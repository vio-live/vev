import React from "react";
import { registerVevComponent } from "@vev/react";
import { KondomerietList, type KondomerietListProps } from "./kondomeriet-list";
import { GROUPS_PROP, KONDOMERIET_EDITABLE_CSS, KONDOMERIET_LIST_CARD_PROPS } from "./kondomeriet-props";
import { SLOT_PROPS } from "./slot-props";

/**
 * Kondomeriet Product Grid — a responsive grid of Kondomeriet cards, one per
 * product group. 2–5 columns, collapses to 2 on phones, like the Vio grid.
 */
export default function KondomerietProductGrid(props: KondomerietListProps) {
  return <KondomerietList kind="grid" props={props} />;
}

registerVevComponent(KondomerietProductGrid, {
  name: "Kondomeriet Product Grid",
  // Vev takes "100%" here (the Vio carousel / grid do too); its type says number | "auto".
  size: { width: "100%" as any, height: "auto" },
  editableCSS: KONDOMERIET_EDITABLE_CSS,
  props: [
    GROUPS_PROP,
    { name: "kicker", title: "Kicker", type: "string", initialValue: "" },
    { name: "heading", title: "Heading", type: "string", initialValue: "" },
    {
      name: "columns",
      title: "Columns",
      type: "select",
      initialValue: 3,
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
    { name: "gap", title: "Gap (px)", type: "number", initialValue: 20 },
    ...SLOT_PROPS,
    ...KONDOMERIET_LIST_CARD_PROPS,
  ],
});
