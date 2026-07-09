import { Vio } from "../../vio-sdk";

/**
 * Shared helpers for the Vio Vev components: SDK init, catalog listing and
 * product fetching. Every block/addon is self-sufficient (Vev mounts components
 * in no guaranteed order), so each one boots the core on its own here.
 * The commerce key stays dynamic — resolved via Vio.bootstrap() per sponsor.
 */

export const DEFAULT_API_KEY = "vg-demo_api_key_57a3038c06434330";
export const DEFAULT_API_BASE = "https://api-staging.vio.live";
export const DEFAULT_GQL_BASE = "https://graph-ql-dev.vio.live";

// The demo catalog lives under sponsor 1. When this grows to multiple sponsors,
// lift it into config / a bootstrap-driven selector.
export const SPONSOR_ID = 1;

export type CatalogProduct = {
  id: number | string;
  brand?: string;
  title?: string;
  price?: { amount?: number; currency_code?: string };
  images?: Array<{ url?: string }>;
};

export function ensureVioInit(): void {
  if (!Vio.isInitialized) {
    Vio.init({
      apiKey: DEFAULT_API_KEY,
      environment: "development",
      apiBase: DEFAULT_API_BASE,
      graphQLBase: DEFAULT_GQL_BASE,
    });
  }
}

/** Fetch a single full product DTO by id, retrying while the config is in flight. */
export async function fetchVioProduct(
  productId: number,
  sponsorId: number,
  attempts = 8
): Promise<any | null> {
  for (let i = 0; i < attempts; i++) {
    try {
      ensureVioInit();
      await Vio.bootstrap();
      const arr = await Vio.commerceFor(sponsorId).channel.product.getByIds({
        product_ids: [productId],
      });
      return (Array.isArray(arr) ? arr : []).find((x: any) => Number(x.id) === Number(productId)) ?? null;
    } catch (e: any) {
      console.warn("[Vio] fetchVioProduct retry", i, productId, e?.message ?? e);
      await new Promise((r) => setTimeout(r, 300));
    }
  }
  return null;
}

/** Fetch several products by id in one call (for carousel / grid), with retry. */
export async function fetchVioProducts(
  productIds: number[],
  sponsorId: number,
  attempts = 8
): Promise<any[]> {
  const ids = productIds.filter((n) => Number.isFinite(n));
  if (ids.length === 0) return [];
  for (let i = 0; i < attempts; i++) {
    try {
      ensureVioInit();
      await Vio.bootstrap();
      const arr = await Vio.commerceFor(sponsorId).channel.product.getByIds({ product_ids: ids });
      const list = Array.isArray(arr) ? arr : [];
      // Preserve the requested order.
      return ids
        .map((id) => list.find((x: any) => Number(x.id) === Number(id)))
        .filter(Boolean);
    } catch (e: any) {
      console.warn("[Vio] fetchVioProducts retry", i, e?.message ?? e);
      await new Promise((r) => setTimeout(r, 300));
    }
  }
  return [];
}

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

// Shared catalog request — one fetch reused by all pickers (parallel requests
// hammered the backend → 500s), deduped via a module-level promise.
let catalogPromise: Promise<CatalogProduct[]> | null = null;
export function loadCatalog(): Promise<CatalogProduct[]> {
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
    catalogPromise = null; // allow a retry on the next call
    throw err;
  });
  return catalogPromise;
}

/** Dispatch the SDK product-detail open event (the Config's <VioProductDetail> listens). */
export function openProductInfo(productId: number, sponsorId: number): void {
  document.dispatchEvent(
    new CustomEvent("vio:product-click", {
      detail: { productId: String(productId), sponsorId: String(sponsorId) },
    })
  );
}

/** Ask the Config to open the cart drawer. */
export function openCart(): void {
  document.dispatchEvent(new CustomEvent("vio:open-cart"));
}
