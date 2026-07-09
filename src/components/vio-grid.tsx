import React, { useEffect, useState } from "react";
import { registerVevComponent } from "@vev/react";
import { ProductMultiSelect } from "./product-picker";
import { ProductCardFromDTO } from "./card-view";
import { CARD_CONFIG_PROPS, CARD_EDITABLE_CSS, pickCardConfig } from "./card-props";
import { fetchVioProducts } from "./vio-helpers";

/**
 * Vio Product Grid — a responsive grid of product cards. The editor picks the
 * products (modal multi-select), the number of columns and the gap. Collapses to
 * 2 columns on small screens. Cards reuse the shared ProductCardView.
 */

const STYLE_ID = "vio-grid-styles";
const GRID_CSS = `
.vio-grid-wrap { width: 100%; font-family: var(--vio-font-sans, -apple-system, sans-serif); color: var(--vio-color-text, #0a0a0a); }
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

type Item = { productId: number; sponsorId: number };

type Props = {
  products?: Item[];
  kicker?: string;
  heading?: string;
  columns?: number;
  gap?: number;
  [key: string]: any;
};

export default function VioProductGrid(props: Props) {
  const { products, kicker, heading, columns = 3, gap = 20 } = props;

  const [list, setList] = useState<any[]>([]);
  const items = Array.isArray(products) ? products : [];
  const ids = items.map((i) => Number(i.productId)).filter(Boolean);
  const sponsorId = items[0]?.sponsorId ?? 1;
  const idsKey = ids.join(",");

  useEffect(() => {
    injectStyles();
  }, []);

  useEffect(() => {
    if (ids.length === 0) {
      setList([]);
      return;
    }
    let cancelled = false;
    fetchVioProducts(ids, sponsorId).then((prods) => {
      if (!cancelled) setList(prods);
    });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [idsKey, sponsorId]);

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
    <div className="vio-grid-wrap">
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
          <ProductCardFromDTO key={p?.id ?? idx} product={p} sponsorId={sponsorId} config={cardConfig} />
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
      type: "array",
      component: ProductMultiSelect as any,
      of: [
        { name: "productId", type: "number" },
        { name: "sponsorId", type: "number" },
      ],
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
    ...CARD_CONFIG_PROPS,
  ],
});
