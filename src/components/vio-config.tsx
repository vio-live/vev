import React, { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { registerVevComponent } from "@vev/react";
import { Vio, VioCart, VioCheckout, VioProductDetail } from "../../vio-sdk";

/**
 * Vio Configuration — el ÚNICO bloque de setup. Envuelve el vio-web-sdk real:
 *  - Vio.init(...) + Vio.bootstrap()  → config de commerce (Lyko / sponsor)
 *  - monta <VioCart> + <VioCheckout>  → drawers globales del SDK (idénticos al demo)
 *  - botón flotante del carrito + contador
 *  - cablea vio:checkout-open (cart → checkout)
 * Colocas SOLO esto + Product Cards.
 */

// Defaults listos: URLs + Vio API Key (host) hardcodeadas → colocar el bloque
// no requiere configurar nada. La COMMERCE key NO se hardcodea: es dinámica,
// la trae el bootstrap (sponsor.commerce.apiKey), siguiendo el flow.
const DEFAULT_API_KEY = "vg-demo_api_key_57a3038c06434330";
const DEFAULT_API_BASE = "https://api-staging.vio.live";
const DEFAULT_GQL_BASE = "https://graph-ql-dev.vio.live";
// Stripe PUBLISHABLE key (público, seguro en bundle). Habilita el flujo de
// tarjeta + Apple Pay. Apple Pay además exige registrar el dominio del artículo
// en esta cuenta Stripe (Dashboard → Payment methods → Apple Pay).
const DEFAULT_STRIPE_PK =
  "pk_test_51TMTbsECwcLH8wcPAkKSPs0GtSap2rLexnYFQ2PP8j07RLNCO9It5r4SR0RbU5jJ5gxtd7GMCJ5HlK9K77dQLhCr00DdDSr23y";

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
  const cartRef = useRef<any>(null);
  const checkoutRef = useRef<any>(null);
  const [count, setCount] = useState(0);
  const [fabHover, setFabHover] = useState(false);
  const idRef = useRef<string>(
    "vio-cfg-" + Math.random().toString(36).slice(2)
  );
  // Solo UNA instancia de Config es "dueña" de los overlays globales
  // (cart/checkout/detalle) + init + bootstrap. Si el bloque está colocado
  // varias veces —o Vev empaqueta copias del bundle—, las demás no montan
  // nada → evita los N drawers y las N inicializaciones que se pisaban.
  const [isOwner, setIsOwner] = useState(false);

  const resolvedKey = apiKey || DEFAULT_API_KEY;
  const resolvedBase = apiBase || DEFAULT_API_BASE;
  const resolvedGql = graphQLBase || DEFAULT_GQL_BASE;
  const resolvedStripe = stripePublishableKey || DEFAULT_STRIPE_PK;

  // Reclamar la propiedad de los overlays (idempotente vía globalThis).
  useEffect(() => {
    const g = globalThis as any;
    const myId = idRef.current;
    if (!g.__VIO_OVERLAY_OWNER__) g.__VIO_OVERLAY_OWNER__ = myId;
    setIsOwner(g.__VIO_OVERLAY_OWNER__ === myId);
    return () => {
      if (g.__VIO_OVERLAY_OWNER__ === myId) g.__VIO_OVERLAY_OWNER__ = null;
    };
  }, []);

  useEffect(() => {
    if (!isOwner) return;
    console.log(
      "%c[Vio] BUILD sdk-wrap · config (owner)",
      "background:#c14a3b;color:#fff;padding:2px 6px;border-radius:3px"
    );
    Vio.init({
      apiKey: resolvedKey,
      environment: "development",
      apiBase: resolvedBase,
      graphQLBase: resolvedGql,
      stripePublishableKey: resolvedStripe,
    });
    Vio.bootstrap().catch((e: any) => console.warn("[Vio] bootstrap", e));
  }, [isOwner, resolvedKey, resolvedBase, resolvedGql, resolvedStripe]);

  // Contador del carrito
  useEffect(() => {
    if (!isOwner) return;
    const update = () => setCount(Vio.cart?.itemCount ?? 0);
    update();
    Vio.cart?.addEventListener?.("change", update);
    return () => Vio.cart?.removeEventListener?.("change", update);
  }, [isOwner]);

  // Producto (Vio Product Card) pide abrir el carrito → evento de documento
  useEffect(() => {
    if (!isOwner) return;
    const openCart = () => cartRef.current?.show?.();
    document.addEventListener("vio:open-cart", openCart);
    return () => document.removeEventListener("vio:open-cart", openCart);
  }, [isOwner]);

  // Carrito / detalle → Klarna → abre el checkout en MODO EXPRESS (como el demo):
  // el evento trae { sponsorId, paymentMethod:'klarna', express:true }. En express
  // el checkout muestra SOLO el widget Klarna + opciones de envío — sin el form
  // manual de Leveringsadresse (Klarna recoge la dirección). Apple Pay no pasa por
  // aquí: cobra directo desde el footer del carrito (dirección desde Wallet).
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
      const el: any = checkoutRef.current;
      if (el) el.express = express;
      el?.show?.();
    }, 200);
  };

  if (typeof document === "undefined") return null;
  if (!isOwner) return null;

  return createPortal(
    <>
      {(
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
            boxShadow: fabHover
              ? "0 8px 24px rgba(0,0,0,0.28)"
              : "0 4px 16px rgba(0,0,0,0.22)",
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
      )}
      <VioCart ref={cartRef} onCheckoutOpen={onCheckoutOpen} />
      <VioCheckout ref={checkoutRef} />
      {/* Detalle de producto: auto-abre al click en un product card (vio:product-click) */}
      <VioProductDetail
        onCheckoutOpen={onCheckoutOpen}
        onAddedToCart={() => cartRef.current?.show?.()}
      />
    </>,
    document.body
  );
}

registerVevComponent(VioConfig, {
  name: "Vio Config (SDK)",
  size: { width: 1, height: 1 },
  props: [
    { name: "apiKey", title: "Vio API Key", type: "string", initialValue: DEFAULT_API_KEY },
    {
      name: "apiBase",
      title: "API Base",
      type: "string",
      initialValue: "https://api-staging.vio.live",
    },
    {
      name: "graphQLBase",
      title: "GraphQL Base",
      type: "string",
      initialValue: "https://graph-ql-dev.vio.live",
    },
    { name: "stripePublishableKey", title: "Stripe PK", type: "string", initialValue: DEFAULT_STRIPE_PK },
  ],
});
