import React, { useEffect, useState } from "react";
import { SilkeBox, SilkeButton, SilkeTextSmall } from "@vev/silke";
import { Vio } from "../../vio-sdk";

/**
 * Editor de selección de producto (como el de Alan): lista el catálogo del canal
 * y deja elegir un producto visualmente en vez de teclear el id.
 * Usa el SDK (Vio) para listar vía la query `Channel { Products(...) }`.
 */

const DEMO_API_KEY = "vg-demo_api_key_57a3038c06434330";
const API_BASE = "https://api-staging.vio.live";
const GQL_BASE = "https://graph-ql-dev.vio.live";
const SPONSOR_ID = 1;

const PRODUCTS_QUERY = `
  query Products($currency: String, $imageSize: ImageSize, $useCache: Boolean!) {
    Channel {
      Products(
        barcode_list: []
        sku_list: []
        category_ids: []
        product_ids: []
        currency: $currency
        image_size: $imageSize
        useCache: $useCache
        shipping_country_code: null
      ) {
        id
        brand
        title
        price { amount currency_code }
        images { url }
      }
    }
  }
`;

// Cache compartido: una sola llamada a la lista, reutilizada por todos los
// pickers (evita disparos en paralelo que hacían flaquear el backend → 500).
let productsPromise: Promise<any[]> | null = null;
function loadProducts(): Promise<any[]> {
  if (productsPromise) return productsPromise;
  productsPromise = (async () => {
    if (!Vio.isInitialized) {
      Vio.init({ apiKey: DEMO_API_KEY, apiBase: API_BASE, graphQLBase: GQL_BASE });
    }
    await Vio.bootstrap();
    const commerce = Vio.commerceFor(SPONSOR_ID);
    const data = await commerce.raw.request(PRODUCTS_QUERY, {
      currency: "NOK",
      imageSize: "large",
      useCache: true,
    });
    const list = data?.Channel?.Products ?? [];
    console.log("[Vio] ProductSelect → productos listados:", list.length);
    return list;
  })().catch((e: any) => {
    productsPromise = null; // permite reintentar en el próximo montaje
    throw e;
  });
  return productsPromise;
}

export default function ProductSelect({ value, onChange }: any) {
  const [products, setProducts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    loadProducts()
      .then((list) => {
        if (!cancelled) {
          setProducts(list);
          setLoading(false);
        }
      })
      .catch((e: any) => {
        console.warn("[Vio] ProductSelect error", e);
        if (!cancelled) {
          setError(e?.message ?? "No se pudo listar el catálogo");
          setLoading(false);
        }
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const selectedId = value?.productId;

  if (loading) return <SilkeTextSmall>Cargando productos…</SilkeTextSmall>;
  if (error) return <SilkeTextSmall style={{ color: "#e5484d" }}>{error}</SilkeTextSmall>;

  return (
    <SilkeBox column gap="s">
      {products.map((p) => {
        const isSel = Number(selectedId) === Number(p.id);
        return (
          <div
            key={p.id}
            onClick={() => onChange({ productId: Number(p.id), sponsorId: SPONSOR_ID })}
            style={{
              display: "flex",
              alignItems: "center",
              gap: 10,
              padding: 8,
              borderRadius: 6,
              cursor: "pointer",
              border: isSel ? "2px solid #0a0a0a" : "1px solid #ddd",
              background: isSel ? "rgba(0,0,0,0.04)" : "transparent",
            }}
          >
            <img
              src={p.images?.[0]?.url}
              alt=""
              style={{ width: 40, height: 40, objectFit: "cover", borderRadius: 4, background: "#f2f2f2", flexShrink: 0 }}
            />
            <div style={{ minWidth: 0 }}>
              <div style={{ fontSize: 13, fontWeight: 500, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                {p.title}
              </div>
              <div style={{ fontSize: 12, opacity: 0.6 }}>
                {p.price?.amount} {p.price?.currency_code} · #{p.id}
              </div>
            </div>
          </div>
        );
      })}
    </SilkeBox>
  );
}
