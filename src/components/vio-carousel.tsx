import React, { useEffect, useRef, useState } from "react";
import { registerVevComponent } from "@vev/react";
import { ProductMultiSelect, parseIds } from "./product-picker";
import { ProductCardFromDTO } from "./card-view";
import { CutByFrameNotice, useCutByFrame } from "./editor-fit";
import { LIST_CARD_CONFIG_PROPS, CARD_EDITABLE_CSS, pickCardConfig } from "./card-props";
import { SLOT_PROPS } from "./slot-props";
import { observeVioImpression, productToItem, trackViewItemList } from "./analytics";
import { COMPONENT_TEMPLATE_ID, fetchVioProducts, useActiveSponsorId, useVioSlot, vioAttribution } from "./vio-helpers";

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
.vio-carousel-arrow:disabled { opacity: 0; pointer-events: none; }
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
  /** Slot (ADR-0034) — both optional; see SLOT_PROPS. */
  slot?: string;
  slotName?: string;
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
    slot: slotProp,
    slotName,
  } = props;

  const trackRef = useRef<HTMLDivElement | null>(null);
  const [list, setList] = useState<any[]>([]);

  // The carousel's slot (ADR-0034): the "Slot" field, else `carousel-<vev key>`,
  // named after its heading and the page; registered as soon as it exists.
  const slot = useVioSlot({ slot: slotProp, slotName, kind: "carousel", title: heading || kicker, hostRef: props.hostRef });
  // The page's active sponsor, live — the same source as the card and the grid
  // — unless a campaign is assigned to this slot: then that campaign's sponsor.
  const activeSponsor = useActiveSponsorId(undefined, slot);
  // The channel of the block's campaign: its cart and checkout sell there (SDK 0.33).
  const blockCampaignId = activeSponsor != null ? vioAttribution(slot, activeSponsor).campaignId ?? null : null;
  // Impresión REAL del componente entero (≥50% visible ≥1s, una vez por
  // carga), con los productos que muestra. Cuenta el CONTENEDOR, no cada
  // tarjeta de adentro: eso sería doble conteo. Corre cuando hay productos,
  // porque recién ahí se monta la raíz real (sin productos se renderiza el
  // estado vacío).
  const rootRef = useRef<HTMLDivElement | null>(null);
  // Editor only: the frame Vev gives this block cuts it (see editor-fit).
  const cutByFrame = useCutByFrame(rootRef, true, list.length);
  useEffect(() => {
    if (list.length === 0) return;
    return observeVioImpression(
      rootRef.current,
      {
        sponsorId: activeSponsor ?? undefined,
        componentTemplateId: COMPONENT_TEMPLATE_ID.carousel,
        locationId: heading || kicker || "Vio Carousel",
        ...vioAttribution(slot, activeSponsor, COMPONENT_TEMPLATE_ID.carousel),
      },
      `vev-carousel:${activeSponsor}:${slot || heading || kicker || "Vio Carousel"}`,
      list.map((p) => productToItem(p)),
    );
  }, [list, activeSponsor, heading, kicker, slot]);
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
    // Another sponsor (or another pick): the products on screen are the
    // previous one's — out they go, so the impression, the list event and the
    // cards never pair sponsor B with sponsor A's products.
    setList((prev) => (prev.length ? [] : prev));
    let cancelled = false;
    fetchVioProducts(ids, activeSponsor, blockCampaignId).then((prods) => {
      if (cancelled) return;
      setList(prods);
      trackViewItemList(
        prods.map((p) => productToItem(p)),
        heading || kicker || "Vio Carousel",
        vioAttribution(slot, activeSponsor, COMPONENT_TEMPLATE_ID.carousel),
      );
    });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [idsKey, activeSponsor, blockCampaignId]);

  const cardConfig = pickCardConfig(props);
  const perView = Math.max(1, Number(visible) || 4);
  const itemWidth = `calc((100% - ${gap * (perView - 1)}px) / ${perView})`;

  // Whether the track can still move each way: the arrow at an end is off.
  // The arrows exist only while the track overflows. Not `list.length >
  // perView`: a card is never narrower than 140px, so on a phone four cards
  // at «4 visible» do not fit and the track swipes (QA 02/11, Alan: Show
  // arrows on, swipe works, no arrows on iPhone).
  const [overflows, setOverflows] = useState(false);
  const [canPrev, setCanPrev] = useState(false);
  const [canNext, setCanNext] = useState(true);
  const updateEnds = () => {
    const el = trackRef.current;
    if (!el) return;
    setOverflows(el.scrollWidth > el.clientWidth + 1);
    setCanPrev(el.scrollLeft > 1);
    setCanNext(el.scrollLeft + el.clientWidth < el.scrollWidth - 1);
  };
  useEffect(() => {
    const el = trackRef.current;
    if (!el) return;
    updateEnds();
    el.addEventListener("scroll", updateEnds, { passive: true });
    window.addEventListener("resize", updateEnds);
    // The block can change width without the window doing so (Vev's editor
    // frame, a column that grows).
    const resized = typeof ResizeObserver !== "undefined" ? new ResizeObserver(updateEnds) : null;
    resized?.observe(el);
    return () => {
      el.removeEventListener("scroll", updateEnds);
      window.removeEventListener("resize", updateEnds);
      resized?.disconnect();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [list.length]);

  // The arrows move card by card. A smooth programmatic scroll on a track with
  // mandatory snapping leaves it blank or halfway on iPhone Safari (QA 23/10:
  // the arrows emptied the carousel, a finger swipe did not), so the snap is
  // paused while the scroll runs and comes back when it ends.
  const scrollBy = (dir: number) => {
    const el = trackRef.current;
    const items = el ? (Array.from(el.children) as HTMLElement[]) : [];
    if (!el || items.length === 0) return;
    const origin = items[0].offsetLeft;
    const cardWidth = items[0].offsetWidth || el.clientWidth;
    const perStep = Math.max(1, Math.floor((el.clientWidth + gap) / (cardWidth + gap)));
    const current = Math.max(0, items.findIndex((it) => it.offsetLeft - origin >= el.scrollLeft - 1));
    const target = Math.min(items.length - 1, Math.max(0, current + dir * perStep));
    const left = Math.min(items[target].offsetLeft - origin, el.scrollWidth - el.clientWidth);
    el.style.scrollSnapType = "none";
    const restore = () => {
      el.style.scrollSnapType = "";
      el.removeEventListener("scrollend", restore);
      updateEnds();
    };
    el.addEventListener("scrollend", restore);
    window.setTimeout(restore, 700);
    el.scrollTo({ left, behavior: "smooth" });
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
        {arrows && overflows ? (
          <button className="vio-carousel-arrow prev" aria-label="Previous" disabled={!canPrev} onClick={() => scrollBy(-1)}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
              <polyline points="15 18 9 12 15 6" />
            </svg>
          </button>
        ) : null}

        <div className="vio-carousel-track" ref={trackRef} style={{ gap }}>
          {list.map((p, idx) => (
            <div key={p?.id ?? idx} className="vio-carousel-item" style={{ width: itemWidth }}>
              <ProductCardFromDTO
                product={p}
                sponsorId={activeSponsor}
                config={cardConfig}
                slot={slot}
                componentTemplateId={COMPONENT_TEMPLATE_ID.carousel}
              />
            </div>
          ))}
        </div>

        {arrows && overflows ? (
          <button className="vio-carousel-arrow next" aria-label="Next" disabled={!canNext} onClick={() => scrollBy(1)}>
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
    ...SLOT_PROPS,
    ...LIST_CARD_CONFIG_PROPS,
  ],
});
