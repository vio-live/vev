import React from "react";
import { registerVevComponent } from "@vev/react";
import { KondomerietList, type KondomerietListProps } from "./kondomeriet-list";
import { GROUPS_PROP, KONDOMERIET_EDITABLE_CSS, KONDOMERIET_LIST_CARD_PROPS } from "./kondomeriet-props";
import { SLOT_PROPS } from "./slot-props";

/**
 * Kondomeriet Product Carousel — a scroll-snapped row of Kondomeriet cards,
 * one per product group (each with its own selector, discount badge and
 * Vipps Hurtigkasse). Same layout options as the Vio carousel.
 */
export default function KondomerietProductCarousel(props: KondomerietListProps) {
  return <KondomerietList kind="carousel" props={props} />;
}

registerVevComponent(KondomerietProductCarousel, {
  name: "Kondomeriet Product Carousel",
  // Vev takes "100%" here (the Vio carousel / grid do too); its type says number | "auto".
  size: { width: "100%" as any, height: "auto" },
  editableCSS: KONDOMERIET_EDITABLE_CSS,
  props: [
    GROUPS_PROP,
    { name: "kicker", title: "Kicker", type: "string", initialValue: "" },
    { name: "heading", title: "Heading", type: "string", initialValue: "" },
    { name: "disclaimer", title: "Disclaimer", type: "string", initialValue: "annonselenker" },
    {
      name: "visible",
      title: "Visible at once",
      type: "select",
      initialValue: 4,
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
    { name: "gap", title: "Gap (px)", type: "number", initialValue: 16 },
    { name: "arrows", title: "Show arrows", type: "boolean", initialValue: true },
    ...SLOT_PROPS,
    ...KONDOMERIET_LIST_CARD_PROPS,
  ],
});
