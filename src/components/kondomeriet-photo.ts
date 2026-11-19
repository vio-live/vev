import { useEffect, useState } from "react";

/**
 * The «photo» of a surface on the CDN: what `/v2/mobile/config` answers for
 * its key (platform vev) and the products of its catalogs, regenerated every
 * ~90 s behind Cloudflare. The blob has no CORS headers, so it is not fetched:
 * the backend also publishes it as a script,
 *
 *   https://container.vio.live/reachu-uploads-production/snapshots/<sha256(surfaceKey), hex, first 32>.js
 *   → (window.__vioSnapshots ||= {})["<hash>"] = { version, generatedAt, market, config, catalogs, products }
 *     and window.dispatchEvent(new CustomEvent("vio:snapshot", { detail: "<hash>" }))
 *
 * which the page loads with a `<script async>` the moment the package runs
 * (with the key this browser saw last) or the Kondomeriet Config renders.
 * Fresh (`generatedAt` under 10 minutes), its products paint the cards at once
 * and its config answers the SDK's bootstrap; the API is still asked in the
 * background and replaces both in place, as with the snapshot in the block's
 * props. A load error, a timeout or an old photo: nothing changes.
 */

const PHOTO_BASE = "https://container.vio.live/reachu-uploads-production/snapshots/";
const PHOTO_MAX_AGE_MS = 10 * 60 * 1000;
const PHOTO_TIMEOUT_MS = 4000;
const PHOTO_EVENT = "kondomeriet:photo";
const SNAPSHOT_EVENT = "vio:snapshot";
const LAST_KEY = "knd.photoKey.v1";

export type SurfacePhoto = { config: any | null; products: any[]; generatedAt: number; currency: string };

type PhotoState = { key: string; promise: Promise<SurfacePhoto | null>; photo: SurfacePhoto | null; settled: boolean };

function photoState(): PhotoState | null {
  return (globalThis as { __KND_PHOTO__?: PhotoState | null }).__KND_PHOTO__ ?? null;
}

async function sha256Hex(text: string): Promise<string | null> {
  try {
    const subtle = globalThis.crypto?.subtle;
    if (!subtle) return null;
    const digest = await subtle.digest("SHA-256", new TextEncoder().encode(text));
    return Array.from(new Uint8Array(digest), (b) => b.toString(16).padStart(2, "0")).join("");
  } catch {
    return null;
  }
}

function generatedAtOf(value: unknown): number {
  const n = typeof value === "number" ? value : Date.parse(String(value ?? ""));
  return Number.isFinite(n) ? n : 0;
}

/** Fresh enough to paint with: generated under 10 minutes ago (a clock a little ahead is fine). */
function isFresh(photo: SurfacePhoto | null, now = Date.now()): photo is SurfacePhoto {
  return !!photo && photo.generatedAt > 0 && now - photo.generatedAt < PHOTO_MAX_AGE_MS;
}

function snapshots(): Record<string, any> | null {
  return typeof window !== "undefined" ? ((window as any).__vioSnapshots ?? null) : null;
}

/** The snapshot script's data for `hash`: already there, or when its event says so (null on error or timeout). */
function loadSnapshot(hash: string): Promise<any | null> {
  const ready = snapshots()?.[hash];
  if (ready) return Promise.resolve(ready);
  if (typeof document === "undefined") return Promise.resolve(null);
  return new Promise((resolve) => {
    let done = false;
    const finish = (v: any | null) => {
      if (done) return;
      done = true;
      clearTimeout(timer);
      window.removeEventListener(SNAPSHOT_EVENT, onEvent);
      resolve(v);
    };
    let script: HTMLScriptElement | null = null;
    const onEvent = (e: Event) => {
      if ((e as CustomEvent).detail === hash) finish(snapshots()?.[hash] ?? null);
    };
    const timer = setTimeout(() => {
      // Given up: the element goes, so a script that never answers does not hold the page's load event.
      try {
        script?.remove();
      } catch {
        /* already gone */
      }
      finish(snapshots()?.[hash] ?? null);
    }, PHOTO_TIMEOUT_MS);
    window.addEventListener(SNAPSHOT_EVENT, onEvent);
    const src = `${PHOTO_BASE}${hash}.js`;
    script = document.querySelector(`script[src="${src}"]`) as HTMLScriptElement | null;
    if (!script) {
      script = document.createElement("script");
      script.async = true;
      script.src = src;
      (document.head || document.documentElement).appendChild(script);
    }
    script.addEventListener("error", () => finish(null));
    // A script that ran without the event (an older format): read what it left.
    script.addEventListener("load", () => setTimeout(() => finish(snapshots()?.[hash] ?? null), 0));
  });
}

/**
 * Starts reading the photo of `surfaceKey` (once per key and page) and
 * returns it — null when there is none, it failed, timed out or is old.
 * Never throws.
 */
export function startPhoto(surfaceKey: string | null | undefined): Promise<SurfacePhoto | null> {
  const key = typeof surfaceKey === "string" ? surfaceKey.trim() : "";
  if (!key || typeof window === "undefined") return Promise.resolve(null);
  const known = photoState();
  if (known && known.key === key) return known.promise;
  try {
    // Per page: on the same origin, another page (Vio blocks only) must not load this one's photo.
    localStorage.setItem(LAST_KEY, JSON.stringify({ key, path: location.pathname }));
  } catch {
    /* no storage: the next visit starts at the Config */
  }
  const state: PhotoState = { key, photo: null, promise: Promise.resolve(null), settled: false };
  state.promise = (async () => {
    try {
      const hash = await sha256Hex(key);
      if (!hash) return null;
      const json = await loadSnapshot(hash.slice(0, 32));
      if (!json || typeof json !== "object") return null;
      const photo: SurfacePhoto = {
        config: json.config && typeof json.config === "object" ? json.config : null,
        products: Array.isArray(json.products) ? json.products.filter((p: any) => Number.isInteger(Number(p?.id))) : [],
        generatedAt: generatedAtOf(json.generatedAt),
        currency: String(json.market?.currency ?? ""),
      };
      if (!isFresh(photo)) return null;
      state.photo = photo;
      return photo;
    } catch {
      return null;
    } finally {
      // Arrived, failed, timed out or old: the blocks waiting on it decide again.
      state.settled = true;
      try {
        window.dispatchEvent(new CustomEvent(PHOTO_EVENT));
      } catch {
        /* no window events */
      }
    }
  })();
  (globalThis as { __KND_PHOTO__?: PhotoState | null }).__KND_PHOTO__ = state;
  return state.promise;
}

/** As soon as the package runs: the photo of the key this page had last time in this browser (the Config confirms or replaces it). */
export function startRememberedPhoto(): void {
  try {
    if (typeof window === "undefined") return;
    const last = JSON.parse(localStorage.getItem(LAST_KEY) || "null");
    if (last && last.path === location.pathname) startPhoto(String(last.key ?? ""));
  } catch {
    /* nothing remembered */
  }
}

/** The photo now, if it has arrived and is still fresh. */
export function photoNow(): SurfacePhoto | null {
  const p = photoState()?.photo ?? null;
  return isFresh(p) ? p : null;
}

/** The photo's config for this key, when it is the photo of that key and fresh. */
export function photoConfigFor(surfaceKey: string): Promise<any | null> {
  const s = photoState();
  if (!s || s.key !== surfaceKey) return Promise.resolve(null);
  return s.promise.then((p) => (isFresh(p) && p.config ? p.config : null));
}

/** A product from the photo, in the page's currency (another market's price is not painted). */
export function photoProduct(id: number, currency: string): any | null {
  const p = photoNow()?.products.find((x) => Number(x?.id) === id) ?? null;
  if (!p) return null;
  const cur = String(p?.price?.currency_code ?? photoNow()?.currency ?? "").toUpperCase();
  return !cur || cur === String(currency || "").toUpperCase() ? p : null;
}

// ---------------------------------------------------------------------------
// The block's own snapshot (`group.snap`) — only when the photo does not come
// ---------------------------------------------------------------------------

/**
 * How long a block waits for the photo before painting from the snapshot in
 * its props. That snapshot is written when an editor last opened the block,
 * so after a price change (or the feed renaming the images) it shows the old
 * price for the second until the API answers, and its images are downloaded
 * twice. The photo is at most ~90 s old and, measured on a mid-range phone on
 * 4G, paints as early (1 375 ms against 1 377 ms from the props).
 */
const SNAP_WAIT_MS = 700;

function snapClockStart(): number {
  const g = globalThis as { __KND_SNAP_T0__?: number };
  if (g.__KND_SNAP_T0__ == null) g.__KND_SNAP_T0__ = typeof performance !== "undefined" ? performance.now() : Date.now();
  return g.__KND_SNAP_T0__;
}

function nowMs(): number {
  return typeof performance !== "undefined" ? performance.now() : Date.now();
}

/** The props' snapshot may paint: the photo failed, timed out or is old, or it has not come in 700 ms. */
export function snapAllowedNow(): boolean {
  const s = photoState();
  if (s && s.settled && !isFresh(s.photo)) return true;
  return nowMs() - snapClockStart() >= SNAP_WAIT_MS;
}

/** `snapAllowedNow()`, re-rendering when it changes (the photo settles or the wait ends). */
export function useSnapFallback(): boolean {
  const [ok, setOk] = useState(() => snapAllowedNow());
  useEffect(() => {
    if (ok) return;
    const check = () => {
      if (snapAllowedNow()) setOk(true);
    };
    const left = Math.max(0, SNAP_WAIT_MS - (nowMs() - snapClockStart()));
    const timer = setTimeout(check, left + 5);
    window.addEventListener(PHOTO_EVENT, check);
    check();
    return () => {
      clearTimeout(timer);
      window.removeEventListener(PHOTO_EVENT, check);
    };
  }, [ok]);
  return ok;
}

/** Re-renders when the photo arrives. */
export function usePhotoArrival(): number {
  const [n, setN] = useState(() => (photoNow() ? 1 : 0));
  useEffect(() => {
    const on = () => setN((x) => x + 1);
    window.addEventListener(PHOTO_EVENT, on);
    if (photoNow()) on();
    return () => window.removeEventListener(PHOTO_EVENT, on);
  }, []);
  return n;
}
