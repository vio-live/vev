import React, { useEffect, useRef, useState } from "react";
import { registerVevComponent } from "@vev/react";
import { ProductMultiSelect, parseIds } from "./product-picker";
import { ProductCardFromDTO } from "./card-view";
import { CutByFrameNotice, useCutByFrame } from "./editor-fit";
import { CARD_CONFIG_PROPS, CARD_EDITABLE_CSS, pickCardConfig } from "./card-props";
import { observeVioImpression, productToItem, trackViewItemList } from "./analytics";
import { fetchVioProducts, useActiveSponsorId } from "./vio-helpers";

/**
 * Vio Product Carousel — a horizontal, scroll-snapped row of product cards (like
 * the SDK demo carousel). The editor picks the products (modal multi-select),
 * how many are visible at once, the gap, arrows and an optional editorial
 * heading. Cards reuse the shared ProductCardView, so they look identical to the
 * single card and are restyled from the same editableCSS.
 */

const STYLE_ID = "vio-carousel-styles";
const CAROUSEL_CSS = `
.vio-carousel {
  position: relative;
  width: 100%;
  font-family: var(--vio-font-sans, -apple-system, sans-serif);
  color: var(--vio-color-text, #0a0a0a);
}
.vio-carousel-head {
  display: flex; align-items: baseline; justify-content: space-between;
  gap: 12px; margin-bottom: 16px;
}
.vio-carousel-titles { min-width: 0; }
.vio-carousel-kicker {
  font-size: 12px; text-transform: uppercase; letter-spacing: 0.12em;
  color: var(--vio-color-accent, #c14a3b); font-weight: 600; margin-bottom: 6px;
}
.vio-carousel-heading { font-family: var(--vio-font-serif, 'Tinos', Georgia, serif); font-size: 26px; font-weight: 400; margin: 0; }
.vio-carousel-disclaimer { font-size: 11px; text-transform: uppercase; letter-spacing: 0.1em; color: #999; white-space: nowrap; }
.vio-carousel-viewport { position: relative; }
.vio-carousel-track {
  display: flex; overflow-x: auto; scroll-snap-type: x mandatory; scroll-behavior: smooth;
  -ms-overflow-style: none; scrollbar-width: none; padding-bottom: 2px;
}
.vio-carousel-track::-webkit-scrollbar { display: none; }
.vio-carousel-item { flex: 0 0 auto; scroll-snap-align: start; min-width: 140px; }
.vio-carousel-arrow {
  position: absolute; top: 40%; transform: translateY(-50%); z-index: 4;
  width: 40px; height: 40px; border-radius: 50%; border: none; cursor: pointer;
  background: #fff; color: #0a0a0a; box-shadow: 0 2px 12px rgba(0,0,0,0.18);
  display: flex; align-items: center; justify-content: center;
  transition: transform 0.14s ease, opacity 0.14s ease;
}
.vio-carousel-arrow:hover { transform: translateY(-50%) scale(1.08); }
.vio-carousel-arrow.prev { left: -8px; }
.vio-carousel-arrow.next { right: -8px; }
.vio-carousel-empty {
  border: 1px dashed #ccc; border-radius: 10px; padding: 40px; text-align: center;
  color: #999; font-size: 14px;
}
`;

function injectStyles() {
  if (typeof document === "undefined" || document.getElementById(STYLE_ID)) return;
  const el = document.createElement("style");
  el.id = STYLE_ID;
  el.textContent = CAROUSEL_CSS;
  document.head.appendChild(el);
}

type Props = {
  products?: { ids?: string };
  kicker?: string;
  heading?: string;
  disclaimer?: string;
  visible?: number;
  gap?: number;
  arrows?: boolean;
  [key: string]: any;
};

export default function VioProductCarousel(props: Props) {
  const {
    products,
    kicker,
    heading,
    disclaimer = "annonselenker",
    visible = 4,
    gap = 16,
    arrows = true,
  } = props;

  const trackRef = useRef<HTMLDivElement | null>(null);
  const [list, setList] = useState<any[]>([]);

  // The page's active sponsor, live — the same source as the card and the grid.
  const activeSponsor = useActiveSponsorId();
  // Impresión REAL del componente entero (≥50% visible ≥1s, una vez por
  // sesión). Cuenta el CONTENEDOR, no cada tarjeta de adentro: eso sería
  // doble conteo. Corre cuando hay productos, porque recién ahí se monta
  // la raíz real (sin productos se renderiza el estado vacío).
  const rootRef = useRef<HTMLDivElement | null>(null);
  // Editor only: the frame Vev gives this block cuts it (see editor-fit).
  const cutByFrame = useCutByFrame(rootRef, true, list.length);
  useEffect(() => {
    if (list.length === 0) return;
    return observeVioImpression(
      rootRef.current,
      { sponsorId: activeSponsor ?? undefined, componentTemplateId: "vev-carousel", locationId: heading || kicker || "Vio Carousel" },
      `vev-carousel:${activeSponsor}:${heading || kicker || "Vio Carousel"}`,
    );
  }, [list.length, activeSponsor, heading, kicker]);
  const ids = parseIds(products?.ids);
  const idsKey = ids.join(",");

  useEffect(() => {
    injectStyles();
  }, []);

  useEffect(() => {
    // No products picked, or no sponsor yet (a key booting): nothing to show,
    // and nothing is asked of Commerce until the Config announces a sponsor.
    if (ids.length === 0 || activeSponsor == null) {
      setList([]);
      return;
    }
    let cancelled = false;
    fetchVioProducts(ids, activeSponsor).then((prods) => {
      if (cancelled) return;
      setList(prods);
      trackViewItemList(prods.map((p) => productToItem(p)), heading || kicker || "Vio Carousel");
    });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [idsKey, activeSponsor]);

  const cardConfig = pickCardConfig(props);
  const perView = Math.max(1, Number(visible) || 4);
  const itemWidth = `calc((100% - ${gap * (perView - 1)}px) / ${perView})`;

  const scrollBy = (dir: number) => {
    const el = trackRef.current;
    if (el) el.scrollBy({ left: dir * el.clientWidth * 0.9, behavior: "smooth" });
  };

  if (ids.length === 0) {
    return (
      <div className="vio-carousel">
        <div className="vio-carousel-empty">Select products in the panel to build the carousel.</div>
      </div>
    );
  }

  return (
    <div ref={rootRef} className="vio-carousel">
      {cutByFrame ? <CutByFrameNotice /> : null}
      {(kicker || heading || disclaimer) && (
        <div className="vio-carousel-head">
          <div className="vio-carousel-titles">
            {kicker ? <div className="vio-carousel-kicker">{kicker}</div> : null}
            {heading ? <h3 className="vio-carousel-heading">{heading}</h3> : null}
          </div>
          {disclaimer ? <div className="vio-carousel-disclaimer">{disclaimer}</div> : null}
        </div>
      )}

      <div className="vio-carousel-viewport">
        {arrows && list.length > perView ? (
          <button className="vio-carousel-arrow prev" aria-label="Previous" onClick={() => scrollBy(-1)}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
              <polyline points="15 18 9 12 15 6" />
            </svg>
          </button>
        ) : null}

        <div className="vio-carousel-track" ref={trackRef} style={{ gap }}>
          {list.map((p, idx) => (
            <div key={p?.id ?? idx} className="vio-carousel-item" style={{ width: itemWidth }}>
              <ProductCardFromDTO product={p} sponsorId={activeSponsor} config={cardConfig} />
            </div>
          ))}
        </div>

        {arrows && list.length > perView ? (
          <button className="vio-carousel-arrow next" aria-label="Next" onClick={() => scrollBy(1)}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
              <polyline points="9 18 15 12 9 6" />
            </svg>
          </button>
        ) : null}
      </div>
    </div>
  );
}

registerVevComponent(VioProductCarousel, {
  name: "Vio Product Carousel",
  size: { width: "100%", height: "auto" },
  editableCSS: CARD_EDITABLE_CSS,
  props: [
    {
      name: "products",
      title: "Products",
      type: "object",
      component: ProductMultiSelect as any,
      fields: [{ name: "ids", type: "string" }],
    } as any,
    { name: "kicker", title: "Kicker", type: "string", initialValue: "" },
    { name: "heading", title: "Heading", type: "string", initialValue: "" },
    { name: "disclaimer", title: "Disclaimer", type: "string", initialValue: "annonselenker" },
    {
      name: "visible",
      title: "Visible at once",
      type: "select",
      initialValue: 4,
      options: {
        display: "dropdown",
        items: [
          { value: 2, label: "2" },
          { value: 3, label: "3" },
          { value: 4, label: "4" },
          { value: 5, label: "5" },
        ],
      },
    } as any,
    { name: "gap", title: "Gap (px)", type: "number", initialValue: 16 },
    { name: "arrows", title: "Show arrows", type: "boolean", initialValue: true },
    ...CARD_CONFIG_PROPS,
  ],
});
