import React, { useEffect, useState } from "react";
import { registerVevComponent } from "@vev/react";
import { Vio, primaryImageUrl } from "../../vio-sdk";
import ProductSelect from "./product-select";

/**
 * Vio Product Card — VEV-NATIVO. Dibuja SU PROPIA UI (no usa el <vio-product> del
 * SDK) y llama al CORE por debajo: `Vio.commerceFor(...)` para datos y `Vio.cart`
 * para el carrito. Así el diseño va "por libre" (VG/Aller lo iteran sin tocar el
 * SDK) mientras la lógica (pricing, carrito, multi-sponsor) sigue única en el core.
 * hideMeta = un simple condicional aquí, ya no un cambio en el SDK.
 */

// Defaults del SDK — el card es autosuficiente (init-if-needed + retry) porque los
// bloques Vev montan sin orden garantizado. La commerce key sigue siendo dinámica.
const DEFAULT_API_KEY = "vg-demo_api_key_57a3038c06434330";
const DEFAULT_API_BASE = "https://api-staging.vio.live";
const DEFAULT_GQL_BASE = "https://graph-ql-dev.vio.live";

const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

// CSS propio, inyectado una vez (Vev no compila Tailwind → estilos scoped nuestros).
// Réplica del look editorial del SDK, pero AHORA es nuestro (aquí se toca el diseño).
const STYLE_ID = "vio-native-card-styles";
const CARD_CSS = `
.vio-native-card {
  box-sizing: border-box; width: 100%; height: 100%; cursor: pointer;
  display: flex; flex-direction: column;
  font-family: var(--vio-font-sans, -apple-system, sans-serif);
  color: var(--vio-color-text, #0a0a0a); -webkit-tap-highlight-color: transparent;
}
.vio-native-card .vnc-image {
  position: relative; aspect-ratio: 1 / 1; width: 100%;
  background-color: var(--vio-color-surface-muted, #f2f2f2);
  display: flex; align-items: center; justify-content: center;
  overflow: hidden; transition: opacity 0.2s ease;
}
.vio-native-card:hover .vnc-image img { opacity: 0.92; }
.vio-native-card .vnc-image img { width: 100%; height: 100%; object-fit: cover; display: block; }
.vio-native-card .vnc-add {
  position: absolute; right: 10px; bottom: 10px; width: 40px; height: 40px;
  border-radius: 50%; background: rgba(255, 255, 255, 0.96); border: none;
  display: flex; align-items: center; justify-content: center; cursor: pointer;
  color: #0a0a0a; box-shadow: 0 2px 10px rgba(0, 0, 0, 0.16);
  transition: transform 0.14s ease, background 0.14s ease, color 0.14s ease;
  padding: 0; z-index: 2;
}
.vio-native-card .vnc-add:hover { background: #fff; transform: scale(1.08); }
.vio-native-card .vnc-add:active { transform: scale(0.95); }
.vio-native-card .vnc-add.in-cart { background: #0a0a0a; color: #fff; }
.vio-native-card .vnc-add.in-cart:hover { background: #222; }
.vio-native-card .vnc-add.pop { animation: vio-add-pop 0.42s cubic-bezier(0.34, 1.56, 0.64, 1); }
.vio-native-card .vnc-add svg { width: 18px; height: 18px; }
.vio-native-card .vnc-count { font-size: 15px; font-weight: 700; line-height: 1; }
@keyframes vio-add-pop { 0% { transform: scale(1); } 35% { transform: scale(1.32); } 60% { transform: scale(0.9); } 100% { transform: scale(1); } }
.vio-native-card .vnc-meta { padding-top: 14px; display: flex; flex-direction: column; flex: 1; }
.vio-native-card .vnc-brand {
  font-size: 12px; letter-spacing: 0.1em; text-transform: uppercase;
  color: var(--vio-color-text-secondary, #666); font-weight: 500; margin-bottom: 6px;
}
.vio-native-card .vnc-name {
  font-size: 16px; font-weight: 500; line-height: 1.3; margin: 0 0 10px;
  display: -webkit-box; -webkit-line-clamp: 2; line-clamp: 2;
  -webkit-box-orient: vertical; overflow: hidden;
}
.vio-native-card .vnc-price { font-size: 16px; font-weight: 700; margin-bottom: 16px; }
.vio-native-card .vnc-retailer {
  font-size: 12px; letter-spacing: 0.1em; text-transform: uppercase;
  color: var(--vio-color-text-tertiary, #999); font-weight: 500; margin-top: auto;
}
`;
function injectStyles() {
  if (typeof document === "undefined") return;
  if (document.getElementById(STYLE_ID)) return;
  const el = document.createElement("style");
  el.id = STYLE_ID;
  el.textContent = CARD_CSS;
  document.head.appendChild(el);
}

const BagIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.7}>
    <path d="M6 2L3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4z" />
    <line x1="3" y1="6" x2="21" y2="6" />
    <path d="M16 10a4 4 0 0 1-8 0" />
  </svg>
);
const CheckIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.4}>
    <polyline points="20 6 9 17 4 12" />
  </svg>
);

type Props = {
  product?: { productId?: number; sponsorId?: number };
  hideMeta?: boolean;
};

export default function VioProductCard({ product, hideMeta }: Props) {
  const productId = product?.productId;
  const sponsorId = product?.sponsorId ?? 1;
  const [p, setP] = useState<any>(null);
  const [qty, setQty] = useState(0);
  const [pop, setPop] = useState(false);

  useEffect(() => {
    injectStyles();
  }, []);

  // Datos vía CORE (autosuficiente: init-if-needed + reintento).
  useEffect(() => {
    if (!productId) return;
    let cancelled = false;
    (async () => {
      for (let attempt = 0; attempt < 8 && !cancelled; attempt++) {
        try {
          if (!Vio.isInitialized) {
            Vio.init({
              apiKey: DEFAULT_API_KEY,
              environment: "development",
              apiBase: DEFAULT_API_BASE,
              graphQLBase: DEFAULT_GQL_BASE,
            });
          }
          await Vio.bootstrap();
          const client = Vio.commerceFor(sponsorId);
          const arr = await client.channel.product.getByIds({ product_ids: [productId] });
          const prod = (Array.isArray(arr) ? arr : []).find(
            (x: any) => Number(x.id) === Number(productId)
          );
          console.log("[Vio] product fetch →", { productId, sponsorId, attempt, found: !!prod });
          if (!cancelled) setP(prod ?? null);
          return;
        } catch (e: any) {
          console.warn(`[Vio] product fetch retry ${attempt}`, productId, e?.message ?? e);
          await sleep(300);
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [productId, sponsorId]);

  // Reflejar cantidad en el carrito (core → UI) — igual que hacía el SDK.
  useEffect(() => {
    const update = () => {
      if (!productId) return setQty(0);
      let q = 0;
      const sid = Number(sponsorId);
      for (const cart of Vio.cart?.getAllCarts?.().values?.() ?? []) {
        if (Number.isFinite(sid) && sid > 0 && (cart as any).sponsorId !== sid) continue;
        for (const i of (cart as any).items) {
          if (Number(i.productId) === Number(productId)) q += i.quantity;
        }
      }
      setQty(q);
    };
    update();
    Vio.cart?.addEventListener?.("change", update);
    return () => Vio.cart?.removeEventListener?.("change", update);
  }, [productId, sponsorId]);

  const img = p ? primaryImageUrl(p) ?? "" : "";
  const brand = p?.brand ?? "";
  const name = p?.title ?? "";
  const price = p?.price ? `${p.price.amount} ${p.price.currency_code ?? ""}` : "";
  const retailer = p?.supplier?.name ?? p?.brand ?? "";
  const hasVariants = Boolean(p?.options_enabled);
  const inCart = qty > 0;

  // Click en el card → abre el detalle del SDK (escucha vio:product-click en document).
  const openDetail = () => {
    if (productId == null) return;
    document.dispatchEvent(
      new CustomEvent("vio:product-click", {
        detail: {
          productId: String(productId),
          sponsorId: String(sponsorId),
          brand,
          name,
          price,
          retailer,
          imageUrl: img,
        },
      })
    );
  };

  const addToCart = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!p) return;
    if (hasVariants) {
      openDetail(); // con variantes: abre el detalle a elegir, no añade a ciegas
      return;
    }
    try {
      Vio.cart.addManual({
        productId: Number(productId),
        sponsorId: Number(sponsorId),
        sponsorName: retailer,
        brand,
        name,
        unitPrice: p.price?.amount ?? 0,
        currency: p.price?.currency_code ?? "NOK",
        imageUrl: img,
        quantity: 1,
      });
      setPop(true);
      setTimeout(() => setPop(false), 420);
      document.dispatchEvent(new CustomEvent("vio:open-cart"));
    } catch (err: any) {
      console.warn("[Vio] addToCart error", err);
    }
  };

  return (
    <div
      className="vio-native-card"
      role="button"
      tabIndex={0}
      aria-label={`${brand} ${name} ${price}`}
      onClick={openDetail}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          openDetail();
        }
      }}
    >
      <div className="vnc-image">
        {img ? <img src={img} alt={name || brand} loading="lazy" /> : null}
        <button
          className={`vnc-add ${inCart ? "in-cart" : ""} ${pop ? "pop" : ""}`}
          onClick={addToCart}
          aria-label={inCart ? "I handlekurven – legg til en til" : "Legg i kurv"}
          title={inCart ? "I handlekurven" : "Legg i kurv"}
        >
          {inCart ? (
            qty > 1 ? <span className="vnc-count">{qty}</span> : <CheckIcon />
          ) : (
            <BagIcon />
          )}
        </button>
      </div>
      {!hideMeta && (
        <div className="vnc-meta">
          {brand ? <div className="vnc-brand">{brand}</div> : null}
          {name ? <div className="vnc-name">{name}</div> : null}
          {price ? <div className="vnc-price">{price}</div> : null}
          {retailer ? <div className="vnc-retailer">{retailer}</div> : null}
        </div>
      )}
    </div>
  );
}

registerVevComponent(VioProductCard, {
  name: "Vio Product Card",
  size: { height: "auto", width: 300 },
  props: [
    {
      name: "product",
      title: "Producto",
      type: "object",
      component: ProductSelect as any,
      fields: [
        { name: "productId", type: "number" },
        { name: "sponsorId", type: "number" },
      ],
    },
    {
      name: "hideMeta",
      title: "Solo imagen (ocultar título y precio)",
      type: "boolean",
      initialValue: false,
    },
  ],
});
