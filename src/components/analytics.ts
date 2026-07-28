import { Vio } from "../../vio-sdk";

/**
 * Vio Vev — commerce analytics. Turns the shoppable funnel into GA4 e-commerce
 * events, so the publisher (VG) can measure ROI from a shoppable article. This is
 * the argument for the publisher: view_item_list → select_item → view_item →
 * add_to_cart → begin_checkout → purchase, all in their own GTM/GA4.
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

type AnalyticsState = { enabled: boolean; debug: boolean };
const state: AnalyticsState = { enabled: false, debug: false };

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
    price: num(p?.price?.amount),
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

const LOG_KEY = "__vioAnalyticsLog";
function ringLog(entry: unknown): void {
  if (typeof window === "undefined") return;
  const w = window as any;
  const log: unknown[] = (w[LOG_KEY] = w[LOG_KEY] || []);
  log.push(entry);
  if (log.length > 50) log.shift();
}

/** The single choke point every tracked event goes through. */
export function trackEvent(name: string, params: EventParams = {}): void {
  if (!state.enabled) return;

  const { currency, value, items, item_list_name, transaction_id, payment_type, ...rest } = params;
  const ecommerce: Record<string, unknown> = { ...rest };
  if (currency) ecommerce.currency = currency;
  if (value != null) ecommerce.value = Math.round(value * 100) / 100;
  if (transaction_id) ecommerce.transaction_id = transaction_id;
  if (payment_type) ecommerce.payment_type = payment_type;
  if (item_list_name) ecommerce.item_list_name = item_list_name;
  if (items && items.length) ecommerce.items = items.map(toGa4Item);

  pushDataLayer(name, ecommerce);

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
// High-level events (call sites use these)
// ---------------------------------------------------------------------------

function currencyOf(items: VioItemInput[]): string | undefined {
  return items.find((i) => i.currency)?.currency;
}

function sumValue(items: VioItemInput[]): number {
  return items.reduce((acc, i) => acc + (i.price ?? 0) * (i.quantity ?? 1), 0);
}

/** Impression: a set of product cards rendered (carousel / grid / single card). */
export function trackViewItemList(items: VioItemInput[], listName?: string): void {
  if (!items.length) return;
  const withIndex = items.map((i, idx) => ({ ...i, index: i.index ?? idx, listName }));
  trackEvent("view_item_list", {
    currency: currencyOf(items),
    item_list_name: listName,
    items: withIndex,
  });
}

/** A shoppable card was clicked (before the detail opens). */
export function trackSelectItem(item: VioItemInput, listName?: string): void {
  trackEvent("select_item", {
    currency: item.currency,
    item_list_name: listName,
    items: [{ ...item, listName }],
  });
}

/** The product detail was opened for a product. */
export function trackViewItem(item: VioItemInput): void {
  trackEvent("view_item", {
    currency: item.currency,
    value: item.price,
    items: [item],
  });
}

/** A product was added to the cart. */
export function trackAddToCart(item: VioItemInput): void {
  const qty = item.quantity ?? 1;
  trackEvent("add_to_cart", {
    currency: item.currency,
    value: (item.price ?? 0) * qty,
    items: [{ ...item, quantity: qty }],
  });
}

// ---------------------------------------------------------------------------
// Cart access (for the SDK-internal signals: add-from-detail, checkout, purchase)
// ---------------------------------------------------------------------------

/** Every line across every sponsor cart, as analytics items. */
function cartToItems(sponsorId?: number): VioItemInput[] {
  const out: VioItemInput[] = [];
  const carts = Vio.cart?.getAllCarts?.();
  if (!carts) return out;
  const sid = num(sponsorId);
  for (const cart of carts.values?.() ?? []) {
    if (sid != null && sid > 0 && (cart as any).sponsorId !== sid) continue;
    for (const it of (cart as any).items ?? []) {
      out.push({
        productId: it.productId,
        name: it.name,
        brand: it.brand,
        price: num(it.unitPrice),
        currency: it.currency,
        quantity: num(it.quantity) ?? 1,
        variantId: it.variantId,
      });
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

  // Keep the last non-empty cart snapshot — the cart is cleared the instant a
  // payment succeeds, so `purchase` needs what was there just before.
  let lastCartSnapshot: VioItemInput[] = [];
  const onCartChange = () => {
    const items = cartToItems();
    if (items.length) lastCartSnapshot = items;
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
    trackAddToCart({ ...item, quantity: num(d.quantity) ?? item.quantity ?? 1 });
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
      items,
    });
  };

  // view_cart — the cart drawer was opened.
  const onOpenCart = () => {
    const items = cartToItems();
    trackEvent("view_cart", {
      currency: currencyOf(items),
      value: sumValue(items),
      items,
    });
  };

  // purchase — payment succeeded. Use the pre-clear snapshot for items/value and
  // the event result for the order id / charged total when present.
  const onPaymentSuccess = (e: Event) => {
    const d = (e as CustomEvent).detail ?? {};
    const result = d.result ?? {};
    const items = lastCartSnapshot;
    const value = num(result.total) ?? sumValue(items);
    trackEvent("purchase", {
      currency: currencyOf(items),
      value,
      transaction_id: result.orderId ?? result.order?.orderId,
      payment_type: d.method,
      items,
    });
    lastCartSnapshot = [];
  };

  document.addEventListener("vio:added-to-cart", onAdded);
  document.addEventListener("vio:checkout-open", onCheckoutOpen);
  document.addEventListener("vio:open-cart", onOpenCart);
  document.addEventListener("vio:payment-success", onPaymentSuccess);

  const cleanup = () => {
    Vio.cart?.removeEventListener?.("change", onCartChange);
    document.removeEventListener("vio:added-to-cart", onAdded);
    document.removeEventListener("vio:checkout-open", onCheckoutOpen);
    document.removeEventListener("vio:open-cart", onOpenCart);
    document.removeEventListener("vio:payment-success", onPaymentSuccess);
    g[INIT_FLAG] = null;
  };
  g[INIT_FLAG] = cleanup;
  return cleanup;
}
