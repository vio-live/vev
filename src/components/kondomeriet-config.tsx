import React, { useEffect, useMemo, useRef, useState } from "react";
import { SilkeBox } from "@vev/silke";
import { Vio } from "../../vio-sdk";
import { registerVevComponent, useEditorState, useModel } from "@vev/react";
import VioConfig, { VioApiKeyEditor, VioCampaignSelector, VioSponsorSelector } from "./vio-config";
import { KondomerietDetailHost } from "./kondomeriet-detail";
import { imposeOwnerConnection, isDuplicateConfig, writeConfigRole } from "./kondomeriet-owner";
import { copySettingsProp } from "./kondomeriet-migrate";
import {
  DEFAULT_ENVIRONMENT,
  ensureVioInit,
  resolveActiveSponsorId,
  resolveConfigApiKey,
  sponsorForSlot,
  vioAttribution,
  type VioEnvironment,
} from "./vio-helpers";
import {
  CIRCLEWISE_DEFAULT_A,
  CIRCLEWISE_DEFAULT_I,
  prefetchWantedProducts,
  setCirclewiseSettings,
  setFastChannel,
  type FastChannel,
  FAST_START_MISSING_NOTICE,
} from "./kondomeriet-helpers";
import { ensurePreconnect, preconnectCirclewise, simpleConfigRequest, setKondomerietScope } from "./kondomeriet-perf";
import { startPhoto, startRememberedPhoto } from "./kondomeriet-photo";

/**
 * Kondomeriet Config (SDK) — the Vio Config for Kondomeriet pages: the same
 * connection (API key, sponsor, campaign, environment), page identity,
 * slots, theme and analytics, but NO Vio cart, checkout, product detail or
 * cart button. Payment is always kondomeriet.no's own Vipps Hurtigkasse, so
 * the only overlay it mounts is the Kondomeriet detail drawer.
 *
 * It is the Vio Config itself with `overlaysOverride` — one implementation of
 * the connection flow, not a copy that drifts. Place ONE per page (one Config
 * of either kind: the first one mounted owns the page).
 */

type Props = Record<string, any>;

// The hosts a card needs, as soon as the package loads (before any block mounts).
ensurePreconnect();
// The CDN's photo of the surface this browser saw last, before any block mounts.
startRememberedPhoto();

const CONFIGS_KEY = "__KND_CONFIGS__";
const ALIVE_KEY = "__KND_CONFIGS_ALIVE__";
const CONFIGS_CHANGED = "knd:configs-changed";

/** Ids whose effect ran (mounted for real); a render React threw away never gets here. */
function aliveConfigs(): Set<string> {
  const g = globalThis as any;
  if (!(g[ALIVE_KEY] instanceof Set)) g[ALIVE_KEY] = new Set<string>();
  return g[ALIVE_KEY];
}

/** Drops ids of renders that never mounted, keeping the mount order. */
function pruneConfigs(): string[] {
  const list = mountedConfigs();
  const alive = aliveConfigs();
  for (let i = list.length - 1; i >= 0; i--) if (!alive.has(list[i])) list.splice(i, 1);
  return list;
}

/** The page's mounted Kondomeriet Configs, in mount order: the first one owns the page. */
function mountedConfigs(): string[] {
  const g = globalThis as any;
  if (!Array.isArray(g[CONFIGS_KEY])) g[CONFIGS_KEY] = [];
  return g[CONFIGS_KEY];
}

export default function KondomerietConfig(props: Props) {
  // The config as a simple GET (no preflight) from the first request on: set
  // while rendering, before the Vio Config inside starts the bootstrap.
  simpleConfigRequest();
  // The CDN's photo of the surface (config + products), asked for at once, in
  // parallel with everything (kondomeriet-photo.ts). Production only: it is prod's bucket.
  startPhoto((props.environment || DEFAULT_ENVIRONMENT) === "production" ? resolveConfigApiKey(props.apiKey) : null);
  // This page's connection, for the blocks' cache and photo (kondomeriet-perf.ts).
  setKondomerietScope(resolveConfigApiKey(props.apiKey), props.environment || DEFAULT_ENVIRONMENT);
  // ONE Config per page. A second one (a common editor slip, Alan in #491)
  // must not touch the page: its fast start, Circlewise settings and
  // environment would overwrite the first one's (whichever rendered last
  // won). The first one mounted owns the page; the others render only an
  // editor warning. Ownership is the head of the list of mounted Configs, so
  // deleting the owner, or Vev remounting it, hands the page to the next one
  // without depending on event order.
  const { disabled: inEditor } = useEditorState();
  const idRef = useRef("knd-cfg-" + Math.random().toString(36).slice(2));
  const [owner, setOwner] = useState(() => {
    const list = mountedConfigs();
    if (list.length === 0) list.push(idRef.current); // the first one claims while rendering (fast start before the blocks ask)
    return list[0] === idRef.current;
  });
  useEffect(() => {
    const id = idRef.current;
    aliveConfigs().add(id);
    const list = mountedConfigs();
    if (!list.includes(id)) list.push(id);
    const sync = () => setOwner(pruneConfigs()[0] === id);
    sync();
    window.addEventListener(CONFIGS_CHANGED, sync);
    window.dispatchEvent(new Event(CONFIGS_CHANGED));
    return () => {
      window.removeEventListener(CONFIGS_CHANGED, sync);
      aliveConfigs().delete(id);
      const l = mountedConfigs();
      const i = l.indexOf(id);
      if (i >= 0) l.splice(i, 1);
      window.dispatchEvent(new Event(CONFIGS_CHANGED));
    };
  }, []);
  // In the editor: this Config's role, for its properties panel (another
  // window): a duplicate's panel touches nothing global (kondomeriet-owner.ts).
  const model: any = useModel();
  const modelKey = String(model?.key ?? "");
  useEffect(() => {
    if (!inEditor || !modelKey) return;
    writeConfigRole(modelKey, owner);
    return () => writeConfigRole(modelKey, null);
  }, [inEditor, modelKey, owner]);
  if (!owner) {
    return inEditor ? (
      <div
        style={{
          padding: "10px 12px",
          border: "1px dashed #d93025",
          borderRadius: 8,
          background: "#fff4f3",
          color: "#a50e0e",
          font: "13px/1.4 system-ui, sans-serif",
        }}
      >
        <strong>Duplicate Kondomeriet Config.</strong> This page already has one; this copy is ignored. Delete it.
      </div>
    ) : null;
  }
  return <KondomerietConfigOwner {...props} inEditor={inEditor} modelKey={modelKey} />;
}

function KondomerietConfigOwner(props: Props) {
  // One round trip instead of two: the channel the editor resolved goes in
  // before the blocks ask (this runs while the Config renders), so the
  // products request leaves in parallel with the bootstrap. Only for the
  // environment it was resolved in.
  const env = props.environment || DEFAULT_ENVIRONMENT;
  const fs = props.fastStart as FastChannel | undefined;
  useMemo(() => {
    setFastChannel(fs && fs.environment === env ? fs : null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fs?.endpoint, fs?.apiKey, fs?.sponsorId, fs?.campaignId, fs?.environment, env]);
  // Circlewise on by default for every Kondomeriet block (its a / i here, in
  // the advanced fields), set while rendering like the fast start.
  const cwOn = props.circlewiseEnabled !== false;
  useMemo(() => {
    setCirclewiseSettings({ enabled: cwOn, a: props.circlewiseA, i: props.circlewiseI });
  }, [cwOn, props.circlewiseA, props.circlewiseI]);
  useEffect(() => {
    if (cwOn) preconnectCirclewise();
  }, [cwOn]);
  // In the editor, the owner imposes its key and environment on the canvas
  // and records them for the panel — again whenever the page's Configs change
  // (a duplicate added or deleted), even if they did not change.
  const ownKey = resolveConfigApiKey(props.apiKey);
  useEffect(() => {
    if (!props.inEditor || !ownKey) return;
    const impose = () => imposeOwnerConnection(String(props.modelKey ?? ""), ownKey, env);
    impose();
    window.addEventListener(CONFIGS_CHANGED, impose);
    return () => window.removeEventListener(CONFIGS_CHANGED, impose);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [props.inEditor, ownKey, env, props.modelKey]);
  useEffect(() => {
    if (fs && fs.environment === env) prefetchWantedProducts(Number(fs.sponsorId), fs.campaignId ?? null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fs?.apiKey, env]);
  // The page's head start: when the sponsor is known (the Config's bootstrap
  // announces it), one request for every product the page's blocks show —
  // the blocks' own requests then find it in flight.
  useEffect(() => {
    const onSponsor = (e: Event) => {
      const id = Number((e as CustomEvent).detail);
      if (!(id > 0)) return;
      prefetchWantedProducts(id, vioAttribution(null, id).campaignId ?? null);
    };
    window.addEventListener("vio:sponsor-changed", onSponsor);
    return () => window.removeEventListener("vio:sponsor-changed", onSponsor);
  }, []);
  const { inEditor, modelKey: _modelKey, ...configProps } = props;
  return (
    <>
      {inEditor && env !== "production" ? (
        <div
          style={{
            padding: "8px 12px",
            marginBottom: 8,
            border: "1px dashed #b06000",
            borderRadius: 8,
            background: "#fff8e1",
            color: "#7a4100",
            font: "13px/1.4 system-ui, sans-serif",
          }}
        >
          Environment is <strong>{env}</strong>: Kondomeriet's products and campaign only exist in <strong>Production</strong>.
        </div>
      ) : null}
      {inEditor && !(fs && fs.environment === env && fs.apiKey) ? (
        <div
          style={{
            padding: "8px 12px",
            marginBottom: 8,
            border: "1px dashed #b06000",
            borderRadius: 8,
            background: "#fff8e1",
            color: "#7a4100",
            font: "13px/1.4 system-ui, sans-serif",
          }}
        >
          {FAST_START_MISSING_NOTICE}
        </div>
      ) : null}
      <VioConfig {...configProps} analytics dataLayer={false} cartButton="never" overlaysOverride={<KondomerietDetailHost />} />
    </>
  );
}

/**
 * Properties-panel field that keeps `fastStart` up to date: with the page's
 * key connected (in this window, like the sponsor selector), the GraphQL
 * endpoint and the channel key of the page's sponsor for its campaign — what
 * the published page needs to ask for its products before its bootstrap
 * answers. Written only when it changed (or is a day old). The key is the
 * channel's public commerce key, the one the bootstrap hands every reader.
 */
export function KondomerietFastStartField({
  value,
  onChange,
  context,
}: {
  value?: FastChannel;
  onChange: (v: FastChannel | null) => void;
  context?: { key?: string; value?: { apiKey?: string; environment?: VioEnvironment; sponsorId?: number; campaignId?: number } };
}) {
  const v = context?.value;
  const key = resolveConfigApiKey(v?.apiKey);
  const env = v?.environment || DEFAULT_ENVIRONMENT;
  // A duplicate Config's panel connects nothing in this window (kondomeriet-owner.ts).
  const duplicate = isDuplicateConfig(context?.key);
  const [state, setState] = useState<"idle" | "working" | "ready" | "failed">(value?.apiKey ? "ready" : "idle");
  useEffect(() => {
    if (!key || duplicate) return;
    let cancelled = false;
    setState("working");
    (async () => {
      simpleConfigRequest();
      ensureVioInit(key, env);
      await Vio.bootstrap();
      const sid = sponsorForSlot(null, await resolveActiveSponsorId(v?.sponsorId));
      if (sid == null) throw new Error("no sponsor");
      const campaignId = vioAttribution(null, sid).campaignId ?? null;
      const sponsor = (Vio as any).sponsorCommerce?.(sid, campaignId != null ? { campaignId } : {});
      const apiKey = sponsor?.commerce?.apiKey;
      const endpoint = (Vio as any).config?.graphQLBase;
      if (typeof apiKey !== "string" || !apiKey || typeof endpoint !== "string") throw new Error("no channel");
      const next: FastChannel = { endpoint, apiKey, sponsorId: sid, campaignId, environment: env, at: Date.now() };
      if (cancelled) return;
      const same =
        value &&
        value.endpoint === next.endpoint &&
        value.apiKey === next.apiKey &&
        Number(value.sponsorId) === next.sponsorId &&
        (value.campaignId ?? null) === next.campaignId &&
        value.environment === next.environment &&
        Date.now() - Number(value.at ?? 0) < 24 * 3600 * 1000;
      if (!same) onChange(next);
      setState("ready");
    })().catch(() => !cancelled && setState("failed"));
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, env, v?.sponsorId, v?.campaignId, duplicate]);
  if (duplicate) {
    return (
      <SilkeBox style={{ fontSize: 11, lineHeight: 1.4, padding: "2px 0", color: "#a50e0e" }}>
        This Config is a duplicate — delete it. Its settings are ignored.
      </SilkeBox>
    );
  }
  return (
    <SilkeBox style={{ fontSize: 11, opacity: 0.7, lineHeight: 1.4, padding: "2px 0" }}>
      {state === "ready" && value?.apiKey
        ? `Fast start ready: products load in parallel with the connection (sponsor #${value.sponsorId}${value.campaignId ? `, campaign #${value.campaignId}` : ""}).`
        : state === "working"
          ? "Preparing fast start…"
          : state === "failed"
            ? "Fast start unavailable — the page still loads, one step slower."
            : "Connect the API key for fast start."}
    </SilkeBox>
  );
}

/**
 * The API key field of the Kondomeriet Config: Vio Config's own, except that
 * a duplicate Config's panel saves nothing (no key or environment persisted,
 * no SDK init in this window), and the owner's Save imposes its key and
 * environment on this window every time, even unchanged.
 */
export function KondomerietApiKeyEditor({
  value,
  onChange,
  context,
}: {
  value?: string;
  onChange: (v: string) => void;
  context?: { key?: string; value?: { environment?: VioEnvironment } };
}) {
  if (isDuplicateConfig(context?.key)) {
    return (
      <SilkeBox style={{ fontSize: 12, lineHeight: 1.4, padding: "4px 0", color: "#a50e0e" }}>
        This Config is a duplicate — delete it. Nothing here is saved.
      </SilkeBox>
    );
  }
  return (
    <VioApiKeyEditor
      value={value}
      onChange={(next: string) => {
        onChange(next);
        if (next) imposeOwnerConnection(String(context?.key ?? ""), next, context?.value?.environment || DEFAULT_ENVIRONMENT);
      }}
    />
  );
}

registerVevComponent(KondomerietConfig, {
  name: "Kondomeriet Config (old)",
  size: { width: 320, height: "auto" },
  props: [
    copySettingsProp("config"),
    { name: "apiKey", title: "Vio API Key", type: "string", initialValue: "", component: KondomerietApiKeyEditor as any },
    { name: "sponsorId", title: "Active Sponsor", type: "number", component: VioSponsorSelector as any },
    { name: "campaignId", title: "Campaign", type: "number", component: VioCampaignSelector as any },
    {
      name: "fastStart",
      title: "Fast start",
      type: "object",
      component: KondomerietFastStartField as any,
      fields: [
        { name: "endpoint", type: "string" },
        { name: "apiKey", type: "string" },
        { name: "sponsorId", type: "number" },
        { name: "campaignId", type: "number" },
        { name: "environment", type: "string" },
        { name: "at", type: "number" },
      ],
    },
    {
      name: "environment",
      title: "Environment",
      type: "select",
      // Kondomeriet lives only in production (a new Config used to start on staging).
      initialValue: "production",
      options: {
        display: "dropdown",
        items: [
          { value: "development", label: "Development" },
          { value: "staging", label: "Staging" },
          { value: "production", label: "Production" },
        ],
      },
    } as any,
    // Theme — the same fields as Vio Config's; blank = the default look.
    { name: "themeColorAccent", title: "Theme · Accent color", type: "string", initialValue: "" },
    { name: "themeColorText", title: "Theme · Text color", type: "string", initialValue: "" },
    { name: "themeColorTextSecondary", title: "Theme · Secondary text", type: "string", initialValue: "" },
    { name: "themeColorSurface", title: "Theme · Background", type: "string", initialValue: "" },
    { name: "themeColorSurfaceMuted", title: "Theme · Muted background", type: "string", initialValue: "" },
    { name: "themeColorBorder", title: "Theme · Border color", type: "string", initialValue: "" },
    { name: "themeFontSerif", title: "Theme · Heading font", type: "string", initialValue: "" },
    { name: "themeFontSans", title: "Theme · Body font", type: "string", initialValue: "" },
    {
      name: "themeCorners",
      title: "Theme · Corners",
      type: "select",
      initialValue: "default",
      options: {
        display: "dropdown",
        items: [
          { value: "default", label: "Default" },
          { value: "sharp", label: "Sharp" },
          { value: "rounded", label: "Rounded" },
        ],
      },
    },
    { name: "sendToVio", title: "Send to Vio Analytics", type: "boolean", initialValue: true },
    { name: "analyticsDebug", title: "Analytics debug + inspector", type: "boolean", initialValue: false },
    // Advanced — Circlewise (TargetCircle): every «Kjøp med Vipps» goes through
    // its tracker to the same bridge and Hurtigkasse, so their side registers it.
    { name: "circlewiseEnabled", title: "Advanced · Circlewise tracking", type: "boolean", initialValue: true },
    {
      name: "circlewiseA",
      title: "Advanced · Circlewise a",
      type: "string",
      initialValue: CIRCLEWISE_DEFAULT_A,
      hidden: (ctx: any) => ctx?.value?.circlewiseEnabled === false,
    },
    {
      name: "circlewiseI",
      title: "Advanced · Circlewise i",
      type: "string",
      initialValue: CIRCLEWISE_DEFAULT_I,
      hidden: (ctx: any) => ctx?.value?.circlewiseEnabled === false,
    },
  ],
});
