import { useEffect, useState } from "react";

/**
 * The «photo» of a surface on the CDN: what `/v2/mobile/config` answers for
 * its key and the Kondomeriet products it shows, regenerated every ~90 s and
 * served by Cloudflare (a HIT in ~0.15 s):
 *
 *   https://container.vio.live/reachu-uploads-production/snapshots/<sha256(surfaceKey), hex, first 32>.json
 *   { config, products: [<the card / product shape>], generatedAt }
 *
 * The Kondomeriet Config asks for it the moment it renders, in parallel with
 * everything else. Fresh (`generatedAt` under 10 minutes), its products paint
 * the cards at once and its config answers the SDK's bootstrap; the API is
 * still asked in the background and replaces both in place, as with the
 * snapshot in the block's props. A 404, an error or an old photo: nothing
 * changes, the page works as without it.
 */

const PHOTO_BASE = "https://container.vio.live/reachu-uploads-production/snapshots/";
const PHOTO_MAX_AGE_MS = 10 * 60 * 1000;
const PHOTO_EVENT = "kondomeriet:photo";

export type SurfacePhoto = { config: any | null; products: any[]; generatedAt: number };

type PhotoState = { key: string; promise: Promise<SurfacePhoto | null>; photo: SurfacePhoto | null };

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

/**
 * Starts reading the photo of `surfaceKey` (once per key and page) and
 * returns it — null when there is none, it failed or it is old. Never throws.
 * A plain GET with no header of ours: no preflight.
 */
export function startPhoto(surfaceKey: string | null | undefined): Promise<SurfacePhoto | null> {
  const key = typeof surfaceKey === "string" ? surfaceKey.trim() : "";
  if (!key || typeof fetch === "undefined") return Promise.resolve(null);
  const g = globalThis as { __KND_PHOTO__?: PhotoState | null };
  const known = photoState();
  if (known && known.key === key) return known.promise;
  const state: PhotoState = { key, photo: null, promise: Promise.resolve(null) };
  state.promise = (async () => {
    try {
      const hash = await sha256Hex(key);
      if (!hash) return null;
      const res = await fetch(`${PHOTO_BASE}${hash.slice(0, 32)}.json`);
      if (!res.ok) return null;
      const json = await res.json();
      const photo: SurfacePhoto = {
        config: json?.config && typeof json.config === "object" ? json.config : null,
        products: Array.isArray(json?.products) ? json.products.filter((p: any) => Number.isInteger(Number(p?.id))) : [],
        generatedAt: generatedAtOf(json?.generatedAt),
      };
      if (!isFresh(photo)) return null;
      state.photo = photo;
      if (typeof window !== "undefined") window.dispatchEvent(new CustomEvent(PHOTO_EVENT));
      return photo;
    } catch {
      return null;
    }
  })();
  g.__KND_PHOTO__ = state;
  return state.promise;
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
  const cur = String(p?.price?.currency_code ?? "").toUpperCase();
  return !cur || cur === String(currency || "").toUpperCase() ? p : null;
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
