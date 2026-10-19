import { useEffect, useState } from "react";
import { useModel, usePages, useRoute } from "@vev/react";
import { Vio } from "../../vio-sdk";

/**
 * Shared helpers for the Vio Vev components: SDK init, catalog listing, product
 * fetching, and small events. Every block/addon is self-sufficient (Vev mounts
 * components in no guaranteed order), so each one can boot the core on its own.
 * The commerce key stays dynamic — resolved via Vio.bootstrap() per sponsor.
 */

// Flip to true to see [Vio] diagnostics in the console.
const DEBUG = false;

/** UI-facing label — the SDK's own Environment type says "testing", not
 * "staging" (parity with the iOS SDK's naming). apiBase/graphQLBase per
 * environment are NOT duplicated here — the SDK owns that map
 * (`configuration.ts: DEFAULT_URLS`); we only pass `environment` to
 * `Vio.init()` and let it resolve the URLs. Single source of truth. */
export type VioEnvironment = "development" | "staging" | "production";
export const DEFAULT_ENVIRONMENT: VioEnvironment = "staging";

/** Panel "Save" persists the host API key here (per browser). */
export const VIO_API_KEY_STORAGE = "vio.apiKey";

let lastInitKey: string | null = null;
let lastInitEnv: string | null = null;
let lastInitCampaign: number | null = null;

export const VIO_ENVIRONMENT_STORAGE = "vio.environment";

export function getPersistedEnvironment(): VioEnvironment | null {
  if (typeof localStorage === "undefined") return null;
  try {
    const env = localStorage.getItem(VIO_ENVIRONMENT_STORAGE);
    return (env as VioEnvironment) || null;
  } catch {
    return null;
  }
}

export function persistEnvironment(env: VioEnvironment): void {
  if (typeof localStorage === "undefined") return;
  try {
    localStorage.setItem(VIO_ENVIRONMENT_STORAGE, env);
  } catch {
    /* noop */
  }
}

export function setRuntimeEnvironment(env: VioEnvironment): void {
  (globalThis as { __VIO_ENVIRONMENT__?: VioEnvironment }).__VIO_ENVIRONMENT__ = env;
}

export function resolveEnvironment(propEnv?: VioEnvironment): VioEnvironment {
  const runtime = (globalThis as { __VIO_ENVIRONMENT__?: VioEnvironment }).__VIO_ENVIRONMENT__;
  return propEnv || runtime || getPersistedEnvironment() || DEFAULT_ENVIRONMENT;
}

export function getPersistedApiKey(): string | null {
  if (typeof localStorage === "undefined") return null;
  try {
    return localStorage.getItem(VIO_API_KEY_STORAGE);
  } catch {
    return null;
  }
}

export function persistApiKey(key: string): void {
  try {
    localStorage.setItem(VIO_API_KEY_STORAGE, key.trim());
  } catch {
    /* noop */
  }
}

export function clearPersistedApiKey(): void {
  try {
    localStorage.removeItem(VIO_API_KEY_STORAGE);
  } catch {
    /* noop */
  }
}

/** Host API key precedence for the blocks and the panel: runtime (what Vio
 * Config connected with) → panel save → Vev prop.
 * No default — a page must have its own key pasted before it can connect. */
export function resolveApiKey(propKey?: string): string {
  const runtime = (globalThis as { __VIO_API_KEY__?: string }).__VIO_API_KEY__;
  return runtime || getPersistedApiKey() || propKey || "";
}

/**
 * The key Vio Config itself connects with: the page's own (its prop), else
 * the one saved from the panel in this browser. Not the runtime key: Vio
 * Config writes that one on connect, and reading it back meant a new key in
 * the prop never reached `connect()` — the canvas kept the previous key (and
 * Disconnect could not disconnect) until the page was reloaded, since the
 * panel that writes the prop lives in another window than the canvas.
 */
export function resolveConfigApiKey(propKey?: string): string {
  return (propKey ?? "").trim() || getPersistedApiKey() || "";
}

export function setRuntimeApiKey(key: string): void {
  (globalThis as { __VIO_API_KEY__?: string }).__VIO_API_KEY__ = key;
}

export const VIO_SPONSOR_ID_STORAGE = "vio.sponsorId";
/** The connected key's sponsors, written by Vio Config for the "Active Sponsor" selector. */
export const VIO_SPONSORS_STORAGE = "vio.sponsors";
/** Fingerprint of the key + environment this browser last connected with: how
 * Vio Config tells a new key from the same one, across visits too. */
export const VIO_CONNECTION_STORAGE = "vio.connection";

// ---- The page's campaign (ADR-0034, amendment 3) ------------------------------
//
// The editor chooses, in Vio Config, which of the surface's campaigns the page
// belongs to. It goes to `Vio.init({ campaignId })`: the SDK (0.24.0) applies it
// wherever a slot has no assignment from the dashboard — assignment > page
// campaign > default — in `campaignForSlot`, `attribution` and the manifest the
// page declares. Vev persists it like the sponsor: the Config sets it at runtime
// for this window and in localStorage for the properties panel (another
// window), and writes the key's campaign list for the "Campaign" selector.

/** The page's campaign, persisted by Vio Config (per browser, like the sponsor). */
export const VIO_CAMPAIGN_ID_STORAGE = "vio.campaignId";
/** The connected key's campaigns, written by Vio Config for the "Campaign" selector. */
export const VIO_CAMPAIGNS_STORAGE = "vio.campaigns";

export type CampaignListItem = { id: number; name: string; status: string; isDefault: boolean };

function toCampaignId(value: unknown): number | null {
  if (value == null || value === "") return null;
  const n = Number(value);
  return Number.isInteger(n) && n > 0 ? n : null;
}

/** Pure. The campaigns of a `/v2/mobile/config` answer for the selector.
 * `availableCampaigns[]` (campaigns micro, ADR-0034 amendment 4): every
 * campaign of the surface that has not ended, with its `status` — the editor
 * may put a page under a paused or scheduled one. `campaigns[]`: the active
 * ones (an older micro lists only these). Active ones first, the backend's
 * order otherwise. A campaign is the default only when the backend says so
 * (`isDefault`): the answer's `campaign` is the one the key serves NOW — the
 * default while it is active, else the most recently started active one
 * (ADR-0027, point 2) — so its id must not be read as "the default". */
export function campaignListFromBootstrap(boot: unknown): CampaignListItem[] {
  const b = (boot ?? {}) as { campaign?: any; campaigns?: any[]; availableCampaigns?: any[] };
  const list: CampaignListItem[] = [];
  const add = (c: any, status: string) => {
    const id = toCampaignId(c?.id);
    if (id == null || list.some((x) => x.id === id)) return;
    list.push({ id, name: String(c?.name ?? `Campaign ${id}`), status, isDefault: c?.isDefault === true });
  };
  for (const c of Array.isArray(b.availableCampaigns) ? b.availableCampaigns : []) add(c, String(c?.status ?? ""));
  for (const c of Array.isArray(b.campaigns) ? b.campaigns : []) add(c, String(c?.status ?? ""));
  if (b.campaign && typeof b.campaign === "object") add(b.campaign, "active");
  return [...list.filter((c) => c.status === "active"), ...list.filter((c) => c.status !== "active")];
}

export function readPersistedCampaigns(): CampaignListItem[] {
  if (typeof localStorage === "undefined") return [];
  try {
    const raw = localStorage.getItem(VIO_CAMPAIGNS_STORAGE);
    const list = raw ? JSON.parse(raw) : [];
    if (!Array.isArray(list)) return [];
    return list
      .filter((c: any) => c && typeof c === "object" && toCampaignId(c.id) != null)
      .map((c: any) => ({
        id: Number(c.id),
        name: typeof c.name === "string" && c.name ? c.name : `Campaign ${Number(c.id)}`,
        status: typeof c.status === "string" ? c.status : "",
        isDefault: c.isDefault === true,
      }));
  } catch {
    return [];
  }
}

/** The SDK's own rule for a usable campaign (`activeCampaignEntry`): listed and active. */
export function isActiveCampaign(c: CampaignListItem | undefined | null): boolean {
  return !!c && c.status === "active";
}

export type PageCampaignVerdict = {
  /** The campaign the page runs under: 0 = the default. */
  effective: number;
  entry?: CampaignListItem;
  /** `default`: nothing chosen (or the default itself); `unknown`: not one of
   *  this key's; `inactive`: listed but paused / scheduled (`effective` kept)
   *  or ended (`effective: 0`); `ok`: listed and active. */
  reason: "default" | "unknown" | "inactive" | "ok";
};

/** Pure. What a saved `campaignId` means against a key's campaign list: a
 * listed campaign that has not ended counts — paused or scheduled too (the
 * page is prepared before the window opens; the SDK shows it only while it
 * is active, so `reason` says `inactive` with `effective` still set); an
 * ended one is `inactive` with `effective: 0`; the default campaign's own id
 * is the same as choosing none. */
export function validatePageCampaign(list: readonly CampaignListItem[], wanted: unknown): PageCampaignVerdict {
  const id = toCampaignId(wanted);
  if (id == null) return { effective: 0, reason: "default" };
  const entry = list.find((c) => c.id === id);
  if (entry?.isDefault) return { effective: 0, entry, reason: "default" };
  if (!entry) return { effective: 0, reason: "unknown" };
  if (entry.status === "ended") return { effective: 0, entry, reason: "inactive" };
  return { effective: id, entry, reason: isActiveCampaign(entry) ? "ok" : "inactive" };
}

/**
 * Before the first init of a connect: does the list this browser kept from a
 * previous connect of THIS key say the saved campaign is usable? `true` /
 * `false` when that list is current (same connection fingerprint), `undefined`
 * when there is none — then the connect bootstraps once without the campaign
 * and validates against the fresh list.
 */
export function persistedCampaignValidity(key: string, environment: string, wanted: number): boolean | undefined {
  if (!(wanted > 0)) return false;
  if (getStoredConnection() !== connectionFingerprint(key, environment)) return undefined;
  if (typeof localStorage === "undefined" || localStorage.getItem(VIO_CAMPAIGNS_STORAGE) == null) return undefined;
  return validatePageCampaign(readPersistedCampaigns(), wanted).effective === wanted;
}

/** True when the vendored SDK knows about the page's campaign (0.24.0). */
export function sdkSupportsPageCampaign(): boolean {
  return sdkHas("pageCampaign");
}

export function getPersistedCampaignId(): number | null {
  if (typeof localStorage === "undefined") return null;
  try {
    return toCampaignId(localStorage.getItem(VIO_CAMPAIGN_ID_STORAGE));
  } catch {
    return null;
  }
}

/** What Vio Config set for this window: `null` = nothing said yet, `0` = the
 * default campaign (explicitly none), else a campaign id. */
function runtimeCampaignId(): number | null {
  const v = (globalThis as { __VIO_CAMPAIGN_ID__?: unknown }).__VIO_CAMPAIGN_ID__;
  return typeof v === "number" && Number.isFinite(v) ? v : null;
}

export function setRuntimeCampaignId(id: number | null): void {
  (globalThis as { __VIO_CAMPAIGN_ID__?: number | null }).__VIO_CAMPAIGN_ID__ = id;
}

/** The page's campaign for `Vio.init`: what Vio Config set in this window
 * (0 = none) → what it persisted, for the properties panel (another window,
 * no Config). Null for the default campaign. The Config sets the runtime value
 * before it inits, so its prop never has to come through here. */
export function resolvePageCampaignId(): number | null {
  const runtime = runtimeCampaignId();
  if (runtime != null) return runtime > 0 ? runtime : null;
  return getPersistedCampaignId();
}

/**
 * Vio Config announces the page's campaign (0 / null = the default): runtime,
 * localStorage and `vio:campaign-changed`, so every block re-resolves its
 * sponsor against it and the picker lists that campaign's catalog.
 */
export function announcePageCampaign(id: number | null, { persist }: { persist: boolean }): void {
  const value = toCampaignId(id) ?? 0;
  const changed = runtimeCampaignId() !== value;
  setRuntimeCampaignId(value);
  // localStorage only from the editor: it is how the properties panel (another
  // window) learns the page's campaign; a visitor's browser keeps nothing.
  if (persist) writeStorage(VIO_CAMPAIGN_ID_STORAGE, value > 0 ? String(value) : null);
  if (!changed) return;
  resetCatalogCache();
  if (typeof window !== "undefined") {
    window.dispatchEvent(new CustomEvent("vio:campaign-changed", { detail: value }));
  }
}

/**
 * B1: the properties panel is another window with no Config. It learns a new
 * page campaign through the `storage` event on `vio.campaignId` and re-inits
 * its own SDK right away (`ensureVioInit` re-inits only when the campaign
 * really changed), so the picker and the Vipps check follow the choice.
 * Installed once per window, from the first `ensureVioInit`.
 */
let campaignStorageSyncInstalled = false;
function installCampaignStorageSync(): void {
  if (campaignStorageSyncInstalled || typeof window === "undefined" || typeof window.addEventListener !== "function") return;
  campaignStorageSyncInstalled = true;
  window.addEventListener("storage", (e: StorageEvent) => {
    if (e.key !== null && e.key !== VIO_CAMPAIGN_ID_STORAGE) return;
    if (!Vio.isInitialized || !resolveApiKey()) return;
    try {
      ensureVioInit();
    } catch {
      /* no key yet in this window */
    }
    resetCatalogCache();
    resetVippsOfferCache();
  });
}

export function getPersistedSponsorId(): number | null {
  if (typeof localStorage === "undefined") return null;
  try {
    const v = localStorage.getItem(VIO_SPONSOR_ID_STORAGE);
    return v ? Number(v) : null;
  } catch {
    return null;
  }
}

export function persistSponsorId(id: number): void {
  if (typeof localStorage === "undefined") return;
  try {
    localStorage.setItem(VIO_SPONSOR_ID_STORAGE, String(id));
  } catch {
    /* noop */
  }
}

// ---- Sponsor resolution ----------------------------------------------------
//
// A sponsor id only means something inside the configuration of the key that
// is connected (`/v2/mobile/config`: a primary sponsor and its secondaries),
// and the SDK only resolves a sponsor that configuration names
// (`Vio.commerceFor`, the cart, the payment methods). Pages built on
// vio-backend keep its ids (4, 5) in the Config's prop, in localStorage and
// in every product picked with the picker; asked with the Commerce key they
// ended in "Sponsor 5 not found in bootstrap" and a 500 from
// getAvailablePaymentMethods (QA, 2026-10-14). So every sponsor a block,
// the picker, the cart or the checkout hands to Commerce goes through
// `resolveSponsorId`, and none is ever made up.

/** The sponsors a key's configuration knows. `ids`: the default campaign's
 * (its primary and secondaries — what the "Active Sponsor" selector offers);
 * `knownIds`: those plus the primary and secondaries of every entry of
 * `campaigns[]` — every sponsor the SDK resolves (`Vio.commerceFor`, the
 * cart, the payment methods): a campaign assigned to a slot may bring one
 * that is not in the default campaign (ADR-0034). */
export type SponsorConfig = { ids: number[]; primaryId: number; knownIds: number[] };
export type SponsorListItem = { id: number; name: string; isPrimary: boolean };

function toSponsorId(value: unknown): number | null {
  if (value == null || value === "") return null;
  const n = Number(value);
  return Number.isInteger(n) && n > 0 ? n : null;
}

/** Pure. The sponsors of a `/v2/mobile/config` answer, primary first; empty
 * when it names no primary sponsor. */
export function sponsorListFromBootstrap(boot: unknown): SponsorListItem[] {
  const b = (boot ?? {}) as { primarySponsor?: any; secondarySponsors?: any[] };
  const primaryId = toSponsorId(b.primarySponsor?.id);
  if (primaryId == null) return [];
  const list: SponsorListItem[] = [
    { id: primaryId, name: String(b.primarySponsor?.name ?? `Sponsor ${primaryId}`), isPrimary: true },
  ];
  for (const s of Array.isArray(b.secondarySponsors) ? b.secondarySponsors : []) {
    const id = toSponsorId(s?.id);
    if (id == null || list.some((x) => x.id === id)) continue;
    list.push({ id, name: String(s?.name ?? `Sponsor ${id}`), isPrimary: false });
  }
  return list;
}

/** Pure. Every sponsor id a `/v2/mobile/config` answer names: the default
 * campaign's, then the primary and secondaries of each `campaigns[]` entry
 * (the same set the SDK's `findSponsor` accepts). Deduped, in that order. */
export function knownSponsorIdsFromBootstrap(boot: unknown): number[] {
  const ids = sponsorListFromBootstrap(boot).map((s) => s.id);
  const b = (boot ?? {}) as { campaigns?: any[] };
  for (const c of Array.isArray(b.campaigns) ? b.campaigns : []) {
    if (!c || typeof c !== "object") continue;
    for (const s of [c.primarySponsor, ...(Array.isArray(c.secondarySponsors) ? c.secondarySponsors : [])]) {
      const id = toSponsorId(s?.id);
      if (id != null && !ids.includes(id)) ids.push(id);
    }
  }
  return ids;
}

/** Pure. The configuration of a `/v2/mobile/config` answer, or null. */
export function sponsorConfigFromBootstrap(boot: unknown): SponsorConfig | null {
  const list = sponsorListFromBootstrap(boot);
  if (!list.length) return null;
  return { ids: list.map((s) => s.id), primaryId: list[0].id, knownIds: knownSponsorIdsFromBootstrap(boot) };
}

/**
 * THE sponsor rule (pure). `saved` is one candidate or several in order of
 * preference — the Config's prop, the runtime or persisted active sponsor,
 * the sponsor a product was picked under, a cart's sponsor. The first one the
 * key's configuration knows wins; else its primary sponsor. Without a
 * configuration (`primaryId` null: no bootstrap yet) there is no sponsor —
 * the caller waits for the bootstrap rather than inventing one.
 */
export function resolveSponsorId(
  saved: unknown,
  sponsorIds: readonly number[],
  primaryId: number | null | undefined
): number | null {
  const primary = toSponsorId(primaryId);
  if (primary == null) return null;
  const known = new Set(sponsorIds.map(Number));
  known.add(primary);
  for (const candidate of Array.isArray(saved) ? saved : [saved]) {
    const id = toSponsorId(candidate);
    if (id != null && known.has(id)) return id;
  }
  return primary;
}

function runtimeSponsorId(): number | null {
  return toSponsorId((globalThis as { __VIO_SPONSOR_ID__?: unknown }).__VIO_SPONSOR_ID__);
}

/** This window's configuration: the bootstrap the SDK holds, which is what
 * `Vio.commerceFor()` and the cart resolve a sponsor against — only while the
 * SDK runs with the key this window resolves to now. After a Disconnect the
 * SDK still holds the previous key's answer (it cannot be un-initialised), and
 * that answer must not keep feeding sponsors. */
export function currentSponsorConfig(): SponsorConfig | null {
  try {
    if (!Vio.isInitialized || Vio.config?.apiKey !== resolveApiKey()) return null;
  } catch {
    return null;
  }
  return sponsorConfigFromBootstrap(Vio.bootstrapCache);
}

/**
 * The page's active sponsor: what Vio Config set (this window's runtime
 * value, else what it persisted — that is how the properties panel, another
 * window, learns it), else `preferred` (the sponsor a product was picked
 * under), each one only if the connected key knows it; the key's primary
 * otherwise. Null while this window has no configuration.
 */
export function getActiveSponsorId(preferred?: unknown): number | null {
  const config = currentSponsorConfig();
  if (!config) return null;
  return resolveSponsorId(
    [runtimeSponsorId(), getPersistedSponsorId(), preferred],
    config.ids,
    config.primaryId
  );
}

/**
 * The sponsor a Commerce call for `requested` uses: `requested` itself when
 * the connected key knows it — in any of its campaigns (`knownIds`): a cart's
 * sponsor, an addon's picked product, the sponsor of a campaign assigned to
 * a slot — else the page's active sponsor, else the primary. Null while this
 * window has no configuration.
 */
export function sponsorForCommerce(requested?: unknown): number | null {
  const config = currentSponsorConfig();
  if (!config) return null;
  return resolveSponsorId(
    [requested, runtimeSponsorId(), getPersistedSponsorId()],
    config.knownIds,
    config.primaryId
  );
}

/**
 * Init + bootstrap this window with the page's key. False when it cannot (no
 * key, the key is wrong, the API is down).
 *
 * On the canvas Vio Config sets the runtime key as soon as it starts
 * connecting, so a block mounted before it waits a moment for that key
 * instead of booting the SDK with the one saved in this browser (which can be
 * another page's): two inits with different keys race in the SDK, and the
 * slower answer would end up as its configuration. The properties panel has
 * no Config — after the wait it uses the saved key, as before.
 */
async function bootstrapWindow(): Promise<boolean> {
  for (let attempt = 0; attempt < 7; attempt++) {
    // Even with a configuration: the page's campaign may have changed (the
    // panel window learns it from storage) — `ensureVioInit` then re-inits
    // and the bootstrap below answers for the new one.
    if (resolveApiKey()) {
      try {
        ensureVioInit();
      } catch {
        /* no usable key: the retries below handle it */
      }
    }
    if (currentSponsorConfig()) return true;
    const runtimeKey = (globalThis as { __VIO_API_KEY__?: string }).__VIO_API_KEY__;
    if (runtimeKey || attempt >= 2) {
      try {
        ensureVioInit();
        await Vio.bootstrap();
        return true;
      } catch (err) {
        if (DEBUG) console.warn(`[Vio] bootstrap retry ${attempt}`, (err as any)?.message ?? err);
      }
    }
    await new Promise((r) => setTimeout(r, 400));
  }
  return false;
}

/** `getActiveSponsorId`, after waiting for this window's bootstrap. */
export async function resolveActiveSponsorId(preferred?: unknown): Promise<number | null> {
  return (await bootstrapWindow()) ? getActiveSponsorId(preferred) : null;
}

/** `sponsorForCommerce`, after waiting for this window's bootstrap. */
export async function resolveSponsorForCommerce(requested?: unknown): Promise<number | null> {
  return (await bootstrapWindow()) ? sponsorForCommerce(requested) : null;
}

/**
 * Vio Config announces the active sponsor: runtime, localStorage and
 * `vio:sponsor-changed` for every block. `null` says "no sponsor yet" — while
 * a new key boots, or when it failed — and the blocks wait (the event's
 * detail is then 0).
 */
export function announceActiveSponsor(id: number | null): void {
  (globalThis as { __VIO_SPONSOR_ID__?: number | null }).__VIO_SPONSOR_ID__ = id;
  if (id != null) persistSponsorId(id);
  resetCatalogCache();
  if (typeof window !== "undefined") {
    window.dispatchEvent(new CustomEvent("vio:sponsor-changed", { detail: id ?? 0 }));
  }
}

/**
 * The active sponsor, live. Vio Config announces each change on
 * `vio:sponsor-changed`, and a block that reads the sponsor here re-renders
 * for the new one instead of keeping the one it mounted with — which is how
 * the single card went on showing a product the new sponsor's channel does
 * not carry (QA, 2026-10-08). Vev mounts blocks in no fixed order: a block
 * mounted before the Config bootstraps on its own and resolves against that
 * configuration, then follows the Config's announcements. Null means "no
 * sponsor yet": the block waits instead of asking Commerce with a made-up id.
 */
export function useActiveSponsorId(preferred?: number | null, slot?: string | null): number | null {
  const [sponsorId, setSponsorId] = useState<number | null>(() => getActiveSponsorId(preferred));
  const [, setCampaignTick] = useState(0);
  useEffect(() => {
    let alive = true;
    // The Config may have spoken between this block's render and its effects.
    const now = getActiveSponsorId(preferred);
    setSponsorId(now);
    if (now == null) {
      resolveActiveSponsorId(preferred).then((id) => {
        // An announcement that arrived meanwhile wins over this resolution.
        if (alive && id != null) setSponsorId((current) => current ?? id);
      });
    }
    const onChange = (e: Event) => {
      setSponsorId(toSponsorId((e as CustomEvent).detail));
    };
    // The page's campaign changed (Vio Config): the sponsor id may be the
    // same, but what the slot resolves to below is not — re-render.
    const onCampaign = () => setCampaignTick((n) => n + 1);
    window.addEventListener("vio:sponsor-changed", onChange);
    window.addEventListener("vio:campaign-changed", onCampaign);
    return () => {
      alive = false;
      window.removeEventListener("vio:sponsor-changed", onChange);
      window.removeEventListener("vio:campaign-changed", onCampaign);
    };
  }, [preferred]);
  // A block with a slot follows the slot's campaign (ADR-0034). Read against
  // the bootstrap the SDK holds, which is there whenever the page's sponsor is
  // (the Config announces it after bootstrapping), so this re-evaluates with it.
  const { sponsorId: effective, fallback } = resolveSlotSponsor(slot, sponsorId);
  // The one-time warning for a slot whose campaign the block cannot follow
  // goes out from an effect, never from the render.
  const fallbackSponsor = fallback ? fallback.campaignSponsorId : null;
  const fallbackName = fallback ? fallback.campaignName : "";
  useEffect(() => {
    if (fallback && typeof slot === "string" && slot.trim()) {
      warnSlotFallbackOnce(slot.trim(), { campaignName: fallbackName, campaignSponsorId: fallbackSponsor });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [slot, fallbackSponsor, fallbackName]);
  return effective;
}

// ---- Slots (ADR-0027 / ADR-0034) -----------------------------------------------
//
// A slot is a place on a page the dashboard can assign a campaign to, with a
// date window; whatever no slot names shows the surface's default campaign.
// Every Vio block registers itself, with no designer input:
//   - id: the "Slot" field when set (several blocks with the same value are ONE
//     slot), else `${kind}-${instanceKey}` — the block's Vev instance key chain
//     (`model.virtualKey || model.key`, what @vev/react ids the host with): it
//     survives republishing and is distinct per instance of a master component;
//   - display name: the "Slot name" field, else the block's heading (a card:
//     its product's title), else `${Kind} ${n}` by position among the same
//     kind on the page — followed by the page's title, except for a block in a
//     header / footer section or a fixed element, which every page shows. An
//     explicit "Slot" with no name is left unnamed: the server keeps the name
//     the slot already has (another block may have named it).
// The SDK declares the registry (`POST /v2/mobile/components/manifest`, mode
// merge) once per page load after the bootstrap, debounced, and skips a set it
// already declared from this browser in the last 24 h. The editor's canvas is
// a page like any other: a block is declared as soon as it exists on it.
//
// The calls below check that the vendored SDK has this API, on purpose: a
// block must never throw into the editor's canvas, and the bundle and the
// blocks have drifted before — the same rule analytics.ts applies to
// `Vio.analytics`. With an older bundle the blocks run unregistered and
// attributed as before.

export type SlotKind = "card" | "carousel" | "grid" | "open";

const SLOT_KIND_LABEL: Record<SlotKind, string> = {
  card: "Card",
  carousel: "Carousel",
  grid: "Grid",
  open: "Open product",
};

/** The server keeps display names up to 255 characters. */
const SLOT_NAME_MAX_LENGTH = 255;
/** The server keeps slot ids up to 100 characters (the SDK cuts, not drops). */
export const SLOT_ID_MAX_LENGTH = 100;

/** A slot id as the SDK registers it: trimmed, cut at 100, trimmed again. */
export function normalizeSlotId(value: unknown): string {
  if (typeof value !== "string") return "";
  return value.trim().slice(0, SLOT_ID_MAX_LENGTH).trim();
}

/** What `Vio.attribution(slot)` answers: the campaign the place shows, its
 * sponsor, the place and the article. Every event and cart line carries it. */
export type VioAttribution = {
  slot?: string;
  campaignId?: number;
  sponsorId?: number;
  contentId?: string;
  contentTitle?: string;
};

function sdkHas(method: string): boolean {
  try {
    return typeof (Vio as any)?.[method] === "function";
  } catch {
    return false;
  }
}

type SlotState = {
  /** Slots already warned about (`warnSlotFallbackOnce`). */
  warned: Set<string>;
  /** Mount-order ordinals per kind, the fallback of `slotOrdinal`. */
  ordinals: Partial<Record<SlotKind, Map<string, number>>>;
};

/** State shared by every chunk of the package: Vev may bundle each block
 * apart, so module state would be one per chunk — the reason the SDK anchors
 * `Vio` on globalThis too. */
function slotState(): SlotState {
  const g = globalThis as { __VIO_VEV_SLOTS__?: SlotState };
  if (!g.__VIO_VEV_SLOTS__) g.__VIO_VEV_SLOTS__ = { warned: new Set(), ordinals: {} };
  return g.__VIO_VEV_SLOTS__;
}

/**
 * The attribution of a place — `Vio.attribution(slot, { sponsorId })`: the
 * campaign the slot shows now (its open assignment, else the sponsor's active
 * campaign, else the default), the sponsor, and the page's content
 * (`Vio.content()`). The sponsor hint is the block's effective sponsor, so
 * what the cart remembers matches what the events say. Without the helper
 * (an older bundle), only what this side knows: the slot and the sponsor.
 */
export function vioAttribution(slot?: string | null, sponsorId?: number | null): VioAttribution {
  const name = normalizeSlotId(slot) || undefined;
  const sid = toSponsorId(sponsorId) ?? undefined;
  // A slot whose campaign the block could NOT follow (its sponsor is not one
  // of the key's — see resolveSlotSponsor) must not attribute to that
  // campaign: the events then carry the slot by name and the campaign the
  // sponsor rule gives the block's actual sponsor (`attribution(null, { sponsorId })`).
  const campaign = name ? slotAssignedCampaign(name) : null;
  const followed = !campaign || sid == null || toSponsorId(campaign.primarySponsor?.id) === sid;
  if (sdkHas("attribution")) {
    try {
      const hint = sid != null ? { sponsorId: sid } : undefined;
      const out = (Vio as any).attribution(followed ? name ?? null : null, hint) ?? {};
      return name ? { ...out, slot: name } : { ...out };
    } catch {
      /* attribution never breaks a render or a click */
    }
  }
  const out: VioAttribution = {};
  if (name) out.slot = name;
  if (sid != null) out.sponsorId = sid;
  return out;
}

/** The `origin` of the units a block adds to the cart (`CartOrigin` in the
 * SDK: campaign, slot, article) — what `CartLineItem.origins[]` remembers. */
export function cartOrigin(attribution: VioAttribution): { campaignId?: number; slot?: string; contentId?: string } {
  const origin: { campaignId?: number; slot?: string; contentId?: string } = {};
  if (attribution.campaignId != null) origin.campaignId = attribution.campaignId;
  if (attribution.slot) origin.slot = attribution.slot;
  if (attribution.contentId) origin.contentId = attribution.contentId;
  return origin;
}

/**
 * The campaign `slot` shows now because something chose it: its assignment
 * (dashboard or page, open window), else the page's campaign chosen in Vio
 * Config (SDK 0.24.0 applies it as the fallback); else null — the slot shows
 * whatever the key serves (the default campaign, or the most recent active
 * one while the default is paused). `Vio.campaignForSlot` answers that
 * fallback in the last case; the page's "Active Sponsor" is how a Vev page
 * chooses a sponsor within it, so only an assignment or the page's choice
 * override it.
 */
export function slotAssignedCampaign(slot?: string | null): any | null {
  const name = normalizeSlotId(slot);
  // No slot (the picker's catalog, an open without a place): the page's
  // campaign is all there can be.
  if (!name) return pageCampaign();
  if (!sdkHas("campaignForSlot")) return null;
  try {
    // 0.24.0: the slot's assignment, else the page's campaign, else the fallback.
    return nonDefaultCampaign((Vio as any).campaignForSlot(name), name);
  } catch {
    return null;
  }
}

/**
 * The campaign the page belongs to, as the SDK resolves it (`Vio.pageCampaign()`,
 * 0.24.0: the one `Vio.init({ campaignId })` named, when the key has it), or
 * null — none chosen, the default one, or a bundle that predates it.
 */
export function pageCampaign(): any | null {
  if (!sdkHas("pageCampaign")) return null;
  try {
    // Chosen explicitly: never the fallback, even when it is also the
    // campaign the key serves now.
    const campaign = (Vio as any).pageCampaign();
    return campaign && campaign.isDefault !== true ? campaign : null;
  } catch {
    return null;
  }
}

/** `campaign` unless it is the surface's default one, or the campaign the key
 * serves now (`config.campaign`: the fallback of every slot without an
 * assignment) when nothing chose it — neither the page explicitly nor an
 * assignment of `slot` (the entry's `slots[]` lists its open assignments,
 * dashboard or page, for this platform). */
function nonDefaultCampaign(campaign: any, slot?: string | null): any | null {
  if (!campaign || campaign.isDefault === true) return null;
  const headId = Number((Vio as any).bootstrapCache?.campaign?.id);
  if (!Number.isFinite(headId) || Number(campaign.id) !== headId) return campaign;
  if (resolvePageCampaignId() === Number(campaign.id)) return campaign;
  const assigned = !!slot && Array.isArray(campaign.slots) && campaign.slots.some((s: any) => typeof s?.name === "string" && s.name.trim() === slot);
  return assigned ? campaign : null;
}

export type SlotSponsor = {
  sponsorId: number | null;
  /** Set when the slot has a campaign assigned that the block could not follow. */
  fallback?: { campaignName: string; campaignSponsorId: number | null };
};

/**
 * Pure. The sponsor a block with `slot` fetches its products with: the
 * primary sponsor of the campaign assigned to the slot (and open now) when
 * the connected key knows it — in any of its campaigns (`knownIds`); else
 * `pageSponsor`, the page's active sponsor, with `fallback` saying why
 * (ADR-0034 §4). The caller decides where to warn: `useActiveSponsorId` from
 * an effect, `sponsorForSlot` right away (event handlers).
 */
export function resolveSlotSponsor(slot: string | null | undefined, pageSponsor: number | null): SlotSponsor {
  const campaign = slotAssignedCampaign(slot);
  if (!campaign) return { sponsorId: pageSponsor };
  // No configuration in this window (Disconnect; the SDK still holds the old
  // bootstrap): nothing to follow and nothing to warn about.
  const config = currentSponsorConfig();
  if (!config) return { sponsorId: pageSponsor };
  const sid = toSponsorId(campaign.primarySponsor?.id);
  if (sid != null && config.knownIds.includes(sid)) return { sponsorId: sid };
  // The slot's campaign cannot be followed. With a page campaign chosen, the
  // block falls back to ITS primary sponsor (when the key knows it), so the
  // sponsor and the campaign the events get agree — the SDK applies the page
  // campaign only to a sponsor that takes part in it; else the page's sponsor.
  const page = pageCampaign();
  const pagePrimary = page ? toSponsorId(page.primarySponsor?.id) : null;
  const base = pagePrimary != null && config.knownIds.includes(pagePrimary) ? pagePrimary : pageSponsor;
  return {
    sponsorId: base,
    fallback: { campaignName: String(campaign.name ?? campaign.id ?? "?"), campaignSponsorId: sid },
  };
}

function warnSlotFallbackOnce(slot: string, fallback: NonNullable<SlotSponsor["fallback"]>): void {
  const key = `${slot}:${fallback.campaignSponsorId ?? "none"}`;
  const { warned } = slotState();
  if (warned.has(key)) return;
  warned.add(key);
  console.warn(
    `[Vio] slot "${slot}": its campaign "${fallback.campaignName}" has sponsor #${fallback.campaignSponsorId ?? "?"}, which is not one of the connected key's sponsors — using the page's sponsor`
  );
}

/** `resolveSlotSponsor` for event handlers (a click, an open): the warning
 * goes out right there, once per slot. Components use `useActiveSponsorId`. */
export function sponsorForSlot(slot: string | null | undefined, pageSponsor: number | null): number | null {
  const { sponsorId, fallback } = resolveSlotSponsor(slot, pageSponsor);
  if (fallback && typeof slot === "string" && slot.trim()) warnSlotFallbackOnce(slot.trim(), fallback);
  return sponsorId;
}

/**
 * The Vev page this block is on — the article: its key and title, from Vev's
 * own store (the route's page key and the pages list, the same source Vev's
 * page component titles with). `document.title` when the store has no title
 * for it; nothing outside a Vev app.
 */
export function useVevPage(): { key?: string; title?: string } {
  let key: string | undefined;
  let title: string | undefined;
  // Hooks inside a try: the two are always called, in this order, on every
  // render (the catch only swallows a throw from a store that is not there,
  // e.g. a bare mount in a test), so React's hook order never changes.
  try {
    const route: any = useRoute();
    const [pages]: any = usePages();
    key = typeof route?.pageKey === "string" && route.pageKey ? route.pageKey : undefined;
    const page = Array.isArray(pages) ? pages.find((p: any) => p?.key === key) : undefined;
    title = typeof page?.title === "string" && page.title.trim() ? page.title.trim() : undefined;
  } catch {
    /* outside a Vev app: the document is all there is */
  }
  if (!title && typeof document !== "undefined") title = document.title?.trim() || undefined;
  return { key, title };
}

/**
 * The effective slot id of a block — the "Slot" field, else
 * `${kind}-${instanceKey}` ('' only with neither). The key is the INSTANCE
 * KEY CHAIN of the model Vev renders the block with (`useModel()`), the way
 * @vev/react's widget-node ids the host (`model.virtualKey || model.key`):
 * an instance of a master component — a template used by thirty articles —
 * gets its own key per instance, so thirty carousels are thirty slots.
 */
export function useVioSlotId({ slot, kind }: { slot?: string; kind: SlotKind }): string {
  const model: any = useModel();
  const explicit = normalizeSlotId(slot);
  const key =
    typeof model?.virtualKey === "string" && model.virtualKey.trim()
      ? model.virtualKey.trim()
      : typeof model?.key === "string"
        ? model.key.trim()
        : "";
  return explicit || (key ? normalizeSlotId(`${kind}-${key}`) : "");
}

export type VioSlotInput = {
  /** The "Slot" field: an explicit id, shared by every block with the same value. */
  slot?: string;
  /** The "Slot name" field. */
  slotName?: string;
  kind: SlotKind;
  /** The block's own heading (carousel/grid `heading`, else `kicker`; a card: its product's title). */
  title?: string;
  /** False delays the registration (a card until its product is known). Default true. */
  ready?: boolean;
  /** Vev's `hostRef` prop — the block's `<vev>` host: tells a header/footer block apart and gives the ordinal. */
  hostRef?: { current: HTMLElement | null } | null;
};

/**
 * The slot of a Vio block and its ONE registration: `Vio.registerSlot` in an
 * effect, released on unmount, re-registered when the id or the name changes
 * (the designer typing in the panel re-declares — the SDK debounces and
 * dedupes). Works in the editor and on the published page alike. Returns the
 * effective id (`useVioSlotId`).
 */
export function useVioSlot({ slot, slotName, kind, title, ready = true, hostRef }: VioSlotInput): string {
  const id = useVioSlotId({ slot, kind });
  const model: any = useModel();
  const type = typeof model?.type === "string" ? model.type : "";
  const page = useVevPage();
  const explicit = typeof slot === "string" && slot.trim() !== "";
  const name = typeof slotName === "string" ? slotName.trim() : "";
  const own = typeof title === "string" ? title.trim() : "";
  const pageTitle = page.title ?? "";
  useEffect(() => {
    if (!id || !ready || !sdkHas("registerSlot")) return;
    // The name is built here, with the DOM mounted: the host says whether the
    // block is in a header / footer and where it sits among its kind.
    const host = hostRef?.current ?? null;
    const displayName = name
      ? name.slice(0, SLOT_NAME_MAX_LENGTH)
      : explicit
        ? undefined
        : autoSlotDisplayName(kind, id, type, own, pageTitle, host);
    let release: (() => void) | undefined;
    try {
      release = (Vio as any).registerSlot(id, displayName);
    } catch (err) {
      if (DEBUG) console.warn("[Vio] registerSlot failed", err);
      return;
    }
    return () => {
      try {
        release?.();
      } catch {
        /* never break an unmount */
      }
    };
  }, [id, ready, name, explicit, kind, type, own, pageTitle, hostRef]);
  return id;
}

/** `<heading> · <page>`, else `Carousel 2 · <page>`; no page for a block every
 * page shows (header / footer section, fixed element). Capped at 255. */
function autoSlotDisplayName(
  kind: SlotKind,
  id: string,
  type: string,
  own: string,
  pageTitle: string,
  host: HTMLElement | null
): string {
  const base = own || `${SLOT_KIND_LABEL[kind]} ${slotOrdinal(kind, id, type, host)}`;
  const full = pageTitle && !isSharedAcrossPages(host) ? `${base} · ${pageTitle}` : base;
  return full.slice(0, SLOT_NAME_MAX_LENGTH);
}

/** True inside a header / footer section of the page (`<header>` / `<footer>`
 * right under the page's `.__p`) or the fixed layer (`.fixed`) — what Vev
 * renders on every page (see @vev/react's page.js / fixed.js). */
function isSharedAcrossPages(host: HTMLElement | null): boolean {
  try {
    return !!host?.closest(".__p > header, .__p > footer, .fixed");
  } catch {
    return false;
  }
}

/**
 * 1-based position of the block among the same-kind Vio blocks of the page in
 * document order — the hosts carry `__<widget type>` as a class — like the
 * SDK's ordinal for its elements; stable across loads while the layout is. A
 * mount-order counter when the DOM cannot tell (no host, no type).
 */
function slotOrdinal(kind: SlotKind, id: string, type: string, host: HTMLElement | null): number {
  const { ordinals } = slotState();
  const byKind = ordinals[kind] ?? (ordinals[kind] = new Map<string, number>());
  try {
    if (host && type && typeof document !== "undefined") {
      const same = document.querySelectorAll(`vev.__${cssEscape(type)}`);
      const index = Array.prototype.indexOf.call(same, host);
      if (index >= 0) {
        byKind.set(id, index + 1);
        return index + 1;
      }
    }
  } catch {
    /* fall through to the counter */
  }
  const known = byKind.get(id);
  if (known) return known;
  const next = byKind.size + 1;
  byKind.set(id, next);
  return next;
}

function cssEscape(value: string): string {
  const css = (globalThis as { CSS?: { escape?: (s: string) => string } }).CSS;
  if (css && typeof css.escape === "function") return css.escape(value);
  return value.replace(/[^a-zA-Z0-9_-]/g, (c) => `\\${c}`);
}

// ---- Changing the key --------------------------------------------------------

/** FNV-1a of environment + key: enough to tell two keys apart, and the key
 * itself is not copied into one more storage slot. */
export function connectionFingerprint(key: string, environment: string): string {
  const input = `${environment}|${key.trim()}`;
  let hash = 0x811c9dc5;
  for (let i = 0; i < input.length; i++) {
    hash ^= input.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193) >>> 0;
  }
  return hash.toString(16).padStart(8, "0");
}

export function getStoredConnection(): string | null {
  if (typeof localStorage === "undefined") return null;
  try {
    return localStorage.getItem(VIO_CONNECTION_STORAGE);
  } catch {
    return null;
  }
}

export function readPersistedSponsors(): SponsorListItem[] {
  if (typeof localStorage === "undefined") return [];
  try {
    const raw = localStorage.getItem(VIO_SPONSORS_STORAGE);
    const list = raw ? JSON.parse(raw) : [];
    return Array.isArray(list) ? list : [];
  } catch {
    return [];
  }
}

function writeStorage(key: string, value: string | null): void {
  if (typeof localStorage === "undefined") return;
  try {
    if (value == null) localStorage.removeItem(key);
    else localStorage.setItem(key, value);
  } catch {
    /* noop */
  }
}

/**
 * Forget the sponsor this browser was using: the active one (runtime and
 * localStorage), the sponsor list, the catalog and the Vipps answers — and,
 * with `carts`, every cart: a cart lives on the commerce channel of the key it
 * was filled under, and checking it out with another key fails.
 */
export function forgetConnectionState({ carts }: { carts: boolean }): void {
  const g = globalThis as { __VIO_SPONSOR_ID__?: number | null; __VIO_PRIMARY_SPONSOR_ID__?: number | null };
  g.__VIO_SPONSOR_ID__ = null;
  g.__VIO_PRIMARY_SPONSOR_ID__ = null;
  writeStorage(VIO_SPONSOR_ID_STORAGE, null);
  writeStorage(VIO_SPONSORS_STORAGE, null);
  writeStorage(VIO_CAMPAIGNS_STORAGE, null);
  writeStorage(VIO_CAMPAIGN_ID_STORAGE, null);
  resetCatalogCache();
  resetVippsOfferCache();
  if (carts) {
    try {
      Vio.cart?.clearAllCarts?.();
    } catch {
      /* noop */
    }
  }
}

/** Drop the carts (the SDK keeps them per sponsor in `vio.cart.v1`) of every
 * sponsor the connected key does not have. Returns the dropped sponsor ids. */
export function pruneCartsOutside(sponsorIds: readonly number[]): number[] {
  const known = new Set(sponsorIds.map(Number));
  const dropped: number[] = [];
  try {
    const carts: Map<number, unknown> = Vio.cart?.getAllCarts?.() ?? new Map();
    for (const sponsorId of carts.keys()) {
      if (known.has(Number(sponsorId))) continue;
      Vio.cart.clearSponsorCart(sponsorId);
      dropped.push(Number(sponsorId));
    }
  } catch {
    /* noop */
  }
  return dropped;
}

export type AdoptedConnection = {
  config: SponsorConfig;
  sponsors: SponsorListItem[];
  /** The key's campaigns, for the "Campaign" selector (active first). */
  campaigns: CampaignListItem[];
  /** This browser was last connected with another key or environment. */
  keyChanged: boolean;
  /** Sponsors whose cart was dropped because this key does not have them. */
  droppedCarts: number[];
};

/**
 * What Vio Config does with a successful bootstrap of `key`:
 *  - another key (or environment) than the one this browser last connected
 *    with → forget the previous key's sponsor, sponsor list, carts, catalog
 *    and Vipps answers;
 *  - drop the cart of any sponsor this key does not have (a page built on
 *    vio-backend's sponsor ids left "4" and "5" in `vio.cart.v1`);
 *  - remember the sponsors (for the "Active Sponsor" selector) and the
 *    connection.
 * Null when the answer names no primary sponsor: nothing is remembered.
 */
export function adoptConnection(
  boot: unknown,
  key: string,
  environment: string,
  { persistCampaigns = false }: { persistCampaigns?: boolean } = {}
): AdoptedConnection | null {
  const sponsors = sponsorListFromBootstrap(boot);
  const campaigns = campaignListFromBootstrap(boot);
  const config = sponsorConfigFromBootstrap(boot);
  if (!config) return null;
  const fingerprint = connectionFingerprint(key, environment);
  const previous = getStoredConnection();
  // No fingerprint yet = a browser from before this rule: nothing says the key
  // changed, and the carts of unknown sponsors go below anyway.
  const keyChanged = previous != null && previous !== fingerprint;
  if (keyChanged) forgetConnectionState({ carts: true });
  // Any sponsor of any campaign of the key keeps its cart: a slot's campaign
  // may sell with a sponsor the default campaign does not have.
  const droppedCarts = pruneCartsOutside(config.knownIds);
  (globalThis as { __VIO_PRIMARY_SPONSOR_ID__?: number }).__VIO_PRIMARY_SPONSOR_ID__ = config.primaryId;
  writeStorage(VIO_CONNECTION_STORAGE, fingerprint);
  writeStorage(VIO_SPONSORS_STORAGE, JSON.stringify(sponsors));
  // The campaign list is for the editor's properties panel only (W6).
  if (persistCampaigns) writeStorage(VIO_CAMPAIGNS_STORAGE, JSON.stringify(campaigns));
  return { config, sponsors, campaigns, keyChanged, droppedCarts };
}

export type CountryConfig = {
  code: string;
  name: string;
  locale: string;
  symbol: string;
  currency: string;
};

export const SUPPORTED_COUNTRIES: CountryConfig[] = [
  { code: "NO", name: "Norway", locale: "nb-NO", symbol: "Kr", currency: "NOK" },
  { code: "DK", name: "Denmark", locale: "da-DK", symbol: "Kr", currency: "DKK" },
  { code: "SE", name: "Sweden", locale: "sv-SE", symbol: "SEK", currency: "SEK" },
  { code: "FI", name: "Finland", locale: "fi-FI", symbol: "€", currency: "EUR" },
  { code: "US", name: "United States", locale: "en-US", symbol: "$", currency: "USD" },
  { code: "CA", name: "Canada", locale: "en-CA", symbol: "$", currency: "CAD" },
  { code: "GB", name: "United Kingdom", locale: "en-GB", symbol: "£", currency: "GBP" },
  { code: "DE", name: "Germany", locale: "de-DE", symbol: "€", currency: "EUR" },
  { code: "NL", name: "Netherlands", locale: "nl-NL", symbol: "€", currency: "EUR" },
  { code: "ES", name: "Spain", locale: "es-ES", symbol: "€", currency: "EUR" },
  { code: "IT", name: "Italy", locale: "it-IT", symbol: "€", currency: "EUR" },
  { code: "CH", name: "Switzerland", locale: "de-CH", symbol: "CHF", currency: "CHF" },
];

export function getCountryConfig(input?: string): CountryConfig {
  if (!input) return SUPPORTED_COUNTRIES[0];
  const query = input.trim().toLowerCase();
  const found = SUPPORTED_COUNTRIES.find(
    (c) =>
      c.code.toLowerCase() === query ||
      c.name.toLowerCase() === query ||
      c.locale.toLowerCase() === query ||
      c.currency.toLowerCase() === query
  );
  return found || SUPPORTED_COUNTRIES[0];
}

export const VIO_COUNTRY_STORAGE = "vio.country";
export const VIO_CURRENCY_STORAGE = "vio.currency";
export const VIO_LOCALE_STORAGE = "vio.locale";
export const VIO_SYMBOL_STORAGE = "vio.symbol";

export function getPersistedCountry(): string | null {
  if (typeof localStorage === "undefined") return null;
  try {
    return localStorage.getItem(VIO_COUNTRY_STORAGE);
  } catch {
    return null;
  }
}

export function getPersistedCurrency(): string | null {
  if (typeof localStorage === "undefined") return null;
  try {
    return localStorage.getItem(VIO_CURRENCY_STORAGE);
  } catch {
    return null;
  }
}

export function persistCountry(countryInput: string): CountryConfig {
  const config = getCountryConfig(countryInput);
  const g = globalThis as any;
  g.__VIO_COUNTRY__ = config.code;
  g.__VIO_CURRENCY__ = config.currency;
  g.__VIO_LOCALE__ = config.locale;
  g.__VIO_SYMBOL__ = config.symbol;

  if (typeof localStorage !== "undefined") {
    try {
      localStorage.setItem(VIO_COUNTRY_STORAGE, config.code);
      localStorage.setItem(VIO_CURRENCY_STORAGE, config.currency);
      localStorage.setItem(VIO_LOCALE_STORAGE, config.locale);
      localStorage.setItem(VIO_SYMBOL_STORAGE, config.symbol);
    } catch {
      /* noop */
    }
  }

  if (typeof window !== "undefined") {
    window.dispatchEvent(new CustomEvent("vio:country-changed", { detail: config }));
    window.dispatchEvent(new CustomEvent("vio:currency-changed", { detail: config.currency }));
  }

  return config;
}

export function persistCurrency(currency: string): void {
  persistCountry(currency);
}

export function getActiveCountry(): CountryConfig {
  const g = globalThis as any;
  const runtime = g.__VIO_COUNTRY__;
  const persisted = getPersistedCountry();
  return getCountryConfig(runtime || persisted || "NO");
}

export function getActiveCountryCode(): string {
  return getActiveCountry().code;
}

export function getActiveCurrency(): string {
  const g = globalThis as any;
  const runtime = g.__VIO_CURRENCY__;
  const persisted = getPersistedCurrency();
  if (runtime) return runtime;
  if (persisted) return persisted;
  return getActiveCountry().currency;
}

export function getActiveLocale(): string {
  const g = globalThis as any;
  if (g.__VIO_LOCALE__) return g.__VIO_LOCALE__;
  if (typeof localStorage !== "undefined") {
    try {
      const v = localStorage.getItem(VIO_LOCALE_STORAGE);
      if (v) return v;
    } catch {}
  }
  return getActiveCountry().locale;
}

export function getActiveSymbol(): string {
  const g = globalThis as any;
  if (g.__VIO_SYMBOL__) return g.__VIO_SYMBOL__;
  if (typeof localStorage !== "undefined") {
    try {
      const v = localStorage.getItem(VIO_SYMBOL_STORAGE);
      if (v) return v;
    } catch {}
  }
  return getActiveCountry().symbol;
}

/** A picked product reference (single-select value / multi-select item). */
export type Item = { productId: number; sponsorId: number };

/** Catalog list row (from the Products query). */
export type CatalogProduct = {
  id: number | string;
  brand?: string;
  title?: string;
  options_enabled?: boolean;
  options?: Array<{ id?: string | number; name?: string; values?: string[] }>;
  variants?: Array<{ id?: number | string; title?: string }>;
  price?: { amount?: number; amount_incl_taxes?: number; currency_code?: string };
  images?: Array<{ url?: string }>;
};

/** Light shape of the full product DTO the UI consumes (the SDK returns untyped). */
export type VioProduct = {
  id: number | string;
  brand?: string;
  title?: string;
  options_enabled?: boolean;
  supplier?: { name?: string };
  price?: { amount?: number; amount_incl_taxes?: number; currency_code?: string; compare_at?: number };
  images?: Array<{ url?: string }>;
  variants?: Array<{ id: number; title?: string; price?: { amount?: number; amount_incl_taxes?: number; currency_code?: string } }>;
  options?: unknown[];
};

export function getProductPriceAmount(p: any): number | undefined {
  if (!p?.price) return undefined;
  const amount = p.price.amount_incl_taxes ?? p.price.amount;
  return amount != null ? Number(amount) : undefined;
}

export function checkHasVariants(p: any): boolean {
  if (!p) return false;
  if (Boolean(p.options_enabled) || Boolean(p.hasVariants) || Boolean(p.has_variants) || Boolean(p.has_options) || Boolean(p.hasOptions)) return true;
  if (Array.isArray(p.options) && p.options.length > 0) return true;
  if (Array.isArray(p.variants) && p.variants.length > 1) return true;
  if (Array.isArray(p.variants) && p.variants.length === 1) {
    const title = String(p.variants[0]?.title ?? "").trim().toLowerCase();
    if (title && title !== "default title" && title !== "default") return true;
  }
  return false;
}

export function ensureVioInit(propKey?: string, propEnv?: VioEnvironment): void {
  installCampaignStorageSync();
  const key = resolveApiKey(propKey);
  const env = resolveEnvironment(propEnv);
  const sdkEnv = env === "staging" ? "testing" : env;
  // The page's campaign (null = default; Vio Config sets it at runtime before
  // it inits). Another campaign re-inits exactly as another key does: the SDK
  // bootstraps again and declares the page's slots again, under the new
  // campaign, and the blocks re-resolve.
  const campaignId = resolvePageCampaignId();
  if (!Vio.isInitialized || lastInitKey !== key || lastInitEnv !== sdkEnv || lastInitCampaign !== campaignId) {
    setRuntimeEnvironment(env);
    persistEnvironment(env);
    Vio.init({
      apiKey: key,
      environment: sdkEnv as any,
      // The surface's platform (ADR-0034): goes on the bootstrap (`?platform=`)
      // and on every slot declaration, so the campaigns service answers with
      // the slot assignments made for Vev.
      platform: "vev",
      // The page's campaign (ADR-0034, amendment 3): the SDK's fallback for
      // every slot without an assignment, and what the declaration carries.
      campaignId: campaignId ?? undefined,
    });
    lastInitKey = key;
    lastInitEnv = sdkEnv;
    lastInitCampaign = campaignId;
    // Another key or environment: another configuration, so the catalog and
    // the Vipps answers of the previous one no longer apply.
    resetCatalogCache();
    resetVippsOfferCache();
  }
}

/** Run an async op with retry (the commerce backend intermittently returns
 * "Authentication failed" under concurrency). Throws the last error if all
 * attempts fail — callers decide whether to swallow or surface it. */
export async function withRetry<T>(
  fn: () => Promise<T>,
  opts: { attempts?: number; delay?: number; label?: string } = {}
): Promise<T> {
  const { attempts = 8, delay = 300, label } = opts;
  let lastError: unknown;
  for (let i = 0; i < attempts; i++) {
    try {
      return await fn();
    } catch (err) {
      lastError = err;
      if (DEBUG && label) console.warn(`[Vio] ${label} retry ${i}`, (err as any)?.message ?? err);
      await new Promise((r) => setTimeout(r, delay));
    }
  }
  throw lastError;
}

/** The sponsor a fetch may use once this window is bootstrapped (see
 * `sponsorForCommerce`). Throws — and so retries — when there is none yet. */
function commerceSponsorOrThrow(requested: unknown): number {
  const sponsorId = sponsorForCommerce(requested);
  if (sponsorId == null) throw new Error("[Vio] no sponsor in the connected key's configuration yet");
  return sponsorId;
}

/** Fetch a single full product DTO by id. Returns null on failure — and when
 * the sponsor's channel does not carry the product (the card then shows its
 * "unavailable" placeholder). */
export async function fetchVioProduct(productId: number, sponsorId?: number | null): Promise<VioProduct | null> {
  try {
    return await withRetry(async () => {
      ensureVioInit();
      await Vio.bootstrap();
      const arr = await Vio.commerceFor(commerceSponsorOrThrow(sponsorId)).channel.product.getByIds({
        product_ids: [productId],
        currency: getActiveCurrency(),
        shipping_country_code: getActiveCountryCode(),
        image_size: "large"
      });
      const list = Array.isArray(arr) ? arr : [];
      return (list.find((x: any) => Number(x.id) === Number(productId)) ?? null) as VioProduct | null;
    }, { label: `product ${productId}` });
  } catch {
    return null;
  }
}

/** Fetch several products by id in one call (carousel / grid). Returns [] on
 * failure; a product the sponsor's channel does not carry is left out. */
export async function fetchVioProducts(productIds: number[], sponsorId?: number | null): Promise<VioProduct[]> {
  const ids = productIds.filter((n) => Number.isFinite(n));
  if (ids.length === 0) return [];
  try {
    return await withRetry(async () => {
      ensureVioInit();
      await Vio.bootstrap();
      const arr = await Vio.commerceFor(commerceSponsorOrThrow(sponsorId)).channel.product.getByIds({
        product_ids: ids,
        currency: getActiveCurrency(),
        shipping_country_code: getActiveCountryCode(),
        image_size: "large"
      });
      const list = Array.isArray(arr) ? arr : [];
      // Preserve the requested order.
      return ids.map((id) => list.find((x: any) => Number(x.id) === Number(id))).filter(Boolean) as VioProduct[];
    }, { label: "products" });
  } catch {
    return [];
  }
}

const PRODUCTS_QUERY = `
  query Products($currency: String, $shippingCountryCode: String, $imageSize: ImageSize, $useCache: Boolean!) {
    Channel {
      Products(
        barcode_list: []
        sku_list: []
        category_ids: []
        product_ids: []
        currency: $currency
        image_size: $imageSize
        useCache: $useCache
        shipping_country_code: $shippingCountryCode
      ) {
        id
        brand
        title
        options_enabled
        options { id name values }
        variants { id title }
        price { amount amount_incl_taxes currency_code }
        images { url }
      }
    }
  }
`;

// Shared catalog request — lists every product tied to the active sponsor's
// commerce apiKey (same source the product card uses). One fetch, reused by all
// pickers, deduped via a module-level promise, with retry. Rejects so the modal
// can show an error; a fresh call after a rejection retries. The answer carries
// the sponsor it was listed under: that is the sponsor a picked product keeps.
export type CatalogResult = { sponsorId: number; products: CatalogProduct[] };
let catalogPromise: Promise<CatalogResult> | null = null;
let catalogSponsorId: number | null = null;
let catalogKey: string | null = null;

export function resetCatalogCache(): void {
  catalogPromise = null;
  catalogSponsorId = null;
  catalogKey = null;
}

export function loadCatalogResult(): Promise<CatalogResult> {
  // First the init: a changed page campaign re-inits (and drops this cache)
  // before anything below reads the configuration.
  if (resolveApiKey()) {
    try {
      ensureVioInit();
    } catch {
      /* no usable key: the request below fails and says so */
    }
  }
  // A catalog listed under another key, or another sponsor than today's
  // effective one — the page's campaign sponsor when a campaign is chosen
  // (what the blocks fetch with), else the page's active sponsor — is stale.
  const active = sponsorForSlot(null, getActiveSponsorId());
  if (
    catalogPromise &&
    (catalogKey !== resolveApiKey() || (catalogSponsorId != null && active != null && active !== catalogSponsorId))
  ) {
    resetCatalogCache();
  }
  if (catalogPromise) return catalogPromise;
  const key = resolveApiKey();
  const pending: Promise<CatalogResult> = withRetry(async () => {
    ensureVioInit();
    await Vio.bootstrap();
    const sponsorId = sponsorForSlot(null, getActiveSponsorId());
    if (sponsorId == null) throw new Error("Connect a Vio API key in Vio Config to list its products");
    const data = await Vio.commerceFor(sponsorId).raw.request(PRODUCTS_QUERY, {
      currency: getActiveCurrency(),
      shippingCountryCode: getActiveCountryCode(),
      imageSize: "large",
      useCache: true,
    });
    const products = (data?.Channel?.Products ?? []) as CatalogProduct[];
    if (DEBUG) console.log("[Vio] loadCatalog →", products.length, "products of sponsor", sponsorId);
    return { sponsorId, products };
  }, { attempts: 5, delay: 400, label: "loadCatalog" }).then(
    (result) => {
      if (catalogPromise === pending) catalogSponsorId = result.sponsorId;
      return result;
    },
    (err: unknown) => {
      if (catalogPromise === pending) resetCatalogCache(); // allow a fresh retry on the next call
      throw err;
    }
  );
  // Set after starting the request: its first, synchronous ensureVioInit() may
  // re-init the SDK, and that resets this cache.
  catalogPromise = pending;
  catalogKey = key;
  return pending;
}

export function loadCatalog(): Promise<CatalogProduct[]> {
  return loadCatalogResult().then((result) => result.products);
}

/** Dispatch the SDK product-detail open event (the Config's <VioProductDetail>
 * listens), with the sponsor `requested` resolves to (see `sponsorForCommerce`)
 * — or the slot's campaign sponsor when `slot` has one assigned. The detail
 * takes the slot and the content from the click and carries them on every
 * event it emits (view_item, add_to_cart, begin_checkout from the drawer).
 * Before the bootstrap it waits for it; with no sponsor at all nothing opens. */
export function openProductInfo(
  productId: number,
  requestedSponsorId?: unknown,
  currency?: string,
  slot?: string | null
): void {
  const dispatch = (pageSponsor: number | null) => {
    const sponsorId = sponsorForSlot(slot, pageSponsor);
    if (sponsorId == null) {
      console.warn("[Vio] product info not opened: no sponsor in the connected key's configuration");
      return;
    }
    document.dispatchEvent(
      new CustomEvent("vio:product-click", {
        detail: {
          ...vioAttribution(slot, sponsorId),
          productId: String(productId),
          sponsorId: String(sponsorId),
          currency: currency || getActiveCurrency(),
        },
      })
    );
  };
  if (currentSponsorConfig()) dispatch(sponsorForCommerce(requestedSponsorId));
  else void resolveSponsorForCommerce(requestedSponsorId).then(dispatch);
}

/** Ask the Config to open the cart drawer. */
export function openCart(): void {
  document.dispatchEvent(new CustomEvent("vio:open-cart"));
}

/**
 * What the channel offers for Vipps, per sponsor: "express" (the button opens
 * the Vipps app), "checkout" (Vipps is offered but the seller switched Express
 * off → the button opens the checkout with Vipps preselected) or "none" (not
 * offered → no button at all). Read the same way the SDK's product detail reads
 * it, once per sponsor for every card on the page — and by the editor, to
 * offer the button only on a channel that has Vipps.
 */
export type VippsOffer = "express" | "checkout" | "none";
const vippsOfferCache = new Map<number, Promise<VippsOffer>>();

export function resetVippsOfferCache(): void {
  vippsOfferCache.clear();
}

/** Rejects when the connected key has no sponsor yet (nothing is asked of
 * Commerce then); `requested` goes through `sponsorForCommerce`. */
export async function loadVippsOffer(requested?: number | null): Promise<VippsOffer> {
  const sponsorId = await resolveSponsorForCommerce(requested);
  if (sponsorId == null) throw new Error("[Vio] no sponsor in the connected key's configuration yet");
  let pending = vippsOfferCache.get(sponsorId);
  if (!pending) {
    pending = withRetry(async (): Promise<VippsOffer> => {
      ensureVioInit();
      await Vio.bootstrap();
      // The key may have changed while this was queued: never ask with a
      // sponsor the configuration no longer has.
      if (sponsorForCommerce(sponsorId) !== sponsorId) throw new Error(`[Vio] sponsor ${sponsorId} left the configuration`);
      const methods: any[] = (await Vio.checkout.getAvailablePaymentMethods(sponsorId)) ?? [];
      const vipps = methods.find((m) => String(m?.name ?? "").toLowerCase() === "vipps");
      if (!vipps) return "none";
      const express = vipps.config?.find?.((c: any) => c?.name === "express")?.value;
      return express === "false" ? "checkout" : "express";
    }, { attempts: 3, label: `vipps offer ${sponsorId}` });
    vippsOfferCache.set(sponsorId, pending);
    // A failed lookup is not remembered: the next card asks again.
    pending.catch(() => vippsOfferCache.delete(sponsorId));
  }
  return pending;
}
