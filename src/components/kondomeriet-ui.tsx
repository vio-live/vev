import React from "react";
import { primaryImageUrl } from "../../vio-sdk";
import { injectCardStyles } from "./card-view";
import { getProductPriceAmount } from "./vio-helpers";
import { compareAtAmount, formatKr, isSoldOut, type ResolvedGroup } from "./kondomeriet-helpers";

/**
 * The pieces the Kondomeriet card and its detail drawer share: the `knd-`
 * styles (on top of the Vio card's, which card-view.tsx injects), the option
 * selector, the price row and the Vipps button.
 */

const STYLE_ID = "kondomeriet-card-styles";
const KND_CSS = `
.vio-native-card.knd-card .vnc-name { min-height: 0; }
.vio-native-card.knd-card .knd-option-title { font-size: 12px; color: var(--vio-color-text-secondary, #666); margin: 0 0 6px; }
.vio-native-card.knd-card .knd-option-title b { color: var(--vio-color-text, #0a0a0a); font-weight: 600; }
.vio-native-card.knd-card .knd-options { display: flex; flex-wrap: wrap; gap: 6px; margin: 0 0 12px; }
.knd-pill {
  border: 1px solid var(--vio-color-border, #d4d4d4); background: var(--vio-color-surface, #fff); color: var(--vio-color-text, #0a0a0a);
  font-family: inherit; font-size: 12px; line-height: 1.2; padding: 6px 10px; border-radius: 999px; cursor: pointer;
  transition: border-color 0.12s ease, box-shadow 0.12s ease;
}
.knd-pill:hover { border-color: var(--vio-color-text, #0a0a0a); }
.knd-pill[aria-pressed="true"] { border-color: var(--vnc-accent, #0a0a0a); box-shadow: inset 0 0 0 1px var(--vnc-accent, #0a0a0a); font-weight: 600; }
.knd-pill.knd-soldout { color: #9a9a9a; text-decoration: line-through; }
.knd-thumb {
  width: 44px; height: 44px; padding: 0; overflow: hidden; cursor: pointer;
  border: 1px solid var(--vio-color-border, #d4d4d4); border-radius: var(--vio-card-badge-radius, 4px);
  background: var(--vio-color-surface-muted, #f2f2f2);
}
.knd-thumb img { width: 100%; height: 100%; object-fit: cover; display: block; }
.knd-thumb[aria-pressed="true"] { border-color: var(--vnc-accent, #0a0a0a); box-shadow: 0 0 0 1px var(--vnc-accent, #0a0a0a); }
.knd-thumb.knd-soldout { opacity: 0.4; }
.vio-native-card.knd-card .knd-select {
  width: 100%; box-sizing: border-box; margin: 0 0 12px; padding: 9px 10px; font-family: inherit; font-size: 13px;
  border: 1px solid var(--vio-color-border, #d4d4d4); border-radius: var(--vio-card-bar-radius, 6px);
  background: var(--vio-color-surface, #fff); color: var(--vio-color-text, #0a0a0a);
}
.knd-price-row { display: flex; flex-wrap: wrap; align-items: baseline; gap: 8px; }
.knd-price-row .knd-was { font-size: 0.85em; font-weight: 500; color: var(--vio-color-text-tertiary, #8a8a8a); text-decoration: line-through; }
.knd-price-row .knd-now.knd-sale { color: var(--knd-sale, #c8102e); }
.knd-editor-note { font-size: 11px; color: #b42318; line-height: 1.4; margin: 6px 0 0; }
.vio-native-card.knd-card .knd-btn-info {
  width: 100%; margin-top: 8px; padding: 12px; box-sizing: border-box; cursor: pointer;
  border: 1px solid currentColor; background: transparent; color: var(--vio-color-text, #0a0a0a);
  border-radius: var(--vio-card-bar-radius, 6px); font-family: inherit; font-size: 12px; font-weight: 700;
  text-transform: uppercase; letter-spacing: 0.08em; transition: background 0.15s ease;
}
.vio-native-card.knd-card .knd-btn-info:hover { background: rgba(0, 0, 0, 0.04); }
@container (max-width: 220px) {
  .vio-native-card.knd-card .knd-btn-info { padding: 10px 8px; font-size: 10.5px; letter-spacing: 0.04em; }
}
`;

export function injectKondomerietStyles(): void {
  injectCardStyles();
  if (typeof document === "undefined" || document.getElementById(STYLE_ID)) return;
  const el = document.createElement("style");
  el.id = STYLE_ID;
  el.textContent = KND_CSS;
  document.head.appendChild(el);
}

/** A catalogue description (HTML) as plain text. */
export function plainText(html: string | null | undefined): string {
  if (!html) return "";
  return html
    .replace(/<\s*br\s*\/?>/gi, "\n")
    .replace(/<\/(p|div|li|h[1-6])>/gi, "\n")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/[ \t]+/g, " ")
    .replace(/\s*\n\s*/g, "\n")
    .trim();
}

/** Selector of a group's options — shared by the card and the drawer. */
export function OptionSelector({
  group,
  index,
  onSelect,
  style = "pills",
  title,
}: {
  group: ResolvedGroup;
  index: number;
  onSelect: (i: number) => void;
  style?: string;
  title?: string;
}) {
  if (group.options.length < 2) return null;
  const current = group.options[index];
  const heading = title?.trim() ? (
    <div className="knd-option-title">
      {title.trim()}: <b>{current?.label}</b>
    </div>
  ) : null;
  if (style === "dropdown") {
    return (
      <>
        {heading}
        <select
          className="knd-select"
          value={index}
          aria-label={title?.trim() || "Velg variant"}
          onClick={(e) => e.stopPropagation()}
          onChange={(e) => onSelect(Number(e.target.value))}
        >
          {group.options.map((o, i) => (
            <option key={o.productId} value={i}>
              {o.label}
              {isSoldOut(o.product) ? " (utsolgt)" : ""}
            </option>
          ))}
        </select>
      </>
    );
  }
  return (
    <>
      {heading}
      <div className="knd-options" role="group" aria-label={title?.trim() || "Varianter"}>
        {group.options.map((o, i) => {
          const soldOut = isSoldOut(o.product);
          const pressed = i === index;
          const click = (e: React.MouseEvent) => {
            e.stopPropagation();
            onSelect(i);
          };
          if (style === "thumbs") {
            const img = primaryImageUrl(o.product) ?? "";
            return (
              <button
                key={o.productId}
                type="button"
                className={`knd-thumb${soldOut ? " knd-soldout" : ""}`}
                aria-pressed={pressed}
                aria-label={`${o.label}${soldOut ? " (utsolgt)" : ""}`}
                title={`${o.label}${soldOut ? " (utsolgt)" : ""}`}
                onClick={click}
              >
                {img ? <img src={img} alt="" loading="lazy" /> : null}
              </button>
            );
          }
          return (
            <button
              key={o.productId}
              type="button"
              className={`knd-pill${soldOut ? " knd-soldout" : ""}`}
              aria-pressed={pressed}
              title={soldOut ? "Utsolgt" : undefined}
              onClick={click}
            >
              {o.label}
            </button>
          );
        })}
      </div>
    </>
  );
}

/** Price of one option: the struck-through compare-at when the feed has a sale. */
export function PriceRow({ product, className = "vnc-price" }: { product: any; className?: string }) {
  const now = getProductPriceAmount(product);
  if (now == null) return null;
  const was = compareAtAmount(product);
  return (
    <div className={`${className} knd-price-row`}>
      {was != null ? <span className="knd-was">{formatKr(was)}</span> : null}
      <span className={`knd-now${was != null ? " knd-sale" : ""}`}>{formatKr(now)}</span>
    </div>
  );
}

/**
 * "Kjøp med vipps" — the Vio card's orange Vipps bar (`.vnc-btn-vipps`, so the
 * editable CSS "Vipps button" styles it too). `soldOut` turns it into a
 * disabled "Utsolgt"; `title` explains a disabled button (no Hurtigkasse).
 */
export function VippsWordmarkButton({
  label,
  disabled,
  soldOut,
  title,
  onClick,
  className = "vnc-btn-vipps",
}: {
  label: string;
  disabled?: boolean;
  soldOut?: boolean;
  title?: string;
  onClick: (e: React.MouseEvent) => void;
  className?: string;
}) {
  if (soldOut) {
    return (
      <button type="button" className={className} disabled onClick={(e) => e.stopPropagation()}>
        <span>Utsolgt</span>
      </button>
    );
  }
  return (
    <button
      type="button"
      className={className}
      onClick={onClick}
      disabled={disabled}
      title={title}
      aria-label={`${label} Vipps`}
    >
      <span>{label}</span>
      <span className="vnc-vipps-badge">vipps</span>
    </button>
  );
}
