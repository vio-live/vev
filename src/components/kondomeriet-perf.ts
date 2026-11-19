/**
 * Kondomeriet blocks — what makes the cards show up fast, and where the reader
 * is. Measured on the real collection with Fast 3G + 4× CPU (see the PR):
 * the cards waited ~2.5 s after the page's JS started (bootstrap ~1.1 s, then
 * the product query ~1.4 s) and every image went through two redirects.
 *
 * - Hosts: `preconnect` / `dns-prefetch` to the API, the GraphQL and the image CDN.
 * - Images: the CDN's sized file directly (`<name>medium.jpg` on cards), not the
 *   `?size=` URL that redirects twice (container → api-ecom → container).
 * - Products: a short-lived browser cache (stale-while-revalidate, 5 min).
 * - The brand's identity (logo, name, promises): the same, so a card painted
 *   from the snapshot already has its seller line before the bootstrap.
 * - In-app browsers (VG, Facebook, Instagram, Dagbladet…).
 *
 * Every storage access is wrapped: a browser that refuses it just loses the cache.
 */

import { useEffect, useState, type RefObject } from "react";
import { Vio, ensureVippsButton } from "../../vio-sdk";
import { photoConfigFor } from "./kondomeriet-photo";

// ---------------------------------------------------------------------------
// The config as a simple request
// ---------------------------------------------------------------------------

/**
 * The SDK asks for the config with an `X-API-Key` header, which makes the
 * browser send a CORS preflight first (one more round trip before anything
 * can paint). The API also takes the key in the URL (campaigns#39,
 * handoff 2026-11-18-cdn-edge-cache-sdk §5): `GET /v2/mobile/config?apiKey=…
 * &platform=…`, nothing else in it, with only `Accept` — a simple request, no
 * preflight, and cacheable by the CDN.
 *
 * The SDK is not changed: this wraps, at runtime and only once a Kondomeriet
 * block renders, the `bootstrap` of the REST client the page's Vio facade
 * hands out (`Vio.api`). Through the facade, not our copy's `VioApi` class:
 * the facade is one per page (`globalThis.__VIO_FACADE__`) and the file Vev
 * serves holds the package twice, so the facade's client can come from the
 * other copy. Pages without Kondomeriet blocks (the Vio blocks alone, Replit)
 * keep the SDK's request; on a page with both, the page's one config request
 * is this one, for every block — same answer. Anything but a 2xx JSON answer
 * falls back to the SDK's own request.
 */
export function simpleConfigRequest(): void {
  try {
    const facade = Vio as any;
    if (!facade || facade.__kndSimpleConfig) return;
    let desc: PropertyDescriptor | undefined;
    for (let o = Object.getPrototypeOf(facade); o && !desc; o = Object.getPrototypeOf(o)) desc = Object.getOwnPropertyDescriptor(o, "api");
    const sdkGetter = desc?.get;
    if (typeof sdkGetter !== "function") return;
    facade.__kndSimpleConfig = true;
    Object.defineProperty(facade, "api", {
      configurable: true,
      get() {
        const api = sdkGetter.call(this);
        if (api && !api.__kndSimpleConfig && typeof api.bootstrap === "function") wrapBootstrap(api);
        return api;
      },
    });
  } catch {
    /* the SDK's request stays */
  }
}

/** The first of these that answers something (not null); null when none does. */
function firstAnswer<T>(promises: Promise<T | null>[]): Promise<T | null> {
  return new Promise((resolve) => {
    let pending = promises.length;
    if (pending === 0) resolve(null);
    for (const p of promises) {
      p.then(
        (v) => {
          if (v != null) resolve(v);
          else if (--pending === 0) resolve(null);
        },
        () => {
          if (--pending === 0) resolve(null);
        }
      );
    }
  });
}

function wrapBootstrap(api: any): void {
  const sdkBootstrap = api.bootstrap;
  api.__kndSimpleConfig = true;
  api.bootstrap = async function (platform?: string) {
    if (typeof api.apiBase === "string" && typeof api.apiKey === "string" && api.apiKey) {
      const fromApi: Promise<any | null> = (async () => {
        try {
          const url =
            `${api.apiBase}/v2/mobile/config?apiKey=${encodeURIComponent(api.apiKey)}` +
            (platform ? `&platform=${encodeURIComponent(platform)}` : "");
          const res = await fetch(url, { headers: { Accept: "application/json" } });
          return res.ok ? await res.json() : null;
        } catch {
          return null;
        }
      })();
      // The CDN's photo of the surface (kondomeriet-photo.ts), when it comes
      // first and is fresh: the API's answer then replaces it in place.
      const fromPhoto = photoConfigFor(api.apiKey).then((c) => (c ? { photo: true, c } : null));
      const first = await firstAnswer<{ photo: boolean; c: any }>([
        fromPhoto,
        fromApi.then((c) => (c ? { photo: false, c } : null)),
      ]);
      if (first?.photo) {
        void fromApi.then((res) => {
          try {
            if (res && typeof res === "object") (Vio as any).adoptBootstrap?.(res);
          } catch {
            /* the photo's config stays until the next refresh */
          }
        });
      }
      if (first) return first.c;
    }
    return sdkBootstrap.call(api, platform);
  };
}

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

/**
 * Warm the connection to Circlewise's tracker: its TLS handshake is most of
 * the extra hop (0.6–1.7 s cold, measured). Once when the Config says
 * Circlewise is on, and again on the first touch of «Kjøp med Vipps»
 * (`refresh`), when the first one's connection may have been closed.
 */
export function preconnectCirclewise(refresh = false): void {
  try {
    if (typeof document === "undefined" || !document.head) return;
    const g = globalThis as { __KND_CW_PRE__?: number };
    if (!refresh && g.__KND_CW_PRE__) return;
    if (refresh && (g.__KND_CW_PRE__ ?? 0) >= 2) return; // the touch re-warms once per page
    g.__KND_CW_PRE__ = (g.__KND_CW_PRE__ ?? 0) + 1;
    const href = "https://c.trackmytarget.com";
    for (const rel of ["preconnect", "dns-prefetch"]) {
      document.head.querySelector(`link[rel="${rel}"][href="${href}"]`)?.remove();
      const link = document.createElement("link");
      link.rel = rel;
      link.href = href;
      document.head.appendChild(link);
    }
  } catch {
    /* never in the way of the click */
  }
}

// ---------------------------------------------------------------------------
// Images
// ---------------------------------------------------------------------------

export type ImageSize = "thumbnail" | "medium" | "large" | "full";
const SIZED = /^(https:\/\/container\.vio\.live\/.+?)(\.[A-Za-z0-9]+)\?size=(thumbnail|medium|large|full)$/;
/** The direct form the API gives since 18/11 (api #81): `…/product-images/<name>large.jpg`. */
const DIRECT = /^(https:\/\/container\.vio\.live\/[^?#]*\/(?:product-images|products)\/[^/?#]*?)(thumbnail|medium|large)(\.(?:jpe?g|png|webp))$/i;

/**
 * The CDN file of an image at `size`, without redirects.
 *
 * Since 18/11 every product image in our container has its three variants,
 * written on upload and backfilled for the old ones (base-api #74, products
 * #71): `thumbnail` 150 px, `medium` 500 px, `large` 1024 px, never upscaled.
 * `full` is the original upload. The API gives either the direct file
 * (`…/<name>large.jpg`, api #81) or the old redirecting form
 * (`…/<name>.jpg?size=large`: 308 → api-ecom → 302 → the file); both are
 * turned into the direct file at the size asked. Any other URL (another
 * host, the editor's own picture) is returned as it is. `fallback` is the
 * redirecting form, tried when the direct file fails.
 */
export function directImage(url: string | undefined | null, size: ImageSize): { src: string; fallback: string } {
  const raw = typeof url === "string" ? url : "";
  const m = raw.match(SIZED);
  const d = m ? null : raw.match(DIRECT);
  if (!m && !d) return { src: raw, fallback: raw };
  const base = m ? m[1] : d![1];
  const ext = m ? m[2] : d![3];
  return { src: size === "full" ? `${base}${ext}` : `${base}${size}${ext}`, fallback: `${base}${ext}?size=${size}` };
}

// ---------------------------------------------------------------------------
// Images below the fold wait for the first ones
// ---------------------------------------------------------------------------

/**
 * `loading="lazy"` does not hold the images of the cards below the fold:
 * Chrome's lazy margin on 4G is ~1 250 px, so on a phone they all leave with
 * the first ones and share the bandwidth — measured on a mid-range phone on
 * 4G, the four cards on screen took 0.8–1.2 s for 7–25 KB each. Here a card
 * that is not a priority card gets its image when every priority image of the
 * page has loaded (or failed), when it comes within 100 px of the viewport
 * (scrolling, or the carousel moving), or after 2.5 s — whichever is first.
 * After that, `loading="lazy"` applies as before.
 */
const IMAGE_GATE_TIMEOUT_MS = 2500;
const IMAGE_NEAR_PX = 100;

type ImageGate = { pending: number; open: boolean; listeners: Set<() => void>; timer: any };

function imageGate(): ImageGate {
  const g = globalThis as { __KND_IMG_GATE__?: ImageGate };
  return g.__KND_IMG_GATE__ ?? (g.__KND_IMG_GATE__ = { pending: 0, open: false, listeners: new Set(), timer: null });
}

function openImageGate(): void {
  const g = imageGate();
  if (g.open) return;
  g.open = true;
  clearTimeout(g.timer);
  const ls = [...g.listeners];
  g.listeners.clear();
  for (const f of ls) f();
}

function armImageGate(): void {
  const g = imageGate();
  if (!g.open && !g.timer) g.timer = setTimeout(openImageGate, IMAGE_GATE_TIMEOUT_MS);
}

/** A priority image starts loading; call the returned function once it has loaded or failed (idempotent). */
export function holdImageGate(): () => void {
  const g = imageGate();
  if (g.open) return () => {};
  g.pending++;
  armImageGate();
  let done = false;
  return () => {
    if (done) return;
    done = true;
    g.pending--;
    if (g.pending <= 0) openImageGate();
  };
}

/** Whether a card's image may load now (see above). `bypass`: priority cards and the editor. */
export function useImageAllowed(bypass: boolean, node: () => Element | null): boolean {
  const [ok, setOk] = useState(() => bypass || imageGate().open);
  useEffect(() => {
    if (ok) return;
    if (bypass || imageGate().open) return setOk(true);
    const allow = () => setOk(true);
    const g = imageGate();
    g.listeners.add(allow);
    armImageGate();
    let io: IntersectionObserver | null = null;
    const el = node();
    if (el && typeof IntersectionObserver !== "undefined") {
      io = new IntersectionObserver((es) => {
        if (es.some((e) => e.isIntersecting)) allow();
      }, { rootMargin: `${IMAGE_NEAR_PX}px` });
      io.observe(el);
    }
    return () => {
      g.listeners.delete(allow);
      io?.disconnect();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ok, bypass]);
  return ok;
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

// ---------------------------------------------------------------------------
// Vipps' button script, when it is needed
// ---------------------------------------------------------------------------

const VIPPS_TAG = "vipps-mobilepay-button";
const VIPPS_LOADING = "kondomeriet:vipps-loading";
let vippsLoad: Promise<boolean> | null = null;

/** Vipps' element is defined on this page (by us or anyone else). */
export function vippsButtonDefined(): boolean {
  try {
    return typeof customElements !== "undefined" && !!customElements.get(VIPPS_TAG);
  } catch {
    return false;
  }
}

/** Loads `button.js` (once per page; again after a failure) and tells every card waiting for it. */
export function loadVippsButton(): Promise<boolean> {
  if (!vippsLoad) {
    vippsLoad = ensureVippsButton().then((ok: boolean) => {
      if (!ok) vippsLoad = null;
      return ok;
    });
    try {
      window.dispatchEvent(new Event(VIPPS_LOADING));
    } catch {
      /* no window */
    }
  }
  return vippsLoad;
}

/** After the page's own load, when the browser is idle: off the cards' and images' critical path. */
function whenSettled(run: () => void): () => void {
  let idle: any = null;
  let timer: any = null;
  const start = () => {
    const ric = (window as any).requestIdleCallback as ((cb: () => void, o?: { timeout: number }) => any) | undefined;
    if (ric) idle = ric(run, { timeout: 2000 });
    else timer = setTimeout(run, 300);
  };
  if (document.readyState === "complete") start();
  else window.addEventListener("load", start, { once: true });
  return () => {
    window.removeEventListener("load", start);
    if (idle != null) (window as any).cancelIdleCallback?.(idle);
    if (timer != null) clearTimeout(timer);
  };
}

/**
 * Whether a card can show Vipps' own button — loading `button.js` only when
 * one is wanted: the first card with a Vipps button near the screen
 * (IntersectionObserver, 400 px ahead, then once the page has loaded and the
 * browser is idle) or the reader's first touch anywhere (at once). Until then,
 * and if the script fails, the card shows its own Vipps bar, of the same size
 * (`.knd-card` rules in kondomeriet-ui.ts), so the swap moves nothing.
 */
export function useVippsButton(ref: RefObject<HTMLElement | null>, wanted: boolean): boolean {
  const [ready, setReady] = useState(vippsButtonDefined);
  useEffect(() => {
    if (!wanted || ready || typeof window === "undefined") return;
    // Read here, after the commit: the card's root is in the DOM.
    const el = ref.current;
    let cancelled = false;
    let io: IntersectionObserver | null = null;
    let unsettle: (() => void) | null = null;
    const stop = () => {
      io?.disconnect();
      io = null;
      unsettle?.();
      document.removeEventListener("pointerdown", now, true);
      window.removeEventListener(VIPPS_LOADING, follow);
    };
    const follow = () => {
      stop();
      loadVippsButton().then((ok) => {
        if (!cancelled && ok) setReady(true);
      });
    };
    function now() {
      follow();
    }
    // Another card (or the product info) started it: wait for the same load.
    if (vippsLoad) {
      follow();
      return () => {
        cancelled = true;
      };
    }
    window.addEventListener(VIPPS_LOADING, follow);
    document.addEventListener("pointerdown", now, { capture: true, passive: true });
    if (el && typeof IntersectionObserver !== "undefined") {
      io = new IntersectionObserver(
        (entries) => {
          if (!entries.some((e) => e.isIntersecting) || unsettle) return;
          io?.disconnect();
          io = null;
          unsettle = whenSettled(follow);
        },
        { rootMargin: "400px 0px" }
      );
      io.observe(el);
    } else {
      unsettle = whenSettled(follow);
    }
    return () => {
      cancelled = true;
      stop();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [wanted, ready]);
  return ready;
}
