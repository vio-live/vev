import React, { useEffect, useRef, useState } from "react";
import { Vio, primaryImageUrl } from "../../vio-sdk";
import { checkHasVariants, fetchVioProduct, getProductPriceAmount, openCart } from "./vio-helpers";
import {
  productToItem,
  trackAddToCart,
  trackSelectItem,
  trackViewItem,
  trackViewItemList,
  observeVioImpression,
} from "./analytics";

/**
 * Reusable Vio product card — presentation + interaction, shared by the single
 * Product Card block and the Carousel / Grid. UI is 100% ours (Vev-native);
 * behaviour calls the core (Vio.cart, product-detail events). Design lives here
 * so every product surface looks identical and editors restyle one place.
 */

export type CardConfig = {
  layout?: string; // standard | image-only | overlay | horizontal
  buttonStyle?: string; // icon | text | bar | hidden
  buttonLabel?: string;
  buttonAction?: string; // add | detail
  imageClickAction?: string; // detail | add (variants always -> detail)
  accentColor?: string;
  showBrand?: boolean;
  showName?: boolean;
  showPrice?: boolean;
  showRetailer?: boolean;
  discountMode?: string; // off | auto | manual
  discountText?: string;
  annonse?: boolean;
  annonseText?: string;
};

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

.vio-native-card .vnc-add {
  position: absolute; right: 10px; bottom: 10px; width: 40px; height: 40px;
  border-radius: 50%; background: rgba(255, 255, 255, 0.96); border: none;
  display: flex; align-items: center; justify-content: center; cursor: pointer;
  color: #0a0a0a; box-shadow: 0 2px 10px rgba(0, 0, 0, 0.16);
  transition: transform 0.14s ease, background 0.14s ease, color 0.14s ease; padding: 0; z-index: 5;
}
.vio-native-card .vnc-add:hover { background: #fff; transform: scale(1.08); }
.vio-native-card .vnc-add:active { transform: scale(0.95); }
.vio-native-card .vnc-add.in-cart { background: #0a0a0a; color: #fff; }
.vio-native-card .vnc-add.in-cart:hover { background: #222; }
.vio-native-card .vnc-add.pop { animation: vio-add-pop 0.42s cubic-bezier(0.34, 1.56, 0.64, 1); }
.vio-native-card .vnc-add svg { width: 18px; height: 18px; }
.vio-native-card .vnc-count { font-size: 15px; font-weight: 700; line-height: 1; }
@keyframes vio-add-pop { 0% { transform: scale(1); } 35% { transform: scale(1.32); } 60% { transform: scale(0.9); } 100% { transform: scale(1); } }

.vio-native-card .vnc-btn-text {
  border: none; cursor: pointer; background: var(--vnc-accent, #0a0a0a); color: #fff;
  font-family: inherit; font-size: 13px; font-weight: 600; letter-spacing: 0.02em;
  transition: opacity 0.15s ease;
}
.vio-native-card .vnc-btn-text:hover { opacity: 0.88; }
.vio-native-card .vnc-btn-pill { position: absolute; right: 10px; bottom: 10px; z-index: 5; padding: 10px 16px; border-radius: 999px; }
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

.vio-native-card.l-overlay .vnc-overlay-meta {
  position: absolute; left: 0; right: 0; bottom: 0; z-index: 3; padding: 16px;
  background: linear-gradient(to top, rgba(0,0,0,0.72), rgba(0,0,0,0)); color: #fff;
}
.vio-native-card.l-overlay .vnc-overlay-meta .vnc-brand,
.vio-native-card.l-overlay .vnc-overlay-meta .vnc-retailer { color: rgba(255,255,255,0.85); }
.vio-native-card.l-overlay .vnc-overlay-meta .vnc-name,
.vio-native-card.l-overlay .vnc-overlay-meta .vnc-price { color: #fff; margin-bottom: 4px; }

/* Skeleton while a product loads. */
.vio-native-card .vnc-skel { background: #ececec; border-radius: 4px; animation: vio-skel 1.2s ease-in-out infinite; }
@keyframes vio-skel { 0%,100% { opacity: 1; } 50% { opacity: 0.5; } }
.vio-native-card .vnc-unavailable { color: #b0b0b0; font-size: 12px; text-transform: uppercase; letter-spacing: 0.06em; }
`;

export function injectCardStyles(): void {
  if (typeof document === "undefined") return;
  if (document.getElementById(STYLE_ID)) return;
  const styleEl = document.createElement("style");
  styleEl.id = STYLE_ID;
  styleEl.textContent = CARD_CSS;
  document.head.appendChild(styleEl);
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

function resolveDiscount(p: any, mode?: string, manual?: string): string | null {
  if (mode === "manual") return manual?.trim() || null;
  if (mode === "auto" && p?.price) {
    const amountVal = getProductPriceAmount(p);
    if (amountVal == null) return null;
    const now = Number(amountVal);
    const was = Number(
      p.price.compare_at ?? p.price.original ?? p.price.original_amount ?? p.compare_at ?? NaN
    );
    if (Number.isFinite(was) && was > now && now > 0) return `-${Math.round((1 - now / was) * 100)} %`;
    const pct = Number(p.price.discount_percentage ?? p.discount ?? NaN);
    if (Number.isFinite(pct) && pct > 0) return `-${Math.round(pct)} %`;
  }
  return null;
}

/** Fetch a single product DTO (with retry). Returns { product, loading }. */
export function useVioProduct(productId?: number, sponsorId = 1) {
  const [product, setProduct] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    if (productId == null) {
      setProduct(null);
      setLoading(false);
      return;
    }
    let cancelled = false;
    setLoading(true);
    fetchVioProduct(productId, sponsorId).then((p) => {
      if (cancelled) return;
      setProduct(p);
      setLoading(false);
    });
    return () => {
      cancelled = true;
    };
  }, [productId, sponsorId]);
  return { product, loading };
}

/** Live quantity of a product in the cart (subscribes to Vio.cart). */
export function useCartQty(productId?: number, sponsorId = 1): number {
  const [qty, setQty] = useState(0);
  useEffect(() => {
    const update = () => {
      if (productId == null) return setQty(0);
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
  return qty;
}

type ProductCardViewProps = {
  productId?: number;
  sponsorId?: number;
  product: any | null;
  loading?: boolean;
  qty: number;
  config?: CardConfig;
  /** Solo lo pasa la tarjeta SUELTA, para observar su impresión. Dentro de
   *  una grilla o carrusel queda sin pasar: ahí cuenta el contenedor. */
  rootRef?: React.Ref<HTMLDivElement>;
};

export function ProductCardView({
  productId,
  sponsorId = 1,
  product,
  loading,
  qty,
  config = {},
  rootRef,
}: ProductCardViewProps) {
  const [pop, setPop] = useState(false);

  useEffect(() => {
    injectCardStyles();
  }, []);

  const {
    layout = "standard",
    buttonStyle = "icon",
    buttonLabel = "Kjøp",
    buttonAction = "add",
    imageClickAction = "detail",
    accentColor,
    showBrand = true,
    showName = true,
    showPrice = true,
    showRetailer = true,
    discountMode = "off",
    discountText = "-25 %",
    annonse = false,
    annonseText = "Annonse",
  } = config;

  const p = product;
  const img = p ? primaryImageUrl(p) ?? "" : "";
  const brand = p?.brand ?? "";
  const name = p?.title ?? "";
  // Products with options show a "from" price (uses the correct product base
  // price, not the per-variant prices which the feed may ship mislabeled).
  const hasVariants = checkHasVariants(p);
  const priceAmount = getProductPriceAmount(p);
  const price = p?.price && priceAmount != null
    ? `${hasVariants ? "Fra " : ""}${priceAmount} ${p.price.currency_code ?? ""}`
    : "";
  const retailer = p?.supplier?.name ?? p?.brand ?? "";
  const inCart = qty > 0;
  const discount = resolveDiscount(p, discountMode, discountText);
  const isImageOnly = layout === "image-only";
  const isOverlay = layout === "overlay";
  const accentStyle = accentColor ? ({ ["--vnc-accent" as any]: accentColor } as React.CSSProperties) : undefined;

  const openDetail = () => {
    if (productId == null) return;
    // Funnel: a shoppable card was clicked (select_item), and the detail it opens
    // counts as a product view (view_item).
    const item = p ? productToItem(p) : { productId, name, brand };
    trackSelectItem(item);
    trackViewItem(item);
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
      Vio.cart.addProduct({ product: p, sponsorId: Number(sponsorId), quantity: 1 });
      trackAddToCart(productToItem(p, { quantity: 1 }));
      setPop(true);
      setTimeout(() => setPop(false), 420);
      openCart();
    } catch (err: any) {
      console.warn("[Vio] addToCart error", err);
    }
  };

  const onImageClick = () => {
    if (hasVariants || imageClickAction !== "add") openDetail();
    else doAdd();
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

  const showMeta = !isImageOnly && !isOverlay;

  // Loading — skeleton in the card's shape.
  if (loading) {
    return (
      <div className={`vio-native-card l-${layout}`} style={accentStyle} aria-busy="true">
        <div className="vnc-image">
          <div className="vnc-skel" style={{ position: "absolute", inset: 0 }} />
        </div>
        {showMeta ? (
          <div className="vnc-meta">
            <div className="vnc-skel" style={{ height: 10, width: "40%", marginBottom: 8 }} />
            <div className="vnc-skel" style={{ height: 16, width: "85%", marginBottom: 10 }} />
            <div className="vnc-skel" style={{ height: 16, width: "30%" }} />
          </div>
        ) : null}
      </div>
    );
  }

  // Fetch failed / product not found — discreet placeholder (never a blank hole).
  if (productId != null && !p) {
    return (
      <div className={`vio-native-card l-${layout}`} style={accentStyle}>
        <div className="vnc-image vnc-unavailable" role="img" aria-label="Kunne ikke laste produkt">
          <span>Utilgjengelig</span>
        </div>
      </div>
    );
  }

  return (
    <div ref={rootRef} className={`vio-native-card l-${layout}`} style={accentStyle}>
      <div
        className="vnc-image"
        role="button"
        tabIndex={0}
        aria-label={`${brand} ${name} ${price}`}
        onClick={onImageClick}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            onImageClick();
          }
        }}
      >
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

/** Render a card from an already-fetched product DTO (carousel / grid items). */
export function ProductCardFromDTO({
  product,
  sponsorId = 1,
  config,
}: {
  product: any;
  sponsorId?: number;
  config?: CardConfig;
}) {
  const id = product?.id != null ? Number(product.id) : undefined;
  const qty = useCartQty(id, sponsorId);
  return (
    <ProductCardView
      productId={id}
      sponsorId={sponsorId}
      product={product}
      qty={qty}
      config={config}
    />
  );
}

/** Self-contained card: fetches its own product by id, then renders the view. */
export function VioProductCardSelf({
  productId,
  sponsorId = 1,
  config,
}: {
  productId?: number;
  sponsorId?: number;
  config?: CardConfig;
}) {
  const { product, loading } = useVioProduct(productId, sponsorId);
  const qty = useCartQty(productId, sponsorId);

  // Impression (view_item_list of one) — fired here so a standalone card counts,
  // without double-firing when the same view renders inside a carousel / grid
  // (those fire the list impression at the container).
  useEffect(() => {
    if (product) trackViewItemList([productToItem(product)], product?.title);
  }, [product]);

  // Impresión REAL (≥50% visible ≥1s). Depende de product: el ref recién
  // apunta a la raíz cargada cuando el producto llegó.
  const rootRef = useRef<HTMLDivElement | null>(null);
  useEffect(() => {
    if (!product) return;
    return observeVioImpression(
      rootRef.current,
      { sponsorId, componentTemplateId: "vev-card" },
      `vev-card:${sponsorId}:${productId}`,
    );
  }, [product, sponsorId, productId]);

  return (
    <ProductCardView
      productId={productId}
      sponsorId={sponsorId}
      product={product}
      loading={loading}
      qty={qty}
      config={config}
      rootRef={rootRef}
    />
  );
}
