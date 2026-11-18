import { productToItem, trackCta, trackSelectItem, trackViewItem } from "./analytics";
import type { VioAttribution } from "./vio-helpers";
import { submitHurtigkasse, type HurtigkasseTarget, type KondomerietOption } from "./kondomeriet-helpers";

/**
 * What the Kondomeriet blocks report, through the package's analytics module
 * (the same sinks and attribution as the Vio blocks). There is no add_to_cart,
 * begin_checkout nor purchase: the payment leaves Vio for the shop's own
 * Vipps Hurtigkasse, so the last thing Vio sees is the tap on "Kjøp med Vipps".
 */

/** The button id of "Kjøp med Vipps" in `cta_click` — not the Vio cards' `vipps` (Vio's Vipps Express). */
export const HURTIGKASSE_CTA = "vipps_hurtigkasse";
/** `item_list_name` of the `select_item` sent with that tap. */
export const HURTIGKASSE_LIST = "Vipps Hurtigkasse";

type Where = "card" | "detail";

function ctx(option: KondomerietOption, attribution: VioAttribution, sponsorId: number | null) {
  return { ...attribution, productId: option.productId, sponsorId: sponsorId ?? undefined };
}

/** "Se produktinfo" / the image: `select_item` + `view_item` (the drawer opens) + `cta_click open`. */
/** The button id of «Se mer» — the card that sends to the product info to choose and buy (`cta_click see_more`). */
export const SEE_MORE_CTA = "see_more";

/**
 * «Se produktinfo» / the image / «Se mer»: `select_item` + `view_item` (the
 * drawer opens) + `cta_click` — `open`, or `see_more` for the «Se mer» card,
 * so a card that buys in place can be compared with one that sends to the
 * product info.
 */
export function trackOpenInfo(
  option: KondomerietOption,
  attribution: VioAttribution,
  sponsorId: number | null,
  label?: string,
  cta: string = "open"
): void {
  const item = productToItem(option.product);
  trackSelectItem(item, undefined, attribution);
  trackViewItem(item, attribution);
  trackCta({ ...ctx(option, attribution, sponsorId), cta, location: "card", label });
}

/** A colour / model / size picked: `cta_click size` with the option, like the SDK detail's pills. */
export function trackOptionSelect(option: KondomerietOption, attribution: VioAttribution, sponsorId: number | null, where: Where): void {
  trackCta({ ...ctx(option, attribution, sponsorId), cta: "size", location: where, optionValue: option.label });
}

/**
 * "Kjøp med Vipps": `select_item` of the chosen product (list "Vipps
 * Hurtigkasse") and `cta_click vipps_hurtigkasse`, then the shop's form is
 * posted. Synchronous on purpose: the submit must stay inside the click.
 * Returns whether the form went.
 */
export function buyWithHurtigkasse(
  option: KondomerietOption,
  {
    attribution,
    sponsorId,
    where,
    label,
    target,
    editor,
  }: {
    attribution: VioAttribution;
    sponsorId: number | null;
    where: Where;
    label?: string;
    target?: HurtigkasseTarget;
    /** In the Vev editor nothing is posted (the canvas is not a shop). */
    editor?: boolean;
  }
): boolean {
  if (!option.slug) return false;
  trackSelectItem(productToItem(option.product, { quantity: 1 }), HURTIGKASSE_LIST, attribution);
  trackCta({ ...ctx(option, attribution, sponsorId), cta: HURTIGKASSE_CTA, location: where, label, variant: "hurtigkasse" });
  if (editor) {
    console.info("[Vio] Kondomeriet: Hurtigkasse not posted in the editor —", option.slug);
    return false;
  }
  return submitHurtigkasse(option.slug, target);
}
