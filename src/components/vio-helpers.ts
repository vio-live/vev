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

/** Host API key precedence for the blocks and the panel: runtime (what Vio
 * Config connected with) → panel save → Vev prop.
 * No default — a page must have its own key pasted before it can connect. */
export function resolveApiKey(propKey?: string): string {
  const runtime = (globalThis as { __VIO_API_KEY__?: string }).__VIO_API_KEY__;
  return runtime || getPersistedApiKey() || propKey || "";
}

/**
 * The key Vio Config itself connects with: the page's own (its prop), else
 * the one saved from the panel in this browser. Not the runtime key: Vio
 * Config writes that one on connect, and reading it back meant a new key in
 * the prop never reached `connect()` — the canvas kept the previous key (and
 * Disconnect could not disconnect) until the page was reloaded, since the
 * panel that writes the prop lives in another window than the canvas.
 */
export function resolveConfigApiKey(propKey?: string): string {
  return (propKey ?? "").trim() || getPersistedApiKey() || "";
}

export function setRuntimeApiKey(key: string): void {
  (globalThis as { __VIO_API_KEY__?: string }).__VIO_API_KEY__ = key;
}

export const VIO_SPONSOR_ID_STORAGE = "vio.sponsorId";
/** The connected key's sponsors, written by Vio Config for the "Active Sponsor" selector. */
export const VIO_SPONSORS_STORAGE = "vio.sponsors";
/** Fingerprint of the key + environment this browser last connected with: how
 * Vio Config tells a new key from the same one, across visits too. */
export const VIO_CONNECTION_STORAGE = "vio.connection";

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

// ---- Sponsor resolution ----------------------------------------------------
//
// A sponsor id only means something inside the configuration of the key that
// is connected (`/v2/mobile/config`: a primary sponsor and its secondaries),
// and the SDK only resolves a sponsor that configuration names
// (`Vio.commerceFor`, the cart, the payment methods). Pages built on
// vio-backend keep its ids (4, 5) in the Config's prop, in localStorage and
// in every product picked with the picker; asked with the Commerce key they
// ended in "Sponsor 5 not found in bootstrap" and a 500 from
// getAvailablePaymentMethods (QA, 2026-10-14). So every sponsor a block,
// the picker, the cart or the checkout hands to Commerce goes through
// `resolveSponsorId`, and none is ever made up.

/** The sponsors a key's configuration knows: its primary and its secondaries. */
export type SponsorConfig = { ids: number[]; primaryId: number };
export type SponsorListItem = { id: number; name: string; isPrimary: boolean };

function toSponsorId(value: unknown): number | null {
  if (value == null || value === "") return null;
  const n = Number(value);
  return Number.isInteger(n) && n > 0 ? n : null;
}

/** Pure. The sponsors of a `/v2/mobile/config` answer, primary first; empty
 * when it names no primary sponsor. */
export function sponsorListFromBootstrap(boot: unknown): SponsorListItem[] {
  const b = (boot ?? {}) as { primarySponsor?: any; secondarySponsors?: any[] };
  const primaryId = toSponsorId(b.primarySponsor?.id);
  if (primaryId == null) return [];
  const list: SponsorListItem[] = [
    { id: primaryId, name: String(b.primarySponsor?.name ?? `Sponsor ${primaryId}`), isPrimary: true },
  ];
  for (const s of Array.isArray(b.secondarySponsors) ? b.secondarySponsors : []) {
    const id = toSponsorId(s?.id);
    if (id == null || list.some((x) => x.id === id)) continue;
    list.push({ id, name: String(s?.name ?? `Sponsor ${id}`), isPrimary: false });
  }
  return list;
}

/** Pure. The configuration of a `/v2/mobile/config` answer, or null. */
export function sponsorConfigFromBootstrap(boot: unknown): SponsorConfig | null {
  const list = sponsorListFromBootstrap(boot);
  return list.length ? { ids: list.map((s) => s.id), primaryId: list[0].id } : null;
}

/**
 * THE sponsor rule (pure). `saved` is one candidate or several in order of
 * preference — the Config's prop, the runtime or persisted active sponsor,
 * the sponsor a product was picked under, a cart's sponsor. The first one the
 * key's configuration knows wins; else its primary sponsor. Without a
 * configuration (`primaryId` null: no bootstrap yet) there is no sponsor —
 * the caller waits for the bootstrap rather than inventing one.
 */
export function resolveSponsorId(
  saved: unknown,
  sponsorIds: readonly number[],
  primaryId: number | null | undefined
): number | null {
  const primary = toSponsorId(primaryId);
  if (primary == null) return null;
  const known = new Set(sponsorIds.map(Number));
  known.add(primary);
  for (const candidate of Array.isArray(saved) ? saved : [saved]) {
    const id = toSponsorId(candidate);
    if (id != null && known.has(id)) return id;
  }
  return primary;
}

function runtimeSponsorId(): number | null {
  return toSponsorId((globalThis as { __VIO_SPONSOR_ID__?: unknown }).__VIO_SPONSOR_ID__);
}

/** This window's configuration: the bootstrap the SDK holds, which is what
 * `Vio.commerceFor()` and the cart resolve a sponsor against — only while the
 * SDK runs with the key this window resolves to now. After a Disconnect the
 * SDK still holds the previous key's answer (it cannot be un-initialised), and
 * that answer must not keep feeding sponsors. */
export function currentSponsorConfig(): SponsorConfig | null {
  try {
    if (!Vio.isInitialized || Vio.config?.apiKey !== resolveApiKey()) return null;
  } catch {
    return null;
  }
  return sponsorConfigFromBootstrap(Vio.bootstrapCache);
}

/**
 * The page's active sponsor: what Vio Config set (this window's runtime
 * value, else what it persisted — that is how the properties panel, another
 * window, learns it), else `preferred` (the sponsor a product was picked
 * under), each one only if the connected key knows it; the key's primary
 * otherwise. Null while this window has no configuration.
 */
export function getActiveSponsorId(preferred?: unknown): number | null {
  const config = currentSponsorConfig();
  if (!config) return null;
  return resolveSponsorId(
    [runtimeSponsorId(), getPersistedSponsorId(), preferred],
    config.ids,
    config.primaryId
  );
}

/**
 * The sponsor a Commerce call for `requested` uses: `requested` itself when
 * the connected key knows it (a cart's sponsor, an addon's picked product),
 * else the page's active sponsor, else the primary. Null while this window
 * has no configuration.
 */
export function sponsorForCommerce(requested?: unknown): number | null {
  const config = currentSponsorConfig();
  if (!config) return null;
  return resolveSponsorId(
    [requested, runtimeSponsorId(), getPersistedSponsorId()],
    config.ids,
    config.primaryId
  );
}

/**
 * Init + bootstrap this window with the page's key. False when it cannot (no
 * key, the key is wrong, the API is down).
 *
 * On the canvas Vio Config sets the runtime key as soon as it starts
 * connecting, so a block mounted before it waits a moment for that key
 * instead of booting the SDK with the one saved in this browser (which can be
 * another page's): two inits with different keys race in the SDK, and the
 * slower answer would end up as its configuration. The properties panel has
 * no Config — after the wait it uses the saved key, as before.
 */
async function bootstrapWindow(): Promise<boolean> {
  for (let attempt = 0; attempt < 7; attempt++) {
    if (currentSponsorConfig()) return true;
    const runtimeKey = (globalThis as { __VIO_API_KEY__?: string }).__VIO_API_KEY__;
    if (runtimeKey || attempt >= 2) {
      try {
        ensureVioInit();
        await Vio.bootstrap();
        return true;
      } catch (err) {
        if (DEBUG) console.warn(`[Vio] bootstrap retry ${attempt}`, (err as any)?.message ?? err);
      }
    }
    await new Promise((r) => setTimeout(r, 400));
  }
  return false;
}

/** `getActiveSponsorId`, after waiting for this window's bootstrap. */
export async function resolveActiveSponsorId(preferred?: unknown): Promise<number | null> {
  return (await bootstrapWindow()) ? getActiveSponsorId(preferred) : null;
}

/** `sponsorForCommerce`, after waiting for this window's bootstrap. */
export async function resolveSponsorForCommerce(requested?: unknown): Promise<number | null> {
  return (await bootstrapWindow()) ? sponsorForCommerce(requested) : null;
}

/**
 * Vio Config announces the active sponsor: runtime, localStorage and
 * `vio:sponsor-changed` for every block. `null` says "no sponsor yet" — while
 * a new key boots, or when it failed — and the blocks wait (the event's
 * detail is then 0).
 */
export function announceActiveSponsor(id: number | null): void {
  (globalThis as { __VIO_SPONSOR_ID__?: number | null }).__VIO_SPONSOR_ID__ = id;
  if (id != null) persistSponsorId(id);
  resetCatalogCache();
  if (typeof window !== "undefined") {
    window.dispatchEvent(new CustomEvent("vio:sponsor-changed", { detail: id ?? 0 }));
  }
}

/**
 * The active sponsor, live. Vio Config announces each change on
 * `vio:sponsor-changed`, and a block that reads the sponsor here re-renders
 * for the new one instead of keeping the one it mounted with — which is how
 * the single card went on showing a product the new sponsor's channel does
 * not carry (QA, 2026-10-08). Vev mounts blocks in no fixed order: a block
 * mounted before the Config bootstraps on its own and resolves against that
 * configuration, then follows the Config's announcements. Null means "no
 * sponsor yet": the block waits instead of asking Commerce with a made-up id.
 */
export function useActiveSponsorId(preferred?: number | null): number | null {
  const [sponsorId, setSponsorId] = useState<number | null>(() => getActiveSponsorId(preferred));
  useEffect(() => {
    let alive = true;
    // The Config may have spoken between this block's render and its effects.
    const now = getActiveSponsorId(preferred);
    setSponsorId(now);
    if (now == null) {
      resolveActiveSponsorId(preferred).then((id) => {
        // An announcement that arrived meanwhile wins over this resolution.
        if (alive && id != null) setSponsorId((current) => current ?? id);
      });
    }
    const onChange = (e: Event) => {
      setSponsorId(toSponsorId((e as CustomEvent).detail));
    };
    window.addEventListener("vio:sponsor-changed", onChange);
    return () => {
      alive = false;
      window.removeEventListener("vio:sponsor-changed", onChange);
    };
  }, [preferred]);
  return sponsorId;
}

// ---- Changing the key --------------------------------------------------------

/** FNV-1a of environment + key: enough to tell two keys apart, and the key
 * itself is not copied into one more storage slot. */
export function connectionFingerprint(key: string, environment: string): string {
  const input = `${environment}|${key.trim()}`;
  let hash = 0x811c9dc5;
  for (let i = 0; i < input.length; i++) {
    hash ^= input.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193) >>> 0;
  }
  return hash.toString(16).padStart(8, "0");
}

export function getStoredConnection(): string | null {
  if (typeof localStorage === "undefined") return null;
  try {
    return localStorage.getItem(VIO_CONNECTION_STORAGE);
  } catch {
    return null;
  }
}

export function readPersistedSponsors(): SponsorListItem[] {
  if (typeof localStorage === "undefined") return [];
  try {
    const raw = localStorage.getItem(VIO_SPONSORS_STORAGE);
    const list = raw ? JSON.parse(raw) : [];
    return Array.isArray(list) ? list : [];
  } catch {
    return [];
  }
}

function writeStorage(key: string, value: string | null): void {
  if (typeof localStorage === "undefined") return;
  try {
    if (value == null) localStorage.removeItem(key);
    else localStorage.setItem(key, value);
  } catch {
    /* noop */
  }
}

/**
 * Forget the sponsor this browser was using: the active one (runtime and
 * localStorage), the sponsor list, the catalog and the Vipps answers — and,
 * with `carts`, every cart: a cart lives on the commerce channel of the key it
 * was filled under, and checking it out with another key fails.
 */
export function forgetSponsorState({ carts }: { carts: boolean }): void {
  const g = globalThis as { __VIO_SPONSOR_ID__?: number | null; __VIO_PRIMARY_SPONSOR_ID__?: number | null };
  g.__VIO_SPONSOR_ID__ = null;
  g.__VIO_PRIMARY_SPONSOR_ID__ = null;
  writeStorage(VIO_SPONSOR_ID_STORAGE, null);
  writeStorage(VIO_SPONSORS_STORAGE, null);
  resetCatalogCache();
  resetVippsOfferCache();
  if (carts) {
    try {
      Vio.cart?.clearAllCarts?.();
    } catch {
      /* noop */
    }
  }
}

/** Drop the carts (the SDK keeps them per sponsor in `vio.cart.v1`) of every
 * sponsor the connected key does not have. Returns the dropped sponsor ids. */
export function pruneCartsOutside(sponsorIds: readonly number[]): number[] {
  const known = new Set(sponsorIds.map(Number));
  const dropped: number[] = [];
  try {
    const carts: Map<number, unknown> = Vio.cart?.getAllCarts?.() ?? new Map();
    for (const sponsorId of carts.keys()) {
      if (known.has(Number(sponsorId))) continue;
      Vio.cart.clearSponsorCart(sponsorId);
      dropped.push(Number(sponsorId));
    }
  } catch {
    /* noop */
  }
  return dropped;
}

export type AdoptedConnection = {
  config: SponsorConfig;
  sponsors: SponsorListItem[];
  /** This browser was last connected with another key or environment. */
  keyChanged: boolean;
  /** Sponsors whose cart was dropped because this key does not have them. */
  droppedCarts: number[];
};

/**
 * What Vio Config does with a successful bootstrap of `key`:
 *  - another key (or environment) than the one this browser last connected
 *    with → forget the previous key's sponsor, sponsor list, carts, catalog
 *    and Vipps answers;
 *  - drop the cart of any sponsor this key does not have (a page built on
 *    vio-backend's sponsor ids left "4" and "5" in `vio.cart.v1`);
 *  - remember the sponsors (for the "Active Sponsor" selector) and the
 *    connection.
 * Null when the answer names no primary sponsor: nothing is remembered.
 */
export function adoptConnection(boot: unknown, key: string, environment: string): AdoptedConnection | null {
  const sponsors = sponsorListFromBootstrap(boot);
  const config = sponsorConfigFromBootstrap(boot);
  if (!config) return null;
  const fingerprint = connectionFingerprint(key, environment);
  const previous = getStoredConnection();
  // No fingerprint yet = a browser from before this rule: nothing says the key
  // changed, and the carts of unknown sponsors go below anyway.
  const keyChanged = previous != null && previous !== fingerprint;
  if (keyChanged) forgetSponsorState({ carts: true });
  const droppedCarts = pruneCartsOutside(config.ids);
  (globalThis as { __VIO_PRIMARY_SPONSOR_ID__?: number }).__VIO_PRIMARY_SPONSOR_ID__ = config.primaryId;
  writeStorage(VIO_CONNECTION_STORAGE, fingerprint);
  writeStorage(VIO_SPONSORS_STORAGE, JSON.stringify(sponsors));
  return { config, sponsors, keyChanged, droppedCarts };
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
    // Another key or environment: another configuration, so the catalog and
    // the Vipps answers of the previous one no longer apply.
    resetCatalogCache();
    resetVippsOfferCache();
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

/** The sponsor a fetch may use once this window is bootstrapped (see
 * `sponsorForCommerce`). Throws — and so retries — when there is none yet. */
function commerceSponsorOrThrow(requested: unknown): number {
  const sponsorId = sponsorForCommerce(requested);
  if (sponsorId == null) throw new Error("[Vio] no sponsor in the connected key's configuration yet");
  return sponsorId;
}

/** Fetch a single full product DTO by id. Returns null on failure — and when
 * the sponsor's channel does not carry the product (the card then shows its
 * "unavailable" placeholder). */
export async function fetchVioProduct(productId: number, sponsorId?: number | null): Promise<VioProduct | null> {
  try {
    return await withRetry(async () => {
      ensureVioInit();
      await Vio.bootstrap();
      const arr = await Vio.commerceFor(commerceSponsorOrThrow(sponsorId)).channel.product.getByIds({
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

/** Fetch several products by id in one call (carousel / grid). Returns [] on
 * failure; a product the sponsor's channel does not carry is left out. */
export async function fetchVioProducts(productIds: number[], sponsorId?: number | null): Promise<VioProduct[]> {
  const ids = productIds.filter((n) => Number.isFinite(n));
  if (ids.length === 0) return [];
  try {
    return await withRetry(async () => {
      ensureVioInit();
      await Vio.bootstrap();
      const arr = await Vio.commerceFor(commerceSponsorOrThrow(sponsorId)).channel.product.getByIds({
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

// Shared catalog request — lists every product tied to the active sponsor's
// commerce apiKey (same source the product card uses). One fetch, reused by all
// pickers, deduped via a module-level promise, with retry. Rejects so the modal
// can show an error; a fresh call after a rejection retries. The answer carries
// the sponsor it was listed under: that is the sponsor a picked product keeps.
export type CatalogResult = { sponsorId: number; products: CatalogProduct[] };
let catalogPromise: Promise<CatalogResult> | null = null;
let catalogSponsorId: number | null = null;
let catalogKey: string | null = null;

export function resetCatalogCache(): void {
  catalogPromise = null;
  catalogSponsorId = null;
  catalogKey = null;
}

export function loadCatalogResult(): Promise<CatalogResult> {
  // A catalog listed under another key, or another sponsor than today's
  // active one, is stale.
  const active = getActiveSponsorId();
  if (
    catalogPromise &&
    (catalogKey !== resolveApiKey() || (catalogSponsorId != null && active != null && active !== catalogSponsorId))
  ) {
    resetCatalogCache();
  }
  if (catalogPromise) return catalogPromise;
  const key = resolveApiKey();
  const pending: Promise<CatalogResult> = withRetry(async () => {
    ensureVioInit();
    await Vio.bootstrap();
    const sponsorId = getActiveSponsorId();
    if (sponsorId == null) throw new Error("Connect a Vio API key in Vio Config to list its products");
    const data = await Vio.commerceFor(sponsorId).raw.request(PRODUCTS_QUERY, {
      currency: getActiveCurrency(),
      shippingCountryCode: getActiveCountryCode(),
      imageSize: "large",
      useCache: true,
    });
    const products = (data?.Channel?.Products ?? []) as CatalogProduct[];
    if (DEBUG) console.log("[Vio] loadCatalog →", products.length, "products of sponsor", sponsorId);
    return { sponsorId, products };
  }, { attempts: 5, delay: 400, label: "loadCatalog" }).then(
    (result) => {
      if (catalogPromise === pending) catalogSponsorId = result.sponsorId;
      return result;
    },
    (err: unknown) => {
      if (catalogPromise === pending) resetCatalogCache(); // allow a fresh retry on the next call
      throw err;
    }
  );
  // Set after starting the request: its first, synchronous ensureVioInit() may
  // re-init the SDK, and that resets this cache.
  catalogPromise = pending;
  catalogKey = key;
  return pending;
}

export function loadCatalog(): Promise<CatalogProduct[]> {
  return loadCatalogResult().then((result) => result.products);
}

/** Dispatch the SDK product-detail open event (the Config's <VioProductDetail>
 * listens), with the sponsor `requested` resolves to (see `sponsorForCommerce`).
 * Before the bootstrap it waits for it; with no sponsor at all nothing opens. */
export function openProductInfo(productId: number, requestedSponsorId?: unknown, currency?: string): void {
  const dispatch = (sponsorId: number | null) => {
    if (sponsorId == null) {
      console.warn("[Vio] product info not opened: no sponsor in the connected key's configuration");
      return;
    }
    document.dispatchEvent(
      new CustomEvent("vio:product-click", {
        detail: {
          productId: String(productId),
          sponsorId: String(sponsorId),
          currency: currency || getActiveCurrency()
        },
      })
    );
  };
  if (currentSponsorConfig()) dispatch(sponsorForCommerce(requestedSponsorId));
  else void resolveSponsorForCommerce(requestedSponsorId).then(dispatch);
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

export function resetVippsOfferCache(): void {
  vippsOfferCache.clear();
}

/** Rejects when the connected key has no sponsor yet (nothing is asked of
 * Commerce then); `requested` goes through `sponsorForCommerce`. */
export async function loadVippsOffer(requested?: number | null): Promise<VippsOffer> {
  const sponsorId = await resolveSponsorForCommerce(requested);
  if (sponsorId == null) throw new Error("[Vio] no sponsor in the connected key's configuration yet");
  let pending = vippsOfferCache.get(sponsorId);
  if (!pending) {
    pending = withRetry(async (): Promise<VippsOffer> => {
      ensureVioInit();
      await Vio.bootstrap();
      // The key may have changed while this was queued: never ask with a
      // sponsor the configuration no longer has.
      if (sponsorForCommerce(sponsorId) !== sponsorId) throw new Error(`[Vio] sponsor ${sponsorId} left the configuration`);
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
