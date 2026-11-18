/**
 * Kondomeriet blocks — what makes the cards show up fast, and where the reader
 * is. Measured on the real collection with Fast 3G + 4× CPU (see the PR):
 * the cards waited ~2.5 s after the page's JS started (bootstrap ~1.1 s, then
 * the product query ~1.4 s) and every image went through two redirects.
 *
 * - Hosts: `preconnect` / `dns-prefetch` to the API, the GraphQL and the image CDN.
 * - Images: the CDN's sized file directly (`<name>large.jpg`), not the
 *   `?size=` URL that redirects twice (container → api-ecom → container).
 * - Products: a short-lived browser cache (stale-while-revalidate, 5 min).
 * - The brand's identity (logo, name, promises): the same, so a card painted
 *   from the snapshot already has its seller line before the bootstrap.
 * - In-app browsers (VG, Facebook, Instagram, Dagbladet…).
 *
 * Every storage access is wrapped: a browser that refuses it just loses the cache.
 */

// ---------------------------------------------------------------------------
// Connections
// ---------------------------------------------------------------------------

const ORIGINS: { href: string; cors: boolean }[] = [
  { href: "https://api.vio.live", cors: true },
  { href: "https://graph-ql.vio.live", cors: true },
  { href: "https://container.vio.live", cors: false },
];

/** `preconnect` + `dns-prefetch` to the hosts a card needs, once per page. */
export function ensurePreconnect(): void {
  // Called when the package loads — also where there is no real DOM (Vev's
  // build evaluates the bundle): it must never throw.
  try {
    if (typeof document === "undefined" || !document.head) return;
    const g = globalThis as { __KND_PRECONNECT__?: boolean };
    if (g.__KND_PRECONNECT__) return;
    g.__KND_PRECONNECT__ = true;
    addLinks();
  } catch {
    /* no DOM worth the name */
  }
}

function addLinks(): void {
  for (const o of ORIGINS) {
    for (const rel of ["preconnect", "dns-prefetch"]) {
      if (document.head.querySelector(`link[rel="${rel}"][href="${o.href}"]`)) continue;
      const link = document.createElement("link");
      link.rel = rel;
      link.href = o.href;
      // fetch() to the API and GraphQL is CORS: its connection pool is the anonymous one.
      if (rel === "preconnect" && o.cors) link.crossOrigin = "anonymous";
      document.head.appendChild(link);
    }
  }
}

// ---------------------------------------------------------------------------
// Images
// ---------------------------------------------------------------------------

export type ImageSize = "thumbnail" | "medium" | "large" | "full";
const SIZED = /^(https:\/\/container\.vio\.live\/.+?)(\.[A-Za-z0-9]+)\?size=(thumbnail|medium|large|full)$/;

/**
 * The CDN file of an image at `size`, without the redirects: Commerce gives
 * `…/<name>.jpg?size=large`, which answers 308 → api-ecom → 302 →
 * `…/<name>large.jpg` (two round trips before the first byte; on 3G about a
 * second each). Only use a size the import generated: `large` (1024 px) exists
 * for every product (checked on the Kondomeriet collection, 31/31), `medium`
 * mostly does not (30/31 answered 404, the redirect too) and `full` is the
 * original upload, whose size is the merchant's. Any other URL is returned as
 * it is; `fallback` is the redirecting URL, tried when the direct file fails.
 */
export function directImage(url: string | undefined | null, size: ImageSize): { src: string; fallback: string } {
  const raw = typeof url === "string" ? url : "";
  const m = raw.match(SIZED);
  if (!m) return { src: raw, fallback: raw };
  const [, base, ext] = m;
  return { src: size === "full" ? `${base}${ext}` : `${base}${size}${ext}`, fallback: `${base}${ext}?size=${size}` };
}

// ---------------------------------------------------------------------------
// Browser cache (stale-while-revalidate)
// ---------------------------------------------------------------------------

const TTL_MS = 5 * 60 * 1000;
const PRODUCTS_KEY = "knd.products.v1";
const IDENTITY_KEY = "knd.identity.v1";
const MAX_PRODUCTS = 200;

function readJson<T>(key: string): T | null {
  try {
    const raw = typeof localStorage !== "undefined" ? localStorage.getItem(key) : null;
    return raw ? (JSON.parse(raw) as T) : null;
  } catch {
    return null;
  }
}

function writeJson(key: string, value: unknown): void {
  try {
    if (typeof localStorage !== "undefined") localStorage.setItem(key, JSON.stringify(value));
  } catch {
    /* full, private mode, refused: no cache */
  }
}

type ProductsStore = Record<string, { t: number; p: any }>;

/** Cached products for `ids` in `market` (currency|country): fresh (< 5 min) or stale, never older than a day. */
export function readCachedProducts(ids: number[], market: string): { products: Map<number, any>; fresh: boolean } {
  const store = readJson<ProductsStore>(PRODUCTS_KEY) ?? {};
  const now = Date.now();
  const products = new Map<number, any>();
  let fresh = ids.length > 0;
  for (const id of ids) {
    const e = store[`${market}|${id}`];
    if (!e || now - e.t > 24 * 3600 * 1000) {
      fresh = false;
      continue;
    }
    products.set(id, e.p);
    if (now - e.t > TTL_MS) fresh = false;
  }
  return { products, fresh };
}

export function writeCachedProducts(products: any[], market: string): void {
  if (!products.length) return;
  const store = readJson<ProductsStore>(PRODUCTS_KEY) ?? {};
  const now = Date.now();
  for (const p of products) {
    const id = Number(p?.id);
    if (Number.isInteger(id)) store[`${market}|${id}`] = { t: now, p };
  }
  const entries = Object.entries(store).sort((a, b) => b[1].t - a[1].t).slice(0, MAX_PRODUCTS);
  writeJson(PRODUCTS_KEY, Object.fromEntries(entries));
}

/** The last brand identity this browser saw (logo, name, promises) — for a card painted before the bootstrap. */
export function readCachedIdentity(): { sponsorId: number; identity: any } | null {
  const e = readJson<{ t: number; sponsorId: number; identity: any }>(IDENTITY_KEY);
  if (!e || Date.now() - e.t > 24 * 3600 * 1000) return null;
  return { sponsorId: e.sponsorId, identity: e.identity };
}

export function writeCachedIdentity(sponsorId: number, identity: any): void {
  if (!identity) return;
  const prev = readJson<{ t: number; sponsorId: number; identity: any }>(IDENTITY_KEY);
  if (prev && prev.sponsorId === sponsorId && JSON.stringify(prev.identity) === JSON.stringify(identity) && Date.now() - prev.t < TTL_MS) return;
  writeJson(IDENTITY_KEY, { t: Date.now(), sponsorId, identity });
}

// ---------------------------------------------------------------------------
// In-app browsers
// ---------------------------------------------------------------------------

/**
 * A browser inside an app — Facebook / Messenger (FBAN, FBAV, FB_IAB),
 * Instagram, VG, Dagbladet, Snapchat, LinkedIn, TikTok, an Android WebView
 * (`; wv)`) or an iOS web view (AppleWebKit without «Safari/»). On our
 * campaigns they were ~30 % of the traffic and left no cart: a form posted to
 * a new tab there either fails or opens badly, so the Hurtigkasse opens in the
 * same window.
 */
export function inAppBrowser(ua: string = typeof navigator !== "undefined" ? navigator.userAgent : ""): string | null {
  if (!ua) return null;
  const tests: [string, RegExp][] = [
    ["facebook", /FBAN|FBAV|FB_IAB|FBIOS|MessengerForiOS|\bFB4A\b/i],
    ["instagram", /Instagram/i],
    ["vg", /\bVG(App|Android|iOS)?\/|\bVGTV\b|no\.vg\b/i],
    ["dagbladet", /Dagbladet/i],
    ["snapchat", /Snapchat/i],
    ["linkedin", /LinkedInApp/i],
    ["tiktok", /musical_ly|BytedanceWebview|TikTok/i],
    ["android-webview", /; wv\)/],
  ];
  for (const [name, re] of tests) if (re.test(ua)) return name;
  if (/iPhone|iPad|iPod/.test(ua) && /AppleWebKit/.test(ua) && !/Safari\//.test(ua)) return "ios-webview";
  return null;
}
