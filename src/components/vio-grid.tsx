import React, { useEffect, useRef, useState } from "react";
import { registerVevComponent } from "@vev/react";
import { ProductMultiSelect, parseIds } from "./product-picker";
import { ProductCardFromDTO } from "./card-view";
import { CutByFrameNotice, useCutByFrame } from "./editor-fit";
import { CARD_CONFIG_PROPS, CARD_EDITABLE_CSS, pickCardConfig } from "./card-props";
import { SLOT_PROPS } from "./slot-props";
import { fetchVioProducts, useActiveSponsorId, useVioSlot, vioAttribution } from "./vio-helpers";
import { observeVioImpression, productToItem, trackViewItemList } from "./analytics";

/**
 * Vio Product Grid — a responsive grid of product cards. The editor picks the
 * products (modal multi-select), the number of columns and the gap. Collapses to
 * 2 columns on small screens. Cards reuse the shared ProductCardView.
 */

const STYLE_ID = "vio-grid-styles";
const GRID_CSS = `
.vio-grid-wrap { position: relative; width: 100%; font-family: var(--vio-font-sans, -apple-system, sans-serif); color: var(--vio-color-text, #0a0a0a); }
.vio-grid-head { display: flex; align-items: baseline; justify-content: space-between; gap: 12px; margin-bottom: 16px; }
.vio-grid-kicker { font-size: 12px; text-transform: uppercase; letter-spacing: 0.12em; color: var(--vio-color-accent, #c14a3b); font-weight: 600; margin-bottom: 6px; }
.vio-grid-heading { font-family: var(--vio-font-serif, 'Tinos', Georgia, serif); font-size: 26px; font-weight: 400; margin: 0; }
.vio-grid { display: grid; }
@media (max-width: 640px) { .vio-grid { grid-template-columns: repeat(2, minmax(0, 1fr)) !important; } }
.vio-grid-empty { border: 1px dashed #ccc; border-radius: 10px; padding: 40px; text-align: center; color: #999; font-size: 14px; }
`;

function injectStyles() {
  if (typeof document === "undefined" || document.getElementById(STYLE_ID)) return;
  const el = document.createElement("style");
  el.id = STYLE_ID;
  el.textContent = GRID_CSS;
  document.head.appendChild(el);
}

type Props = {
  products?: { ids?: string };
  kicker?: string;
  heading?: string;
  columns?: number;
  gap?: number;
  /** Slot (ADR-0034) — both optional; see SLOT_PROPS. */
  slot?: string;
  slotName?: string;
  [key: string]: any;
};

export default function VioProductGrid(props: Props) {
  const { products, kicker, heading, columns = 3, gap = 20, slot: slotProp, slotName } = props;

  const [list, setList] = useState<any[]>([]);

  // The grid's slot (ADR-0034): the "Slot" field, else `grid-<vev key>`, named
  // after its heading and the page; registered as soon as it exists.
  const slot = useVioSlot({ slot: slotProp, slotName, kind: "grid", title: heading || kicker, hostRef: props.hostRef });
  // The page's active sponsor, live — the same source as the card and the
  // carousel — unless a campaign is assigned to this slot: then its sponsor.
  const activeSponsor = useActiveSponsorId(undefined, slot);
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
      {
        sponsorId: activeSponsor ?? undefined,
        componentTemplateId: "vev-grid",
        locationId: heading || kicker || "Vio Grid",
        ...vioAttribution(slot, activeSponsor),
      },
      `vev-grid:${activeSponsor}:${slot || heading || kicker || "Vio Grid"}`,
    );
  }, [list.length, activeSponsor, heading, kicker, slot]);
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
      trackViewItemList(
        prods.map((p) => productToItem(p)),
        heading || kicker || "Vio Grid",
        vioAttribution(slot, activeSponsor),
      );
    });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [idsKey, activeSponsor]);

  const cardConfig = pickCardConfig(props);
  const cols = Math.max(1, Number(columns) || 3);

  if (ids.length === 0) {
    return (
      <div className="vio-grid-wrap">
        <div className="vio-grid-empty">Select products in the panel to build the grid.</div>
      </div>
    );
  }

  return (
    <div ref={rootRef} className="vio-grid-wrap">
      {cutByFrame ? <CutByFrameNotice /> : null}
      {(kicker || heading) && (
        <div className="vio-grid-head">
          <div>
            {kicker ? <div className="vio-grid-kicker">{kicker}</div> : null}
            {heading ? <h3 className="vio-grid-heading">{heading}</h3> : null}
          </div>
        </div>
      )}
      <div
        className="vio-grid"
        style={{ gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))`, gap }}
      >
        {list.map((p, idx) => (
          <ProductCardFromDTO key={p?.id ?? idx} product={p} sponsorId={activeSponsor} config={cardConfig} slot={slot} />
        ))}
      </div>
    </div>
  );
}

registerVevComponent(VioProductGrid, {
  name: "Vio Product Grid",
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
    {
      name: "columns",
      title: "Columns",
      type: "select",
      initialValue: 3,
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
    { name: "gap", title: "Gap (px)", type: "number", initialValue: 20 },
    ...SLOT_PROPS,
    ...CARD_CONFIG_PROPS,
  ],
});
