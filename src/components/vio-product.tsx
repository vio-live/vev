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
  /** Vev's image field: { url, key } — or a bare url from older values. */
  image?: { url?: string } | string;
} & CardConfig;

export default function VioProductCard({ product, image, ...config }: Props) {
  const imageOverride = typeof image === "string" ? image : image?.url;
  return (
    <VioProductCardSelf
      productId={product?.productId}
      // Only a preference: the card resolves it against the connected key.
      sponsorId={product?.sponsorId}
      config={config}
      imageOverride={imageOverride || undefined}
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
    // Their own picture in place of the product's (Angelo, 2026-10-08): a
    // campaign shot, a cut-out on the page's colour. Only on this card — the
    // product's detail and the cart keep the product's photos.
    {
      name: "image",
      title: "Custom image",
      type: "image",
      description: "Replaces the product's photo on this card. Leave empty to use the product's.",
    },
    ...CARD_CONFIG_PROPS,
  ],
});
