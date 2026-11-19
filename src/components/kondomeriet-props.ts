import { CARD_CONFIG_PROPS, CARD_EDITABLE_CSS } from "./card-props";
import { KondomerietGroupEditor, KondomerietGroupsEditor } from "./kondomeriet-group-editor";
import type { KondomerietCardConfig } from "./kondomeriet-card-view";
import { DEFAULT_DIRECT_BADGE, DEFAULT_PERKS, DEFAULT_STOCK_TEXT, DEFAULT_VIPPS_NOTE } from "./kondomeriet-helpers";

/**
 * Props of the Kondomeriet card / carousel / grid. The look-and-feel fields
 * are the Vio card's own — the same definitions, taken from CARD_CONFIG_PROPS
 * (layout, accent, brand / name / price / description, «Annonse») — so they
 * behave the same — and the rest of the Vio card's choices with their
 * Kondomeriet meaning: the button (bar / pill / icon) opens the product info
 * instead of adding to a cart, «Image click» opens it or buys with Vipps, the
 * discount badge is Off / Auto (the group's badge in its dates, else the sale
 * %) / Manual, and the Vipps button is the Hurtigkasse. On top: the selector,
 * where the Hurtigkasse opens, the product-info texts, a picture per card and
 * the editor's own subtitle, label and footer.
 */

/** The Vio card fields reused as they are. */
const REUSED = new Set([
  "layout",
  "accentColor",
  "showBrand",
  "showName",
  "showPrice",
  "showDescription",
  "descriptionText",
  "annonse",
  "annonseText",
]);

const reused = CARD_CONFIG_PROPS.filter((p) => REUSED.has(p.name));
const layoutProp = reused.find((p) => p.name === "layout");

export const KONDOMERIET_CARD_PROPS: any[] = [
  layoutProp,
  {
    name: "optionTitle",
    title: "Selector heading",
    type: "string",
    initialValue: "",
    description: "E.g. Farge, Modell, Størrelse — shown as «Farge: blåbær». Empty: no heading.",
  },
  {
    name: "selectorStyle",
    title: "Selector",
    type: "select",
    initialValue: "pills",
    options: {
      display: "dropdown",
      items: [
        { value: "pills", label: "Pills (labels)" },
        { value: "thumbs", label: "Thumbnails (photos)" },
        { value: "dropdown", label: "Dropdown" },
      ],
    },
  },
  { name: "vippsLabel", title: "Vipps button label", type: "string", initialValue: "Kjøp med" },
  { name: "infoButton", title: "'Product info' button", type: "boolean", initialValue: true },
  {
    name: "infoButtonStyle",
    title: "Product info button style",
    type: "select",
    initialValue: "bar",
    // The Vio card's button styles: its full-width bar, or its pill on the photo.
    options: {
      display: "dropdown",
      items: [
        { value: "bar", label: "Full-width bar" },
        { value: "text", label: "Text (pill)" },
        { value: "icon", label: "Icon (i)" },
      ],
    },
    hidden: (ctx: any) => ctx?.value?.infoButton === false,
  },
  { name: "infoLabel", title: "Product info label", type: "string", initialValue: "Se produktinfo" },
  {
    name: "hurtigkasseTarget",
    title: "Vipps Hurtigkasse opens in",
    type: "select",
    initialValue: "_blank",
    options: {
      display: "dropdown",
      items: [
        { value: "_blank", label: "New tab (article stays open)" },
        { value: "_top", label: "Same window" },
      ],
    },
  },
  { name: "showRetailer", title: "Show 'Kondomeriet'", type: "boolean", initialValue: false },
  {
    name: "showSeller",
    title: "Show seller (logo + «Du handler direkte hos …»)",
    type: "boolean",
    initialValue: true,
  },
  // Product info (the drawer): trust texts the editor can change or clear.
  {
    name: "directBadge",
    title: "Product info badge",
    type: "string",
    initialValue: DEFAULT_DIRECT_BADGE,
    description: "Shown by the brand in the product info. Empty: no badge.",
  },
  {
    name: "directBadgeOnCard",
    title: "Badge on the card too",
    type: "boolean",
    initialValue: false,
    hidden: (ctx: any) => typeof ctx?.value?.directBadge === "string" && !ctx.value.directBadge.trim(),
  },
  {
    name: "perks",
    title: "Shop promises (one per line)",
    type: "string",
    initialValue: DEFAULT_PERKS.join("\n"),
    options: { multiline: true },
    description: "Ticked under the Vipps button in the product info. Empty: none.",
  },
  {
    name: "stockText",
    title: "In-stock line",
    type: "string",
    initialValue: DEFAULT_STOCK_TEXT,
    description: "Ticked first in the list when the option is in stock («Utsolgt» when it is not).",
  },
  // The Vio card's remaining choices, with the Kondomeriet meaning.
  {
    ...CARD_CONFIG_PROPS.find((p) => p.name === "discountMode"),
    initialValue: "auto",
    options: {
      display: "dropdown",
      items: [
        { value: "off", label: "Off" },
        { value: "auto", label: "Auto (feed's sale %, else card's badge in its dates)" },
        { value: "manual", label: "Manual (text)" },
      ],
    },
  },
  {
    ...CARD_CONFIG_PROPS.find((p) => p.name === "discountText"),
    hidden: (ctx: any) => (ctx?.value?.discountMode ?? "auto") !== "manual",
  },
  // Where the card sells (replaces the old «Vipps Hurtigkasse button»: a
  // block placed with that switched off reads as Never — resolveBuyOnCard).
  {
    name: "buyOnCard",
    title: "Buy on card",
    type: "select",
    initialValue: "auto",
    description:
      "Auto: one product → «Kjøp med Vipps» on the card; options (colours, sizes) → only «Se mer», chosen and bought in the product info. Always: selector and Vipps on every card. Never: only «Se mer». A card's own choice (Details) wins.",
    options: {
      display: "dropdown",
      items: [
        { value: "auto", label: "Auto (Vipps for single products)" },
        { value: "always", label: "Always (selector + Vipps)" },
        { value: "never", label: "Never (only «Se mer»)" },
      ],
    },
  },
  { name: "moreLabel", title: "«Se mer» label", type: "string", initialValue: "Se mer" },
  // Conversion: what makes a reader trust and click.
  { name: "showRating", title: "Show rating (★ 5/5 (792))", type: "boolean", initialValue: true },
  { name: "showTrustLine", title: "Show promises line", type: "boolean", initialValue: true },
  {
    name: "trustLine",
    title: "Promises line (own text)",
    type: "string",
    description: "Empty: the brand's promises (short titles), else «Diskret pakket · Anonym levering · Frakt fra 59,-».",
    hidden: (ctx: any) => ctx?.value?.showTrustLine === false,
  },
  {
    name: "vippsNote",
    title: "Under Vipps (new tab)",
    type: "string",
    initialValue: DEFAULT_VIPPS_NOTE,
    description: "Under the Vipps button when the Hurtigkasse opens in a new tab. Empty: none.",
  },
  {
    name: "vippsNoteSameWindow",
    title: "Under Vipps (same window)",
    type: "string",
    initialValue: "",
    description: "When it opens in the same window — always the case in an app's browser (VG, Facebook, Instagram…). Empty: none.",
  },
  {
    name: "offerEnd",
    title: "Offer ends",
    type: "string",
    initialValue: "",
    description: "Optional, «2026-11-30 23:59». Shows the line below until then; a card's own date (Details) wins.",
  },
  {
    name: "trackingLink",
    title: "Tracking link (Circlewise)",
    type: "string",
    initialValue: "",
    description:
      "Optional: the sheet's link (https://c.trackmytarget.com/?a=…&i=…&ref1=…). «Kjøp med Vipps» then goes through Circlewise to the Hurtigkasse. A card's own link (Details) wins. Empty or invalid: the Config's default (Circlewise on, ref1 from the sheet).",
  },
  { name: "offerEndText", title: "Offer end text", type: "string", initialValue: "Tilbudet gjelder til {dato}", description: "{dato} = «mandag 30. november»." },
  {
    name: "imageClickAction",
    title: "Image click",
    type: "select",
    initialValue: "info",
    options: {
      display: "dropdown",
      items: [
        { value: "info", label: "Product info" },
        { value: "vipps", label: "Kjøp med Vipps" },
      ],
    },
  },
  ...reused.filter((p) => p.name !== "layout"),
  // The editor's own texts.
  { name: "subtitle", title: "Subtitle (own text)", type: "string", initialValue: "", description: "A line under the name. Empty: none." },
  { name: "tagText", title: "Label on the photo", type: "string", initialValue: "", description: "E.g. «Bestselger». Empty: none." },
  {
    name: "footerText",
    title: "Footer (own text)",
    type: "string",
    initialValue: "",
    options: { multiline: true },
    description: "Small text at the bottom of the card. Empty: none.",
  },
];

/** The single card: its own picture (Vev image), and whether the product info shows only it. */
export const KONDOMERIET_CARD_IMAGE_PROPS: any[] = [
  {
    name: "image",
    title: "Card image",
    type: "image",
    description: "Replaces the product's photo on the card; first in the product info. Empty: the product's.",
  },
  {
    name: "infoImageOnly",
    title: "Product info: only this image",
    type: "boolean",
    initialValue: false,
    hidden: (ctx: any) => !ctx?.value?.image,
  },
];

/**
 * Carousel / grid: a picture per card (Vev image), by its number in the list
 * (1 = the first card). A plain array of objects — no custom editor, which
 * crashes Vev's array fields.
 */
export const KONDOMERIET_CARD_IMAGES_PROP: any = {
  name: "cardImages",
  title: "Card images",
  type: "array",
  of: "object",
  fields: [
    { name: "card", title: "Card # (1 = first)", type: "number", initialValue: 1 },
    { name: "image", title: "Image", type: "image" },
    { name: "only", title: "Product info: only this image", type: "boolean", initialValue: false },
  ],
};

/** A Vev image value as a URL (`{ url, key }`, or a bare url from older values). */
export function imageUrlOf(value: unknown): string | undefined {
  if (typeof value === "string") return value.trim() || undefined;
  const url = (value as any)?.url;
  return typeof url === "string" && url.trim() ? url.trim() : undefined;
}

/** `cardImages` → per card index (0-based): its URL and the «only» flag. */
export function cardImagesByIndex(value: unknown): Map<number, { url: string; only: boolean }> {
  const out = new Map<number, { url: string; only: boolean }>();
  if (!Array.isArray(value)) return out;
  for (const item of value) {
    const n = Number(item?.card);
    const url = imageUrlOf(item?.image);
    if (Number.isInteger(n) && n >= 1 && url) out.set(n - 1, { url, only: !!item?.only });
  }
  return out;
}

/** Carousel / grid: one description text for every card would be wrong. */
export const KONDOMERIET_LIST_CARD_PROPS: any[] = KONDOMERIET_CARD_PROPS.filter((p) => p.name !== "descriptionText");

/** The Vio card's editable CSS (every entry: the card uses all its classes), plus the selector and the old price. */
export const KONDOMERIET_EDITABLE_CSS: any[] = [
  ...CARD_EDITABLE_CSS,
  { selector: ".vio-native-card .knd-option-pill", title: "Option pill", properties: ["background", "color", "border-color", "border-radius", "font-size", "font-family", "font-weight", "padding"] },
  { selector: ".vio-native-card .knd-option-label", title: "Option label", properties: ["color", "font-size", "font-family", "font-weight", "letter-spacing"] },
  { selector: ".vio-native-card .knd-was", title: "Old price", properties: ["color", "font-size", "font-family", "font-weight"] },
  { selector: ".vio-native-card .knd-direct-badge", title: "Direct badge (card)", properties: ["background", "color", "border-radius", "font-size", "font-family", "font-weight", "padding"] },
  { selector: ".vio-native-card .knd-subtitle", title: "Subtitle", properties: ["color", "font-size", "font-family", "font-weight", "line-height"] },
  { selector: ".vio-native-card .knd-tag", title: "Label on the photo", properties: ["background", "color", "border-radius", "font-size", "font-family", "font-weight", "padding", "letter-spacing"] },
  { selector: ".vio-native-card .knd-footer", title: "Footer", properties: ["color", "font-size", "font-family", "font-weight", "line-height"] },
  { selector: ".vio-native-card .knd-rating", title: "Rating", properties: ["color", "font-size", "font-family", "font-weight"] },
  { selector: ".vio-native-card .knd-trust", title: "Promises line", properties: ["color", "font-size", "font-family", "font-weight", "letter-spacing"] },
  { selector: ".vio-native-card .knd-vipps-note", title: "Under Vipps", properties: ["color", "font-size", "font-family", "font-weight", "text-align"] },
  { selector: ".vio-native-card .knd-offer-end", title: "Offer end", properties: ["color", "font-size", "font-family", "font-weight"] },
  { selector: ".vio-native-card .knd-more", title: "«Se mer» button", properties: ["background", "color", "border-radius", "font-size", "font-family", "font-weight", "padding", "letter-spacing"] },
  { selector: ".vio-native-card .knd-seller", title: "Seller line", properties: ["color", "font-size", "font-family", "font-weight", "letter-spacing", "gap"] },
  { selector: ".vio-native-card .knd-seller-logo", title: "Seller logo", properties: ["height", "max-width", "opacity"] },
  { selector: ".vio-native-card .knd-info-icon", title: "Product info icon", properties: ["background", "color", "box-shadow", "width", "height"] },
];

export const GROUP_PROP = {
  name: "group",
  title: "Products (one card)",
  type: "object",
  component: KondomerietGroupEditor as any,
  fields: [{ name: "data", type: "string" }],
};

export const GROUPS_PROP = {
  name: "groups",
  title: "Cards (product groups)",
  type: "object",
  component: KondomerietGroupsEditor as any,
  fields: [{ name: "data", type: "string" }],
};

const CONFIG_KEYS = [
  "layout", "accentColor", "showBrand", "showName", "showPrice", "showRetailer", "showSeller", "showDescription", "descriptionText",
  "annonse", "annonseText", "optionTitle", "selectorStyle", "vippsLabel", "infoButton", "infoButtonStyle", "infoLabel",
  "hurtigkasseTarget", "directBadge", "directBadgeOnCard", "perks", "stockText", "infoImageOnly", "discountMode",
  "discountText", "vippsButton", "buyOnCard", "moreLabel", "showRating", "showTrustLine", "trustLine", "vippsNote",
  "vippsNoteSameWindow", "offerEnd", "offerEndText", "trackingLink", "imageClickAction", "subtitle", "tagText", "footerText",
] as const;

export function pickKondomerietConfig(props: Record<string, any>): KondomerietCardConfig {
  const out: Record<string, any> = {};
  for (const k of CONFIG_KEYS) out[k] = props[k];
  return out as KondomerietCardConfig;
}
