import React, { useEffect, useState } from "react";
import { registerVevComponent } from "@vev/react";
import { Vio, primaryImageUrl } from "../../vio-sdk";
import ProductSelect from "./product-select";

/**
 * Vio Product Card — VEV-NATIVO + configurable. Dibuja SU PROPIA UI y llama al
 * CORE por debajo (Vio.commerceFor / Vio.cart). Da libertad creativa al editor de
 * Vev por 3 vías:
 *   1. props    — layout, botón, toggles, descuento, annonse, color de acento.
 *   2. editableCSS — reestilizar selectores desde el panel de diseño de Vev.
 *   3. slot overlay — arrastrar contenido Vev propio ENCIMA de la imagen (children).
 * La lógica (pricing, carrito, multi-sponsor) sigue única en el core.
 */

const DEFAULT_API_KEY = "vg-demo_api_key_57a3038c06434330";
const DEFAULT_API_BASE = "https://api-staging.vio.live";
const DEFAULT_GQL_BASE = "https://graph-ql-dev.vio.live";

const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

const STYLE_ID = "vio-native-card-styles";
const CARD_CSS = `
.vio-native-card {
  box-sizing: border-box; width: 100%; height: 100%; cursor: pointer;
  display: flex; flex-direction: column;
  font-family: var(--vio-font-sans, -apple-system, sans-serif);
  color: var(--vio-color-text, #0a0a0a); -webkit-tap-highlight-color: transparent;
}
.vio-native-card.l-horizontal { flex-direction: row; gap: 14px; align-items: stretch; }
.vio-native-card.l-horizontal .vnc-image { width: 42%; flex-shrink: 0; }
.vio-native-card.l-horizontal .vnc-meta { padding-top: 0; justify-content: center; }
.vio-native-card .vnc-image {
  position: relative; aspect-ratio: 1 / 1; width: 100%;
  background-color: var(--vio-color-surface-muted, #f2f2f2);
  display: flex; align-items: center; justify-content: center;
  overflow: hidden; transition: opacity 0.2s ease;
}
.vio-native-card:hover .vnc-image img { opacity: 0.92; }
.vio-native-card .vnc-image img { width: 100%; height: 100%; object-fit: cover; display: block; }

/* Slot overlay: contenido Vev del editor encima de la imagen. Transparente al
   click salvo donde hay contenido real (Vev envuelve cada hijo). */
.vio-native-card .vnc-slot { position: absolute; inset: 0; z-index: 4; pointer-events: none; }
.vio-native-card .vnc-slot > * { pointer-events: auto; }

/* Badge de descuento (esquina) + etiqueta annonse. */
.vio-native-card .vnc-badge {
  position: absolute; top: 10px; left: 10px; z-index: 3;
  background: var(--vnc-accent, #0a0a0a); color: #fff;
  font-size: 12px; font-weight: 700; line-height: 1; padding: 5px 8px; border-radius: 4px;
}
.vio-native-card .vnc-annonse {
  position: absolute; top: 10px; right: 10px; z-index: 3;
  background: rgba(255,255,255,0.9); color: #666;
  font-size: 10px; font-weight: 600; letter-spacing: 0.08em; text-transform: uppercase;
  padding: 3px 7px; border-radius: 3px;
}

/* Botón añadir — icono flotante. */
.vio-native-card .vnc-add {
  position: absolute; right: 10px; bottom: 10px; width: 40px; height: 40px;
  border-radius: 50%; background: rgba(255, 255, 255, 0.96); border: none;
  display: flex; align-items: center; justify-content: center; cursor: pointer;
  color: #0a0a0a; box-shadow: 0 2px 10px rgba(0, 0, 0, 0.16);
  transition: transform 0.14s ease, background 0.14s ease, color 0.14s ease; padding: 0; z-index: 3;
}
.vio-native-card .vnc-add:hover { background: #fff; transform: scale(1.08); }
.vio-native-card .vnc-add:active { transform: scale(0.95); }
.vio-native-card .vnc-add.in-cart { background: #0a0a0a; color: #fff; }
.vio-native-card .vnc-add.in-cart:hover { background: #222; }
.vio-native-card .vnc-add.pop { animation: vio-add-pop 0.42s cubic-bezier(0.34, 1.56, 0.64, 1); }
.vio-native-card .vnc-add svg { width: 18px; height: 18px; }
.vio-native-card .vnc-count { font-size: 15px; font-weight: 700; line-height: 1; }
@keyframes vio-add-pop { 0% { transform: scale(1); } 35% { transform: scale(1.32); } 60% { transform: scale(0.9); } 100% { transform: scale(1); } }

/* Botón de texto (pill) + barra full-width. */
.vio-native-card .vnc-btn-text {
  border: none; cursor: pointer; background: var(--vnc-accent, #0a0a0a); color: #fff;
  font-family: inherit; font-size: 13px; font-weight: 600; letter-spacing: 0.02em;
  transition: opacity 0.15s ease;
}
.vio-native-card .vnc-btn-text:hover { opacity: 0.88; }
.vio-native-card .vnc-btn-pill { position: absolute; right: 10px; bottom: 10px; z-index: 3; padding: 10px 16px; border-radius: 999px; }
.vio-native-card .vnc-btn-bar { width: 100%; margin-top: 10px; padding: 14px; border-radius: 6px; text-transform: uppercase; letter-spacing: 0.08em; }

.vio-native-card .vnc-meta { padding-top: 14px; display: flex; flex-direction: column; flex: 1; }
.vio-native-card .vnc-brand {
  font-size: 12px; letter-spacing: 0.1em; text-transform: uppercase;
  color: var(--vio-color-text-secondary, #666); font-weight: 500; margin-bottom: 6px;
}
.vio-native-card .vnc-name {
  font-size: 16px; font-weight: 500; line-height: 1.3; margin: 0 0 10px;
  display: -webkit-box; -webkit-line-clamp: 2; line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden;
}
.vio-native-card .vnc-price { font-size: 16px; font-weight: 700; margin-bottom: 16px; }
.vio-native-card .vnc-retailer {
  font-size: 12px; letter-spacing: 0.1em; text-transform: uppercase;
  color: var(--vio-color-text-tertiary, #999); font-weight: 500; margin-top: auto;
}

/* Layout overlay: meta sobre la imagen. */
.vio-native-card.l-overlay .vnc-overlay-meta {
  position: absolute; left: 0; right: 0; bottom: 0; z-index: 3; padding: 16px;
  background: linear-gradient(to top, rgba(0,0,0,0.72), rgba(0,0,0,0)); color: #fff;
}
.vio-native-card.l-overlay .vnc-overlay-meta .vnc-brand,
.vio-native-card.l-overlay .vnc-overlay-meta .vnc-retailer { color: rgba(255,255,255,0.85); }
.vio-native-card.l-overlay .vnc-overlay-meta .vnc-name,
.vio-native-card.l-overlay .vnc-overlay-meta .vnc-price { color: #fff; margin-bottom: 4px; }
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

/** Descuento a mostrar: manual (texto libre) o auto (desde compare-at si existe). */
function resolveDiscount(p: any, mode: string, manual: string): string | null {
  if (mode === "manual") return manual?.trim() || null;
  if (mode === "auto" && p?.price) {
    const now = Number(p.price.amount);
    const was = Number(
      p.price.compare_at ?? p.price.original ?? p.price.original_amount ?? p.compare_at ?? NaN
    );
    if (Number.isFinite(was) && was > now && now > 0) {
      return `-${Math.round((1 - now / was) * 100)} %`;
    }
    const pct = Number(p.price.discount_percentage ?? p.discount ?? NaN);
    if (Number.isFinite(pct) && pct > 0) return `-${Math.round(pct)} %`;
  }
  return null;
}

type Props = {
  product?: { productId?: number; sponsorId?: number };
  layout?: string; // standard | image-only | overlay | horizontal
  buttonStyle?: string; // icon | text | bar | hidden
  buttonLabel?: string;
  buttonAction?: string; // add | detail
  accentColor?: string;
  showBrand?: boolean;
  showName?: boolean;
  showPrice?: boolean;
  showRetailer?: boolean;
  discountMode?: string; // off | auto | manual
  discountText?: string;
  annonse?: boolean;
  annonseText?: string;
  children?: React.ReactNode; // slot overlay del editor
};

export default function VioProductCard({
  product,
  layout = "standard",
  buttonStyle = "icon",
  buttonLabel = "Kjøp",
  buttonAction = "add",
  accentColor,
  showBrand = true,
  showName = true,
  showPrice = true,
  showRetailer = true,
  discountMode = "off",
  discountText = "-25 %",
  annonse = false,
  annonseText = "Annonse",
  children,
}: Props) {
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

  // Cantidad en carrito (core → UI).
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
  const discount = resolveDiscount(p, discountMode, discountText);
  const isImageOnly = layout === "image-only";
  const isOverlay = layout === "overlay";
  const accentStyle = accentColor ? ({ ["--vnc-accent" as any]: accentColor } as React.CSSProperties) : undefined;

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

  const doAdd = () => {
    if (!p) return;
    if (hasVariants) {
      openDetail();
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

  const onButton = (e: React.MouseEvent) => {
    e.stopPropagation();
    buttonAction === "detail" ? openDetail() : doAdd();
  };

  const metaBlock = (
    <>
      {showBrand && brand ? <div className="vnc-brand">{brand}</div> : null}
      {showName && name ? <div className="vnc-name">{name}</div> : null}
      {showPrice && price ? <div className="vnc-price">{price}</div> : null}
      {showRetailer && retailer ? <div className="vnc-retailer">{retailer}</div> : null}
    </>
  );

  return (
    <div
      className={`vio-native-card l-${layout}`}
      style={accentStyle}
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

        {discount ? <span className="vnc-badge">{discount}</span> : null}
        {annonse ? <span className="vnc-annonse">{annonseText}</span> : null}

        {buttonStyle === "icon" ? (
          <button
            className={`vnc-add ${inCart ? "in-cart" : ""} ${pop ? "pop" : ""}`}
            onClick={onButton}
            aria-label={inCart ? "I handlekurven – legg til en til" : "Legg i kurv"}
            title={inCart ? "I handlekurven" : "Legg i kurv"}
          >
            {inCart ? (qty > 1 ? <span className="vnc-count">{qty}</span> : <CheckIcon />) : <BagIcon />}
          </button>
        ) : null}

        {buttonStyle === "text" ? (
          <button className="vnc-btn-text vnc-btn-pill" onClick={onButton}>
            {inCart ? `${buttonLabel} · ${qty}` : buttonLabel}
          </button>
        ) : null}

        {isOverlay && !isImageOnly ? <div className="vnc-overlay-meta">{metaBlock}</div> : null}

        {/* Slot overlay del editor (contenido Vev arrastrado encima). */}
        <div className="vnc-slot">{children}</div>
      </div>

      {!isImageOnly && !isOverlay ? <div className="vnc-meta">{metaBlock}</div> : null}

      {buttonStyle === "bar" ? (
        <button className="vnc-btn-text vnc-btn-bar" onClick={onButton}>
          {inCart ? `${buttonLabel} · ${qty}` : buttonLabel}
        </button>
      ) : null}
    </div>
  );
}

registerVevComponent(VioProductCard, {
  name: "Vio Product Card",
  type: "both",
  children: { name: "Overlay imagen" },
  size: { height: "auto", width: 300 },
  editableCSS: [
    { selector: ".vio-native-card", title: "Card", properties: ["background", "border-radius", "padding", "box-shadow", "gap"] },
    { selector: ".vio-native-card .vnc-image", title: "Imagen", properties: ["border-radius", "aspect-ratio", "background-color"] },
    { selector: ".vio-native-card .vnc-add", title: "Botón (icono)", properties: ["background", "color", "border-radius", "box-shadow", "width", "height"] },
    { selector: ".vio-native-card .vnc-btn-text", title: "Botón (texto)", properties: ["background", "color", "border-radius", "font-size", "padding", "letter-spacing"] },
    { selector: ".vio-native-card .vnc-badge", title: "Badge descuento", properties: ["background", "color", "border-radius", "font-size", "padding"] },
    { selector: ".vio-native-card .vnc-brand", title: "Marca", properties: ["color", "font-size", "letter-spacing", "font-weight"] },
    { selector: ".vio-native-card .vnc-name", title: "Nombre", properties: ["color", "font-size", "font-weight", "font-family", "line-height"] },
    { selector: ".vio-native-card .vnc-price", title: "Precio", properties: ["color", "font-size", "font-weight"] },
    { selector: ".vio-native-card .vnc-retailer", title: "Retailer", properties: ["color", "font-size", "letter-spacing"] },
  ],
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
      name: "layout",
      title: "Layout",
      type: "select",
      initialValue: "standard",
      options: {
        display: "dropdown",
        items: [
          { value: "standard", label: "Estándar (imagen + info)" },
          { value: "image-only", label: "Solo imagen" },
          { value: "overlay", label: "Info sobre la imagen" },
          { value: "horizontal", label: "Horizontal" },
        ],
      },
    } as any,
    {
      name: "buttonStyle",
      title: "Botón",
      type: "select",
      initialValue: "icon",
      options: {
        display: "dropdown",
        items: [
          { value: "icon", label: "Icono (+)" },
          { value: "text", label: "Texto (pill)" },
          { value: "bar", label: "Barra full-width" },
          { value: "hidden", label: "Sin botón" },
        ],
      },
    } as any,
    { name: "buttonLabel", title: "Texto del botón", type: "string", initialValue: "Kjøp" },
    {
      name: "buttonAction",
      title: "Acción del botón",
      type: "select",
      initialValue: "add",
      options: {
        display: "dropdown",
        items: [
          { value: "add", label: "Añadir al carrito" },
          { value: "detail", label: "Abrir detalle" },
        ],
      },
    } as any,
    { name: "accentColor", title: "Color de acento", type: "string", initialValue: "" },
    { name: "showBrand", title: "Mostrar marca", type: "boolean", initialValue: true },
    { name: "showName", title: "Mostrar nombre", type: "boolean", initialValue: true },
    { name: "showPrice", title: "Mostrar precio", type: "boolean", initialValue: true },
    { name: "showRetailer", title: "Mostrar retailer", type: "boolean", initialValue: true },
    {
      name: "discountMode",
      title: "Badge de descuento",
      type: "select",
      initialValue: "off",
      options: {
        display: "dropdown",
        items: [
          { value: "off", label: "Off" },
          { value: "auto", label: "Auto (desde oferta)" },
          { value: "manual", label: "Manual (texto)" },
        ],
      },
    } as any,
    { name: "discountText", title: "Texto del descuento (manual)", type: "string", initialValue: "-25 %" },
    { name: "annonse", title: "Etiqueta 'Annonse'", type: "boolean", initialValue: false },
    { name: "annonseText", title: "Texto annonse", type: "string", initialValue: "Annonse" },
  ],
});
