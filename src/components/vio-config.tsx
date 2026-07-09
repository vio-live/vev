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

type Props = {
  apiKey?: string;
  apiBase?: string;
  graphQLBase?: string;
  stripePublishableKey?: string;
};

export default function VioConfig({
  apiKey,
  apiBase,
  graphQLBase,
  stripePublishableKey,
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
  const resolvedKey = apiKey || DEFAULT_API_KEY;

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

  const disconnect = useCallback(() => {
    setStatus("disconnected");
    setStatusMsg("");
    // Soft disconnect: clear the cached bootstrap so a later Save re-fetches.
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

  // Claim overlay ownership (idempotent via globalThis).
  useEffect(() => {
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
          onClick={() => void connect(apiKeyInput)}
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
          onClick={disconnect}
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

  const overlays = (
    <>
      <button
        type="button"
        aria-label="Handlekurv"
        onClick={() => cartRef.current?.show?.()}
        onMouseEnter={() => setFabHover(true)}
        onMouseLeave={() => setFabHover(false)}
        style={{
          position: "fixed",
          right: 24,
          bottom: 24,
          width: 56,
          height: 56,
          borderRadius: 9999,
          background: "#0a0a0a",
          color: "#fff",
          border: "none",
          cursor: "pointer",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          boxShadow: fabHover ? "0 8px 24px rgba(0,0,0,0.28)" : "0 4px 16px rgba(0,0,0,0.22)",
          transform: fabHover ? "scale(1.08)" : "scale(1)",
          transition: "transform 0.14s ease, box-shadow 0.14s ease",
          zIndex: 2147483000,
        }}
      >
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.7}>
          <path d="M6 2L3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4z" />
          <line x1="3" y1="6" x2="21" y2="6" />
          <path d="M16 10a4 4 0 0 1-8 0" />
        </svg>
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
  ],
});
