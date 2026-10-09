import { useEffect, useState } from "react";
import { Vio } from "../../vio-sdk";

/**
 * Shared helpers for the Vio Vev components: SDK init, catalog listing, product
 * fetching, and small events. Every block/addon is self-sufficient (Vev mounts
 * components in no guaranteed order), so each one can boot the core on its own.
 * The commerce key stays dynamic — resolved via Vio.bootstrap() per sponsor.
 */

// Flip to true to see [Vio] diagnostics in the console.
const DEBUG = false;

/** UI-facing label — the SDK's own Environment type says "testing", not
 * "staging" (parity with the iOS SDK's naming). apiBase/graphQLBase per
 * environment are NOT duplicated here — the SDK owns that map
 * (`configuration.ts: DEFAULT_URLS`); we only pass `environment` to
 * `Vio.init()` and let it resolve the URLs. Single source of truth. */
export type VioEnvironment = "development" | "staging" | "production";
export const DEFAULT_ENVIRONMENT: VioEnvironment = "staging";

/** Panel "Save" persists the host API key here (per browser). */
export const VIO_API_KEY_STORAGE = "vio.apiKey";

let lastInitKey: string | null = null;
let lastInitEnv: string | null = null;

export const VIO_ENVIRONMENT_STORAGE = "vio.environment";

export function getPersistedEnvironment(): VioEnvironment | null {
  if (typeof localStorage === "undefined") return null;
  try {
    const env = localStorage.getItem(VIO_ENVIRONMENT_STORAGE);
    return (env as VioEnvironment) || null;
  } catch {
    return null;
  }
}

export function persistEnvironment(env: VioEnvironment): void {
  if (typeof localStorage === "undefined") return;
  try {
    localStorage.setItem(VIO_ENVIRONMENT_STORAGE, env);
  } catch {
    /* noop */
  }
}

export function setRuntimeEnvironment(env: VioEnvironment): void {
  (globalThis as { __VIO_ENVIRONMENT__?: VioEnvironment }).__VIO_ENVIRONMENT__ = env;
}

export function resolveEnvironment(propEnv?: VioEnvironment): VioEnvironment {
  const runtime = (globalThis as { __VIO_ENVIRONMENT__?: VioEnvironment }).__VIO_ENVIRONMENT__;
  return propEnv || runtime || getPersistedEnvironment() || DEFAULT_ENVIRONMENT;
}

export function getPersistedApiKey(): string | null {
  if (typeof localStorage === "undefined") return null;
  try {
    return localStorage.getItem(VIO_API_KEY_STORAGE);
  } catch {
    return null;
  }
}

export function persistApiKey(key: string): void {
  try {
    localStorage.setItem(VIO_API_KEY_STORAGE, key.trim());
  } catch {
    /* noop */
  }
}

export function clearPersistedApiKey(): void {
  try {
    localStorage.removeItem(VIO_API_KEY_STORAGE);
  } catch {
    /* noop */
  }
}

/** Host API key precedence: panel save → runtime (Vio Config) → Vev prop.
 * No default — a page must have its own key pasted before it can connect. */
export function resolveApiKey(propKey?: string): string {
  const runtime = (globalThis as { __VIO_API_KEY__?: string }).__VIO_API_KEY__;
  return runtime || getPersistedApiKey() || propKey || "";
}

export function setRuntimeApiKey(key: string): void {
  (globalThis as { __VIO_API_KEY__?: string }).__VIO_API_KEY__ = key;
}

export const VIO_SPONSOR_ID_STORAGE = "vio.sponsorId";

export function getPersistedSponsorId(): number | null {
  if (typeof localStorage === "undefined") return null;
  try {
    const v = localStorage.getItem(VIO_SPONSOR_ID_STORAGE);
    return v ? Number(v) : null;
  } catch {
    return null;
  }
}

export function persistSponsorId(id: number): void {
  if (typeof localStorage === "undefined") return;
  try {
    localStorage.setItem(VIO_SPONSOR_ID_STORAGE, String(id));
  } catch {
    /* noop */
  }
}

/** The page's active sponsor: what Vio Config set (it persists and announces
 * every change), else `fallback` — the demo sponsor, unless the caller has a
 * better one, such as the sponsor a product was picked under. */
export function getActiveSponsorId(fallback = 4): number {
  const runtime = (globalThis as { __VIO_SPONSOR_ID__?: number }).__VIO_SPONSOR_ID__;
  const persisted = getPersistedSponsorId();
  return persisted || runtime || fallback;
}

/**
 * The active sponsor, live. Vio Config announces each change on
 * `vio:sponsor-changed`, and a block that reads the sponsor here re-renders
 * for the new one instead of keeping the one it mounted with — which is how
 * the single card went on showing a product the new sponsor's channel does
 * not carry (QA, 2026-10-08). Vev mounts blocks in no fixed order: a block
 * mounted before the Config starts from what the last visit persisted (or
 * `fallback`) and follows the Config's first announcement.
 */
export function useActiveSponsorId(fallback?: number): number {
  const [sponsorId, setSponsorId] = useState(() => getActiveSponsorId(fallback));
  useEffect(() => {
    // The Config may have spoken between this block's render and its effects.
    setSponsorId(getActiveSponsorId(fallback));
    const onChange = (e: Event) => {
      const next = Number((e as CustomEvent).detail);
      if (Number.isFinite(next) && next > 0) setSponsorId(next);
    };
    window.addEventListener("vio:sponsor-changed", onChange);
    return () => window.removeEventListener("vio:sponsor-changed", onChange);
  }, [fallback]);
  return sponsorId;
}

export type CountryConfig = {
  code: string;
  name: string;
  locale: string;
  symbol: string;
  currency: string;
};

export const SUPPORTED_COUNTRIES: CountryConfig[] = [
  { code: "NO", name: "Norway", locale: "nb-NO", symbol: "Kr", currency: "NOK" },
  { code: "DK", name: "Denmark", locale: "da-DK", symbol: "Kr", currency: "DKK" },
  { code: "SE", name: "Sweden", locale: "sv-SE", symbol: "SEK", currency: "SEK" },
  { code: "FI", name: "Finland", locale: "fi-FI", symbol: "€", currency: "EUR" },
  { code: "US", name: "United States", locale: "en-US", symbol: "$", currency: "USD" },
  { code: "CA", name: "Canada", locale: "en-CA", symbol: "$", currency: "CAD" },
  { code: "GB", name: "United Kingdom", locale: "en-GB", symbol: "£", currency: "GBP" },
  { code: "DE", name: "Germany", locale: "de-DE", symbol: "€", currency: "EUR" },
  { code: "NL", name: "Netherlands", locale: "nl-NL", symbol: "€", currency: "EUR" },
  { code: "ES", name: "Spain", locale: "es-ES", symbol: "€", currency: "EUR" },
  { code: "IT", name: "Italy", locale: "it-IT", symbol: "€", currency: "EUR" },
  { code: "CH", name: "Switzerland", locale: "de-CH", symbol: "CHF", currency: "CHF" },
];

export function getCountryConfig(input?: string): CountryConfig {
  if (!input) return SUPPORTED_COUNTRIES[0];
  const query = input.trim().toLowerCase();
  const found = SUPPORTED_COUNTRIES.find(
    (c) =>
      c.code.toLowerCase() === query ||
      c.name.toLowerCase() === query ||
      c.locale.toLowerCase() === query ||
      c.currency.toLowerCase() === query
  );
  return found || SUPPORTED_COUNTRIES[0];
}

export const VIO_COUNTRY_STORAGE = "vio.country";
export const VIO_CURRENCY_STORAGE = "vio.currency";
export const VIO_LOCALE_STORAGE = "vio.locale";
export const VIO_SYMBOL_STORAGE = "vio.symbol";

export function getPersistedCountry(): string | null {
  if (typeof localStorage === "undefined") return null;
  try {
    return localStorage.getItem(VIO_COUNTRY_STORAGE);
  } catch {
    return null;
  }
}

export function getPersistedCurrency(): string | null {
  if (typeof localStorage === "undefined") return null;
  try {
    return localStorage.getItem(VIO_CURRENCY_STORAGE);
  } catch {
    return null;
  }
}

export function persistCountry(countryInput: string): CountryConfig {
  const config = getCountryConfig(countryInput);
  const g = globalThis as any;
  g.__VIO_COUNTRY__ = config.code;
  g.__VIO_CURRENCY__ = config.currency;
  g.__VIO_LOCALE__ = config.locale;
  g.__VIO_SYMBOL__ = config.symbol;

  if (typeof localStorage !== "undefined") {
    try {
      localStorage.setItem(VIO_COUNTRY_STORAGE, config.code);
      localStorage.setItem(VIO_CURRENCY_STORAGE, config.currency);
      localStorage.setItem(VIO_LOCALE_STORAGE, config.locale);
      localStorage.setItem(VIO_SYMBOL_STORAGE, config.symbol);
    } catch {
      /* noop */
    }
  }

  if (typeof window !== "undefined") {
    window.dispatchEvent(new CustomEvent("vio:country-changed", { detail: config }));
    window.dispatchEvent(new CustomEvent("vio:currency-changed", { detail: config.currency }));
  }

  return config;
}

export function persistCurrency(currency: string): void {
  persistCountry(currency);
}

export function getActiveCountry(): CountryConfig {
  const g = globalThis as any;
  const runtime = g.__VIO_COUNTRY__;
  const persisted = getPersistedCountry();
  return getCountryConfig(runtime || persisted || "NO");
}

export function getActiveCountryCode(): string {
  return getActiveCountry().code;
}

export function getActiveCurrency(): string {
  const g = globalThis as any;
  const runtime = g.__VIO_CURRENCY__;
  const persisted = getPersistedCurrency();
  if (runtime) return runtime;
  if (persisted) return persisted;
  return getActiveCountry().currency;
}

export function getActiveLocale(): string {
  const g = globalThis as any;
  if (g.__VIO_LOCALE__) return g.__VIO_LOCALE__;
  if (typeof localStorage !== "undefined") {
    try {
      const v = localStorage.getItem(VIO_LOCALE_STORAGE);
      if (v) return v;
    } catch {}
  }
  return getActiveCountry().locale;
}

export function getActiveSymbol(): string {
  const g = globalThis as any;
  if (g.__VIO_SYMBOL__) return g.__VIO_SYMBOL__;
  if (typeof localStorage !== "undefined") {
    try {
      const v = localStorage.getItem(VIO_SYMBOL_STORAGE);
      if (v) return v;
    } catch {}
  }
  return getActiveCountry().symbol;
}

/** A picked product reference (single-select value / multi-select item). */
export type Item = { productId: number; sponsorId: number };

/** Catalog list row (from the Products query). */
export type CatalogProduct = {
  id: number | string;
  brand?: string;
  title?: string;
  options_enabled?: boolean;
  options?: Array<{ id?: string | number; name?: string; values?: string[] }>;
  variants?: Array<{ id?: number | string; title?: string }>;
  price?: { amount?: number; amount_incl_taxes?: number; currency_code?: string };
  images?: Array<{ url?: string }>;
};

/** Light shape of the full product DTO the UI consumes (the SDK returns untyped). */
export type VioProduct = {
  id: number | string;
  brand?: string;
  title?: string;
  options_enabled?: boolean;
  supplier?: { name?: string };
  price?: { amount?: number; amount_incl_taxes?: number; currency_code?: string; compare_at?: number };
  images?: Array<{ url?: string }>;
  variants?: Array<{ id: number; title?: string; price?: { amount?: number; amount_incl_taxes?: number; currency_code?: string } }>;
  options?: unknown[];
};

export function getProductPriceAmount(p: any): number | undefined {
  if (!p?.price) return undefined;
  const amount = p.price.amount_incl_taxes ?? p.price.amount;
  return amount != null ? Number(amount) : undefined;
}

export function checkHasVariants(p: any): boolean {
  if (!p) return false;
  if (Boolean(p.options_enabled) || Boolean(p.hasVariants) || Boolean(p.has_variants) || Boolean(p.has_options) || Boolean(p.hasOptions)) return true;
  if (Array.isArray(p.options) && p.options.length > 0) return true;
  if (Array.isArray(p.variants) && p.variants.length > 1) return true;
  if (Array.isArray(p.variants) && p.variants.length === 1) {
    const title = String(p.variants[0]?.title ?? "").trim().toLowerCase();
    if (title && title !== "default title" && title !== "default") return true;
  }
  return false;
}

export function ensureVioInit(propKey?: string, propEnv?: VioEnvironment): void {
  const key = resolveApiKey(propKey);
  const env = resolveEnvironment(propEnv);
  const sdkEnv = env === "staging" ? "testing" : env;
  if (!Vio.isInitialized || lastInitKey !== key || lastInitEnv !== sdkEnv) {
    setRuntimeEnvironment(env);
    persistEnvironment(env);
    Vio.init({
      apiKey: key,
      environment: sdkEnv as any,
    });
    lastInitKey = key;
    lastInitEnv = sdkEnv;
    resetCatalogCache();
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
      const arr = await Vio.commerceFor(sponsorId).channel.product.getByIds({
        product_ids: [productId],
        currency: getActiveCurrency(),
        shipping_country_code: getActiveCountryCode(),
        image_size: "large"
      });
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
      const arr = await Vio.commerceFor(sponsorId).channel.product.getByIds({
        product_ids: ids,
        currency: getActiveCurrency(),
        shipping_country_code: getActiveCountryCode(),
        image_size: "large"
      });
      const list = Array.isArray(arr) ? arr : [];
      // Preserve the requested order.
      return ids.map((id) => list.find((x: any) => Number(x.id) === Number(id))).filter(Boolean) as VioProduct[];
    }, { label: "products" });
  } catch {
    return [];
  }
}

const PRODUCTS_QUERY = `
  query Products($currency: String, $shippingCountryCode: String, $imageSize: ImageSize, $useCache: Boolean!) {
    Channel {
      Products(
        barcode_list: []
        sku_list: []
        category_ids: []
        product_ids: []
        currency: $currency
        image_size: $imageSize
        useCache: $useCache
        shipping_country_code: $shippingCountryCode
      ) {
        id
        brand
        title
        options_enabled
        options { id name values }
        variants { id title }
        price { amount amount_incl_taxes currency_code }
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

export function resetCatalogCache(): void {
  catalogPromise = null;
}

export function loadCatalog(): Promise<CatalogProduct[]> {
  if (catalogPromise) return catalogPromise;
  catalogPromise = withRetry(async () => {
    ensureVioInit();
    await Vio.bootstrap();
    const commerce = Vio.commerceFor(getActiveSponsorId());
    const data = await commerce.raw.request(PRODUCTS_QUERY, {
      currency: getActiveCurrency(),
      shippingCountryCode: getActiveCountryCode(),
      imageSize: "large",
      useCache: true,
    });
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
export function openProductInfo(productId: number, sponsorId: number, currency?: string): void {
  document.dispatchEvent(
    new CustomEvent("vio:product-click", {
      detail: {
        productId: String(productId),
        sponsorId: String(sponsorId),
        currency: currency || getActiveCurrency()
      },
    })
  );
}

/** Ask the Config to open the cart drawer. */
export function openCart(): void {
  document.dispatchEvent(new CustomEvent("vio:open-cart"));
}

/**
 * What the channel offers for Vipps, per sponsor: "express" (the button opens
 * the Vipps app), "checkout" (Vipps is offered but the seller switched Express
 * off → the button opens the checkout with Vipps preselected) or "none" (not
 * offered → no button at all). Read the same way the SDK's product detail reads
 * it, once per sponsor for every card on the page — and by the editor, to
 * offer the button only on a channel that has Vipps.
 */
export type VippsOffer = "express" | "checkout" | "none";
const vippsOfferCache = new Map<number, Promise<VippsOffer>>();

export function loadVippsOffer(sponsorId: number): Promise<VippsOffer> {
  let pending = vippsOfferCache.get(sponsorId);
  if (!pending) {
    pending = withRetry(async (): Promise<VippsOffer> => {
      ensureVioInit();
      await Vio.bootstrap();
      const methods: any[] = (await Vio.checkout.getAvailablePaymentMethods(sponsorId)) ?? [];
      const vipps = methods.find((m) => String(m?.name ?? "").toLowerCase() === "vipps");
      if (!vipps) return "none";
      const express = vipps.config?.find?.((c: any) => c?.name === "express")?.value;
      return express === "false" ? "checkout" : "express";
    }, { attempts: 3, label: `vipps offer ${sponsorId}` });
    vippsOfferCache.set(sponsorId, pending);
    // A failed lookup is not remembered: the next card asks again.
    pending.catch(() => vippsOfferCache.delete(sponsorId));
  }
  return pending;
}
