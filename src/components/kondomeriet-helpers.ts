import { useEffect, useState } from "react";
import { Vio } from "../../vio-sdk";
import { ensureOwnerConnection } from "./kondomeriet-owner";
import { readCachedIdentity, simpleConfigRequest, writeCachedIdentity, writeCachedProducts } from "./kondomeriet-perf";
import {
  ensureVioInit,
  fetchVioProducts,
  getActiveCountryCode,
  getActiveCurrency,
  getActiveSponsorId,
  getProductPriceAmount,
  resolveApiKey,
  sponsorForCommerce,
  sponsorForSlot,
  withRetry,
  type CatalogProduct,
  type VioAttribution,
} from "./vio-helpers";

/**
 * Kondomeriet blocks — the shared logic: product groups (several Vio products
 * shown as ONE card with a selector), option labels, the Vipps Hurtigkasse of
 * kondomeriet.no, the time-boxed discount label and the product fetch that
 * also reads each product's page in the shop (`origin_url`).
 *
 * Payment never goes through Vio here: "Kjøp med Vipps" posts the shop's own
 * Hurtigkasse form (see `submitHurtigkasse`). Nothing in these blocks touches
 * `Vio.cart` or `Vio.checkout`.
 */

// ---------------------------------------------------------------------------
// Groups (what the editor stores)
// ---------------------------------------------------------------------------

/**
 * One card: the Vio products it unifies (one per colour / model / size, in
 * the order the selector shows them) and the editor's overrides. Stored as
 * JSON in a string field (`{ data: "[…]" }`): Vev's array props crash with a
 * custom editor component, a string always serialises cleanly.
 */
export type KondomerietGroup = {
  ids: number[];
  /** Option label per product id, overriding the one derived from the titles. */
  labels?: Record<string, string>;
  /** Hurtigkasse slug per product id, overriding the one read from its shop URL. */
  slugs?: Record<string, string>;
  /** The card's title, overriding the part the products' titles share. */
  title?: string;
  /** Manual badge text, e.g. "−60 %". Empty: no badge. */
  discount?: string;
  /** `datetime-local` values ("2026-11-27T00:00"), read in the reader's time zone. Empty: open-ended. */
  discountStart?: string;
  discountEnd?: string;
  /** This card's «Buy on card», overriding the block's; absent = the block's. */
  buyOnCard?: BuyOnCard;
  /** «Tilbudet gjelder til …»: this card's offer end (`datetime-local`), overriding the block's. */
  offerEnd?: string;
  /** This card's Circlewise tracking link (the sheet's), overriding the block's. */
  tracking?: string;
  /**
   * What the editor saw when the products were picked, per product id — the
   * published card paints from it at once and refreshes price and stock from
   * the API in the background (see `SnapProduct`).
   */
  snap?: Record<string, SnapProduct>;
};

/**
 * A product as the card needs it to paint before any request: title, brand,
 * price, compare-at, currency, main image, shop URL (the Hurtigkasse slug),
 * stock, and the rating line of the description. Short keys: it lives in the
 * block's props, for every product of every card.
 */
export type SnapProduct = {
  t: string;
  b?: string;
  p?: number;
  c?: number | null;
  cur?: string;
  img?: string;
  u?: string | null;
  q?: number | null;
  r?: string;
  /** When it was taken (ms) — the editor refreshes snapshots older than a day. */
  at?: number;
};

function cleanSnap(value: unknown): Record<string, SnapProduct> | undefined {
  if (!value || typeof value !== "object") return undefined;
  const out: Record<string, SnapProduct> = {};
  for (const [k, v] of Object.entries(value as Record<string, any>)) {
    if (!v || typeof v !== "object" || typeof v.t !== "string") continue;
    const num = (x: unknown) => (typeof x === "number" && Number.isFinite(x) ? x : undefined);
    const s: SnapProduct = { t: v.t };
    if (typeof v.b === "string") s.b = v.b;
    if (num(v.p) != null) s.p = v.p;
    if (num(v.c) != null) s.c = v.c;
    if (typeof v.cur === "string") s.cur = v.cur;
    if (typeof v.img === "string") s.img = v.img;
    if (typeof v.u === "string") s.u = v.u;
    if (num(v.q) != null) s.q = v.q;
    if (typeof v.r === "string") s.r = v.r;
    if (num(v.at) != null) s.at = v.at;
    out[k] = s;
  }
  return Object.keys(out).length ? out : undefined;
}

/** The snapshot of a product the API returned (`KONDOMERIET_PRODUCTS_QUERY`). */
export function snapshotOf(p: any): SnapProduct {
  const images: any[] = Array.isArray(p?.images) ? [...p.images].sort((a, b) => Number(a?.order ?? 0) - Number(b?.order ?? 0)) : [];
  const rating = ratingLineOf(p?.description);
  const s: SnapProduct = { t: String(p?.title ?? ""), at: Date.now() };
  if (p?.brand) s.b = String(p.brand);
  const amount = getProductPriceAmount(p);
  if (amount != null) s.p = amount;
  const was = compareAtAmount(p);
  if (was != null) s.c = was;
  if (p?.price?.currency_code) s.cur = String(p.price.currency_code);
  if (images[0]?.url) s.img = String(images[0].url);
  if (typeof p?.origin_url === "string") s.u = p.origin_url;
  if (p?.quantity != null && Number.isFinite(Number(p.quantity))) s.q = Number(p.quantity);
  if (rating) s.r = rating;
  return s;
}

const escapeHtml = (t: string) => t.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

/** A product-shaped object from a snapshot (`__snap: true`), for the card's first paint. */
export function productFromSnap(id: number, s: SnapProduct): any {
  return {
    id,
    __snap: true,
    title: s.t,
    brand: s.b ?? "",
    price: { amount_incl_taxes: s.p, amount: s.p, compare_at_incl_taxes: s.c ?? null, currency_code: s.cur ?? "NOK" },
    images: s.img ? [{ url: s.img, order: 0 }] : [],
    origin_url: s.u ?? null,
    quantity: s.q ?? null,
    description: s.r ? `<p>${escapeHtml(s.r)}</p>` : "",
  };
}

/** «★ 5/5 · 792 anmeldelser hos Kondomeriet» — the first line of Vio's descriptions, when it is the rating. */
export function ratingLineOf(description: unknown): string | null {
  if (typeof description !== "string") return null;
  const text = description
    .replace(/<!--[\s\S]*?-->/g, " ")
    .replace(/<[^>]+>/g, "\n")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&");
  const first = text.split("\n").map((l) => l.trim()).find(Boolean) ?? "";
  return first.startsWith("★") ? first : null;
}

/** «★ 5/5 (792)» for the card, from the rating line; null without one. */
export function cardRating(description: unknown): { score: string; count: string | null } | null {
  const line = ratingLineOf(description);
  if (!line) return null;
  const m = line.match(/★\s*([\d.,]+)\s*\/\s*(\d+)(?:\s*[·•-]\s*([\d\s\u00a0.]+)\s*anmeldelse)?/i);
  if (!m) return null;
  return { score: `${m[1]}/${m[2]}`, count: m[3] ? m[3].replace(/[\s\u00a0.]/g, "") : null };
}

/**
 * «Tilbudet gjelder til mandag 30. november» while `end` is ahead; null once it
 * has passed (or without one). `{dato}` in the template is the weekday, day
 * and month in Norwegian.
 */
export function offerEndText(end: string | undefined, template: string | undefined, now = Date.now()): string | null {
  if (!end) return null;
  const t = new Date(end.trim().replace(" ", "T")).getTime();
  if (!Number.isFinite(t) || now >= t) return null;
  let date: string;
  try {
    date = new Date(t).toLocaleDateString("nb-NO", { weekday: "long", day: "numeric", month: "long" });
  } catch {
    date = new Date(t).toISOString().slice(0, 10);
  }
  const tpl = template?.trim() || "Tilbudet gjelder til {dato}";
  return tpl.includes("{dato}") ? tpl.replace("{dato}", date) : `${tpl} ${date}`;
}

/**
 * Where a card sells (Angelo, conversion default): `auto` — a single product
 * buys on the card («Kjøp med Vipps» + «Se produktinfo»), a group with options
 * shows only «Se mer», which opens the product info to choose and buy there;
 * `always` — the selector and Vipps on every card (the earlier behaviour);
 * `never` — only «Se mer».
 */
export type BuyOnCard = "auto" | "always" | "never";

function cleanBuyOnCard(v: unknown): BuyOnCard | undefined {
  return v === "auto" || v === "always" || v === "never" ? v : undefined;
}

/**
 * The card's mode: its group's choice, else the block's, else — for a block
 * placed before this prop existed — `never` if its Vipps button was switched
 * off (the old `vippsButton: hidden`, which this prop replaces), else `auto`.
 */
export function resolveBuyOnCard(groupValue: unknown, blockValue: unknown, legacyVippsButton: unknown): BuyOnCard {
  return cleanBuyOnCard(groupValue) ?? cleanBuyOnCard(blockValue) ?? (legacyVippsButton === "hidden" ? "never" : "auto");
}

/** Vev value of a group editor field. */
export type GroupsValue = { data?: string };

function cleanIds(value: unknown): number[] {
  if (!Array.isArray(value)) return [];
  const out: number[] = [];
  for (const v of value) {
    const n = Number(v);
    if (Number.isInteger(n) && n > 0 && !out.includes(n)) out.push(n);
  }
  return out;
}

function cleanMap(value: unknown): Record<string, string> | undefined {
  if (!value || typeof value !== "object") return undefined;
  const out: Record<string, string> = {};
  for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
    if (typeof v === "string" && v.trim()) out[k] = v.trim();
  }
  return Object.keys(out).length ? out : undefined;
}

function cleanText(value: unknown): string | undefined {
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}

/** Parse the stored groups; anything malformed is dropped, never thrown. */
export function parseGroups(value?: GroupsValue | null): KondomerietGroup[] {
  const raw = value?.data;
  if (typeof raw !== "string" || !raw.trim()) return [];
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return [];
  }
  if (!Array.isArray(parsed)) return [];
  const groups: KondomerietGroup[] = [];
  for (const g of parsed) {
    if (!g || typeof g !== "object") continue;
    const src = g as Record<string, unknown>;
    groups.push({
      ids: cleanIds(src.ids),
      labels: cleanMap(src.labels),
      slugs: cleanMap(src.slugs),
      title: cleanText(src.title),
      discount: cleanText(src.discount),
      discountStart: cleanText(src.discountStart),
      discountEnd: cleanText(src.discountEnd),
      buyOnCard: cleanBuyOnCard(src.buyOnCard),
      offerEnd: cleanText(src.offerEnd),
      tracking: cleanText(src.tracking),
      snap: cleanSnap(src.snap),
    });
  }
  return groups;
}

export function serializeGroups(groups: KondomerietGroup[]): GroupsValue {
  return { data: JSON.stringify(groups.map(normalizeGroup)) };
}

function normalizeGroup(g: KondomerietGroup): KondomerietGroup {
  const out: KondomerietGroup = { ids: cleanIds(g.ids) };
  const keep = (map?: Record<string, string>) => {
    const cleaned = cleanMap(map);
    if (!cleaned) return undefined;
    // Overrides of products no longer in the group go.
    for (const k of Object.keys(cleaned)) if (!out.ids.includes(Number(k))) delete cleaned[k];
    return Object.keys(cleaned).length ? cleaned : undefined;
  };
  const labels = keep(g.labels);
  const slugs = keep(g.slugs);
  if (labels) out.labels = labels;
  if (slugs) out.slugs = slugs;
  const buy = cleanBuyOnCard(g.buyOnCard);
  if (buy) out.buyOnCard = buy;
  const end = cleanText(g.offerEnd);
  if (end) out.offerEnd = end;
  const tracking = cleanText(g.tracking);
  if (tracking) out.tracking = tracking;
  // The snapshot of the products still in the group.
  const snap = cleanSnap(g.snap);
  if (snap) {
    for (const k of Object.keys(snap)) if (!out.ids.includes(Number(k))) delete snap[k];
    if (Object.keys(snap).length) out.snap = snap;
  }
  for (const k of ["title", "discount", "discountStart", "discountEnd"] as const) {
    const v = cleanText(g[k]);
    if (v) out[k] = v;
  }
  return out;
}

/** Every product id of every group, once, in order (one fetch for a whole carousel / grid). */
export function allGroupIds(groups: KondomerietGroup[]): number[] {
  const out: number[] = [];
  for (const g of groups) for (const id of g.ids) if (!out.includes(id)) out.push(id);
  return out;
}

// ---------------------------------------------------------------------------
// Option labels
// ---------------------------------------------------------------------------

/** A shared trailing word that is a unit stays in the label: "150 ml", not "150". */
const UNIT_WORDS = new Set(["ml", "cl", "dl", "l", "g", "kg", "mg", "stk", "stk.", "pk", "pk.", "pakke", "cm", "mm", "m"]);
const EDGE_SEPARATORS = /^[\s\-–—,:;|/·]+|[\s\-–—,:;|/·]+$/g;

function sameWord(a: string, b: string): boolean {
  return a.localeCompare(b, "nb", { sensitivity: "accent" }) === 0;
}

/**
 * The card title and one label per product, from the products' titles: the
 * words they all start with are the title ("Womanizer Premium 2"), what is
 * left of each is its label ("blåbær"). Words they all end with go too
 * ("… bordeaux klitorisstimulator" → "bordeaux") unless they start with a
 * unit ("Easyglide vannbasert 150 ml" → "150 ml"). A label that comes out
 * empty or repeated falls back to the whole title.
 */
export function deriveLabels(titles: string[]): { title: string; labels: string[] } {
  const clean = titles.map((t) => String(t ?? "").trim());
  if (clean.length === 0) return { title: "", labels: [] };
  if (clean.length === 1) return { title: clean[0], labels: [clean[0]] };
  const words = clean.map((t) => t.split(/\s+/).filter(Boolean));
  const minLen = Math.min(...words.map((w) => w.length));
  let pre = 0;
  while (pre < minLen && words.every((w) => sameWord(w[pre], words[0][pre]))) pre++;
  let suf = 0;
  while (
    suf < minLen - pre &&
    words.every((w) => sameWord(w[w.length - 1 - suf], words[0][words[0].length - 1 - suf]))
  ) {
    suf++;
  }
  if (suf > 0 && UNIT_WORDS.has(words[0][words[0].length - suf].toLowerCase())) suf = 0;
  let labels = words.map((w) => w.slice(pre, w.length - suf).join(" ").replace(EDGE_SEPARATORS, ""));
  const seen = new Set<string>();
  const unusable = labels.some((l) => {
    const k = l.toLowerCase();
    if (!l || seen.has(k)) return true;
    seen.add(k);
    return false;
  });
  if (unusable) labels = clean;
  const title = words[0].slice(0, pre).join(" ").replace(EDGE_SEPARATORS, "") || clean[0];
  return { title, labels };
}

// ---------------------------------------------------------------------------
// Vipps Hurtigkasse (kondomeriet.no)
// ---------------------------------------------------------------------------

export const KONDOMERIET_ORIGIN = "https://www.kondomeriet.no";
export const KONDOMERIET_NAME = "Kondomeriet";
const SLUG_PATTERN = /^[a-z0-9][a-z0-9_-]{0,200}$/i;

export function isValidSlug(slug: unknown): slug is string {
  return typeof slug === "string" && SLUG_PATTERN.test(slug.trim());
}

/**
 * The Hurtigkasse slug of a product page: the second path segment of its URL
 * on kondomeriet.no — `/klitorisvibrator/we-vibe-melt-2-purple/til-henne/` →
 * `we-vibe-melt-2-purple`, the slug the page's own purchase form posts to
 * (`/k/<slug>/kjop/`). Null for a URL on another host or of another shape.
 */
export function slugFromProductUrl(url: unknown): string | null {
  if (typeof url !== "string" || !url.trim()) return null;
  let parsed: URL;
  try {
    parsed = new URL(url.trim());
  } catch {
    return null;
  }
  const host = parsed.hostname.toLowerCase();
  if (host !== "kondomeriet.no" && host !== "www.kondomeriet.no") return null;
  const segments = parsed.pathname.split("/").filter(Boolean);
  const slug = segments.length >= 2 ? decodeURIComponent(segments[1]) : "";
  return isValidSlug(slug) ? slug : null;
}

/** Where the shop's checkout opens: a new tab (the article stays open) or the whole window. */
export type HurtigkasseTarget = "_blank" | "_top";

export function hurtigkasseAction(slug: string): string {
  return `${KONDOMERIET_ORIGIN}/k/${encodeURIComponent(slug)}/kjop/`;
}

/**
 * "Kjøp med Vipps": posts kondomeriet.no's own Hurtigkasse form for one
 * product — exactly what its product page submits (`<form id=purchaseform
 * method=post action=/k/<slug>/kjop/>` with `qty-<slug>=1` and the Vipps
 * button's `cbtn=vps`). It has to be a POST, so a link cannot do it: a
 * hidden form is built and submitted, synchronously inside the click, so
 * no popup blocker treats the new tab as unsolicited. `form.submit()` does
 * not send a submit button's name, so `cbtn=vps` goes as a hidden field.
 *
 * Target `_blank` (the default) opens the shop in a new tab: works inside
 * an iframe that allows popups and keeps the article open; `_top` replaces
 * the page and needs a frame that allows top navigation. Returns false when
 * nothing was submitted (no slug, no DOM).
 */
export function submitHurtigkasse(slug: string, target: HurtigkasseTarget = "_blank", quantity = 1): boolean {
  if (typeof document === "undefined" || !isValidSlug(slug)) return false;
  const clean = slug.trim();
  const form = document.createElement("form");
  form.method = "post";
  form.action = hurtigkasseAction(clean);
  form.target = target === "_top" ? "_top" : "_blank";
  form.acceptCharset = "UTF-8";
  // The shop does not get a handle on the article's window.
  if (form.target === "_blank") form.setAttribute("rel", "noopener");
  form.style.display = "none";
  const field = (name: string, value: string) => {
    const input = document.createElement("input");
    input.type = "hidden";
    input.name = name;
    input.value = value;
    form.appendChild(input);
  };
  field(`qty-${clean}`, String(Math.max(1, Math.floor(quantity) || 1)));
  field("cbtn", "vps");
  document.body.appendChild(form);
  try {
    form.submit();
  } finally {
    setTimeout(() => form.remove(), 1000);
  }
  return true;
}

// ---------------------------------------------------------------------------
// Circlewise (TargetCircle) tracking
// ---------------------------------------------------------------------------

/**
 * A Circlewise tracking link as the sheet gives it —
 * `https://c.trackmytarget.com/?a=h9k6zq&i=3j26pb&ref1=blackweek_blowcastpro&r=…`
 * — reduced to what we rebuild it from: `a`, `i` and `ref1`.
 */
export type CirclewiseLink = { a: string; i: string; ref1: string };

export const CIRCLEWISE_HOST = "c.trackmytarget.com";
/**
 * The bridge page on Vio's CDN: it validates the slug and posts the
 * Hurtigkasse form (`qty-<slug>=1&cbtn=vps`) to kondomeriet.no, keeping the
 * `tmt_*` and `utm_*` of its URL — tested end to end in prod (tracker →
 * bridge → Hurtigkasse → Vipps «Kondomeriet AS»).
 */
export const HURTIGKASSE_BRIDGE = "https://container.vio.live/reachu-uploads-production/bridge/kondomeriet-hurtigkasse.html";
const CW_PARAM = /^[A-Za-z0-9_.-]{1,80}$/;

/** The pasted link: null when empty; an error (and no link) when it is not a Circlewise link with `a`, `i` and `ref1`. */
export function parseCirclewiseLink(raw: unknown): { link: CirclewiseLink | null; error: string | null } {
  const text = typeof raw === "string" ? raw.trim() : "";
  if (!text) return { link: null, error: null };
  let url: URL;
  try {
    url = new URL(text);
  } catch {
    return { link: null, error: "Not a URL" };
  }
  if (url.protocol !== "https:" || url.hostname.toLowerCase() !== CIRCLEWISE_HOST) {
    return { link: null, error: `Not a Circlewise link (${CIRCLEWISE_HOST})` };
  }
  const a = url.searchParams.get("a") ?? "";
  const i = url.searchParams.get("i") ?? "";
  const ref1 = url.searchParams.get("ref1") ?? "";
  const missing = [["a", a], ["i", i], ["ref1", ref1]].filter(([, v]) => !CW_PARAM.test(v)).map(([k]) => k);
  if (missing.length) return { link: null, error: `Missing or invalid ${missing.join(", ")}` };
  return { link: { a, i, ref1 }, error: null };
}

/**
 * The tracker URL for one purchase: Circlewise's redirect with `r` = the
 * bridge for the chosen option's slug, tagged for VG's Black Week
 * (`utm_content` = the link's `ref1`).
 */
export function circlewiseUrl(
  link: CirclewiseLink,
  slug: string,
  extra: { ref2?: string | null; ref3?: string | number | null } = {}
): string {
  const bridge =
    `${HURTIGKASSE_BRIDGE}?slug=${encodeURIComponent(slug)}` +
    `&utm_source=vg&utm_medium=content&utm_campaign=blackweek&utm_content=${encodeURIComponent(link.ref1)}`;
  // ref2 / ref3 (our SDK session and campaign) go only when they are clean values.
  const ref = (name: string, v: unknown) => {
    const t = v == null ? "" : String(v).trim();
    return t && CW_PARAM.test(t) ? `&${name}=${encodeURIComponent(t)}` : "";
  };
  return (
    `https://${CIRCLEWISE_HOST}/?a=${encodeURIComponent(link.a)}&i=${encodeURIComponent(link.i)}` +
    `&ref1=${encodeURIComponent(link.ref1)}${ref("ref2", extra.ref2)}${ref("ref3", extra.ref3)}` +
    `&r=${encodeURIComponent(bridge)}`
  );
}

// ---------------------------------------------------------------------------
// Circlewise on by default (Angelo: «always our mode, but theirs registered»)
// ---------------------------------------------------------------------------

/** The affiliate (`a`) and offer (`i`) of Kondomeriet's Black Week in Circlewise — the Config can change them. */
export const CIRCLEWISE_DEFAULT_A = "h9k6zq";
export const CIRCLEWISE_DEFAULT_I = "3j26pb";

export type CirclewiseSettings = { enabled: boolean; a: string; i: string };

/** Set by the Kondomeriet Config while it renders; without a Config, the defaults (on). */
export function setCirclewiseSettings(s: Partial<CirclewiseSettings> | null): void {
  const a = typeof s?.a === "string" && CW_PARAM.test(s.a.trim()) ? s.a.trim() : CIRCLEWISE_DEFAULT_A;
  const i = typeof s?.i === "string" && CW_PARAM.test(s.i.trim()) ? s.i.trim() : CIRCLEWISE_DEFAULT_I;
  (globalThis as { __KND_CW__?: CirclewiseSettings }).__KND_CW__ = { enabled: s?.enabled !== false, a, i };
}

export function circlewiseSettings(): CirclewiseSettings {
  return (
    (globalThis as { __KND_CW__?: CirclewiseSettings }).__KND_CW__ ?? {
      enabled: true,
      a: CIRCLEWISE_DEFAULT_A,
      i: CIRCLEWISE_DEFAULT_I,
    }
  );
}

/**
 * The sheet's ref1 per Black Week product, by its shop slug (the second
 * segment of the product URL): colours, sizes and models share their
 * group's. First match wins, so the specific patterns come first. «kondomer»
 * and «undertoy» are the sheet's two categories (no product of the
 * collection matches them today).
 */
const BLACK_WEEK_REF1: [RegExp, string][] = [
  [/^blowcast-wingman-pro/, "blowcastpro"],
  [/^blowcast-wingman-plus/, "wingmanplus"],
  [/^blowcast-wingman-lite/, "blowcastlite"],
  [/julekalender/, "julekalender"],
  [/^womanizer-snap/, "womanizersnap"],
  [/^womanizer-premium/, "womanizerpremium"],
  [/^womanizer-duo/, "womanizerduo"],
  [/^easytoys-slikkemaskin-pleasure/, "pleasure"],
  [/lyserosa-slikkemaskin/, "easytoys_slikk"],
  [/^easytoys-penispumpe/, "easytoys"],
  [/analplugg/, "analplugg"],
  [/corrida/, "corrida"],
  [/^tenga-spinner/, "tenga"],
  [/easyglide/, "easyglide"],
  [/alex-neo/, "alexneo"],
  [/^we-vibe-melt/, "wevibemelt"],
  [/petal/, "petal"],
  [/kondom/, "kondomer"],
  [/undertoy/, "undertoy"],
];

/** The Black Week sheet's «Rabatt» per row (by its ref1 suffix), for the editor's picker. */
const BLACK_WEEK_DISCOUNT: Record<string, string> = {
  blowcastpro: "60 %",
  wingmanplus: "60 %",
  blowcastlite: "60 %",
  julekalender: "30 %",
  pleasure: "40 %",
  corrida: "40 %",
  analplugg: "70 %",
  alexneo: "20 %",
  easytoys: "40 %",
  easytoys_slikk: "40 %",
  wevibemelt: "15 %",
  petal: "30 %",
  womanizersnap: "25 %",
  womanizerpremium: "32 %",
  tenga: "15 %",
  easyglide: "20 %",
  kondomer: "20 %",
  undertoy: "20 %",
};

/** The sheet's discount for one shop slug («60 %»), or null. */
export function blackWeekDiscount(slug: string | null | undefined): string | null {
  const row = blackWeekRef1(slug);
  return row ? BLACK_WEEK_DISCOUNT[row] ?? null : null;
}

/** The words (dash-separated) every slug of a group starts with: «womanizer-premium-2». */
function commonSlug(slugs: string[]): string {
  const parts = slugs.map((x) => x.split("-").filter(Boolean));
  const out: string[] = [];
  for (let k = 0; k < (parts[0]?.length ?? 0); k++) {
    if (parts.every((p) => p[k] === parts[0][k])) out.push(parts[0][k]);
    else break;
  }
  return out.join("-") || slugs[0] || "";
}

/**
 * The ref1 of a card: the sheet's for its products (the first option that
 * matches), else `blackweek_<the group's slug, or the product's>`.
 */
/** The sheet's ref1 suffix for one shop slug («blowcastpro»), or null. */
export function blackWeekRef1(slug: string | null | undefined): string | null {
  if (!slug) return null;
  const hit = BLACK_WEEK_REF1.find(([re]) => re.test(slug));
  return hit ? hit[1] : null;
}

export function ref1ForGroup(group: ResolvedGroup): string {
  const slugs = group.options.map((o) => o.slug).filter((s): s is string => !!s);
  for (const s of slugs) {
    const hit = blackWeekRef1(s);
    if (hit) return `blackweek_${hit}`;
  }
  const base = (slugs.length > 1 ? commonSlug(slugs) : slugs[0] ?? "").replace(/[^A-Za-z0-9_.-]/g, "").slice(0, 70);
  return `blackweek_${base || "kondomeriet"}`;
}

/**
 * The Circlewise link a card's «Kjøp med Vipps» goes through: its own pasted
 * link (card / block) when valid; else, Circlewise on, the Config's `a` / `i`
 * with the card's ref1; else none (the direct POST).
 */
export function circlewiseFor(
  group: ResolvedGroup,
  ownLink: unknown,
  option?: KondomerietOption | null
): { link: CirclewiseLink | null; error: string | null; source: "own" | "auto" | "off" } {
  const own = parseCirclewiseLink(ownLink);
  if (own.link) return { link: own.link, error: null, source: "own" };
  const s = circlewiseSettings();
  if (!s.enabled) return { link: null, error: own.error, source: "off" };
  return { link: { a: s.a, i: s.i, ref1: ref1ForOption(group, option) }, error: own.error, source: "auto" };
}

/**
 * The ref1 of a purchase: the chosen option's own row in the sheet when it
 * has one (a card can hold several models the sheet tracks apart — Wingman
 * pro / plus / lite), else the card's (`ref1ForGroup`).
 */
export function ref1ForOption(group: ResolvedGroup, option?: KondomerietOption | null): string {
  const own = blackWeekRef1(option?.slug);
  return own ? `blackweek_${own}` : ref1ForGroup(group);
}

// ---------------------------------------------------------------------------
// Families: which picked products are one card
// ---------------------------------------------------------------------------

/**
 * A card's picker closed with `ids` picked (in the order they were picked):
 * one family stays the card (with its Details); more than one splits — the
 * first family stays, every other one becomes a new card right after it.
 */
export function applyCardPick(
  groups: KondomerietGroup[],
  index: number,
  ids: number[],
  info: Map<number, FamilyItem>
): { groups: KondomerietGroup[]; created: number } {
  const current = groups[index] ?? { ids: [] };
  const fams = familiesOf(ids.map((id) => info.get(id) ?? { id }));
  if (fams.length <= 1) {
    const next = [...groups];
    next[index] = { ...current, ids };
    return { groups: next, created: 0 };
  }
  const [first, ...rest] = fams;
  return {
    groups: [...groups.slice(0, index), { ...current, ids: first }, ...rest.map((f) => ({ ids: f })), ...groups.slice(index + 1)],
    created: rest.length,
  };
}

/**
 * «+ Add products» closed with `ids` picked: one new card per family, in the
 * order they were picked, at the end of the list. Cards that exist are left
 * as they are; a product already in one of them is skipped.
 */
export function addProductsAsCards(
  groups: KondomerietGroup[],
  ids: number[],
  info: Map<number, FamilyItem>
): { groups: KondomerietGroup[]; created: number; skipped: number } {
  const taken = new Set(allGroupIds(groups));
  const fresh = ids.filter((id) => !taken.has(id));
  const fams = familiesOf(fresh.map((id) => info.get(id) ?? { id }));
  return { groups: [...groups, ...fams.map((f) => ({ ids: f }))], created: fams.length, skipped: ids.length - fresh.length };
}

/** What the editor knows about a picked product (the catalog row). */
export type FamilyItem = { id: number; title?: string; brand?: string; slug?: string | null };

function words(t: string | undefined): string[] {
  return String(t ?? "").trim().split(/\s+/).filter(Boolean);
}

/** The words two titles start with in common (case-insensitive). */
function commonLeadingWords(a: string | undefined, b: string | undefined): number {
  const x = words(a), y = words(b);
  let n = 0;
  while (n < x.length && n < y.length && x[n].localeCompare(y[n], "nb", { sensitivity: "accent" }) === 0) n++;
  return n;
}

function sameBrand(a?: string, b?: string): boolean {
  const x = String(a ?? "").trim().toLowerCase(), y = String(b ?? "").trim().toLowerCase();
  return !x || !y || x === y;
}

/**
 * Picked products grouped into families — the same product in another
 * colour, size or model, which one card shows behind its selector. Two
 * products are one family when the Black Week sheet puts them in one row
 * (same ref1: Premium 2's colours, Spinner's models, EasyGlide's sizes), or
 * when they have the same brand and their titles start with at least two
 * words in common («Blowcast Wingman …», «TENGA Spinner …» — what
 * `deriveLabels` turns into the card title and the option labels). One word
 * is not enough: «EasyToys …» or «Womanizer …» name a brand, not a product.
 * Families come in the order of their first product; products keep the
 * order they were picked in.
 */
export function familiesOf(items: FamilyItem[]): number[][] {
  const parent = items.map((_, k) => k);
  const find = (k: number): number => (parent[k] === k ? k : (parent[k] = find(parent[k])));
  for (let a = 0; a < items.length; a++) {
    for (let b = a + 1; b < items.length; b++) {
      const ra = blackWeekRef1(items[a].slug);
      const rb = blackWeekRef1(items[b].slug);
      const sheet = !!ra && ra === rb;
      const title = sameBrand(items[a].brand, items[b].brand) && commonLeadingWords(items[a].title, items[b].title) >= 2;
      if (sheet || title) parent[find(b)] = find(a);
    }
  }
  const out = new Map<number, number[]>();
  items.forEach((it, k) => {
    const root = find(k);
    out.set(root, [...(out.get(root) ?? []), it.id]);
  });
  return [...out.values()];
}

/** Opens a URL the way the Hurtigkasse opens (new tab, or the same window), from inside the click. */
export function openInTarget(url: string, target: HurtigkasseTarget = "_blank"): boolean {
  if (typeof document === "undefined") return false;
  const a = document.createElement("a");
  a.href = url;
  a.target = target === "_top" ? "_top" : "_blank";
  if (a.target === "_blank") a.rel = "noopener";
  a.style.display = "none";
  document.body.appendChild(a);
  try {
    a.click();
  } finally {
    setTimeout(() => a.remove(), 1000);
  }
  return true;
}

// ---------------------------------------------------------------------------
// Discount label
// ---------------------------------------------------------------------------

function parseLocalDate(value?: string): number | null {
  if (!value) return null;
  const t = new Date(value.trim().replace(" ", "T")).getTime();
  return Number.isFinite(t) ? t : null;
}

/** The group's badge text if it should show now: text set and `now` inside its window. */
export function activeDiscount(group: Pick<KondomerietGroup, "discount" | "discountStart" | "discountEnd">, now = Date.now()): string | null {
  const text = group.discount?.trim();
  if (!text) return null;
  const start = parseLocalDate(group.discountStart);
  const end = parseLocalDate(group.discountEnd);
  if (start != null && now < start) return null;
  if (end != null && now >= end) return null;
  return text;
}

/** A clock that ticks once a minute — only while `enabled` (a discount with dates). */
export function useMinuteClock(enabled: boolean): number {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (!enabled) return;
    const id = setInterval(() => setNow(Date.now()), 60_000);
    return () => clearInterval(id);
  }, [enabled]);
  return now;
}

// ---------------------------------------------------------------------------
// Prices
// ---------------------------------------------------------------------------

/** "1 299 kr", "349,30 kr": no decimals or two, never one. */
export function formatKr(amount: number | null | undefined): string {
  if (amount == null || !Number.isFinite(amount)) return "";
  const whole = Math.abs(amount - Math.round(amount)) < 0.005;
  return `${amount.toLocaleString("nb-NO", {
    minimumFractionDigits: whole ? 0 : 2,
    maximumFractionDigits: whole ? 0 : 2,
  })} kr`;
}

/** The feed's sale: compare-at above the price (both incl. taxes when the API gives them). */
export function compareAtAmount(p: any): number | null {
  const now = getProductPriceAmount(p);
  const was = Number(p?.price?.compare_at_incl_taxes ?? p?.price?.compare_at ?? NaN);
  return now != null && Number.isFinite(was) && was > now ? was : null;
}

/** Out of stock in Vio: quantity 0 (the feed sweep sets it; null = not tracked). */
export function isSoldOut(p: any): boolean {
  const q = p?.quantity;
  return q != null && Number.isFinite(Number(q)) && Number(q) <= 0;
}

// ---------------------------------------------------------------------------
// Resolved groups (what the card renders)
// ---------------------------------------------------------------------------

export type KondomerietOption = {
  productId: number;
  product: any;
  label: string;
  /** Hurtigkasse slug (override, else from the product's shop URL); null = cannot buy directly. */
  slug: string | null;
};

export type ResolvedGroup = {
  /** Stable key for React lists. */
  key: string;
  title: string;
  brand: string;
  options: KondomerietOption[];
  group: KondomerietGroup;
};

/** A group with its fetched products — the ones the channel did not return are left out. */
export function resolveGroup(group: KondomerietGroup, products: Map<number, any>, index = 0): ResolvedGroup | null {
  const present = group.ids.map((id) => ({ id, p: products.get(id) })).filter((x) => x.p);
  if (present.length === 0) return null;
  const derived = deriveLabels(present.map((x) => x.p.title ?? ""));
  const options: KondomerietOption[] = present.map(({ id, p }, i) => {
    const override = group.slugs?.[String(id)];
    return {
      productId: id,
      product: p,
      label: group.labels?.[String(id)] || derived.labels[i] || p.title || `#${id}`,
      slug: isValidSlug(override) ? override.trim() : slugFromProductUrl(p.origin_url ?? p.originUrl),
    };
  });
  return {
    key: `${index}:${group.ids.join("-")}`,
    title: group.title || derived.title,
    brand: present[0].p.brand ?? "",
    options,
    group,
  };
}

/** The option a card starts on: the first one in stock, else the first. */
export function initialOptionIndex(options: KondomerietOption[]): number {
  const i = options.findIndex((o) => !isSoldOut(o.product));
  return i >= 0 ? i : 0;
}

// ---------------------------------------------------------------------------
// Fetch (with the shop URL)
// ---------------------------------------------------------------------------

/**
 * The SDK's product query plus `origin_url` (the product's page in the
 * merchant's store, imported from the feed — graphql #976ebfc, on master
 * since 2026-09). The Hurtigkasse slug comes from it.
 */
const KONDOMERIET_PRODUCTS_QUERY = `
  query KondomerietProducts(
    $currency: String
    $imageSize: ImageSize
    $productIds: [Int!]
    $useCache: Boolean!
    $shippingCountryCode: String
  ) {
    Channel {
      GetProductsByIds(
        currency: $currency
        image_size: $imageSize
        product_ids: $productIds
        useCache: $useCache
        shipping_country_code: $shippingCountryCode
      ) {
        id
        brand
        title
        description
        quantity
        origin_url
        price {
          amount
          currency_code
          compare_at
          amount_incl_taxes
          compare_at_incl_taxes
        }
        images {
          id
          url
          width
          height
          order
        }
      }
    }
  }
`;

/**
 * What a card paints, and nothing else: no description (the card's rating
 * comes from the snapshot; the product info reads the full product), no
 * image sizes. Asked only for the page's ids — never the whole catalog.
 */
const KONDOMERIET_CARD_QUERY = `
  query KondomerietCards(
    $currency: String
    $imageSize: ImageSize
    $productIds: [Int!]
    $useCache: Boolean!
    $shippingCountryCode: String
  ) {
    Channel {
      GetProductsByIds(
        currency: $currency
        image_size: $imageSize
        product_ids: $productIds
        useCache: $useCache
        shipping_country_code: $shippingCountryCode
      ) {
        id
        brand
        title
        quantity
        origin_url
        price {
          amount
          currency_code
          compare_at
          amount_incl_taxes
          compare_at_incl_taxes
        }
        images {
          url
          order
        }
      }
    }
  }
`;

/** Currency | country — what a product's price depends on besides its channel. */
export function marketKey(): string {
  return `${getActiveCurrency()}|${getActiveCountryCode()}`;
}

// ---------------------------------------------------------------------------
// Fast start: the products request without waiting for the bootstrap
// ---------------------------------------------------------------------------

/**
 * The channel the Kondomeriet Config resolved in the editor (its `fastStart`
 * prop): the GraphQL endpoint and the sponsor's channel key for the page's
 * campaign. With it the published page asks for its products IN PARALLEL with
 * the bootstrap — one round trip instead of two. Once the bootstrap is there,
 * its own key and endpoint (`Vio.commerceFor`) serve every later request.
 */
export type FastChannel = {
  endpoint: string;
  apiKey: string;
  sponsorId: number;
  campaignId?: number | null;
  environment?: string;
  at?: number;
};

const FAST_EVENT = "kondomeriet:fast-channel";

export function fastChannel(): FastChannel | null {
  return (globalThis as { __KND_FAST__?: FastChannel | null }).__KND_FAST__ ?? null;
}

/** Set by the Kondomeriet Config while it renders (before the blocks' effects, when it is above them). */
export function setFastChannel(fc: FastChannel | null): void {
  const valid =
    fc && typeof fc.endpoint === "string" && /^https:\/\//.test(fc.endpoint) && typeof fc.apiKey === "string" && fc.apiKey && Number(fc.sponsorId) > 0
      ? { ...fc, sponsorId: Number(fc.sponsorId), campaignId: fc.campaignId != null && Number(fc.campaignId) > 0 ? Number(fc.campaignId) : null }
      : null;
  const g = globalThis as { __KND_FAST__?: FastChannel | null };
  if (JSON.stringify(g.__KND_FAST__ ?? null) === JSON.stringify(valid)) return;
  g.__KND_FAST__ = valid;
  if (typeof window !== "undefined") window.dispatchEvent(new CustomEvent(FAST_EVENT));
}

/** The fast channel, live (a Config that mounts after a block still reaches it). */
export function useFastChannel(): FastChannel | null {
  const [fc, setFc] = useState<FastChannel | null>(() => fastChannel());
  useEffect(() => {
    const on = () => setFc(fastChannel());
    on();
    window.addEventListener(FAST_EVENT, on);
    return () => window.removeEventListener(FAST_EVENT, on);
  }, []);
  return fc;
}

/**
 * Catalog reads as a simple request (handoff 2026-11-18-cdn-edge-cache-sdk §5):
 * `GET ?query&variables&operationName&apiKey`, with no header of our own — no
 * `Authorization`, no `Content-Type` — so the browser sends it without a CORS
 * preflight (one round trip less per reader) and the CDN can answer it. The
 * variables are built in one fixed order (`productVariables`); the same set of
 * products is the same URL on every page. Anything but a clean answer (network,
 * 4xx/5xx, GraphQL errors) falls back to the POST, and an endpoint whose GET
 * failed is not asked by GET again on this page. Mutations never come here.
 */
const getRefused = new Set<string>();

function operationNameOf(query: string): string | null {
  return /^\s*query\s+([A-Za-z_][A-Za-z0-9_]*)/.exec(query)?.[1] ?? null;
}

/** One GraphQL read straight to an endpoint with a channel key (no SDK client, no bootstrap). */
export async function directGraphQL(endpoint: string, apiKey: string, query: string, variables: Record<string, unknown>): Promise<any> {
  const compact = query.replace(/\s+/g, " ").trim();
  if (!getRefused.has(endpoint)) {
    try {
      const op = operationNameOf(compact);
      const url =
        `${endpoint}?query=${encodeURIComponent(compact)}` +
        `&variables=${encodeURIComponent(JSON.stringify(variables))}` +
        (op ? `&operationName=${encodeURIComponent(op)}` : "") +
        `&apiKey=${encodeURIComponent(apiKey)}`;
      const res = await fetch(url);
      const json = res.ok ? await res.json() : null;
      if (json?.data && !json?.errors?.length) return json.data;
      getRefused.add(endpoint);
    } catch {
      getRefused.add(endpoint);
    }
  }
  const res = await fetch(endpoint, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: apiKey },
    body: JSON.stringify({ query: compact, variables }),
  });
  if (!res.ok) throw new Error(`[Vio] GraphQL ${res.status}`);
  const json = await res.json();
  if (json?.errors?.length) throw new Error(`[Vio] GraphQL: ${json.errors[0]?.message ?? "error"}`);
  return json?.data;
}

/** The GraphQL endpoint and channel key the SDK would use for a sponsor (after the bootstrap), or null. */
function channelOf(sponsorId: number, campaignId: number | null | undefined): { endpoint: string; apiKey: string } | null {
  try {
    const sponsor = (Vio as any).sponsorCommerce?.(sponsorId, campaignId != null ? { campaignId } : {});
    const apiKey = sponsor?.commerce?.apiKey;
    const endpoint = (Vio as any).config?.graphQLBase;
    return typeof apiKey === "string" && apiKey && typeof endpoint === "string" && endpoint ? { endpoint, apiKey } : null;
  } catch {
    return null;
  }
}

type Batch = { ids: Set<number>; waiters: Map<number, { resolve: (p: any) => void; reject: (e: unknown) => void }[]>; timer: any };
const productPromises = new Map<string, Promise<any | null>>();
const batches = new Map<string, Batch>();

/** One product query for every id asked in the same tick, per sponsor + campaign + market + shape. */
function batchedProduct(id: number, sponsorId: number, campaignId: number | null | undefined, full: boolean): Promise<any | null> {
  const scope = [full ? "full" : "card", sponsorId, campaignId ?? "", marketKey()].join("|");
  const key = `${scope}|${id}`;
  const known = productPromises.get(key);
  if (known) return known;
  let batch = batches.get(scope);
  if (!batch) {
    batch = { ids: new Set(), waiters: new Map(), timer: null };
    batches.set(scope, batch);
  }
  const b = batch;
  const promise = new Promise<any | null>((resolve, reject) => {
    b.ids.add(id);
    const list = b.waiters.get(id) ?? [];
    list.push({ resolve, reject });
    b.waiters.set(id, list);
  });
  productPromises.set(key, promise);
  // A failed or missing product is not remembered: the next block asks again.
  promise.then(
    (p) => {
      if (!p) productPromises.delete(key);
    },
    () => productPromises.delete(key)
  );
  if (!b.timer) {
    b.timer = setTimeout(() => {
      batches.delete(scope);
      const ids = [...b.ids];
      queryProducts(ids, sponsorId, campaignId, full).then(
        (list) => {
          const byId = new Map(list.map((p) => [Number(p?.id), p]));
          for (const [pid, ws] of b.waiters) for (const w of ws) w.resolve(byId.get(pid) ?? null);
          if (!full) writeCachedProducts(list, marketKey());
        },
        (err) => {
          for (const ws of b.waiters.values()) for (const w of ws) w.reject(err);
        }
      );
    }, 0);
  }
  return promise;
}

/** Always the same keys in the same order, the ids sorted: one URL (one CDN entry) per set of products. */
function productVariables(ids: number[]) {
  return {
    productIds: [...ids].sort((a, b) => a - b),
    currency: getActiveCurrency(),
    shippingCountryCode: getActiveCountryCode(),
    imageSize: "large",
    useCache: true,
  };
}

function inOrder(ids: number[], list: any[], light: boolean): any[] {
  return ids
    .map((id) => list.find((x) => Number(x?.id) === id))
    .filter(Boolean)
    .map((p) => (light ? { ...p, __light: true } : p));
}

async function queryProducts(ids: number[], sponsorId: number, campaignId: number | null | undefined, full: boolean): Promise<any[]> {
  const query = full ? KONDOMERIET_PRODUCTS_QUERY : KONDOMERIET_CARD_QUERY;
  // Before the bootstrap: straight to the channel the editor resolved, in
  // parallel with the bootstrap — if it is the channel asked for.
  const fc = fastChannel();
  if (fc && fc.sponsorId === sponsorId && (fc.campaignId ?? null) === (campaignId ?? null) && !(Vio as any).bootstrapCache) {
    try {
      const data = await directGraphQL(fc.endpoint, fc.apiKey, query, productVariables(ids));
      const list: any[] = Array.isArray(data?.Channel?.GetProductsByIds) ? data.Channel.GetProductsByIds : [];
      if (list.length) return inOrder(ids, list, !full);
    } catch (err: any) {
      console.warn("[Vio] Kondomeriet fast start failed, waiting for the bootstrap", err?.message ?? err);
    }
  }
  try {
    return await withRetry(
      async () => {
        ensureVioInit();
        await Vio.bootstrap();
        const sid = sponsorForCommerce(sponsorId);
        if (sid == null) throw new Error("[Vio] no sponsor in the connected key's configuration yet");
        const channel = channelOf(sid, campaignId);
        const data = channel
          ? await directGraphQL(channel.endpoint, channel.apiKey, query, productVariables(ids))
          : await (campaignId != null ? Vio.commerceFor(sid, { campaignId }) : Vio.commerceFor(sid)).raw.request(query, productVariables(ids));
        const list: any[] = Array.isArray(data?.Channel?.GetProductsByIds) ? data.Channel.GetProductsByIds : [];
        return inOrder(ids, list, !full);
      },
      { attempts: 4, delay: 300, label: "kondomeriet products" }
    );
  } catch (err: any) {
    console.warn("[Vio] Kondomeriet product query failed, using the standard one (no shop URL)", err?.message ?? err);
    return (await fetchVioProducts(ids, sponsorId, campaignId)) as any[];
  }
}

// ---------------------------------------------------------------------------
// Shipping rates for the product info, as a simple GET
// ---------------------------------------------------------------------------

/** The SDK's GET_PRODUCT_SHIPPING_WITH_LOGO (ChannelProduct.getShippingRates), under our own name. */
const KONDOMERIET_SHIPPING_QUERY = `
  query KondomerietShipping($productIds: [Int!], $useCache: Boolean!, $currency: String, $shippingCountryCode: String) {
    Channel {
      GetProductsByIds(product_ids: $productIds, useCache: $useCache, currency: $currency, shipping_country_code: $shippingCountryCode) {
        id
        product_shipping {
          id
          name
          description
          logo_url
          default
          shipping_country {
            country
            price { amount amount_incl_taxes currency_code }
          }
        }
      }
    }
  }
`;

export type KondomerietShippingRate = { name: string; price: number; currency: string; description: string; logoUrl: string };

const FILLER_SHIPPING = ["by outshifter", "default shipping method"];

/**
 * A product's shipping rates for the page's market, cheapest first — what the
 * SDK's `getShippingRates` answers (same rows, same filler descriptions
 * dropped), read with `directGraphQL` so it is a simple GET. `null` when it
 * cannot be read this way (no bootstrap yet, an error): the caller asks the SDK.
 */
export async function kondomerietShippingRates(
  productId: number,
  sponsorId: number,
  campaignId: number | null | undefined,
  currency: string
): Promise<KondomerietShippingRate[] | null> {
  const channel = channelOf(sponsorId, campaignId);
  if (!channel) return null;
  const country = getActiveCountryCode();
  try {
    const data = await directGraphQL(channel.endpoint, channel.apiKey, KONDOMERIET_SHIPPING_QUERY, {
      productIds: [productId],
      useCache: false,
      currency,
      shippingCountryCode: country,
    });
    const product = data?.Channel?.GetProductsByIds?.[0];
    if (!product) return null;
    const want = String(country || "").trim().toUpperCase();
    const out: KondomerietShippingRate[] = [];
    for (const s of Array.isArray(product.product_shipping) ? product.product_shipping : []) {
      const row = (Array.isArray(s?.shipping_country) ? s.shipping_country : []).find(
        (c: any) => String(c?.country ?? "").trim().toUpperCase() === want
      );
      const amount = typeof row?.price?.amount_incl_taxes === "number" ? row.price.amount_incl_taxes : row?.price?.amount;
      if (typeof amount !== "number" || !Number.isFinite(amount) || amount < 0) continue;
      const name = String(s.name ?? "");
      const text = typeof s.description === "string" ? s.description.trim() : "";
      const filler = !text || FILLER_SHIPPING.includes(text.toLowerCase()) || text.toLowerCase() === name.trim().toLowerCase();
      const logo = typeof s.logo_url === "string" && /^https:\/\/[^\s]+$/i.test(s.logo_url.trim()) ? s.logo_url.trim() : "";
      out.push({ name, price: amount, currency: String(row?.price?.currency_code ?? "") || currency, description: filler ? "" : text, logoUrl: logo });
    }
    return out.sort((a, b) => a.price - b.price);
  } catch {
    return null;
  }
}

/**
 * Products by id on the block's channel, in the requested order, each with
 * `origin_url`. Every block of the page asking in the same tick shares ONE
 * request (and the Kondomeriet Config starts it as early as it can); each
 * product's answer is kept for the page, and the card shape in the browser
 * for 5 minutes (`kondomeriet-perf.ts`). `full`: with the description and
 * every image size (the product info, the editor) — the card shape
 * (`__light`) otherwise. A failure falls back to the SDK's own product query.
 */
export function fetchKondomerietProducts(
  productIds: number[],
  sponsorId: number | null,
  campaignId?: number | null,
  { full = false }: { full?: boolean } = {}
): Promise<any[]> {
  simpleConfigRequest();
  const ids = productIds.filter((n) => Number.isInteger(n) && n > 0);
  if (ids.length === 0 || sponsorId == null) return Promise.resolve([]);
  return Promise.all(ids.map((id) => batchedProduct(id, sponsorId, campaignId, full).catch(() => null))).then(
    (list) => list.filter(Boolean)
  );
}

/** The product ids the page's Kondomeriet blocks show — registered as they render. */
function wantedIds(): Set<number> {
  const g = globalThis as { __KND_WANTED__?: Set<number> };
  return g.__KND_WANTED__ ?? (g.__KND_WANTED__ = new Set());
}

export function registerWantedProducts(ids: number[]): void {
  const set = wantedIds();
  for (const id of ids) set.add(id);
}

/** The Config's head start: one request for every product of the page as soon as the sponsor is known. */
export function prefetchWantedProducts(sponsorId: number | null, campaignId?: number | null): void {
  // (The card shape: what the blocks ask for.)
  const ids = [...wantedIds()];
  if (sponsorId == null || ids.length === 0) return;
  void fetchKondomerietProducts(ids, sponsorId, campaignId);
}

// ---------------------------------------------------------------------------
// The editor's catalog (fresh every time)
// ---------------------------------------------------------------------------

/** The Vio pickers' catalog query (vio-helpers' PRODUCTS_QUERY), asked for without the gateway's cache. */
const FRESH_CATALOG_QUERY = `
  query KondomerietCatalog($currency: String, $shippingCountryCode: String, $imageSize: ImageSize, $useCache: Boolean!) {
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
        price { amount amount_incl_taxes currency_code compare_at compare_at_incl_taxes }
        images { url }
        origin_url
      }
    }
  }
`;

/**
 * The sponsor's whole catalog, read fresh — for the Kondomeriet pickers. The
 * Vio blocks' `loadCatalog` keeps one answer per page and asks the gateway
 * with `useCache: true`, whose cached list outlives a reload: a product added
 * to the collection that day (Ring For Sex, 410659) did not show. Here every
 * opening asks again with `useCache: false` (which neither reads nor writes
 * the gateway's cache), so the Vio blocks' pickers are left as they are.
 */
export function loadFreshCatalog(): Promise<CatalogProduct[]> {
  return withRetry(
    async () => {
      if (!resolveApiKey()) throw new Error("Connect a Vio API key in the Config block to list its products");
      simpleConfigRequest();
      // On the page's owner Config's key and environment, whatever another
      // Config's panel left in this window (kondomeriet-owner.ts).
      ensureOwnerConnection();
      await Vio.bootstrap();
      const sponsorId = sponsorForSlot(null, getActiveSponsorId());
      if (sponsorId == null) throw new Error("Connect a Vio API key in the Config block to list its products");
      const data = await Vio.commerceFor(sponsorId).raw.request(FRESH_CATALOG_QUERY, {
        currency: getActiveCurrency(),
        shippingCountryCode: getActiveCountryCode(),
        imageSize: "large",
        useCache: false,
      });
      return (data?.Channel?.Products ?? []) as CatalogProduct[];
    },
    { attempts: 4, delay: 400, label: "kondomeriet catalog" }
  );
}

// ---------------------------------------------------------------------------
// The detail drawer (kondomeriet-detail.tsx) is opened with a document event
// ---------------------------------------------------------------------------

/** Its own event, never `vio:product-click`: the SDK's detail (and its cart) must not open. */
export const KONDOMERIET_DETAIL_EVENT = "kondomeriet:open-detail";

export type KondomerietDetailRequest = {
  group: ResolvedGroup;
  index: number;
  /** Labels and behaviour of the card that opened it. */
  optionTitle?: string;
  vippsLabel?: string;
  target?: HurtigkasseTarget;
  badge?: string | null;
  /** The card's «Discount badge» choice, so the drawer badges each option the same way. */
  discountMode?: string;
  discountText?: string;
  /** The editor's picture: first in the gallery, or alone with leadImageOnly. */
  leadImage?: string;
  leadImageOnly?: boolean;
  accentColor?: string;
  /** «Kjøp direkte fra artikkelen» — the card's text; '' = no badge. */
  directBadge?: string;
  /** The shop's promises under the Vipps button (one per line in the panel). */
  perks?: string[];
  /** The stock line when the option is in stock. */
  stockText?: string;
  attribution: VioAttribution;
  sponsorId: number | null;
  /** Under the Vipps button (the card's microcopy for its target); '' = none. */
  vippsNote?: string;
  /** «Tilbudet gjelder til …», already worded; null = none. */
  offerText?: string | null;
  /** The card's Circlewise link (valid), so the drawer's Vipps goes through it too. */
  tracking?: CirclewiseLink | null;
  /** The link is the default one: its ref1 follows the option chosen in the drawer. */
  trackingAuto?: boolean;
  /** The card follows a choice made in the drawer. */
  onSelect?: (index: number) => void;
};

export type BrandHighlight = { icon: string; title: string; text?: string };
export type BrandIdentity = {
  name?: string;
  logoUrl?: string | null;
  termsUrl?: string;
  refundPolicyUrl?: string;
  highlights?: BrandHighlight[];
};

/**
 * Who the brand is to the SDK — `Vio.sponsorIdentity` (the bootstrap's sponsor:
 * name, logo, terms and returns pages, promises), the rule every SDK element
 * uses. Null before the bootstrap or for an unknown sponsor.
 */
export function brandIdentity(sponsorId: number | null): BrandIdentity | null {
  if (sponsorId == null) return null;
  try {
    const id = (Vio as any).sponsorIdentity?.(sponsorId);
    return id && typeof id === "object" ? (id as BrandIdentity) : null;
  } catch {
    return null;
  }
}

/** The brand's identity, else the last one this browser saw (a card painted before the bootstrap); keeps that copy fresh. */
export function brandIdentityOrCached(sponsorId: number | null): BrandIdentity | null {
  const live = brandIdentity(sponsorId);
  if (live && sponsorId != null) {
    writeCachedIdentity(sponsorId, live);
    return live;
  }
  const cached = readCachedIdentity();
  return cached && (sponsorId == null || cached.sponsorId === sponsorId) ? (cached.identity as BrandIdentity) : null;
}

/** Under the card's Vipps button, when the Hurtigkasse opens in a new tab. */
export const DEFAULT_VIPPS_NOTE = "Du blir værende i artikkelen";
export const DEFAULT_TRUST_LINE = "Diskret pakket · Anonym levering · Frakt fra 59,-";

/**
 * The card's line of promises: the editor's text; else the brand's promises
 * (their titles, when short); else the default. Hidden with `showTrustLine`.
 */
export function trustLineFor(own: unknown, identity: BrandIdentity | null): string {
  if (typeof own === "string" && own.trim()) return own.trim();
  const titles = (identity?.highlights ?? []).map((h) => String(h?.title ?? "").trim()).filter((t) => t && t.length <= 28);
  return titles.length >= 2 ? titles.slice(0, 3).join(" · ") : DEFAULT_TRUST_LINE;
}

/** Defaults of the editable trust texts (props of the Kondomeriet card / carousel / grid). */
export const DEFAULT_DIRECT_BADGE = "Kjøp direkte fra artikkelen";
export const DEFAULT_PERKS = ["Anonym levering", "Miljørabatt", "Orgasmegaranti", "Frakt fra kun 59,-"];
export const DEFAULT_STOCK_TEXT = "På lager — Leveres innen 1-3 virkedager";

/** The panel's text (one per line) as a list; undefined = the defaults, '' = none. */
export function perksFrom(value: unknown): string[] {
  if (typeof value !== "string") return DEFAULT_PERKS;
  return value.split("\n").map((l) => l.trim()).filter(Boolean);
}

/** The badge text; undefined = the default, '' (or blanks) = no badge. */
export function directBadgeFrom(value: unknown): string {
  return typeof value === "string" ? value.trim() : DEFAULT_DIRECT_BADGE;
}

export function openKondomerietDetail(request: KondomerietDetailRequest): void {
  if (typeof document === "undefined") return;
  document.dispatchEvent(new CustomEvent(KONDOMERIET_DETAIL_EVENT, { detail: request }));
}

// ---------------------------------------------------------------------------
// Editor notices: what makes the published page slower until someone opens a panel
// ---------------------------------------------------------------------------

/**
 * A block's props can only be written from its properties panel (Vev gives a
 * block on the canvas no way to save its own props): the snapshot is written
 * by the group editor when it opens, the Config's fast start by its field.
 * Until then the editor says so on the block, before publishing.
 */
export const SNAPSHOT_MISSING_NOTICE =
  "Instant loading missing — select this block and open its properties once (its products), then publish.";
export const FAST_START_MISSING_NOTICE = "Fast start missing — open this Config's properties once, then publish.";

/** Some picked product has no snapshot: the published card waits for the products to paint. */
export function groupsMissingSnapshot(groups: KondomerietGroup[]): boolean {
  return groups.some((g) => g.ids.some((id) => !g.snap?.[String(id)]));
}
