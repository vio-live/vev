import React from "react";
import { registerVevComponent } from "@vev/react";
import ProductSelect from "./product-picker";
import { openProductInfo } from "./vio-helpers";
import { trackViewItem } from "./analytics";

/**
 * Vio · Open Product Info — an ACTION addon. Attach it to ANY element and pick a
 * product; clicking opens the SDK product-detail drawer for that product. No data
 * fetch here — the detail (mounted by Vio Config) fetches on its own.
 */

type Props = {
  product?: { productId?: number; sponsorId?: number };
  className?: string;
  children?: React.ReactNode;
};

export default function VioOpenProduct({ product, className, children }: Props) {
  const productId = product?.productId;
  const sponsorId = product?.sponsorId ?? 1;

  const onClick = () => {
    if (productId == null) return;
    trackViewItem({ productId }); // detail opens → product view (id only here)
    openProductInfo(Number(productId), Number(sponsorId));
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
  ],
});
