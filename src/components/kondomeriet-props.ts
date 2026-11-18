import { CARD_CONFIG_PROPS, CARD_EDITABLE_CSS } from "./card-props";
import { KondomerietGroupEditor, KondomerietGroupsEditor } from "./kondomeriet-group-editor";
import type { KondomerietCardConfig } from "./kondomeriet-card-view";
import { DEFAULT_DIRECT_BADGE, DEFAULT_PERKS, DEFAULT_STOCK_TEXT } from "./kondomeriet-helpers";

/**
 * Props of the Kondomeriet card / carousel / grid. The look-and-feel fields
 * are the Vio card's own — the same definitions, taken from CARD_CONFIG_PROPS
 * (layout, accent, brand / name / price / description, «Annonse») — so they
 * behave the same. Left out is what needs Vio's cart: the add button and its
 * action, the image's «add» action, the discount badge mode (the Kondomeriet
 * badge is the group's own text, else the feed sale's %), and the Vio Vipps
 * Express button (here the Vipps button is always the Hurtigkasse). On top:
 * the selector, the product-info button and where the Hurtigkasse opens.
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
  ...reused.filter((p) => p.name !== "layout"),
];

/** Carousel / grid: one description text for every card would be wrong. */
export const KONDOMERIET_LIST_CARD_PROPS: any[] = KONDOMERIET_CARD_PROPS.filter((p) => p.name !== "descriptionText");

/** The Vio card's editable CSS (every entry: the card uses all its classes), plus the selector and the old price. */
export const KONDOMERIET_EDITABLE_CSS: any[] = [
  ...CARD_EDITABLE_CSS,
  { selector: ".vio-native-card .knd-option-pill", title: "Option pill", properties: ["background", "color", "border-color", "border-radius", "font-size", "padding"] },
  { selector: ".vio-native-card .knd-option-label", title: "Option label", properties: ["color", "font-size", "letter-spacing"] },
  { selector: ".vio-native-card .knd-was", title: "Old price", properties: ["color", "font-size"] },
  { selector: ".vio-native-card .knd-direct-badge", title: "Direct badge (card)", properties: ["background", "color", "border-radius", "font-size", "padding"] },
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

export function pickKondomerietConfig(props: Record<string, any>): KondomerietCardConfig {
  const {
    layout,
    accentColor,
    showBrand,
    showName,
    showPrice,
    showRetailer,
    showDescription,
    descriptionText,
    annonse,
    annonseText,
    optionTitle,
    selectorStyle,
    vippsLabel,
    infoButton,
    infoButtonStyle,
    infoLabel,
    hurtigkasseTarget,
    directBadge,
    directBadgeOnCard,
    perks,
    stockText,
  } = props;
  return {
    layout,
    accentColor,
    showBrand,
    showName,
    showPrice,
    showRetailer,
    showDescription,
    descriptionText,
    annonse,
    annonseText,
    optionTitle,
    selectorStyle,
    vippsLabel,
    infoButton,
    infoButtonStyle,
    infoLabel,
    hurtigkasseTarget,
    directBadge,
    directBadgeOnCard,
    perks,
    stockText,
  };
}
