import React from "react";
import { registerVevComponent } from "@vev/react";
import ProductSelect from "./product-picker";
import { VioProductCardSelf, type CardConfig } from "./card-view";
import { CARD_CONFIG_PROPS, CARD_EDITABLE_CSS } from "./card-props";

/**
 * Vio Product Card — a single Vev-native product card. Thin wrapper: maps props
 * to a CardConfig and delegates to the shared ProductCardView (same look used by
 * the Carousel and Grid). Logic stays in the core (Vio.cart / detail events).
 */

type Props = {
  product?: { productId?: number; sponsorId?: number };
} & CardConfig;

export default function VioProductCard({ product, ...config }: Props) {
  return (
    <VioProductCardSelf
      productId={product?.productId}
      sponsorId={product?.sponsorId ?? 1}
      config={config}
    />
  );
}

registerVevComponent(VioProductCard, {
  name: "Vio Product Card",
  size: { height: "auto", width: 300 },
  editableCSS: CARD_EDITABLE_CSS,
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
    ...CARD_CONFIG_PROPS,
  ],
});
