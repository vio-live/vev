import { useEffect, useState } from "react";
import { Vio } from "../../vio-sdk";
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
};

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

const fetchCache = new Map<string, Promise<any[]>>();

/**
 * Products by id on the block's channel, in the requested order, each with
 * `origin_url`. A failure of that query (an API without the field) falls back
 * to the SDK's own product query — the cards then show, but "Kjøp med Vipps"
 * needs a slug override. Deduped per ids + sponsor + campaign + market.
 */
export function fetchKondomerietProducts(
  productIds: number[],
  sponsorId: number | null,
  campaignId?: number | null
): Promise<any[]> {
  const ids = productIds.filter((n) => Number.isInteger(n) && n > 0);
  if (ids.length === 0 || sponsorId == null) return Promise.resolve([]);
  const key = [ids.join(","), sponsorId, campaignId ?? "", getActiveCurrency(), getActiveCountryCode()].join("|");
  const cached = fetchCache.get(key);
  if (cached) return cached;
  const pending = withRetry(
    async () => {
      ensureVioInit();
      await Vio.bootstrap();
      const sid = sponsorForCommerce(sponsorId);
      if (sid == null) throw new Error("[Vio] no sponsor in the connected key's configuration yet");
      const commerce = campaignId != null ? Vio.commerceFor(sid, { campaignId }) : Vio.commerceFor(sid);
      const data = await commerce.raw.request(KONDOMERIET_PRODUCTS_QUERY, {
        productIds: ids,
        currency: getActiveCurrency(),
        shippingCountryCode: getActiveCountryCode(),
        imageSize: "large",
        useCache: true,
      });
      const list: any[] = Array.isArray(data?.Channel?.GetProductsByIds) ? data.Channel.GetProductsByIds : [];
      return ids.map((id) => list.find((x) => Number(x?.id) === id)).filter(Boolean);
    },
    { attempts: 4, delay: 300, label: "kondomeriet products" }
  ).catch((err) => {
    console.warn("[Vio] Kondomeriet product query failed, using the standard one (no shop URL)", err?.message ?? err);
    return fetchVioProducts(ids, sponsorId, campaignId) as Promise<any[]>;
  });
  fetchCache.set(key, pending);
  // An empty answer is not remembered: the next block asks again.
  pending.then(
    (list) => {
      if (list.length === 0) fetchCache.delete(key);
    },
    () => fetchCache.delete(key)
  );
  return pending;
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
        price { amount amount_incl_taxes currency_code }
        images { url }
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
      ensureVioInit();
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
