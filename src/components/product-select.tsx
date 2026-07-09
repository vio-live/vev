import React, { useEffect, useState } from "react";
import { SilkeBox, SilkeTextSmall } from "@vev/silke";
import { Vio } from "../../vio-sdk";
import { ensureVioInit } from "./vio-helpers";

/**
 * ProductSelect — custom editor for the `product` prop. Lists the channel catalog
 * so the editor picks a product visually instead of typing an id. Runs a single
 * shared catalog request (module-level promise) reused by every picker instance.
 */

// The demo catalog lives under sponsor 1. When this grows to multiple sponsors,
// lift this into a prop / bootstrap-driven selector.
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

type CatalogProduct = {
  id: number | string;
  brand?: string;
  title?: string;
  price?: { amount?: number; currency_code?: string };
  images?: Array<{ url?: string }>;
};

// Shared catalog request — one fetch reused by all pickers. Firing it per instance
// hammered the backend (parallel requests → 500s), so it is deduped here.
let catalogPromise: Promise<CatalogProduct[]> | null = null;
function loadCatalog(): Promise<CatalogProduct[]> {
  if (catalogPromise) return catalogPromise;
  catalogPromise = (async () => {
    ensureVioInit();
    await Vio.bootstrap();
    const commerce = Vio.commerceFor(SPONSOR_ID);
    const data = await commerce.raw.request(PRODUCTS_QUERY, {
      currency: "NOK",
      imageSize: "large",
      useCache: true,
    });
    return (data?.Channel?.Products ?? []) as CatalogProduct[];
  })().catch((err: unknown) => {
    catalogPromise = null; // allow a retry on the next mount
    throw err;
  });
  return catalogPromise;
}

type ProductSelectValue = { productId?: number; sponsorId?: number };

type ProductSelectProps = {
  value?: ProductSelectValue;
  onChange: (value: ProductSelectValue) => void;
};

export default function ProductSelect({ value, onChange }: ProductSelectProps) {
  const [products, setProducts] = useState<CatalogProduct[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    loadCatalog()
      .then((list) => {
        if (cancelled) return;
        setProducts(list);
        setLoading(false);
      })
      .catch((err: any) => {
        if (cancelled) return;
        console.warn("[Vio] ProductSelect", err);
        setError(err?.message ?? "Could not load the catalog");
        setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const selectedId = value?.productId;

  if (loading) return <SilkeTextSmall>Loading products…</SilkeTextSmall>;
  if (error) return <SilkeTextSmall style={{ color: "#e5484d" }}>{error}</SilkeTextSmall>;

  return (
    <SilkeBox column gap="s">
      {products.map((p) => {
        const isSelected = Number(selectedId) === Number(p.id);
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
              border: isSelected ? "2px solid #0a0a0a" : "1px solid #ddd",
              background: isSelected ? "rgba(0,0,0,0.04)" : "transparent",
            }}
          >
            <img
              src={p.images?.[0]?.url}
              alt=""
              style={{
                width: 40,
                height: 40,
                objectFit: "cover",
                borderRadius: 4,
                background: "#f2f2f2",
                flexShrink: 0,
              }}
            />
            <div style={{ minWidth: 0 }}>
              <div
                style={{
                  fontSize: 13,
                  fontWeight: 500,
                  whiteSpace: "nowrap",
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                }}
              >
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
