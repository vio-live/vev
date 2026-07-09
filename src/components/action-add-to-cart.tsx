import React, { useEffect, useState } from "react";
import { registerVevComponent } from "@vev/react";
import { Vio } from "../../vio-sdk";
import ProductSelect from "./product-select";
import { fetchVioProduct, openCart, openProductInfo } from "./vio-helpers";

/**
 * Vio · Add to Cart — an ACTION addon. Attach it to ANY element (image, shape,
 * text) and pick a product; clicking the element adds that product to the cart
 * (opens the cart drawer). If the product has variants, it opens the product
 * detail instead so the buyer can pick one. UI is 100% the editor's element —
 * this only adds behaviour, calling the core (Vio.cart) underneath.
 */

type Props = {
  product?: { productId?: number; sponsorId?: number };
  openCartOnAdd?: boolean;
  className?: string;
  children?: React.ReactNode;
};

export default function VioAddToCart({ product, openCartOnAdd = true, className, children }: Props) {
  const productId = product?.productId;
  const sponsorId = product?.sponsorId ?? 1;
  const [p, setP] = useState<any>(null);

  useEffect(() => {
    if (productId == null) return;
    let cancelled = false;
    fetchVioProduct(productId, sponsorId).then((prod) => {
      if (!cancelled) setP(prod);
    });
    return () => {
      cancelled = true;
    };
  }, [productId, sponsorId]);

  const onClick = () => {
    if (productId == null) return;
    if (p?.options_enabled) {
      openProductInfo(Number(productId), Number(sponsorId)); // variants → pick in detail
      return;
    }
    if (!p) return;
    try {
      Vio.cart.addProduct({ product: p, sponsorId: Number(sponsorId), quantity: 1 });
      if (openCartOnAdd) openCart();
    } catch (e: any) {
      console.warn("[Vio] add-to-cart addon", e);
    }
  };

  return (
    <div className={className} style={{ cursor: "pointer", width: "100%", height: "100%" }} onClick={onClick}>
      {children}
    </div>
  );
}

registerVevComponent(VioAddToCart, {
  name: "Vio · Add to Cart",
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
    { name: "openCartOnAdd", title: "Open cart after add", type: "boolean", initialValue: true },
  ],
});
