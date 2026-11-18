/**
 * The slot fields of a Vio block (ADR-0027 / ADR-0034) — the card, the
 * carousel, the grid and the Open Product Info addon share them. Both are
 * optional, nobody has to fill them: with an empty "Slot" a block registers
 * itself under its own Vev key, named after its heading and the page (see
 * `useVioSlot` in vio-helpers.ts). "Slot" is an explicit id that groups
 * blocks (same value = one slot in the dashboard); "Slot name" is how the
 * slot is listed there — an explicit Slot with no name is left unnamed, so
 * the server keeps the name the slot already has.
 */
export const SLOT_PROPS: any[] = [
  {
    name: "slot",
    title: "Slot",
    type: "string",
    initialValue: "",
    description:
      "Optional. An id for this place in the Vio dashboard; blocks with the same value are one slot. Empty: the block registers itself with its own id.",
  },
  {
    name: "slotName",
    title: "Slot name",
    type: "string",
    initialValue: "",
    description:
      "Optional. How the slot is listed in the Vio dashboard. Empty: the block's heading (a card: its product), else its kind and position, with the page title.",
  },
];
