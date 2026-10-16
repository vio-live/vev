import React, { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { registerVevComponent, useEditorState, useVevEvent } from "@vev/react";
import { SilkeBox, SilkeButton, SilkeSelectFieldNative, SilkeTextField } from "@vev/silke";
import { Vio, VioCart, VioCheckout, VioProductDetail, applyVioTheme } from "../../vio-sdk";
import { configureAnalytics, initVioAnalytics } from "./analytics";
import AnalyticsInspector from "./analytics-inspector";
import {
  ensureVioInit,
  clearPersistedApiKey,
  DEFAULT_ENVIRONMENT,
  persistApiKey,
  resolveConfigApiKey,
  setRuntimeApiKey,
  resetCatalogCache,
  persistCountry,
  SUPPORTED_COUNTRIES,
  getCountryConfig,
  openProductInfo,
  adoptConnection,
  announceActiveSponsor,
  connectionFingerprint,
  forgetSponsorState,
  getStoredConnection,
  readPersistedSponsors,
  resolveSponsorId,
  sponsorForCommerce,
  sponsorForSlot,
  vioAttribution,
  VIO_CONNECTION_STORAGE,
  VIO_SPONSORS_STORAGE,
  type SponsorConfig,
  type SponsorListItem,
  type VioEnvironment,
} from "./vio-helpers";
import ProductSelect from "./product-picker";
import { trackViewItem } from "./analytics";

/**
 * Vio Configuration — the ONLY setup block. Wraps the real vio-web-sdk:
 *  - Vio.init(...) + Vio.bootstrap()  → commerce config (campaign / sponsor)
 *  - mounts <VioCart> + <VioCheckout> + <VioProductDetail> → the SDK's global drawers
 *  - floating cart button + badge count
 *  - wires vio:open-cart and vio:checkout-open (Klarna express)
 *  - editor-only connection panel: status dot + API key + Save + Disconnect
 * Place ONE of these + your product blocks/addons.
 */

type Status = "connecting" | "connected" | "error" | "disconnected";

const CONFIG_STYLE_ID = "vio-config-styles";
function injectConfigStyles() {
  if (typeof document === "undefined" || document.getElementById(CONFIG_STYLE_ID)) return;
  const el = document.createElement("style");
  el.id = CONFIG_STYLE_ID;
  el.textContent = `
    @keyframes vio-fab-pulse { 0%, 100% { transform: scale(1); } 50% { transform: scale(1.09); } }
    .vio-fab-pulse { animation: vio-fab-pulse 1.8s ease-in-out infinite; }
  `;
  document.head.appendChild(el);
}

// Corner → fixed offsets for the cart button.
function cartPositionStyle(position: string): React.CSSProperties {
  const v = position.includes("top") ? { top: 24 } : { bottom: 24 };
  const h = position.includes("left") ? { left: 24 } : { right: 24 };
  return { ...v, ...h };
}

function CartIcon({ kind }: { kind: string }) {
  if (kind === "cart") {
    return (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.7}>
        <circle cx="9" cy="21" r="1" />
        <circle cx="20" cy="21" r="1" />
        <path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6" />
      </svg>
    );
  }
  if (kind === "basket") {
    return (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.7}>
        <path d="M5 11l2-7h10l2 7" />
        <path d="M3 11h18l-1.5 8a2 2 0 0 1-2 1.7H6.5a2 2 0 0 1-2-1.7z" />
        <line x1="9" y1="15" x2="9" y2="17" />
        <line x1="15" y1="15" x2="15" y2="17" />
      </svg>
    );
  }
  // bag (default)
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.7}>
      <path d="M6 2L3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4z" />
      <line x1="3" y1="6" x2="21" y2="6" />
      <path d="M16 10a4 4 0 0 1-8 0" />
    </svg>
  );
}

type Props = {
  apiKey?: string;
  environment?: VioEnvironment;
  sponsorId?: number;
  country?: string;
  currency?: string;
  // Cart button (floating action button).
  // "items" | "always" | "never". Older pages stored a boolean here — see
  // resolveCartVisibility.
  cartButton?: string | boolean;
  cartPosition?: string; // bottom-right | bottom-left | top-right | top-left
  cartIcon?: string; // bag | cart | basket
  cartColor?: string;
  cartEffect?: string; // none | scale | pulse
  cartSize?: number;
  // Theme — applied via the SDK's applyVioTheme, see below.
  // Empty/undefined means "use the SDK default", not "clear to blank".
  themeColorAccent?: string;
  themeColorTextOnAccent?: string;
  themeColorText?: string;
  themeColorTextSecondary?: string;
  themeColorSurface?: string;
  themeColorSurfaceMuted?: string;
  themeColorBorder?: string;
  themeFontSerif?: string;
  themeFontSans?: string;
  themeCorners?: string; // default | sharp | rounded
  themeDensity?: string; // default | compact | roomy
  // Analytics.
  analytics?: boolean; // emit GA4 e-commerce events to dataLayer + vio:analytics
  analyticsDebug?: boolean; // console logs + live inspector overlay (+ fires in editor)
  sendToVio?: boolean; // forward events to the Vio collector (Vio Analytics pipeline)
};

/**
 * Corner shape and density are exposed as a few opinionated choices rather
 * than eight raw pixel inputs — the SDK API stays per-token so a panel can
 * compose whatever presets it wants, and this is ours.
 *
 * "default" deliberately sends `undefined` for every key: applyVioTheme reads
 * that as "clear the override", so switching back really restores the SDK
 * scale instead of freezing today's numbers into the page.
 */
/**
 * Cart button visibility. Default is "items": a floating cart on an empty cart
 * is noise in an editorial article — it should appear when there is something
 * in it.
 *
 * Pages configured before this was a choice stored a boolean. `true` maps to
 * the new default rather than to "always", so they get the improved behaviour;
 * `false` stays hidden, which is what its author asked for.
 */
type CartVisibility = "items" | "always" | "never";

function resolveCartVisibility(value: unknown): CartVisibility {
  if (value === true) return "items";
  if (value === false) return "never";
  return value === "always" || value === "never" || value === "items" ? value : "items";
}

const CORNER_PRESETS = {
  default: { radiusSm: undefined, radiusMd: undefined, radiusLg: undefined, radiusXl: undefined },
  sharp: { radiusSm: "0", radiusMd: "0", radiusLg: "0", radiusXl: "0" },
  rounded: { radiusSm: "4px", radiusMd: "8px", radiusLg: "14px", radiusXl: "28px" },
} as const;

const DENSITY_PRESETS = {
  default: { spaceSm: undefined, spaceMd: undefined, spaceLg: undefined, spaceXl: undefined },
  compact: { spaceSm: "6px", spaceMd: "12px", spaceLg: "16px", spaceXl: "24px" },
  roomy: { spaceSm: "10px", spaceMd: "20px", spaceLg: "32px", spaceXl: "44px" },
} as const;

/**
 * The Vev card's corners (card-view.tsx) come from three variables of its
 * own, with today's pixels as their fallbacks — not from `--vio-radius-*`
 * directly, because the SDK injects its scale on :root at load and the card
 * would take the SDK's look under "default" (an 8px photo corner, 4px bars)
 * instead of its own. "default" removes them (the fallbacks apply, nothing
 * changes); "sharp" squares them; "rounded" hands them the theme's
 * lg / md / sm, which CORNER_PRESETS sets through applyVioTheme.
 */
const CARD_CORNER_VARS = {
  "--vio-card-radius": "--vio-radius-lg",
  "--vio-card-bar-radius": "--vio-radius-md",
  "--vio-card-badge-radius": "--vio-radius-sm",
} as const;

function applyCardCorners(preset: string): void {
  if (typeof document === "undefined") return;
  const style = document.documentElement.style;
  for (const [cardVar, token] of Object.entries(CARD_CORNER_VARS)) {
    if (preset === "sharp") style.setProperty(cardVar, "0px");
    else if (preset === "rounded") style.setProperty(cardVar, `var(${token})`);
    else style.removeProperty(cardVar);
  }
}

export default function VioConfig({
  apiKey,
  environment = DEFAULT_ENVIRONMENT,
  sponsorId,
  country = "NO",
  currency,
  cartButton,
  cartPosition = "bottom-right",
  cartIcon = "bag",
  cartColor,
  cartEffect = "scale",
  cartSize = 56,
  themeColorAccent,
  themeColorTextOnAccent,
  themeColorText,
  themeColorTextSecondary,
  themeColorSurface,
  themeColorSurfaceMuted,
  themeColorBorder,
  themeFontSerif,
  themeFontSans,
  themeCorners = "default",
  themeDensity = "default",
  analytics = true,
  analyticsDebug = false,
  sendToVio = true,
}: Props) {
  const { disabled } = useEditorState(); // true in the editor, false on the published page
  const cartRef = useRef<any>(null);
  const checkoutRef = useRef<any>(null);
  const [count, setCount] = useState(0);
  const [fabHover, setFabHover] = useState(false);
  const idRef = useRef<string>("vio-cfg-" + Math.random().toString(36).slice(2));

  // Only ONE Config instance owns the global overlays (cart/checkout/detail) +
  // init + bootstrap. If the block is placed more than once — or Vev bundles
  // duplicate copies — the others render nothing (avoids N drawers / N inits).
  const [isOwner, setIsOwner] = useState(false);

  // Active environment selected via Vev inspector prop (or runtime/persisted fallback).
  const activeEnvironment = environment || DEFAULT_ENVIRONMENT;
  // The page's key (its prop), else the one saved from the panel — see
  // resolveConfigApiKey for why not the runtime key.
  const resolvedKey = resolveConfigApiKey(apiKey);

  // Connection panel state.
  const [status, setStatus] = useState<Status>("connecting");
  const [statusMsg, setStatusMsg] = useState("");
  // The connected key's sponsors. Null until its bootstrap answers: until
  // then there is no active sponsor and nothing is asked of Commerce.
  const [sponsorConfig, setSponsorConfig] = useState<SponsorConfig | null>(null);
  const [sponsorList, setSponsorList] = useState<SponsorListItem[]>([]);
  // Which key + environment this Config is connected with, and a counter so a
  // slower, older connect never overwrites a newer one.
  const connectedRef = useRef<string | null>(null);
  const connectSeqRef = useRef(0);

  const connect = useCallback(
    async (key: string) => {
      const seq = ++connectSeqRef.current;
      const dropConnection = () => {
        forgetSponsorState({ carts: false });
        connectedRef.current = null;
        setSponsorConfig(null);
        setSponsorList([]);
        announceActiveSponsor(null);
      };
      if (!key) {
        setStatus("disconnected");
        setStatusMsg("");
        // The SDK keeps the last key's configuration; with no runtime key the
        // blocks stop resolving sponsors against it (currentSponsorConfig).
        setRuntimeApiKey("");
        dropConnection();
        return;
      }
      const fingerprint = connectionFingerprint(key, activeEnvironment);
      if (connectedRef.current != null && connectedRef.current !== fingerprint) {
        // Switching keys: nothing of the previous key's sponsor may be used
        // while the new one boots — the blocks wait (null) and the selector
        // empties. Its carts go once the new key answers (adoptConnection),
        // so a mistyped key does not cost the cart.
        dropConnection();
      }
      setStatus("connecting");
      setStatusMsg("");
      try {
        setRuntimeApiKey(key);
        ensureVioInit(key, activeEnvironment);
        const boot = await Vio.bootstrap();
        if (seq !== connectSeqRef.current) return; // a newer connect owns the state
        const adopted = adoptConnection(boot, key, activeEnvironment);
        if (!adopted) throw new Error("This key has no sponsor");
        connectedRef.current = fingerprint;
        setSponsorList(adopted.sponsors);
        setSponsorConfig(adopted.config);
        setStatus("connected");
        setStatusMsg(adopted.sponsors[0]?.name ?? "");
      } catch (e: any) {
        if (seq !== connectSeqRef.current) return;
        setStatus("error");
        setStatusMsg(e?.message ?? "Connection failed");
        dropConnection();
      }
    },
    [activeEnvironment]
  );

  // Claim overlay ownership (idempotent via globalThis) + inject FAB styles.
  useEffect(() => {
    injectConfigStyles();
    const g = globalThis as any;
    const myId = idRef.current;
    if (!g.__VIO_OVERLAY_OWNER__) g.__VIO_OVERLAY_OWNER__ = myId;
    setIsOwner(g.__VIO_OVERLAY_OWNER__ === myId);
    return () => {
      if (g.__VIO_OVERLAY_OWNER__ === myId) g.__VIO_OVERLAY_OWNER__ = null;
    };
  }, []);

  // Connect on mount and whenever the prop key changes (owner only).
  useEffect(() => {
    if (!isOwner) return;
    void connect(resolvedKey);
  }, [isOwner, resolvedKey, connect]);

  // The active sponsor: the "Active Sponsor" prop when the connected key has
  // it, else the key's primary — never a fixed id. Announced to every block on
  // each connect (a new key re-renders them even when the id is the same).
  const resolvedSponsorId = sponsorConfig
    ? resolveSponsorId(sponsorId, sponsorConfig.ids, sponsorConfig.primaryId)
    : null;
  const savedSponsorUnknown =
    sponsorConfig != null && Number(sponsorId) > 0 && resolvedSponsorId !== Number(sponsorId);
  useEffect(() => {
    if (!isOwner || resolvedSponsorId == null) return;
    announceActiveSponsor(resolvedSponsorId);
  }, [isOwner, resolvedSponsorId, sponsorConfig]);

  // Set the dynamic runtime country/currency/locale/symbol and notify listeners
  const resolvedCountryInput = country || (currency ? getCountryConfig(currency).code : "NO");
  useEffect(() => {
    persistCountry(resolvedCountryInput);
    resetCatalogCache();
  }, [resolvedCountryInput]);

  // Theme (brand colors/fonts) — applies live in the editor canvas too (not
  // gated on `disabled`/published), so a color/font pick shows immediately
  // while configuring, same as any other Vev style property.
  useEffect(() => {
    applyVioTheme({
      colorAccent: themeColorAccent || undefined,
      colorTextOnPrimary: themeColorTextOnAccent || undefined,
      colorText: themeColorText || undefined,
      colorTextSecondary: themeColorTextSecondary || undefined,
      colorSurface: themeColorSurface || undefined,
      colorSurfaceMuted: themeColorSurfaceMuted || undefined,
      colorBorder: themeColorBorder || undefined,
      fontSerif: themeFontSerif || undefined,
      fontSans: themeFontSans || undefined,
      ...CORNER_PRESETS[themeCorners as keyof typeof CORNER_PRESETS],
      ...DENSITY_PRESETS[themeDensity as keyof typeof DENSITY_PRESETS],
    });
    applyCardCorners(themeCorners);
  }, [
    themeColorAccent,
    themeColorTextOnAccent,
    themeColorText,
    themeColorTextSecondary,
    themeColorSurface,
    themeColorSurfaceMuted,
    themeColorBorder,
    themeFontSerif,
    themeFontSans,
    themeCorners,
    themeDensity,
  ]);

  // "Open product info" as a Vev INTERACTION: any element on the page (an
  // image, a button, a hotspot) can trigger it from the Interactions panel,
  // which is how Vev models this now — the older `type: "action"` addon still
  // ships alongside for pages already using it.
  //
  // It lives on Vio Config because that's the singleton that mounts the
  // product-detail drawer; a per-element addon can't be assumed present.
  useVevEvent<{ product?: { productId?: number; sponsorId?: number }; slot?: string }>(
    "OPEN_PRODUCT_INFO",
    (payload) => {
      const productId = payload?.product?.productId;
      if (productId == null) return;
      // The interaction's optional "Slot" (ADR-0034): the place it was opened
      // from, carried by the detail's events — and its campaign's sponsor,
      // when one is assigned. Else the sponsor it was picked under when the
      // connected key has it, else the page's active sponsor
      // (openProductInfo → sponsorForCommerce).
      const slot = typeof payload?.slot === "string" && payload.slot.trim() ? payload.slot.trim() : undefined;
      const sponsorId = sponsorForSlot(slot, sponsorForCommerce(payload?.product?.sponsorId));
      trackViewItem({ productId: Number(productId) }, vioAttribution(slot, sponsorId));
      openProductInfo(Number(productId), payload?.product?.sponsorId, undefined, slot);
    },
  );

  // Cart badge count.
  useEffect(() => {
    if (!isOwner) return;
    const update = () => setCount(Vio.cart?.itemCount ?? 0);
    update();
    Vio.cart?.addEventListener?.("change", update);
    return () => Vio.cart?.removeEventListener?.("change", update);
  }, [isOwner]);

  // A block/addon asks to open the cart → document event.
  useEffect(() => {
    if (!isOwner) return;
    const openCart = () => cartRef.current?.show?.();
    document.addEventListener("vio:open-cart", openCart);
    return () => document.removeEventListener("vio:open-cart", openCart);
  }, [isOwner]);

  // Analytics: enable on the published page (and in the editor when debugging, so
  // the inspector is demoable live). Install the global funnel listeners once.
  useEffect(() => {
    if (!isOwner) return;
    configureAnalytics({
      enabled: analytics && (!disabled || analyticsDebug),
      sendToVio,
      debug: analyticsDebug,
    });
  }, [isOwner, analytics, analyticsDebug, sendToVio, disabled]);

  useEffect(() => {
    if (!isOwner || !analytics) return;
    return initVioAnalytics();
  }, [isOwner, analytics]);

  // Cart / detail → Klarna → open checkout in EXPRESS mode (like the demo):
  // the event carries { sponsorId, paymentMethod:'klarna', express:true }. Express
  // shows only the Klarna widget + shipping — no manual Leveringsadresse form
  // (Klarna collects the address). Apple Pay never comes here: it charges directly
  // from the cart footer (address from Wallet).
  const onCheckoutOpen = (e: any) => {
    const detail = e?.detail ?? {};
    // The cart's sponsor when the connected key has it (carts of other
    // sponsors are dropped on connect), else the active one — the same rule
    // as everywhere else.
    const sponsorId = sponsorForCommerce(detail.sponsorId) ?? detail.sponsorId;
    const paymentMethod = detail.paymentMethod;
    const express = !!detail.express;
    cartRef.current?.close?.();
    try {
      Vio.checkout?.open?.(sponsorId);
      if (paymentMethod) Vio.checkout?.selectPaymentMethod?.(paymentMethod);
    } catch {
      /* noop */
    }
    setTimeout(() => {
      const checkoutEl: any = checkoutRef.current;
      if (checkoutEl) checkoutEl.express = express;
      checkoutEl?.show?.();
    }, 200);
  };

  if (typeof document === "undefined") return null;
  if (!isOwner) return null;

  const dotColor =
    status === "connected"
      ? "#16a34a"
      : status === "connecting"
      ? "#d97706"
      : status === "error"
      ? "#dc2626"
      : "#9ca3af";
  const statusLabel =
    status === "connected"
      ? "Connected"
      : status === "connecting"
      ? "Connecting…"
      : status === "error"
      ? "Error"
      : "Disconnected";

  const panel = (
    <div
      style={{
        boxSizing: "border-box",
        width: "100%",
        maxWidth: 320,
        fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
        color: "#0a0a0a",
        background: "#fff",
        border: "1px solid #e5e5e5",
        borderRadius: 10,
        padding: 14,
        boxShadow: "0 2px 12px rgba(0,0,0,0.08)",
        pointerEvents: "none",
        position: "relative",
        zIndex: 1,
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
        <span
          style={{
            width: 9,
            height: 9,
            borderRadius: "50%",
            background: dotColor,
            boxShadow: `0 0 0 3px ${dotColor}22`,
            flexShrink: 0,
          }}
        />
        <strong style={{ fontSize: 13 }}>Vio · {statusLabel}</strong>
        {statusMsg ? (
          <span
            style={{
              fontSize: 12,
              opacity: 0.6,
              overflow: "hidden",
              textOverflow: "ellipsis",
              whiteSpace: "nowrap",
            }}
          >
            · {statusMsg}
          </span>
        ) : null}
      </div>
      {savedSponsorUnknown ? (
        <div style={{ fontSize: 11, color: "#b45309", lineHeight: 1.4, marginBottom: 4 }}>
          The saved sponsor (#{String(sponsorId)}) is not one of this key's sponsors — using the primary,{" "}
          {sponsorList.find((s) => s.isPrimary)?.name ?? `#${resolvedSponsorId}`}.
        </div>
      ) : null}
      <div style={{ fontSize: 11, color: "#666", lineHeight: 1.4 }}>
        Configure the Vio API Key and options in the Properties panel on the right.
      </div>
    </div>
  );

  const fabScaleHover = cartEffect === "scale" && fabHover;
  const cartVisibility = resolveCartVisibility(cartButton);
  const showCartButton =
    cartVisibility === "always" || (cartVisibility === "items" && count > 0);
  const overlays = (
    <>
      {showCartButton ? (
      <button
        type="button"
        aria-label="Handlekurv"
        className={cartEffect === "pulse" ? "vio-fab-pulse" : undefined}
        onClick={() => document.dispatchEvent(new CustomEvent("vio:open-cart"))}
        onMouseEnter={() => setFabHover(true)}
        onMouseLeave={() => setFabHover(false)}
        style={{
          position: "fixed",
          ...cartPositionStyle(cartPosition),
          width: cartSize,
          height: cartSize,
          // A circle in every "Corners" preset, its badge a pill: the round
          // shape is what makes a floating icon read as the cart, the SDK
          // keeps its own round controls outside the radius scale too, and
          // the scale's `xl` (16px by default) would turn today's circle
          // into a rounded square on every page.
          borderRadius: 9999,
          background: cartColor || "#0a0a0a",
          color: "#fff",
          border: "none",
          cursor: "pointer",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          boxShadow: fabHover ? "0 8px 24px rgba(0,0,0,0.28)" : "0 4px 16px rgba(0,0,0,0.22)",
          transform: fabScaleHover ? "scale(1.08)" : "scale(1)",
          transition: "transform 0.14s ease, box-shadow 0.14s ease",
          zIndex: 2147483000,
        }}
      >
        <CartIcon kind={cartIcon} />
        {count > 0 && (
          <span
            style={{
              position: "absolute",
              top: -4,
              right: -4,
              minWidth: 20,
              height: 20,
              padding: "0 5px",
              borderRadius: 9999,
              background: "#c14a3b",
              color: "#fff",
              fontSize: 12,
              fontWeight: 600,
              lineHeight: "20px",
              textAlign: "center",
            }}
          >
            {count}
          </span>
        )}
      </button>
      ) : null}
      <VioCart ref={cartRef} onCheckoutOpen={onCheckoutOpen} />
      <VioCheckout ref={checkoutRef} />
      {/* Product detail: auto-opens on a product card click (vio:product-click). */}
      <VioProductDetail
        onCheckoutOpen={onCheckoutOpen}
        onAddedToCart={() => cartRef.current?.show?.()}
      />
      {analytics && analyticsDebug ? <AnalyticsInspector /> : null}
    </>
  );

  return (
    <>
      {disabled ? panel : null}
      {!disabled ? createPortal(overlays, document.body) : null}
    </>
  );
}

// Properties-panel inputs use Vev's own Silke components (SilkeTextField /
// SilkeSelectFieldNative) — the SAME components Vev's native "string"/"select"
// prop fields render with (e.g. API Base, Cart position). That's what makes
// them pick up the panel's dark theme automatically, popover-based dropdown
// included — a raw <input>/<select> with a hand-written stylesheet loses to
// Vev's own (higher-specificity) panel CSS and renders as a plain white
// browser control instead.

type ApiKeyEditorProps = {
  value?: string;
  onChange: (value: string) => void;
};

export function VioApiKeyEditor({ value, onChange }: ApiKeyEditorProps) {
  // The block's canvas side (VioConfig) resolves its key as this prop →
  // localStorage (see resolveConfigApiKey). Showing only the raw prop here —
  // and only offering Disconnect when the PROP is set — hid a real gap: a key
  // left over in localStorage from an earlier test kept the block connected
  // while this panel showed an empty field with no way to clear it. Mirror
  // that same precedence here so the field always shows what's actually in
  // effect, and Disconnect is offered whenever there's anything (prop OR
  // persisted) to clear.
  const effectiveKey = resolveConfigApiKey(value);
  const [localKey, setLocalKey] = useState(effectiveKey);

  useEffect(() => {
    setLocalKey(effectiveKey);
  }, [effectiveKey]);

  const trimmed = localKey.trim();
  const dirty = trimmed !== effectiveKey;

  /** Persist the key to the Vev prop (+ localStorage). A CHANGED key auto-
   * connects via VioConfig's key effect; an unchanged key is a no-op. */
  const handleSave = () => {
    persistApiKey(trimmed);
    setRuntimeApiKey(trimmed);
    onChange(trimmed);
  };

  /** (Re)connect NOW with the key in the field, WITHOUT persisting it to
   * localStorage — lets you test a key (or recover from an error) without
   * making it the browser-wide default for other blocks/projects.
   *
   * MUST go through the Vev prop (`onChange`), not a same-window custom
   * event: this field editor renders in the properties panel, while
   * VioConfig (the widget that owns `connect()`) renders inside the
   * canvas — a DIFFERENT `window` (Vev's canvas is an iframe; confirmed via
   * @vev/react's own use of `window.postMessage` for panel↔canvas
   * communication). `window.dispatchEvent` never crosses that boundary, so
   * events dispatched here are simply never seen there. The prop channel is
   * the only bridge Vev guarantees — it's what makes Save work today. */
  const handleConnect = () => {
    if (!trimmed) return;
    setRuntimeApiKey(trimmed);
    onChange(trimmed);
  };

  const handleClear = () => {
    clearPersistedApiKey();
    setRuntimeApiKey("");
    setLocalKey("");
    onChange("");
  };

  return (
    <SilkeBox column gap="s" style={{ width: "100%" }}>
      <SilkeTextField
        value={localKey}
        onChange={(v: string) => setLocalKey(v)}
        placeholder="vg-demo_api_key_…"
        autocomplete={false}
        size="s"
      />
      <SilkeBox gap="xs" style={{ width: "100%" }}>
        <SilkeButton
          label={dirty ? "Save •" : "Save"}
          size="s"
          kind="primary"
          onClick={handleSave}
          disabled={!trimmed}
          style={{ flex: 1 }}
        />
        <SilkeButton
          label="Connect"
          size="s"
          kind="secondary"
          onClick={handleConnect}
          disabled={!trimmed}
          style={{ flex: 1 }}
        />
      </SilkeBox>
      {effectiveKey ? (
        <SilkeButton
          label="Disconnect"
          size="s"
          kind="tertiary"
          onClick={handleClear}
          style={{ width: "100%" }}
        />
      ) : null}
    </SilkeBox>
  );
}

type SponsorSelectorProps = {
  value?: number;
  onChange: (value: number) => void;
  /** Vev's form context: `value` holds this block's other props (apiKey, environment). */
  context?: { value?: { apiKey?: string; environment?: VioEnvironment } };
};

export function VioSponsorSelector({ value, onChange, context }: SponsorSelectorProps) {
  const [sponsors, setSponsors] = useState<SponsorListItem[]>(() => readPersistedSponsors());
  const [connection, setConnection] = useState<string | null>(() => getStoredConnection());

  // This field editor renders in the properties panel, while VioConfig (the
  // one that writes "vio.sponsors" after a successful connect) renders in the
  // canvas — a DIFFERENT window (Vev's canvas is an iframe). A same-window
  // CustomEvent never reaches across that boundary, so we rely on the native
  // cross-window `storage` event instead — it fires in every OTHER window of
  // the same origin whenever localStorage changes (never in the window that
  // made the change, which is fine: that's VioConfig's own canvas state).
  useEffect(() => {
    const handleStorage = (e: StorageEvent) => {
      if (e.key !== null && e.key !== VIO_SPONSORS_STORAGE && e.key !== VIO_CONNECTION_STORAGE) return;
      setSponsors(readPersistedSponsors());
      setConnection(getStoredConnection());
    };
    window.addEventListener("storage", handleStorage);
    return () => window.removeEventListener("storage", handleStorage);
  }, []);

  // The list in storage is whatever key connected last in this browser: the
  // previous key while a new one boots, or another project's. When Vev hands
  // us this block's key, the list only counts once it belongs to that key.
  const formValue = context?.value;
  const pageKey = formValue ? resolveConfigApiKey(formValue.apiKey) : "";
  const expected = pageKey ? connectionFingerprint(pageKey, formValue?.environment || DEFAULT_ENVIRONMENT) : null;
  const listIsCurrent = sponsors.length > 0 && (expected == null || connection == null || connection === expected);
  const primary = sponsors.find((s) => s.isPrimary) ?? sponsors[0];
  const saved = value != null && String(value) !== "" ? Number(value) : null;
  const savedKnown = saved != null && sponsors.some((s) => s.id === saved);

  // Auto-select primary sponsor by default if no value is set
  useEffect(() => {
    if (!value && listIsCurrent && primary) onChange(primary.id);
  }, [value, listIsCurrent, primary, onChange]);

  if (!listIsCurrent) {
    return (
      <SilkeBox style={{ fontSize: 12, opacity: 0.55, fontStyle: "italic", padding: "4px 0" }}>
        {sponsors.length > 0 || pageKey
          ? "This key's sponsors show here once it connects"
          : "Connect API Key to select sponsor"}
      </SilkeBox>
    );
  }

  return (
    <SilkeBox column gap="xs" style={{ width: "100%" }}>
      <SilkeSelectFieldNative
        size="s"
        // A saved sponsor this key does not have is not shown as chosen: the
        // page uses the primary (the note says so) until one is picked.
        value={savedKnown ? saved : undefined}
        onChange={(v: number) => onChange(Number(v))}
        placeholder="Select a sponsor…"
        items={sponsors.map((s: SponsorListItem) => ({
          value: s.id,
          label: s.isPrimary ? `${s.name} (Primary)` : s.name,
        }))}
      />
      {saved != null && !savedKnown && primary ? (
        <SilkeBox style={{ fontSize: 11, opacity: 0.75, lineHeight: 1.4 }}>
          {`The saved sponsor (#${saved}) is not one of this key's sponsors. The page uses the primary, ${primary.name}.`}
        </SilkeBox>
      ) : null}
    </SilkeBox>
  );
}

// Launch scope (decisión 2026-08-10): UN mercado, NO/NOK. Volver a true expone
// el selector de país — ANTES de activarlo, resolver la tarea #4 / handbook
// §8.3 (la currency del carrito backend no se realinea al cambiar de mercado).
const MULTI_MARKET_ENABLED = false;

registerVevComponent(VioConfig, {
  name: "Vio Config (SDK)",
  size: { width: 320, height: "auto" },
  /**
   * Interactions any element can trigger — this is how Vev wires behaviour to
   * an arbitrary element now (select the image → Interactions → On click →
   * Vio Config → Open product info → pick the product).
   */
  interactions: [
    {
      type: "OPEN_PRODUCT_INFO",
      description: "Open product info — turns any element (an image, a button) into a product",
      args: [
        {
          name: "product",
          title: "Product",
          type: "object",
          component: ProductSelect as any,
          fields: [
            { name: "productId", type: "number" },
            { name: "sponsorId", type: "number" },
          ],
        },
        {
          name: "slot",
          title: "Slot",
          type: "string",
          description:
            "Optional. The slot this element belongs to in the Vio dashboard (the id of a Vio block, or your own). Its campaign is attributed the product views and purchases that start here.",
        },
      ],
    },
  ],
  props: [
    {
      name: "apiKey",
      title: "Vio API Key",
      type: "string",
      initialValue: "",
      component: VioApiKeyEditor as any,
    },
    {
      name: "sponsorId",
      title: "Active Sponsor",
      type: "number",
      component: VioSponsorSelector as any,
    },
    ...(MULTI_MARKET_ENABLED
      ? [
          {
            name: "country",
            title: "Country",
            type: "select",
            initialValue: "NO",
            options: {
              display: "dropdown",
              items: SUPPORTED_COUNTRIES.map((c) => ({
                value: c.code,
                label: c.name,
              })),
            },
          } as any,
        ]
      : []),
    {
      name: "environment",
      title: "Environment",
      type: "select",
      initialValue: DEFAULT_ENVIRONMENT,
      options: {
        display: "dropdown",
        items: [
          { value: "development", label: "Development" },
          { value: "staging", label: "Staging" },
          { value: "production", label: "Production" },
        ],
      },
    } as any,
    {
      name: "cartButton",
      title: "Cart button",
      type: "select",
      initialValue: "items",
      options: {
        display: "dropdown",
        items: [
          { value: "items", label: "Only when it has items" },
          { value: "always", label: "Always visible" },
          { value: "never", label: "Hidden" },
        ],
      },
    },
    {
      name: "cartPosition",
      title: "Cart position",
      type: "select",
      initialValue: "bottom-right",
      options: {
        display: "dropdown",
        items: [
          { value: "bottom-right", label: "Bottom right" },
          { value: "bottom-left", label: "Bottom left" },
          { value: "top-right", label: "Top right" },
          { value: "top-left", label: "Top left" },
        ],
      },
    } as any,
    {
      name: "cartIcon",
      title: "Cart icon",
      type: "select",
      initialValue: "bag",
      options: {
        display: "dropdown",
        items: [
          { value: "bag", label: "Bag" },
          { value: "cart", label: "Cart" },
          { value: "basket", label: "Basket" },
        ],
      },
    } as any,
    {
      name: "cartEffect",
      title: "Cart effect",
      type: "select",
      initialValue: "scale",
      options: {
        display: "dropdown",
        items: [
          { value: "none", label: "None" },
          { value: "scale", label: "Scale on hover" },
          { value: "pulse", label: "Pulse" },
        ],
      },
    } as any,
    { name: "cartColor", title: "Cart color", type: "string", initialValue: "" },
    { name: "cartSize", title: "Cart size (px)", type: "number", initialValue: 56 },
    // Theme — leave blank to use the SDK default for each. Same pattern as
    // Cart color above: a plain hex/CSS-value string, no custom picker.
    { name: "themeColorAccent", title: "Theme · Accent color", type: "string", initialValue: "" },
    { name: "themeColorTextOnAccent", title: "Theme · Text on accent", type: "string", initialValue: "" },
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
    {
      name: "themeDensity",
      title: "Theme · Density",
      type: "select",
      initialValue: "default",
      options: {
        display: "dropdown",
        items: [
          { value: "default", label: "Default" },
          { value: "compact", label: "Compact" },
          { value: "roomy", label: "Roomy" },
        ],
      },
    },
    { name: "analytics", title: "Analytics (GA4 / dataLayer)", type: "boolean", initialValue: true },
    { name: "sendToVio", title: "Send to Vio Analytics", type: "boolean", initialValue: true },
    { name: "analyticsDebug", title: "Analytics debug + inspector", type: "boolean", initialValue: false },
  ],
});
