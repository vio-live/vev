import { CARD_CONFIG_PROPS, CARD_EDITABLE_CSS } from "./card-props";
import { KondomerietGroupEditor, KondomerietGroupsEditor } from "./kondomeriet-group-editor";
import type { KondomerietCardConfig } from "./kondomeriet-card-view";

/**
 * Props of the Kondomeriet card / carousel / grid. The look-and-feel fields
 * are the Vio card's own (same names, same defaults where they apply), minus
 * what makes no sense without Vio's cart: the add button, its action, the
 * auto discount badge, the Vio Vipps Express button. On top: the selector,
 * the two buttons and where the Hurtigkasse opens.
 */

/** The Vio card fields reused as they are. */
const REUSED = new Set([
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

export const KONDOMERIET_CARD_PROPS: any[] = [
  {
    name: "layout",
    title: "Card layout",
    type: "select",
    initialValue: "standard",
    options: {
      display: "dropdown",
      items: [
        { value: "standard", label: "Standard (image + info)" },
        { value: "horizontal", label: "Horizontal" },
      ],
    },
  },
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
  ...reused,
];

/** Carousel / grid: one description text for every card would be wrong. */
export const KONDOMERIET_LIST_CARD_PROPS: any[] = KONDOMERIET_CARD_PROPS.filter((p) => p.name !== "descriptionText");

/** The Vio card's editable CSS, plus the Kondomeriet pieces. */
export const KONDOMERIET_EDITABLE_CSS: any[] = [
  ...CARD_EDITABLE_CSS.filter((c) => !/vnc-add|vnc-btn-text/.test(c.selector)),
  { selector: ".vio-native-card .knd-pill", title: "Option pill", properties: ["background", "color", "border-color", "border-radius", "font-size", "padding"] },
  { selector: ".vio-native-card .knd-btn-info", title: "Product info button", properties: ["background", "color", "border-color", "border-radius", "font-size", "padding", "letter-spacing"] },
  { selector: ".vio-native-card .knd-was", title: "Old price", properties: ["color", "font-size"] },
  { selector: ".vio-native-card .knd-now.knd-sale", title: "Sale price", properties: ["color", "font-size", "font-weight"] },
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
    infoLabel,
    hurtigkasseTarget,
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
    infoLabel,
    hurtigkasseTarget,
  };
}
