import React from "react";
import * as VioSdk from "../../vio-sdk";
import { primaryImageUrl } from "../../vio-sdk";
import { injectCardStyles } from "./card-view";
import { getProductPriceAmount } from "./vio-helpers";
import { activeDiscount, compareAtAmount, formatKr, isSoldOut, type KondomerietGroup, type ResolvedGroup } from "./kondomeriet-helpers";

/**
 * What the Kondomeriet card and its drawer share. The card IS the Vio card:
 * the same `.vio-native-card` markup and styles (injected by card-view.tsx),
 * the same editable CSS. The only `knd-` rules here are the pieces the Vio
 * card has no equivalent for: the option selector — drawn with the values of
 * the SDK detail's own option pills (`.option-label`, `.option-pill`) — and
 * the struck-through old price, drawn like the SDK detail's `.compare-at`.
 */

const STYLE_ID = "kondomeriet-card-styles";
const KND_CSS = `
.vio-native-card .knd-option-group { display: flex; flex-direction: column; gap: 8px; margin: 0 0 14px; }
.vio-native-card .knd-option-label {
  font-size: 11px; text-transform: uppercase; letter-spacing: var(--vio-tracking-label, 0.1em);
  color: var(--vio-color-text-secondary, #666); font-weight: 500; line-height: 1.4;
}
.vio-native-card .knd-option-chosen { color: var(--vio-color-text, #0a0a0a); font-weight: 700; }
.vio-native-card .knd-option-values { display: flex; flex-wrap: wrap; gap: 6px; }
.vio-native-card .knd-option-pill {
  flex: 0 0 auto; box-sizing: border-box; min-height: 36px; min-width: 36px; padding: 0 12px;
  border-radius: var(--vio-detail-option-radius, 0); background: #fff; border: 1px solid var(--vio-color-border, #e5e5e5);
  cursor: pointer; font-family: inherit; font-size: 13px; font-weight: 500; color: inherit;
  transition: border-color 0.15s, background 0.15s;
}
.vio-native-card .knd-option-pill:hover { border-color: var(--vio-color-text, #0a0a0a); }
.vio-native-card .knd-option-pill[aria-pressed="true"] {
  border-color: var(--vio-color-text, #0a0a0a); background: var(--vio-color-text, #0a0a0a); color: var(--vio-color-text-on-primary, #fff);
}
.vio-native-card .knd-option-pill.unavailable {
  opacity: 0.4; cursor: not-allowed; text-decoration: line-through;
  background: repeating-linear-gradient(-45deg, #fafafa, #fafafa 5px, #f0f0f0 5px, #f0f0f0 10px);
}
.vio-native-card .knd-option-pill.unavailable:hover { border-color: var(--vio-color-border, #e5e5e5); }
.vio-native-card .knd-option-thumb {
  flex: 0 0 auto; width: 44px; height: 44px; padding: 0; overflow: hidden; cursor: pointer; box-sizing: border-box;
  background: var(--vio-color-surface-muted, #f2f2f2); border: 1px solid transparent; border-radius: var(--vio-detail-thumb-radius, 0);
}
.vio-native-card .knd-option-thumb img { display: block; width: 100%; height: 100%; object-fit: cover; }
.vio-native-card .knd-option-thumb[aria-pressed="true"] { border-color: var(--vio-color-text, #0a0a0a); }
.vio-native-card .knd-option-thumb.unavailable { opacity: 0.4; cursor: not-allowed; }
.vio-native-card .knd-option-select {
  width: 100%; box-sizing: border-box; min-height: 36px; padding: 0 10px; font-family: inherit; font-size: 13px; font-weight: 500;
  border: 1px solid var(--vio-color-border, #e5e5e5); border-radius: var(--vio-detail-option-radius, 0);
  background: #fff; color: var(--vio-color-text, #0a0a0a);
}
.vio-native-card .knd-direct-badge {
  align-self: flex-start; display: inline-block; margin: 0 0 8px;
  background: var(--vnc-accent, #0a0a0a); color: #fff;
  font-size: 11px; font-weight: 700; line-height: 1; padding: 5px 8px; border-radius: var(--vio-card-badge-radius, 4px);
}
.vio-native-card .knd-subtitle { font-size: 13px; line-height: 1.4; color: var(--vio-color-text-secondary, #666); margin: -6px 0 10px; }
.vio-native-card .knd-tag {
  position: absolute; left: 10px; bottom: 10px; z-index: 3; max-width: calc(100% - 70px);
  background: rgba(255, 255, 255, 0.92); color: var(--vio-color-text, #0a0a0a);
  font-size: 11px; font-weight: 600; letter-spacing: 0.04em; line-height: 1.2; padding: 5px 8px;
  border-radius: var(--vio-card-badge-radius, 4px); white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
}
.vio-native-card.l-overlay .knd-tag { bottom: auto; top: 42px; }
.vio-native-card .knd-footer { margin-top: 10px; font-size: 12px; line-height: 1.45; color: var(--vio-color-text-secondary, #666); white-space: pre-line; }
.vio-native-card .vnc-price { overflow-wrap: anywhere; }
/* «Du handler direkte hos Kondomeriet» with the brand's logo, where the Vio card puts its retailer. */
.vio-native-card .knd-seller {
  display: flex; align-items: center; flex-wrap: wrap; gap: 4px 8px; margin-top: auto; padding-top: 2px;
  font-size: 12px; line-height: 1.35; color: var(--vio-color-text-secondary, #666);
}
.vio-native-card .knd-seller strong { color: var(--vio-color-text, #0a0a0a); font-weight: 600; }
.vio-native-card .knd-seller .knd-seller-logo { display: block; flex: 0 0 auto; height: 20px; width: auto; max-width: 110px; object-fit: contain; }
.vio-native-card.l-overlay .vnc-overlay-meta .knd-seller, .vio-native-card.l-overlay .vnc-overlay-meta .knd-seller strong { color: #fff; }
.vio-native-card .vnc-meta .vnc-btn-vipps + .knd-seller, .vio-native-card .vnc-meta .vnc-btn-vipps-official + .knd-seller { margin-top: 0; }
/* «Se mer» in the Vipps button's place: the same spot under the price, the Vio card's bar. */
.vio-native-card .vnc-meta .knd-more { margin: -4px 0 12px; }
.vio-native-card .vnc-meta .knd-more + .knd-seller { margin-top: 0; }
.vio-native-card .vnc-body > .knd-more:first-child { margin-top: 12px; }
.vio-native-card .vnc-price .knd-was {
  margin-left: 8px; font-size: 0.85em; font-weight: 400; color: var(--vio-color-text-tertiary, #999); text-decoration: line-through;
}
.vio-native-card.l-overlay .vnc-overlay-meta .knd-was { color: rgba(255, 255, 255, 0.75); }
.vio-native-card.l-overlay .vnc-overlay-meta .knd-option-label { color: rgba(255, 255, 255, 0.85); }
.vio-native-card.l-overlay .vnc-overlay-meta .knd-option-chosen { color: #fff; }
@container (max-width: 220px) {
  .vio-native-card .knd-option-pill { min-height: 30px; min-width: 30px; padding: 0 8px; font-size: 12px; }
  .vio-native-card .knd-option-thumb { width: 36px; height: 36px; }
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

/** A catalogue description (HTML) as plain text, paragraphs kept as line breaks. */
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

/** The card's price as the Vio card writes it (`1199 NOK`). */
export function cardPrice(amount: number | null | undefined, product: any): string {
  return amount != null ? `${amount} ${product?.price?.currency_code ?? ""}`.trim() : "";
}

/** The detail's price as the SDK detail writes it (`1 199 Kr`) — its own formatter when the bundle exports it. */
export function detailPrice(amount: number | null | undefined, product: any): string {
  if (amount == null || !Number.isFinite(amount)) return "";
  const fmt = (VioSdk as any).formatPrice;
  if (typeof fmt === "function") {
    try {
      return fmt(amount, product?.price?.currency_code);
    } catch {
      /* fall through */
    }
  }
  return formatKr(amount);
}

/**
 * A ref that puts a class on a custom element (Vipps' `<vipps-mobilepay-button>`).
 * React 18 writes `className` on a custom element as a `classname` attribute,
 * so the class the stylesheet targets (`.vnc-btn-vipps-official`,
 * `.buy-vipps-official`) never lands; set on the node it always does.
 */
export function classRef(cls: string) {
  return (el: HTMLElement | null) => {
    if (el && el.className !== cls) el.className = cls;
  };
}

/** `-60 %` from the feed's sale (compare-at above the price) — the Vio card's «Auto (from sale price)» formula. */
export function salePercent(product: any): string | null {
  const now = getProductPriceAmount(product);
  const was = compareAtAmount(product);
  if (now == null || was == null || now <= 0) return null;
  return `-${Math.round((1 - now / was) * 100)} %`;
}

/**
 * The badge of the card and the drawer, in the Vio badge's place: the
 * editor's text while its dates say so, else the feed sale's percentage.
 * Never a made-up price: the Hurtigkasse charges the shop's price.
 */
export function cardBadge(group: KondomerietGroup, product: any, now = Date.now()): string | null {
  return activeDiscount(group, now) ?? salePercent(product);
}

/** The brand's logo in a seller line: a fixed height, its own width, and gone if it does not load. */
export function SellerLogo({ src, name, className }: { src: string; name: string; className: string }) {
  const [failed, setFailed] = React.useState(false);
  if (failed) return null;
  // Not lazy: a zero-width image until it loads is never "in view" for the browser.
  return <img className={className} src={src} alt={name} onError={() => setFailed(true)} />;
}

/** The badge under the card's «Discount badge» choice — the card and the drawer use the same rule. */
export function badgeFor(
  mode: string | undefined,
  manualText: string | undefined,
  group: KondomerietGroup,
  product: any,
  now = Date.now()
): string | null {
  if (mode === "off") return null;
  if (mode === "manual") return manualText?.trim() || null;
  return cardBadge(group, product, now);
}

/** Selector of a group's options — the card's (light DOM, `knd-` classes). */
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
  const label = (
    <div className="knd-option-label">
      {title?.trim() ? `${title.trim()}: ` : ""}
      <span className="knd-option-chosen">{current?.label}</span>
    </div>
  );
  if (style === "dropdown") {
    return (
      <div className="knd-option-group">
        {title?.trim() ? <div className="knd-option-label">{title.trim()}</div> : null}
        <select
          className="knd-option-select"
          value={index}
          aria-label={title?.trim() || "Velg variant"}
          onClick={(e) => e.stopPropagation()}
          onChange={(e) => onSelect(Number(e.target.value))}
        >
          {group.options.map((o, i) => {
            const soldOut = isSoldOut(o.product);
            return (
              <option key={o.productId} value={i} disabled={soldOut && i !== index}>
                {o.label}
                {soldOut ? " (utsolgt)" : ""}
              </option>
            );
          })}
        </select>
      </div>
    );
  }
  return (
    <div className="knd-option-group">
      {label}
      <div className="knd-option-values" role="group" aria-label={title?.trim() || "Varianter"}>
        {group.options.map((o, i) => {
          const soldOut = isSoldOut(o.product);
          const pressed = i === index;
          const click = (e: React.MouseEvent) => {
            e.stopPropagation();
            if (!soldOut) onSelect(i);
          };
          const name = `${o.label}${soldOut ? " (utsolgt)" : ""}`;
          if (style === "thumbs") {
            const img = primaryImageUrl(o.product) ?? "";
            return (
              <button
                key={o.productId}
                type="button"
                className={`knd-option-thumb${soldOut ? " unavailable" : ""}`}
                aria-pressed={pressed}
                aria-label={name}
                title={name}
                disabled={soldOut && !pressed}
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
              className={`knd-option-pill${soldOut ? " unavailable" : ""}`}
              aria-pressed={pressed}
              title={soldOut ? "Utsolgt" : undefined}
              disabled={soldOut && !pressed}
              onClick={click}
            >
              {o.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}
