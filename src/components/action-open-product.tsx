import React from "react";
import { registerVevComponent } from "@vev/react";
import ProductSelect from "./product-picker";
import { SLOT_PROPS } from "./slot-props";
import {
  COMPONENT_TEMPLATE_ID,
  openProductInfo,
  sponsorForCommerce,
  sponsorForSlot,
  useVioSlot,
  vioAttribution,
} from "./vio-helpers";
import { trackCta, trackViewItem } from "./analytics";

/**
 * Vio · Open Product Info — an ACTION addon. Attach it to ANY element and pick a
 * product; clicking opens the SDK product-detail drawer for that product. No data
 * fetch here — the detail (mounted by Vio Config) fetches on its own.
 */

type Props = {
  product?: { productId?: number; sponsorId?: number };
  className?: string;
  children?: React.ReactNode;
  /** Slot (ADR-0034) — both optional; see SLOT_PROPS. */
  slot?: string;
  slotName?: string;
  /** Vev passes the host element of the element the addon is attached to. */
  hostRef?: { current: HTMLElement | null } | null;
};

export default function VioOpenProduct({ product, className, children, slot, slotName, hostRef }: Props) {
  const productId = product?.productId;
  // Its own slot (ADR-0034): the "Slot" field, else `open-<vev key>` (the
  // addon's own key), registered like any block — a hotspot is a place too.
  const slotId = useVioSlot({ slot, slotName, kind: "open", hostRef });

  const onClick = () => {
    if (productId == null) return;
    // The sponsor it was picked under when the connected key has it, else the
    // page's active one (sponsorForCommerce) — or the slot's campaign sponsor
    // when one is assigned. The detail then carries this slot on its events.
    const sponsorId = sponsorForSlot(slotId, sponsorForCommerce(product?.sponsorId));
    // detail opens → product view (id only here); typed as the detail, the
    // component the reader actually sees (COMPONENT_TEMPLATE_ID.open).
    const attr = vioAttribution(slotId, sponsorId, COMPONENT_TEMPLATE_ID.open);
    trackViewItem({ productId }, attr);
    // The tap itself, for the dashboard's «Buttons» (an article block).
    trackCta({ ...attr, cta: "open", location: "block", productId, sponsorId: sponsorId ?? undefined });
    openProductInfo(Number(productId), product?.sponsorId, undefined, slotId);
  };

  return (
    <div className={className} style={{ cursor: "pointer", width: "100%", height: "100%" }} onClick={onClick}>
      {children}
    </div>
  );
}

registerVevComponent(VioOpenProduct, {
  name: "Vio · Open Product Info",
  type: "action",
  props: [
    {
      name: "product",
      title: "Product",
      type: "object",
      component: ProductSelect as any,
      fields: [
        { name: "productId", type: "number" },
        { name: "sponsorId", type: "number" },
      ],
    },
    ...SLOT_PROPS,
  ],
});
