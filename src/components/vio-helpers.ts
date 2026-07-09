import { Vio } from "../../vio-sdk";

/**
 * Shared helpers for the Vio Vev components. Keeps the SDK init + product fetch
 * in one place so every block/addon is self-sufficient (Vev mounts components in
 * no guaranteed order, so each one must be able to boot the core on its own).
 * The commerce key stays dynamic — resolved via Vio.bootstrap() per sponsor.
 */

export const DEFAULT_API_KEY = "vg-demo_api_key_57a3038c06434330";
export const DEFAULT_API_BASE = "https://api-staging.vio.live";
export const DEFAULT_GQL_BASE = "https://graph-ql-dev.vio.live";

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

/** Fetch a product DTO by id, retrying while the core config is still in flight. */
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
