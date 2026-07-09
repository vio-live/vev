import React, { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { registerVevComponent, useEditorState } from "@vev/react";
import { Vio, VioCart, VioCheckout, VioProductDetail } from "../../vio-sdk";

/**
 * Vio Configuration — the ONLY setup block. Wraps the real vio-web-sdk:
 *  - Vio.init(...) + Vio.bootstrap()  → commerce config (campaign / sponsor)
 *  - mounts <VioCart> + <VioCheckout> + <VioProductDetail> → the SDK's global drawers
 *  - floating cart button + badge count
 *  - wires vio:open-cart and vio:checkout-open (Klarna express)
 *  - editor-only connection panel: status dot + API key + Save + Disconnect
 * Place ONE of these + your product blocks/addons.
 */

// Ready-to-go defaults: URLs + Vio API key (host) + Stripe publishable key are
// pre-filled so dropping the block needs zero config. The COMMERCE key is NOT
// hardcoded — it is dynamic, resolved by bootstrap (sponsor.commerce.apiKey).
const DEFAULT_API_KEY = "vg-demo_api_key_57a3038c06434330";
const DEFAULT_API_BASE = "https://api-staging.vio.live";
const DEFAULT_GQL_BASE = "https://graph-ql-dev.vio.live";
// Stripe PUBLISHABLE key (public, safe in the bundle). Enables card + Apple Pay.
// Apple Pay also requires registering the article domain in this Stripe account.
const DEFAULT_STRIPE_PK =
  "pk_test_51TMTbsECwcLH8wcPAkKSPs0GtSap2rLexnYFQ2PP8j07RLNCO9It5r4SR0RbU5jJ5gxtd7GMCJ5HlK9K77dQLhCr00DdDSr23y";

type Status = "connecting" | "connected" | "error" | "disconnected";

// Panel-saved API key persists here (per browser), overriding the prop default.
const STORAGE_KEY = "vio.apiKey";

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
  apiBase?: string;
  graphQLBase?: string;
  stripePublishableKey?: string;
  // Cart button (floating action button).
  cartButton?: boolean;
  cartPosition?: string; // bottom-right | bottom-left | top-right | top-left
  cartIcon?: string; // bag | cart | basket
  cartColor?: string;
  cartEffect?: string; // none | scale | pulse
  cartSize?: number;
};

export default function VioConfig({
  apiKey,
  apiBase,
  graphQLBase,
  stripePublishableKey,
  cartButton = true,
  cartPosition = "bottom-right",
  cartIcon = "bag",
  cartColor,
  cartEffect = "scale",
  cartSize = 56,
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

  const resolvedBase = apiBase || DEFAULT_API_BASE;
  const resolvedGql = graphQLBase || DEFAULT_GQL_BASE;
  const resolvedStripe = stripePublishableKey || DEFAULT_STRIPE_PK;
  // Key precedence: a key saved from the panel (localStorage) wins over the prop
  // default, so "Save" persists across reloads. The prop stays the shipped default.
  const storedKey =
    typeof localStorage !== "undefined" ? localStorage.getItem(STORAGE_KEY) : null;
  const resolvedKey = storedKey || apiKey || DEFAULT_API_KEY;

  // Connection panel state.
  const [apiKeyInput, setApiKeyInput] = useState(resolvedKey);
  const [status, setStatus] = useState<Status>("connecting");
  const [statusMsg, setStatusMsg] = useState("");

  const connect = useCallback(
    async (key: string) => {
      if (!key) {
        setStatus("disconnected");
        setStatusMsg("");
        return;
      }
      setStatus("connecting");
      setStatusMsg("");
      try {
        Vio.init({
          apiKey: key,
          environment: "development",
          apiBase: resolvedBase,
          graphQLBase: resolvedGql,
          stripePublishableKey: resolvedStripe,
        });
        const boot = await Vio.bootstrap();
        setStatus("connected");
        setStatusMsg((boot as any)?.primarySponsor?.name ?? "");
      } catch (e: any) {
        setStatus("error");
        setStatusMsg(e?.message ?? "Connection failed");
      }
    },
    [resolvedBase, resolvedGql, resolvedStripe]
  );

  // Save: persist the typed key, then (re)connect with it.
  const onSave = useCallback(() => {
    try {
      localStorage.setItem(STORAGE_KEY, apiKeyInput.trim());
    } catch {
      /* noop */
    }
    void connect(apiKeyInput.trim());
  }, [apiKeyInput, connect]);

  // Disconnect: drop the saved key and clear the cached bootstrap.
  const onDisconnect = useCallback(() => {
    try {
      localStorage.removeItem(STORAGE_KEY);
    } catch {
      /* noop */
    }
    setStatus("disconnected");
    setStatusMsg("");
    try {
      Vio.init({
        apiKey: "",
        environment: "development",
        apiBase: resolvedBase,
        graphQLBase: resolvedGql,
        stripePublishableKey: resolvedStripe,
      });
    } catch {
      /* noop */
    }
  }, [resolvedBase, resolvedGql, resolvedStripe]);

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
    setApiKeyInput(resolvedKey);
    void connect(resolvedKey);
  }, [isOwner, resolvedKey, connect]);

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

  // Cart / detail → Klarna → open checkout in EXPRESS mode (like the demo):
  // the event carries { sponsorId, paymentMethod:'klarna', express:true }. Express
  // shows only the Klarna widget + shipping — no manual Leveringsadresse form
  // (Klarna collects the address). Apple Pay never comes here: it charges directly
  // from the cart footer (address from Wallet).
  const onCheckoutOpen = (e: any) => {
    const detail = e?.detail ?? {};
    const sponsorId = detail.sponsorId;
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
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12 }}>
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

      <label
        style={{
          display: "block",
          fontSize: 11,
          textTransform: "uppercase",
          letterSpacing: "0.06em",
          opacity: 0.55,
          marginBottom: 4,
        }}
      >
        Vio API key
      </label>
      <input
        value={apiKeyInput}
        onChange={(e) => setApiKeyInput(e.target.value)}
        placeholder="vg-demo_api_key_…"
        spellCheck={false}
        style={{
          boxSizing: "border-box",
          width: "100%",
          padding: "8px 10px",
          fontSize: 13,
          fontFamily: "ui-monospace, Menlo, monospace",
          border: "1px solid #ddd",
          borderRadius: 6,
          outline: "none",
          background: "#fafafa",
        }}
      />

      <div style={{ display: "flex", gap: 8, marginTop: 12 }}>
        <button
          type="button"
          onClick={onSave}
          style={{
            flex: 1,
            padding: "9px 12px",
            fontSize: 13,
            fontWeight: 600,
            color: "#fff",
            background: "#0a0a0a",
            border: "none",
            borderRadius: 6,
            cursor: "pointer",
          }}
        >
          Save
        </button>
        <button
          type="button"
          onClick={onDisconnect}
          style={{
            padding: "9px 12px",
            fontSize: 13,
            fontWeight: 600,
            color: "#dc2626",
            background: "#fff",
            border: "1px solid #eab8b8",
            borderRadius: 6,
            cursor: "pointer",
          }}
        >
          Disconnect
        </button>
      </div>
    </div>
  );

  const fabScaleHover = cartEffect === "scale" && fabHover;
  const overlays = (
    <>
      {cartButton ? (
      <button
        type="button"
        aria-label="Handlekurv"
        className={cartEffect === "pulse" ? "vio-fab-pulse" : undefined}
        onClick={() => cartRef.current?.show?.()}
        onMouseEnter={() => setFabHover(true)}
        onMouseLeave={() => setFabHover(false)}
        style={{
          position: "fixed",
          ...cartPositionStyle(cartPosition),
          width: cartSize,
          height: cartSize,
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
    </>
  );

  return (
    <>
      {disabled ? panel : null}
      {createPortal(overlays, document.body)}
    </>
  );
}

registerVevComponent(VioConfig, {
  name: "Vio Config (SDK)",
  size: { width: 320, height: "auto" },
  props: [
    { name: "apiKey", title: "Vio API Key", type: "string", initialValue: DEFAULT_API_KEY },
    { name: "apiBase", title: "API Base", type: "string", initialValue: DEFAULT_API_BASE },
    { name: "graphQLBase", title: "GraphQL Base", type: "string", initialValue: DEFAULT_GQL_BASE },
    { name: "stripePublishableKey", title: "Stripe PK", type: "string", initialValue: DEFAULT_STRIPE_PK },
    { name: "cartButton", title: "Cart button", type: "boolean", initialValue: true },
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
  ],
});
