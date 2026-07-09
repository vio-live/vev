import React, { useEffect, useState } from "react";
import { registerVevComponent } from "@vev/react";
import { Vio, VioProduct, primaryImageUrl } from "../../vio-sdk";
import ProductSelect from "./product-select";

/**
 * Vio Product Card — envuelve el <vio-product> del SDK. El producto se ELIGE
 * con un selector visual (ProductSelect), no se teclea el id. Trae los datos
 * por id vía Vio commerce y los pasa al componente del SDK (que maneja
 * click/add/detalle exactamente como el demo).
 */

// Defaults del SDK — el card es AUTOSUFICIENTE: si monta antes de que el bloque
// Config haya hecho Vio.init/bootstrap (son componentes Vev separados, sin orden
// de montaje garantizado), se inicializa solo. La commerce key sigue viniendo
// del bootstrap (dinámica). Sin esto, el fetch del card corría contra un SDK sin
// inicializar → producto null → card en blanco (aunque el detalle sí cargaba).
const DEFAULT_API_KEY = "vg-demo_api_key_57a3038c06434330";
const DEFAULT_API_BASE = "https://api-staging.vio.live";
const DEFAULT_GQL_BASE = "https://graph-ql-dev.vio.live";

const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

type Props = {
  product?: { productId?: number; sponsorId?: number };
  hideMeta?: boolean;
};

export default function VioProductCard({ product, hideMeta }: Props) {
  const productId = product?.productId;
  const sponsorId = product?.sponsorId ?? 1;
  const [p, setP] = useState<any>(null);

  useEffect(() => {
    if (!productId) return;
    let cancelled = false;
    (async () => {
      // Reintenta hasta que el SDK esté listo (config del Config aún en vuelo).
      for (let attempt = 0; attempt < 8 && !cancelled; attempt++) {
        try {
          if (!Vio.isInitialized) {
            Vio.init({
              apiKey: DEFAULT_API_KEY,
              environment: "development",
              apiBase: DEFAULT_API_BASE,
              graphQLBase: DEFAULT_GQL_BASE,
            });
          }
          await Vio.bootstrap();
          const client = Vio.commerceFor(sponsorId);
          const arr = await client.channel.product.getByIds({ product_ids: [productId] });
          const prod = (Array.isArray(arr) ? arr : []).find(
            (x: any) => Number(x.id) === Number(productId)
          );
          console.log("[Vio] product fetch →", { productId, sponsorId, attempt, found: !!prod, image: prod && primaryImageUrl(prod) });
          if (!cancelled) setP(prod ?? null);
          return;
        } catch (e: any) {
          console.warn(`[Vio] product fetch retry ${attempt}`, productId, e?.message ?? e);
          await sleep(300);
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [productId, sponsorId]);

  const addToCart = () => {
    if (!p) return;
    try {
      Vio.cart.addManual({
        productId: Number(productId),
        sponsorId: Number(sponsorId),
        sponsorName: p.supplier?.name ?? p.brand ?? "",
        brand: p.brand ?? "",
        name: p.title ?? "",
        unitPrice: p.price?.amount ?? 0,
        currency: p.price?.currency_code ?? "NOK",
        imageUrl: primaryImageUrl(p) ?? "",
        quantity: 1,
      });
      console.log("[Vio] add-to-cart →", { productId, sponsorId });
      document.dispatchEvent(new CustomEvent("vio:open-cart"));
    } catch (e: any) {
      console.warn("[Vio] addToCart error", e);
    }
  };

  const img = p ? primaryImageUrl(p) : "";

  return (
    <VioProduct
      brand={p?.brand ?? ""}
      name={p?.title ?? ""}
      price={p?.price ? `${p.price.amount} ${p.price.currency_code ?? ""}` : ""}
      retailer={p?.supplier?.name ?? p?.brand ?? ""}
      imageUrl={img ?? ""}
      productId={productId != null ? String(productId) : ""}
      sponsorId={String(sponsorId)}
      hasVariants={Boolean(p?.options_enabled)}
      hideMeta={Boolean(hideMeta)}
      onProductAdd={addToCart}
    />
  );
}

registerVevComponent(VioProductCard, {
  name: "Vio Product (SDK)",
  size: { height: "auto", width: 300 },
  props: [
    {
      name: "product",
      title: "Producto",
      type: "object",
      component: ProductSelect as any,
      fields: [
        { name: "productId", type: "number" },
        { name: "sponsorId", type: "number" },
      ],
    },
    {
      name: "hideMeta",
      title: "Solo imagen (ocultar título y precio)",
      type: "boolean",
      initialValue: false,
    },
  ],
});
