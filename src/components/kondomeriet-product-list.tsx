import React from "react";
import { registerVevComponent } from "@vev/react";
import { KondomerietList, type KondomerietListProps } from "./kondomeriet-list";
import { GROUPS_PROP, KONDOMERIET_CARD_IMAGES_PROP, KONDOMERIET_EDITABLE_CSS, KONDOMERIET_LIST_CARD_PROPS } from "./kondomeriet-props";
import { SLOT_PROPS } from "./slot-props";

/**
 * Kondomeriet Product List — the Grid's and Carousel's product groups as
 * rows: a small square image, brand, name and price beside it, «Kjøp nå med
 * Vipps» or «Se mer» on the right (under the text on a phone), a thin line
 * between rows. Same groups, editor, Details, snapshot, Circlewise and
 * product info as the Grid; each row is a `KondomerietCardView` (variant
 * `row`), so price, options, buying and analytics are the card's.
 */
export default function KondomerietProductList(props: KondomerietListProps) {
  return <KondomerietList kind="list" props={props} />;
}

registerVevComponent(KondomerietProductList, {
  name: "Kondomeriet Product List",
  // Vev takes "100%" here (the Vio carousel / grid do too); its type says number | "auto".
  size: { width: "100%" as any, height: "auto" },
  editableCSS: KONDOMERIET_EDITABLE_CSS,
  props: [
    GROUPS_PROP,
    KONDOMERIET_CARD_IMAGES_PROP,
    { name: "kicker", title: "Kicker", type: "string", initialValue: "" },
    { name: "heading", title: "Heading", type: "string", initialValue: "" },
    { name: "disclaimer", title: "Disclaimer", type: "string", initialValue: "annonselenker" },
    ...SLOT_PROPS,
    ...KONDOMERIET_LIST_CARD_PROPS,
  ],
});
