/**
 * Shared prop + editableCSS definitions for every product surface (card,
 * carousel, grid) so they expose the same card-styling controls to the editor.
 */

import { ensureVioInit, loadVippsOffer, resolveActiveSponsorId, resolveApiKey, sponsorForSlot } from "./vio-helpers";

/**
 * The Vipps button is offered in the panel only when the channel has Vipps
 * (Angelo, 2026-10-08): the editor asks the payment methods the same way the
 * card does before drawing it. Only a known "no" hides it — a lookup that
 * fails (no key yet, a network hiccup) leaves the option where it was,
 * rather than hiding something we could not check.
 */
async function channelLacksVipps(ctx: any): Promise<boolean> {
  try {
    // The panel is another window: a changed page campaign (storage) must
    // re-init here first, so the sponsor below is the campaign's.
    if (resolveApiKey()) ensureVioInit();
    // The sponsor the block itself will use: the page's campaign sponsor when
    // a campaign is chosen, else the page's active one (else the one its
    // product was picked under), only if the connected key has it.
    const sponsorId = sponsorForSlot(null, await resolveActiveSponsorId(ctx?.value?.product?.sponsorId));
    if (sponsorId == null) return false; // no configuration yet: not checked
    return (await loadVippsOffer(sponsorId)) === "none";
  } catch {
    return false;
  }
}

export const CARD_CONFIG_PROPS: any[] = [
  {
    name: "layout",
    title: "Card layout",
    type: "select",
    initialValue: "standard",
    options: {
      display: "dropdown",
      items: [
        { value: "standard", label: "Standard (image + info)" },
        { value: "image-only", label: "Image only" },
        { value: "overlay", label: "Info over image" },
        { value: "horizontal", label: "Horizontal" },
      ],
    },
  },
  {
    name: "buttonStyle",
    title: "Button",
    type: "select",
    initialValue: "icon",
    options: {
      display: "dropdown",
      items: [
        { value: "icon", label: "Icon (+)" },
        { value: "text", label: "Text (pill)" },
        { value: "bar", label: "Full-width bar" },
        { value: "hidden", label: "No button" },
      ],
    },
  },
  { name: "buttonLabel", title: "Button label", type: "string", initialValue: "Kjøp" },
  {
    name: "buttonAction",
    title: "Button action",
    type: "select",
    initialValue: "add",
    options: {
      display: "dropdown",
      items: [
        { value: "add", label: "Add to cart" },
        { value: "detail", label: "Open detail" },
      ],
    },
  },
  {
    name: "imageClickAction",
    title: "Image click",
    type: "select",
    initialValue: "detail",
    options: {
      display: "dropdown",
      items: [
        { value: "detail", label: "Product info" },
        { value: "add", label: "Add to cart" },
      ],
    },
  },
  { name: "accentColor", title: "Accent color", type: "string", initialValue: "" },
  { name: "showBrand", title: "Show brand", type: "boolean", initialValue: true },
  { name: "showName", title: "Show name", type: "boolean", initialValue: true },
  { name: "showPrice", title: "Show price", type: "boolean", initialValue: true },
  { name: "showRetailer", title: "Show retailer", type: "boolean", initialValue: true },
  {
    name: "discountMode",
    title: "Discount badge",
    type: "select",
    initialValue: "off",
    options: {
      display: "dropdown",
      items: [
        { value: "off", label: "Off" },
        { value: "auto", label: "Auto (from sale price)" },
        { value: "manual", label: "Manual (text)" },
      ],
    },
  },
  { name: "discountText", title: "Discount text (manual)", type: "string", initialValue: "-25 %" },
  { name: "annonse", title: "'Annonse' label", type: "boolean", initialValue: false },
  { name: "annonseText", title: "Annonse text", type: "string", initialValue: "Annonse" },
  // Vipps Express straight from the card: the app opens with address and
  // delivery already there. Off by default — it is a new button on pages that
  // already exist; the detail, cart and checkout show theirs on their own.
  {
    name: "vippsButton",
    title: "Vipps Express button",
    type: "select",
    initialValue: "hidden",
    hidden: channelLacksVipps,
    options: {
      display: "dropdown",
      items: [
        { value: "hidden", label: "Off" },
        { value: "bar", label: "Full-width bar (under the name)" },
      ],
    },
  },
  {
    name: "vippsLabel",
    title: "Vipps button label",
    type: "string",
    initialValue: "Kjøp nå med",
    // Only with the button on, and only where there can be one.
    hidden: async (ctx: any) =>
      (ctx?.value?.vippsButton ?? "hidden") === "hidden" || (await channelLacksVipps(ctx)),
  },
];

export const CARD_EDITABLE_CSS: any[] = [
  { selector: ".vio-native-card", title: "Card", properties: ["background", "border-radius", "padding", "box-shadow", "gap"] },
  { selector: ".vio-native-card .vnc-image", title: "Image", properties: ["border-radius", "aspect-ratio", "background-color"] },
  { selector: ".vio-native-card .vnc-add", title: "Button (icon)", properties: ["background", "color", "border-radius", "box-shadow", "width", "height"] },
  { selector: ".vio-native-card .vnc-btn-text", title: "Button (text)", properties: ["background", "color", "border-radius", "font-size", "padding", "letter-spacing"] },
  { selector: ".vio-native-card .vnc-btn-vipps", title: "Vipps button", properties: ["background", "color", "border-radius", "font-size", "padding", "letter-spacing"] },
  { selector: ".vio-native-card .vnc-badge", title: "Discount badge", properties: ["background", "color", "border-radius", "font-size", "padding"] },
  { selector: ".vio-native-card .vnc-brand", title: "Brand", properties: ["color", "font-size", "letter-spacing", "font-weight"] },
  { selector: ".vio-native-card .vnc-name", title: "Name", properties: ["color", "font-size", "font-weight", "font-family", "line-height"] },
  { selector: ".vio-native-card .vnc-price", title: "Price", properties: ["color", "font-size", "font-weight"] },
  { selector: ".vio-native-card .vnc-retailer", title: "Retailer", properties: ["color", "font-size", "letter-spacing"] },
];

/** Extract the CardConfig subset from a Vev props object. */
export function pickCardConfig(props: Record<string, any>) {
  const {
    layout,
    buttonStyle,
    buttonLabel,
    buttonAction,
    imageClickAction,
    accentColor,
    showBrand,
    showName,
    showPrice,
    showRetailer,
    discountMode,
    discountText,
    annonse,
    annonseText,
    vippsButton,
    vippsLabel,
  } = props;
  return {
    layout,
    buttonStyle,
    buttonLabel,
    buttonAction,
    imageClickAction,
    accentColor,
    showBrand,
    showName,
    showPrice,
    showRetailer,
    discountMode,
    discountText,
    annonse,
    annonseText,
    vippsButton,
    vippsLabel,
  };
}
