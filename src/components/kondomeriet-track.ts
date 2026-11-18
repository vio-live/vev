import { productToItem, trackCta, trackSelectItem, trackViewItem } from "./analytics";
import type { VioAttribution } from "./vio-helpers";
import { inAppBrowser } from "./kondomeriet-perf";
import { Vio } from "../../vio-sdk";
import { circlewiseUrl, openInTarget, type CirclewiseLink } from "./kondomeriet-helpers";
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
  // The in-app browser mark rides on the product click (props on the Vio collector).
  trackSelectItem(item, undefined, { ...attribution, in_app_browser: inAppBrowser() ?? "no" } as any);
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
    inAppBrowser,
    tracking,
    editor,
  }: {
    attribution: VioAttribution;
    sponsorId: number | null;
    where: Where;
    label?: string;
    target?: HurtigkasseTarget;
    /** The app whose browser this is (`inAppBrowser()`), or null — marked on both events, to measure that traffic. */
    inAppBrowser?: string | null;
    /**
     * A Circlewise link: after our events, the purchase goes through its
     * tracker → Vio's bridge → the Hurtigkasse POST, in the same target.
     * Without one, the direct POST.
     */
    tracking?: CirclewiseLink | null;
    /** In the Vev editor nothing is posted (the canvas is not a shop). */
    editor?: boolean;
  }
): boolean {
  if (!option.slug) return false;
  const app = inAppBrowser ?? null;
  const via = tracking ? "circlewise" : "direct";
  trackSelectItem(productToItem(option.product, { quantity: 1 }), HURTIGKASSE_LIST, {
    ...attribution,
    in_app_browser: app ?? "no",
    hurtigkasse_target: target ?? "_blank",
    tracking: via,
  } as any);
  // `variant`: «hurtigkasse», + «_inapp_<app>» in an app's browser, + «_circlewise» through the tracker.
  trackCta({
    ...ctx(option, attribution, sponsorId),
    cta: HURTIGKASSE_CTA,
    location: where,
    label,
    variant: `hurtigkasse${app ? `_inapp_${app}` : ""}${tracking ? "_circlewise" : ""}`,
  });
  if (editor) {
    console.info("[Vio] Kondomeriet: Hurtigkasse not posted in the editor —", option.slug, via);
    return false;
  }
  if (tracking) {
    // ref2 = our SDK session, ref3 = the campaign: Circlewise's postback brings them back.
    const session = (() => {
      try {
        return (Vio as any).analytics?.sessionId ?? null;
      } catch {
        return null;
      }
    })();
    return openInTarget(circlewiseUrl(tracking, option.slug, { ref2: session, ref3: attribution.campaignId ?? null }), target);
  }
  return submitHurtigkasse(option.slug, target);
}
