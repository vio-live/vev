import { Vio } from "../../vio-sdk";

/**
 * Shared helpers for the Vio Vev components: SDK init, catalog listing, product
 * fetching, and small events. Every block/addon is self-sufficient (Vev mounts
 * components in no guaranteed order), so each one can boot the core on its own.
 * The commerce key stays dynamic — resolved via Vio.bootstrap() per sponsor.
 */

// Flip to true to see [Vio] diagnostics in the console.
const DEBUG = false;

export const DEFAULT_API_KEY = "vg-demo_api_key_57a3038c06434330";
export const DEFAULT_API_BASE = "https://api-staging.vio.live";
export const DEFAULT_GQL_BASE = "https://graph-ql-dev.vio.live";

// The demo catalog lives under sponsor 1. When this grows to multiple sponsors,
// lift it into config / a bootstrap-driven selector.
export const SPONSOR_ID = 1;

/** A picked product reference (single-select value / multi-select item). */
export type Item = { productId: number; sponsorId: number };

/** Catalog list row (from the Products query). */
export type CatalogProduct = {
  id: number | string;
  brand?: string;
  title?: string;
  price?: { amount?: number; currency_code?: string };
  images?: Array<{ url?: string }>;
};

/** Light shape of the full product DTO the UI consumes (the SDK returns untyped). */
export type VioProduct = {
  id: number | string;
  brand?: string;
  title?: string;
  options_enabled?: boolean;
  supplier?: { name?: string };
  price?: { amount?: number; currency_code?: string; compare_at?: number };
  images?: Array<{ url?: string }>;
  variants?: Array<{ id: number; title?: string; price?: { amount?: number; currency_code?: string } }>;
  options?: unknown[];
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

/** Run an async op with retry (the commerce backend intermittently returns
 * "Authentication failed" under concurrency). Throws the last error if all
 * attempts fail — callers decide whether to swallow or surface it. */
export async function withRetry<T>(
  fn: () => Promise<T>,
  opts: { attempts?: number; delay?: number; label?: string } = {}
): Promise<T> {
  const { attempts = 8, delay = 300, label } = opts;
  let lastError: unknown;
  for (let i = 0; i < attempts; i++) {
    try {
      return await fn();
    } catch (err) {
      lastError = err;
      if (DEBUG && label) console.warn(`[Vio] ${label} retry ${i}`, (err as any)?.message ?? err);
      await new Promise((r) => setTimeout(r, delay));
    }
  }
  throw lastError;
}

/** Fetch a single full product DTO by id. Returns null on failure. */
export async function fetchVioProduct(productId: number, sponsorId: number): Promise<VioProduct | null> {
  try {
    return await withRetry(async () => {
      ensureVioInit();
      await Vio.bootstrap();
      const arr = await Vio.commerceFor(sponsorId).channel.product.getByIds({ product_ids: [productId] });
      const list = Array.isArray(arr) ? arr : [];
      return (list.find((x: any) => Number(x.id) === Number(productId)) ?? null) as VioProduct | null;
    }, { label: `product ${productId}` });
  } catch {
    return null;
  }
}

/** Fetch several products by id in one call (carousel / grid). Returns [] on failure. */
export async function fetchVioProducts(productIds: number[], sponsorId: number): Promise<VioProduct[]> {
  const ids = productIds.filter((n) => Number.isFinite(n));
  if (ids.length === 0) return [];
  try {
    return await withRetry(async () => {
      ensureVioInit();
      await Vio.bootstrap();
      const arr = await Vio.commerceFor(sponsorId).channel.product.getByIds({ product_ids: ids });
      const list = Array.isArray(arr) ? arr : [];
      // Preserve the requested order.
      return ids.map((id) => list.find((x: any) => Number(x.id) === Number(id))).filter(Boolean) as VioProduct[];
    }, { label: "products" });
  } catch {
    return [];
  }
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

// Shared catalog request — lists every product tied to the sponsor's commerce
// apiKey (same source the product card uses). One fetch, reused by all pickers,
// deduped via a module-level promise, with retry. Rejects so the modal can show
// an error; a fresh call after a rejection retries.
let catalogPromise: Promise<CatalogProduct[]> | null = null;
export function loadCatalog(): Promise<CatalogProduct[]> {
  if (catalogPromise) return catalogPromise;
  catalogPromise = withRetry(async () => {
    ensureVioInit();
    await Vio.bootstrap();
    const commerce = Vio.commerceFor(SPONSOR_ID);
    const data = await commerce.raw.request(PRODUCTS_QUERY, { currency: "NOK", imageSize: "large", useCache: true });
    const list = (data?.Channel?.Products ?? []) as CatalogProduct[];
    if (DEBUG) console.log("[Vio] loadCatalog →", list.length, "products");
    return list;
  }, { attempts: 5, delay: 400, label: "loadCatalog" }).catch((err: unknown) => {
    catalogPromise = null; // allow a fresh retry on the next call
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
