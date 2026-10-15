import { currentSponsorConfig, getPersistedSponsorId } from "./vio-helpers";
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

/** Diagnostics (contract v1) go to the Vio pipeline and the inspector, not
 * to the publisher's GA4: they are not e-commerce events. */
const DIAGNOSTIC_EVENT_NAMES = new Set(["sdk_error", "checkout_error"]);

/** The single choke point every tracked event goes through. */
export function trackEvent(name: string, params: EventParams = {}): void {
  if (!state.enabled) return;

  const { currency, value, items, item_list_name, transaction_id, payment_type, sponsorId, ...rest } =
    params;
  const ecommerce: Record<string, unknown> = { ...rest };
  if (currency) ecommerce.currency = currency;
  if (value != null) ecommerce.value = Math.round(value * 100) / 100;
  if (transaction_id) ecommerce.transaction_id = transaction_id;
  if (payment_type) ecommerce.payment_type = payment_type;
  if (item_list_name) ecommerce.item_list_name = item_list_name;
  if (items && items.length) ecommerce.items = items.map(toGa4Item);

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

function forwardToVio(name: string, params: EventParams): void {
  if (!VIO_EVENT_NAMES.has(name)) return;
  const analytics = (Vio as any).analytics;
  if (!analytics?.track) return; // vendored SDK predates Vio.analytics
  const {
    currency, value, items, item_list_name, transaction_id, payment_type, sponsorId, error_code,
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
      // equivocado es peor que no atribuir. El SDK deriva campaign_id del
      // sponsor (la campaña activa en la que participa).
      context: (() => {
        const sid = num(sponsorId) ?? soleCartSponsor() ?? persistedSponsorIfKnown();
        return sid || errorCode ? { sponsorId: sid || undefined, errorCode } : undefined;
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
      sponsorId: num(d.sponsorId) ?? soleCartSponsor(),
      items,
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
      sponsorId: num(d.sponsorId) ?? lastCartSponsor,
      items,
    });
    lastCartSnapshot = [];
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
  context: { sponsorId?: number; componentTemplateId: string; locationId?: string },
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
        locationId: context.locationId || undefined,
      },
      { key },
    );
  } catch {
    return () => {}; // la analítica nunca rompe la página
  }
}
