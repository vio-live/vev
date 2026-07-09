import React from "react";
import { registerVevComponent } from "@vev/react";
import { openCart } from "./vio-helpers";

/**
 * Vio · Open Cart — an ACTION addon. Attach it to ANY element (a bag icon, a
 * button, a shape); clicking opens the cart drawer (the Config's listener). No
 * product needed.
 */

type Props = {
  className?: string;
  children?: React.ReactNode;
};

export default function VioOpenCart({ className, children }: Props) {
  return (
    <div
      className={className}
      style={{ cursor: "pointer", width: "100%", height: "100%" }}
      onClick={() => openCart()}
    >
      {children}
    </div>
  );
}

registerVevComponent(VioOpenCart, {
  name: "Vio · Open Cart",
  type: "action",
  props: [],
});
