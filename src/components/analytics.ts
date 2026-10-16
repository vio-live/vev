import { currentSponsorConfig, getPersistedSponsorId, vioAttribution, type VioAttribution } from "./vio-helpers";
import { Vio, purchaseFromPaymentSuccess } from "../../vio-sdk";

/**
 * Vio Vev — commerce analytics. Turns the shoppable funnel into GA4 e-commerce
 * events, so the publisher (VG) can measure ROI from a shoppable article. This is
 * the argument for the publisher: view_item_list → select_item → view_item →
 * add_to_cart → remove_from_cart → begin_checkout → purchase, all in their own
 * GTM/GA4. `remove_from_cart` goes to the dataLayer ON PURPOSE: it is a standard
 * GA4 e-commerce event, exactly like `add_to_cart`. Only the diagnostics
 * (`sdk_error`, `checkout_error`) stay out of it — see DIAGNOSTIC_EVENT_NAMES.
 *
 * Three sinks, all fed by trackEvent():
 *  1. window.dataLayer — GA4/GTM standard (the one a publisher already consumes).
 *  2. `vio:analytics` DOM event — generic hook (bridge to any other tool / our
 *     inspector overlay).
 *  3. console.debug — when debug is on.
 *
 * NOTHING fires until configureAnalytics({ enabled: true }) runs — the Vio Config
 * block enables it on the published page (and, if analyticsDebug is on, in the
 * editor too, so the inspector is demoable live).
 */

// ---------------------------------------------------------------------------
// Config
// ---------------------------------------------------------------------------

type AnalyticsState = {
  enabled: boolean;
  debug: boolean;
  /** Forward every tracked event to the Vio collector via Vio.analytics
   *  (F3 — the GA4/dataLayer/inspector sinks above stay untouched). */
  sendToVio: boolean;
};
const state: AnalyticsState = { enabled: false, debug: false, sendToVio: true };

export function configureAnalytics(cfg: Partial<AnalyticsState>): void {
  Object.assign(state, cfg);
}

// ---------------------------------------------------------------------------
// GA4 item shaping
// ---------------------------------------------------------------------------

/** Loose input any call site can build without knowing GA4's field names. */
export type VioItemInput = {
  productId?: number | string;
  name?: string;
  brand?: string;
  price?: number;
  currency?: string;
  quantity?: number;
  variantId?: number | string;
  index?: number;
  listName?: string;
  /** Where a cart line was added from — its `origin` (ADR-0034): the campaign,
   *  the slot and the article. Only on items read from the cart. */
  campaignId?: number;
  slot?: string;
  contentId?: string;
  /** The sponsor whose cart the line is in. Only on items read from the cart. */
  sponsorId?: number;
};

/** GA4 e-commerce item (the shape GTM/GA4 expects in `ecommerce.items`). */
type Ga4Item = {
  item_id: string;
  item_name?: string;
  item_brand?: string;
  item_variant?: string;
  price?: number;
  quantity?: number;
  index?: number;
  item_list_name?: string;
};

function num(v: unknown): number | undefined {
  // `Number(null)` and `Number("")` are 0 — never a campaign or a sponsor id.
  if (v === null || v === undefined || v === "") return undefined;
  const n = Number(v);
  return Number.isFinite(n) ? n : undefined;
}

function toGa4Item(i: VioItemInput): Ga4Item {
  const item: Ga4Item = { item_id: i.productId != null ? String(i.productId) : "" };
  if (i.name) item.item_name = i.name;
  if (i.brand) item.item_brand = i.brand;
  if (i.variantId != null) item.item_variant = String(i.variantId);
  if (i.price != null) item.price = i.price;
  if (i.quantity != null) item.quantity = i.quantity;
  if (i.index != null) item.index = i.index;
  if (i.listName) item.item_list_name = i.listName;
  return item;
}

/** Map a Vio product DTO (card/carousel/grid) to an analytics item. */
export function productToItem(p: any, extra?: Partial<VioItemInput>): VioItemInput {
  return {
    productId: p?.id,
    name: p?.title,
    brand: p?.brand,
    // Consumer-facing price (incl. taxes) — same base the cart uses, so the
    // GA4 funnel (view_item -> purchase) stays consistent.
    price: num(p?.price?.amount_incl_taxes ?? p?.price?.amount),
    currency: p?.price?.currency_code,
    ...extra,
  };
}

// ---------------------------------------------------------------------------
// Core dispatch
// ---------------------------------------------------------------------------

type EventParams = {
  currency?: string;
  value?: number;
  items?: VioItemInput[];
  item_list_name?: string;
  transaction_id?: string;
  payment_type?: string;
  // Attribution (ADR-0034): the sponsor, the place, its campaign and the
  // article. Goes to the Vio pipeline as context — never into GA4's
  // `ecommerce` object, which only takes GA4's own fields.
  sponsorId?: number;
  slot?: string;
  campaignId?: number;
  contentId?: string;
  contentTitle?: string;
  [key: string]: unknown;
};

function pushDataLayer(name: string, ecommerce: Record<string, unknown>): void {
  if (typeof window === "undefined") return;
  const w = window as any;
  w.dataLayer = w.dataLayer || [];
  // GA4 best practice: clear the previous ecommerce object before each push so
  // fields don't leak between events.
  w.dataLayer.push({ ecommerce: null });
  w.dataLayer.push({ event: name, ecommerce });
}

/** One row per product + variant; quantities summed when both sides have one. */
function mergeItemRows(items: VioItemInput[]): VioItemInput[] {
  const rows = new Map<string, VioItemInput>();
  for (const i of items) {
    const key = `${i.productId ?? ""}::${i.variantId ?? ""}`;
    const prev = rows.get(key);
    if (!prev) {
      rows.set(key, { ...i });
      continue;
    }
    const q = (prev.quantity ?? 0) + (i.quantity ?? 0);
    if (q > 0) prev.quantity = q;
  }
  return [...rows.values()];
}

const LOG_KEY = "__vioAnalyticsLog";
function ringLog(entry: unknown): void {
  if (typeof window === "undefined") return;
  const w = window as any;
  const log: unknown[] = (w[LOG_KEY] = w[LOG_KEY] || []);
  log.push(entry);
  if (log.length > 50) log.shift();
}

/** Diagnostics (contract v1) go to the Vio pipeline and the inspector, not
 * to the publisher's GA4: they are not e-commerce events. */
const DIAGNOSTIC_EVENT_NAMES = new Set(["sdk_error", "checkout_error"]);

/** The single choke point every tracked event goes through. */
export function trackEvent(name: string, params: EventParams = {}): void {
  if (!state.enabled) return;

  const {
    currency, value, items, item_list_name, transaction_id, payment_type,
    sponsorId, slot, campaignId, contentId, contentTitle,
    ...rest
  } = params;
  const ecommerce: Record<string, unknown> = { ...rest };
  if (currency) ecommerce.currency = currency;
  if (value != null) ecommerce.value = Math.round(value * 100) / 100;
  if (transaction_id) ecommerce.transaction_id = transaction_id;
  if (payment_type) ecommerce.payment_type = payment_type;
  if (item_list_name) ecommerce.item_list_name = item_list_name;
  // GA4 rows: one per product (+ variant), quantities summed — a line the
  // reader added from two blocks is ONE row for the publisher. The Vio sink
  // keeps the per-origin rows (forwardToVio), which is how it splits.
  if (items && items.length) ecommerce.items = mergeItemRows(items).map(toGa4Item);

  if (!DIAGNOSTIC_EVENT_NAMES.has(name)) pushDataLayer(name, ecommerce);

  // Vio pipeline (collector -> ClickHouse + vendor fan-out). Same choke
  // point as every other sink, so nothing can be double-counted: the core
  // runs with autoTrack:false (see initVioAnalytics) and only receives
  // what we forward here.
  if (state.sendToVio) forwardToVio(name, params);

  if (typeof document !== "undefined") {
    const detail = { name, params: { ...params }, ts: Date.now() };
    ringLog(detail);
    document.dispatchEvent(new CustomEvent("vio:analytics", { detail }));
  }

  if (state.debug && typeof console !== "undefined") {
    console.debug("[Vio analytics]", name, params);
  }
}

// ---------------------------------------------------------------------------
// Vio collector forwarding (F3 adapter over vio-web-sdk's Vio.analytics)
// ---------------------------------------------------------------------------

/** Client-side taxonomy of the analytics contract v1 — only these forward. */
const VIO_EVENT_NAMES = new Set([
  "view_item_list", "select_item", "view_item", "add_to_cart", "remove_from_cart",
  "view_cart", "begin_checkout", "purchase",
  "component_impression", "component_click", "ad_impression", "ad_click",
  "poll_impression", "contest_impression", "session_start", "session_end",
  "sdk_error",
]);

/**
 * El sponsor persistido de la página, solo si la configuración de la key
 * conectada lo conoce. A diferencia de `getActiveSponsorId`, acá NO se cae al
 * primario: un evento atribuido al sponsor equivocado es peor que uno sin
 * sponsor (el dashboard de commerce filtra por sponsor_id). Un id de otra
 * key (páginas hechas sobre vio-backend, otra org) queda fuera.
 */
function persistedSponsorIfKnown(): number | undefined {
  const config = currentSponsorConfig();
  const id = num(getPersistedSponsorId());
  if (!config || !id) return undefined;
  return config.ids.includes(id) ? id : undefined;
}

/** Events that a cart with several campaigns splits (ADR-0034, amendment 2). */
const SPLIT_BY_CAMPAIGN = new Set(["begin_checkout", "purchase"]);

type CampaignGroup = { campaignId?: number; slot?: string; contentId?: string; sponsorId?: number; items: VioItemInput[] };

/** Items grouped by campaign, in order of first appearance — the SDK's
 * `cartSlices` rule: units with an origin go to its campaign; units without
 * one to the campaign the current rule resolves for their line's sponsor
 * (`Vio.attribution(null, { sponsorId })`), never to a campaign-less group
 * of their own (only when nothing resolves — no bootstrap — they share one
 * `default` group the SDK attributes on the wire). The group's slot /
 * content / sponsor only when they are the same for the whole group; a
 * group's sponsor comes from its lines, never from the event. */
function groupItemsByCampaign(items: VioItemInput[]): CampaignGroup[] {
  const groups = new Map<string, CampaignGroup & { slots: Set<string>; contents: Set<string>; sponsors: Set<number> }>();
  const resolvedBySponsor = new Map<string, number | undefined>();
  const campaignOf = (it: VioItemInput): number | undefined => {
    const own = num(it.campaignId);
    if (own != null) return own;
    const sid = num(it.sponsorId);
    const key = sid != null ? String(sid) : "";
    if (!resolvedBySponsor.has(key)) resolvedBySponsor.set(key, num(vioAttribution(null, sid ?? null).campaignId));
    return resolvedBySponsor.get(key);
  };
  for (const it of items) {
    const cid = campaignOf(it);
    const k = cid != null ? String(cid) : "default";
    let g = groups.get(k);
    if (!g) {
      g = { campaignId: cid, items: [], slots: new Set(), contents: new Set(), sponsors: new Set() };
      groups.set(k, g);
    }
    if (it.slot) g.slots.add(it.slot);
    if (it.contentId) g.contents.add(it.contentId);
    const sid = num(it.sponsorId);
    if (sid != null) g.sponsors.add(sid);
    g.items.push(it);
  }
  return [...groups.values()].map((g) => ({
    campaignId: g.campaignId,
    slot: g.slots.size === 1 ? [...g.slots][0] : undefined,
    contentId: g.contents.size === 1 ? [...g.contents][0] : undefined,
    sponsorId: g.sponsors.size === 1 ? [...g.sponsors][0] : undefined,
    items: g.items,
  }));
}

/**
 * The SDK's own split (`Vio.cartSlices(sponsorId?)`, when the bundle exports
 * it) as groups — the same rule, computed by the one that keeps the origins.
 * Null when the bundle lacks it, when it answers nothing (the cart is already
 * cleared on `vio:payment-success`) or when the shape is not the expected
 * `{ campaignId?, slot?, contentId?, commerce: { items, value, currency } }`:
 * then `groupItemsByCampaign` over the snapshot does the same job.
 */
function sdkCartGroups(sponsorId?: number): CampaignGroup[] | null {
  const fn = (Vio as any)?.cartSlices;
  if (typeof fn !== "function") return null;
  try {
    const slices: any[] = fn.call(Vio, sponsorId);
    if (!Array.isArray(slices) || slices.length === 0) return null;
    const groups: CampaignGroup[] = [];
    for (const s of slices) {
      const rows: any[] = Array.isArray(s?.commerce?.items) ? s.commerce.items : [];
      if (!rows.length) return null;
      const campaignId = num(s?.campaignId);
      const slot = typeof s?.slot === "string" && s.slot ? s.slot : undefined;
      const contentId = s?.contentId != null && s.contentId !== "" ? String(s.contentId) : undefined;
      groups.push({
        campaignId,
        slot,
        contentId,
        sponsorId,
        items: rows.map((i) => ({
          productId: i?.productId,
          name: i?.name,
          brand: i?.brand,
          variantId: i?.variantId,
          price: num(i?.price),
          currency: s?.commerce?.currency,
          quantity: num(i?.quantity) ?? 1,
          campaignId,
          slot,
          contentId,
          sponsorId,
        })),
      });
    }
    return groups;
  } catch {
    return null;
  }
}

function forwardToVio(name: string, params: EventParams): void {
  if (!VIO_EVENT_NAMES.has(name)) return;
  const analytics = (Vio as any).analytics;
  if (!analytics?.track) return; // vendored SDK predates Vio.analytics
  // begin_checkout / purchase go out ONCE PER CAMPAIGN present in the cart,
  // each with its lines and its value and the same transaction id, so the
  // statistics per campaign come out exact (ADR-0034, amendment 2). The split
  // is done here, not by the SDK: Vev runs the core with autoTrack:false, so
  // the SDK's own per-campaign purchase never fires on these pages. A cart
  // whose lines carry no origin (persisted before 0.23.0) goes out once, as
  // before. GA4 (above) always gets the one event with every item: a
  // publisher's purchase is one purchase.
  if (SPLIT_BY_CAMPAIGN.has(name) && params.items?.length) {
    const groups = sdkCartGroups(num(params.sponsorId)) ?? groupItemsByCampaign(params.items);
    // The same precedence with one group or several: what the lines say
    // (their campaign, slot, content, sponsor) over what the event says.
    const withGroup = (g: CampaignGroup): EventParams => ({
      ...params,
      items: g.items,
      value: sumValue(g.items),
      campaignId: g.campaignId ?? params.campaignId,
      slot: g.slot ?? params.slot,
      contentId: g.contentId ?? params.contentId,
      sponsorId: g.sponsorId ?? params.sponsorId,
    });
    if (groups.length > 1) {
      for (const g of groups) sendToVio(analytics, name, withGroup(g));
      return;
    }
    if (groups.length === 1) params = withGroup(groups[0]);
  }
  sendToVio(analytics, name, params);
}

function sendToVio(analytics: any, name: string, params: EventParams): void {
  const {
    currency, value, items, item_list_name, transaction_id, payment_type, sponsorId, error_code,
    slot, campaignId, contentId, contentTitle,
    ...rest
  } = params;
  const props: Record<string, unknown> = { ...rest };
  if (item_list_name) props.list_name = item_list_name;
  const errorCode = typeof error_code === "string" && error_code ? error_code : undefined;
  try {
    analytics.track(name, {
      commerce:
        items?.length || value != null || transaction_id || payment_type
          ? {
              items: items?.map((i) => ({
                productId: i.productId ?? "",
                name: i.name,
                brand: i.brand,
                variantId: i.variantId,
                price: i.price,
                quantity: i.quantity,
              })),
              value: value ?? undefined,
              currency: currency ?? undefined,
              orderId: transaction_id,
              paymentMethod: payment_type,
            }
          : undefined,
      // El sponsor es LA dimensión del dashboard de commerce (filtra por
      // sponsor_id). Vev corre con autoTrack:false, así que los listeners del
      // core —que sí lo copian— están apagados: si no lo mandamos desde acá,
      // todo lo de Vev llega con sponsor_id = 0 y ese dashboard nace vacío.
      // Cascada: lo explícito del evento → el sponsor del carrito (si es
      // uno solo) → el sponsor persistido de la página, solo si la key
      // conectada lo conoce. Nunca un id inventado: atribuir a un sponsor
      // equivocado es peor que no atribuir. El campaign_id lo deriva el SDK
      // (explícito → slot asignado → campaña activa del sponsor → default);
      // el slot, la campaña y el artículo vienen de `Vio.attribution(slot)`
      // del bloque que emite (ADR-0034) y van tal cual.
      context: (() => {
        const sid = num(sponsorId) ?? soleCartSponsor() ?? persistedSponsorIfKnown();
        const ctx: Record<string, unknown> = {};
        if (sid) ctx.sponsorId = sid;
        if (errorCode) ctx.errorCode = errorCode;
        if (typeof slot === "string" && slot) ctx.slot = slot;
        const cid = num(campaignId);
        if (cid != null) ctx.campaignId = cid;
        if (contentId != null && contentId !== "") ctx.contentId = contentId;
        if (typeof contentTitle === "string" && contentTitle) ctx.contentTitle = contentTitle;
        return Object.keys(ctx).length ? ctx : undefined;
      })(),
      props: Object.keys(props).length ? props : undefined,
    });
  } catch {
    // Analytics must never break the page.
  }
}

// ---------------------------------------------------------------------------
// High-level events (call sites use these)
// ---------------------------------------------------------------------------

function currencyOf(items: VioItemInput[]): string | undefined {
  return items.find((i) => i.currency)?.currency;
}

function sumValue(items: VioItemInput[]): number {
  return items.reduce((acc, i) => acc + (i.price ?? 0) * (i.quantity ?? 1), 0);
}

/** Impression: a set of product cards rendered (carousel / grid / single card).
 * `attribution` is the block's `vioAttribution(slot, sponsor)` (ADR-0034). */
export function trackViewItemList(items: VioItemInput[], listName?: string, attribution?: VioAttribution): void {
  if (!items.length) return;
  const withIndex = items.map((i, idx) => ({ ...i, index: i.index ?? idx, listName }));
  trackEvent("view_item_list", {
    currency: currencyOf(items),
    item_list_name: listName,
    items: withIndex,
    ...attribution,
  });
}

/** A shoppable card was clicked (before the detail opens). */
export function trackSelectItem(item: VioItemInput, listName?: string, attribution?: VioAttribution): void {
  trackEvent("select_item", {
    currency: item.currency,
    item_list_name: listName,
    items: [{ ...item, listName }],
    ...attribution,
  });
}

/** The product detail was opened for a product. */
export function trackViewItem(item: VioItemInput, attribution?: VioAttribution): void {
  trackEvent("view_item", {
    currency: item.currency,
    value: item.price,
    items: [item],
    ...attribution,
  });
}

/** A product was added to the cart. */
export function trackAddToCart(item: VioItemInput, attribution?: VioAttribution): void {
  const qty = item.quantity ?? 1;
  trackEvent("add_to_cart", {
    currency: item.currency,
    value: (item.price ?? 0) * qty,
    items: [{ ...item, quantity: qty }],
    ...attribution,
  });
}

/**
 * The attribution a `vio:*` event detail carries: slot, campaign and article.
 * Who puts it there: our own cards (`vio:product-click`, `vio:checkout-open`
 * from the Vipps button — card-view.tsx) and, from the SDK 0.23.x on, its
 * product detail, cart and checkout (`vio:added-to-cart`,
 * `vio:removed-from-cart`, `vio:checkout-open`, `vio:payment-success`, each
 * spreading `Vio.attribution()` of the slot it was opened from). Older
 * bundles send none of it. Only what is there — never a made-up value.
 */
function attributionOf(d: any): VioAttribution {
  const out: VioAttribution = {};
  if (typeof d?.slot === "string" && d.slot.trim()) out.slot = d.slot.trim();
  const cid = num(d?.campaignId);
  if (cid != null) out.campaignId = cid;
  if (d?.contentId != null && String(d.contentId).trim()) out.contentId = String(d.contentId).trim();
  if (typeof d?.contentTitle === "string" && d.contentTitle.trim()) out.contentTitle = d.contentTitle.trim();
  return out;
}

// ---------------------------------------------------------------------------
// Cart access (for the SDK-internal signals: add-from-detail, checkout, purchase)
// ---------------------------------------------------------------------------

/** Every line across every sponsor cart, as analytics items. */
/**
 * Sponsor del carrito cuando el evento no lo trae (`vio:open-cart` no lleva
 * detail, y algunos caminos de pago tampoco). Con un solo sponsor en el
 * carrito —el caso normal— la respuesta es inequívoca; con varios devuelve
 * undefined en vez de inventar uno.
 */
function soleCartSponsor(): number | undefined {
  const carts = Vio.cart?.getAllCarts?.();
  if (!carts) return undefined;
  const ids = new Set<number>();
  for (const cart of carts.values?.() ?? []) {
    const sid = num((cart as any).sponsorId);
    if (sid) ids.add(sid);
  }
  return ids.size === 1 ? [...ids][0] : undefined;
}

function cartToItems(sponsorId?: number): VioItemInput[] {
  const out: VioItemInput[] = [];
  const carts = Vio.cart?.getAllCarts?.();
  if (!carts) return out;
  const sid = num(sponsorId);
  for (const cart of carts.values?.() ?? []) {
    if (sid != null && sid > 0 && (cart as any).sponsorId !== sid) continue;
    for (const it of (cart as any).items ?? []) {
      const base: VioItemInput = {
        productId: it.productId,
        name: it.name,
        brand: it.brand,
        price: num(it.unitPrice),
        currency: it.currency,
        quantity: num(it.quantity) ?? 1,
        variantId: it.variantId,
        // The cart it is in: purchase and begin_checkout are per sponsor.
        sponsorId: num((cart as any).sponsorId),
      };
      // The line remembers where its units were added from (ADR-0034,
      // `CartLineItem.origins`: campaign, slot, article, quantity per origin
      // — several when the same product came from more than one block): one
      // row per origin. Units no origin accounts for (a cart persisted before
      // the SDK 0.23.0, a quantity the server raised) are one row with an
      // empty origin, as the SDK's `lineOrigins` fills the gap.
      const origins: any[] = Array.isArray(it.origins) ? it.origins : [];
      let covered = 0;
      for (const o of origins) {
        const q = num(o?.quantity) ?? 0;
        if (q <= 0) continue;
        covered += q;
        out.push({
          ...base,
          quantity: q,
          campaignId: num(o?.campaignId),
          slot: typeof o?.slot === "string" && o.slot ? o.slot : undefined,
          contentId: o?.contentId != null && o.contentId !== "" ? String(o.contentId) : undefined,
        });
      }
      const quantity = base.quantity ?? 1;
      if (quantity > covered) out.push({ ...base, quantity: quantity - covered });
    }
  }
  return out;
}

/** Find the just-added line (for a rich add_to_cart from the detail drawer). */
function findCartItem(
  productId: unknown,
  sponsorId: unknown,
  variantId?: unknown
): VioItemInput | null {
  const items = cartToItems(num(sponsorId));
  const pid = Number(productId);
  const vid = variantId != null ? String(variantId) : null;
  return (
    items.find(
      (i) =>
        Number(i.productId) === pid &&
        (vid == null || String(i.variantId ?? "") === vid)
    ) ?? null
  );
}

// ---------------------------------------------------------------------------
// Document listeners for SDK-internal signals
// ---------------------------------------------------------------------------

const INIT_FLAG = "__VIO_ANALYTICS_INIT__";

/**
 * Install the global listeners for events we can't reach from our own call sites
 * (they originate inside the SDK's cart / checkout / detail web components, which
 * dispatch bubbling+composed events that reach document). Idempotent — the Vio
 * Config owner calls this once. Returns a cleanup.
 */
export function initVioAnalytics(): () => void {
  if (typeof document === "undefined") return () => {};
  const g = globalThis as any;
  if (g[INIT_FLAG]) return g[INIT_FLAG] as () => void;

  // Vio collector engine: sessions, batching, beacon, retries. autoTrack
  // OFF — our document listeners below are the single instrumentation
  // source; the core only transports what trackEvent() forwards.
  if (state.sendToVio) {
    try {
      (Vio as any).analytics?.start?.({ host: "vev", autoTrack: false });
    } catch {
      /* vendored SDK predates Vio.analytics — GA4/inspector still work */
    }
  }

  // Keep the last non-empty cart snapshot — the cart is cleared the instant a
  // payment succeeds, so `purchase` needs what was there just before.
  let lastCartSnapshot: VioItemInput[] = [];
  let lastCartSponsor: number | undefined;
  const onCartChange = () => {
    const items = cartToItems();
    if (items.length) {
      lastCartSnapshot = items;
      // El carrito se vacía ANTES de que llegue payment-success, así que el
      // sponsor se guarda con el snapshot o se pierde.
      lastCartSponsor = soleCartSponsor() ?? lastCartSponsor;
    }
  };
  Vio.cart?.addEventListener?.("change", onCartChange);
  onCartChange();

  // add_to_cart from the product detail (variant products). Our native card /
  // addon adds fire trackAddToCart() directly, so this only catches the detail.
  const onAdded = (e: Event) => {
    const d = (e as CustomEvent).detail ?? {};
    const item =
      findCartItem(d.productId, d.sponsorId, d.variantId) ??
      ({ productId: d.productId, variantId: d.variantId } as VioItemInput);
    trackAddToCart({ ...item, quantity: num(d.quantity) ?? item.quantity ?? 1 }, attributionOf(d));
  };

  // begin_checkout — the cart / detail asked to open the checkout (Klarna
  // express, Vipps, or the normal flow).
  const onCheckoutOpen = (e: Event) => {
    const d = (e as CustomEvent).detail ?? {};
    const items = cartToItems(num(d.sponsorId));
    if (!items.length) return;
    trackEvent("begin_checkout", {
      currency: currencyOf(items),
      value: sumValue(items),
      payment_type: d.paymentMethod,
      sponsorId: num(d.sponsorId) ?? soleCartSponsor(),
      items,
      ...attributionOf(d),
    });
  };

  // view_cart — the cart drawer was opened.
  const onOpenCart = () => {
    const items = cartToItems();
    trackEvent("view_cart", {
      currency: currencyOf(items),
      value: sumValue(items),
      sponsorId: soleCartSponsor(),
      items,
    });
  };

  // purchase — payment succeeded. Items/value/currency come from the pre-clear
  // cart snapshot on every path (sum of the items, no shipping — the charged
  // total will arrive through the server-side order_paid event). The order id
  // is the SDK's normalization: always a Vio id (the redirect's checkout id,
  // Apple Pay's backend confirmation, or the checkout id the drawer attaches),
  // never Qliro's/Walley's own reference.
  const onPaymentSuccess = (e: Event) => {
    const d = (e as CustomEvent).detail ?? {};
    // Only the sponsor that was paid: the checkout is per sponsor, and the
    // other carts are still there (their own payment follows). Apple Pay
    // from the cart names no sponsor and pays every cart: all of it then.
    const paidSponsor = num(d.sponsorId);
    const items = paidSponsor != null ? lastCartSnapshot.filter((i) => i.sponsorId === paidSponsor) : lastCartSnapshot;
    const { orderId } = purchaseFromPaymentSuccess(d);
    trackEvent("purchase", {
      currency: currencyOf(items),
      value: sumValue(items),
      transaction_id: orderId,
      payment_type: d.method,
      sponsorId: paidSponsor ?? lastCartSponsor,
      items,
      ...attributionOf(d),
    });
    lastCartSnapshot = paidSponsor != null ? lastCartSnapshot.filter((i) => i.sponsorId !== paidSponsor) : [];
  };

  // remove_from_cart — the CartManager is the choke point for removals (the
  // drawer and the host's removeItem() alike) and dispatches it on document.
  // The SDK's own listener is off here (autoTrack:false), so we forward it.
  const onRemoved = (e: Event) => {
    const d = (e as CustomEvent).detail ?? {};
    if (d.productId == null) return;
    const qty = num(d.quantity) ?? 1;
    const price = num(d.price);
    trackEvent("remove_from_cart", {
      currency: d.currency,
      value: (price ?? 0) * qty,
      sponsorId: num(d.sponsorId),
      items: [
        {
          productId: d.productId,
          name: d.name,
          brand: d.brand,
          price,
          currency: d.currency,
          quantity: qty,
          variantId: d.variantId,
        },
      ],
      ...attributionOf(d),
    });
  };

  // sdk_error — a cart sync failure (vio:cart-error). Without it "the cart
  // broke" and "the reader left" look the same in the funnel.
  const onCartError = (e: Event) => {
    const d = (e as CustomEvent).detail ?? {};
    trackEvent("sdk_error", {
      error_code: "cart_error",
      ...(d.message ? { message: String(d.message).slice(0, 500) } : {}),
    });
  };

  document.addEventListener("vio:added-to-cart", onAdded);
  document.addEventListener("vio:removed-from-cart", onRemoved);
  document.addEventListener("vio:cart-error", onCartError);
  document.addEventListener("vio:checkout-open", onCheckoutOpen);
  document.addEventListener("vio:open-cart", onOpenCart);
  document.addEventListener("vio:payment-success", onPaymentSuccess);

  const cleanup = () => {
    Vio.cart?.removeEventListener?.("change", onCartChange);
    document.removeEventListener("vio:added-to-cart", onAdded);
    document.removeEventListener("vio:removed-from-cart", onRemoved);
    document.removeEventListener("vio:cart-error", onCartError);
    document.removeEventListener("vio:checkout-open", onCheckoutOpen);
    document.removeEventListener("vio:open-cart", onOpenCart);
    document.removeEventListener("vio:payment-success", onPaymentSuccess);
    g[INIT_FLAG] = null;
  };
  g[INIT_FLAG] = cleanup;
  return cleanup;
}

/**
 * Impresión REAL de un componente de Vio (≥50% visible durante ≥1s, una vez
 * por sesión) — la regla del contrato, idéntica en web, iOS, Android y TV.
 *
 * Por qué existe (2026-09-14): el KPI "Shoppable views" del dashboard de
 * commerce cuenta `component_impression`, pero Vev solo emitía
 * `view_item_list`, que se dispara al RENDERIZAR la lista — aunque nunca
 * entre en pantalla. Sumarlos inflaría el número; hay que medir lo que de
 * verdad se vio.
 *
 * La unidad es el componente TAL COMO SE COLOCÓ en la página: una grilla
 * cuenta una vez, un carrusel una vez, una tarjeta suelta una vez. Nunca la
 * tarjeta cuando vive adentro de una grilla o carrusel (sería doble conteo).
 *
 * Respeta el toggle "Send to Vio Analytics" del editor: si está apagado, no
 * se observa nada. Devuelve la función de limpieza para el useEffect.
 */
export function observeVioImpression(
  el: Element | null,
  context: {
    sponsorId?: number;
    componentTemplateId: string;
    locationId?: string;
    /** `vioAttribution(slot, sponsor)` of the block: the slot IS the location id (ADR-0034). */
    slot?: string;
    campaignId?: number;
    contentId?: string;
    contentTitle?: string;
  },
  key: string,
): () => void {
  if (!el || !state.enabled || !state.sendToVio) return () => {};
  const a = (Vio as any).analytics;
  if (typeof a?.observeImpression !== "function") return () => {};
  const sid = num(context.sponsorId);
  try {
    return a.observeImpression(
      el,
      {
        sponsorId: sid ?? undefined,
        componentTemplateId: context.componentTemplateId,
        locationId: context.slot || context.locationId || undefined,
        slot: context.slot || undefined,
        campaignId: num(context.campaignId),
        contentId: context.contentId || undefined,
        contentTitle: context.contentTitle || undefined,
      },
      { key },
    );
  } catch {
    return () => {}; // la analítica nunca rompe la página
  }
}
