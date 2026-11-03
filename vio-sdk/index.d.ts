/**
 * The SDK facade (vio-web-sdk 0.37.6; this header lists what Vev uses, added in 0.25.0). Beyond init / bootstrap / cart /
 * checkout / analytics, the slot and page-campaign API of ADR-0027 / ADR-0034
 * (amendment 3) the blocks use:
 *   init({ apiKey, environment?, platform?, contentId?, contentTitle?, campaignId?, debug?, … })
 *     — `campaignId`: the page's campaign, the fallback of every slot without a
 *     dashboard assignment (assignment > page campaign > default), carried by
 *     the page's declaration; `debug`: console.debug of the slot decisions.
 *   registerSlot(id, displayName?, { kind?, campaignId? } | campaignId?) → release()   (0.25.0: kind goes to the manifest)
 *   declareSlots(slots, { force? }) → { …, locations[].assignment: 'created'|'kept'|'replaced'|'dashboard'|'none' }
 *   pageCampaign() → BootstrapCampaignEntry | null   (the init's campaign when the key has it active)
 *   campaignForSlot(slot?, { campaignId?, sponsorId? }?) → BootstrapCampaignEntry | null
 *   attribution(slot?, { sponsorId?, campaignId? }?) → { slot?, campaignId?, sponsorId?, contentId?, contentTitle? }
 *     — with `sponsorId` the campaign follows assignment > page campaign > the
 *     sponsor's active campaign > default; `campaignId` overrides the init's page campaign.
 *   content() → { id?, title? }   (title: init contentTitle → ?vio_content_title= →
 *     <meta name="vio:content-title"> → og:title → document.title, resolved live)
 *   cartSlices(sponsorId?, { items? }?) → [{ campaignId?, sponsorId?, slot?, contentId?, items, value, currency?, slice, slices }]
 * Page scope (0.25.0): an SDK element's auto slot id is `${scope}-${kind}-${n}`,
 * the scope being its `vio-scope` property / attribute, else the nearest
 * ancestor's `data-vio-scope` (`data-vio-scope-name` labels it) — what Vio
 * Config sets on <body> for the page (declareVevPage in vio-helpers.ts).
 * Cart: addProduct / addManual / adjustQuantity / updateQuantity take
 * `{ origin?: { campaignId?, slot?, contentId? } }`; each line keeps
 * `origins: [{ campaignId?, slot?, contentId?, quantity }]`.
 */
export const Vio: any;
export const VioProduct: any;
export const VioProductCarousel: any;
export const VioProductDetail: any;
export const VioCart: any;
export const VioCheckout: any;
export const CartManager: any;
export const CheckoutManager: any;
export const Configuration: any;

export function registerVioElements(): void;
export function primaryImageUrl(product: any): string | undefined;

/** Mirrors `purchaseFromPaymentSuccess` in vio-web-sdk/src/core/analytics/
 *  analytics-manager.ts (0.25.0): the Vio order id of a `vio:payment-success`
 *  detail (redirect `orderId` → Apple Pay `result.confirmation.orderId` →
 *  `checkoutId`), never a provider's reference — and the buyer reference the
 *  detail carries (`buyerRef` from the SDK's checkout, `buyer_ref` from a
 *  host): shopcart's keyed hash of the email, kept only when it is one
 *  (`buyerRefOf`), never an email. `{}` when there is neither. */
export function purchaseFromPaymentSuccess(detail: {
  method?: string;
  sponsorId?: number | string;
  orderId?: string | number;
  checkoutId?: string | number;
  buyerRef?: string | null;
  buyer_ref?: string | null;
  result?: { confirmation?: { orderId?: string | number | null; status?: string } | null; [key: string]: unknown } | null;
}): { orderId?: string; checkoutId?: string; buyerId?: string };

export const CREATE_CART_MUTATION: string;
export const ADD_ITEM_MUTATION: string;
export const DELETE_ITEM_MUTATION: string;
export const UPDATE_ITEM_MUTATION: string;
export const GET_CART_QUERY: string;
export const GET_LINE_ITEMS_BY_SUPPLIER_QUERY: string;
export const UPDATE_SHIPPINGS_BY_SUPPLIER_MUTATION: string;
export const CREATE_CHECKOUT_MUTATION: string;
export const UPDATE_CHECKOUT_MUTATION: string;
export const GET_CHECKOUT_QUERY: string;
export const GET_AVAILABLE_PAYMENT_METHODS_QUERY: string;
export const CREATE_PAYMENT_STRIPE_MUTATION: string;
export const CREATE_PAYMENT_VIPPS_MUTATION: string;

export function createCart(customerSessionId: string, currency: string, shippingCountry?: string | null, options?: any): Promise<any>;
export function addItem(cartId: string, lineItems: any[], options?: any): Promise<any>;
export function deleteItem(cartId: string, cartItemId: string, options?: any): Promise<any>;
export function updateItem(cartId: string, cartItemId: string, shippingId?: string | null, qty?: number | null, options?: any): Promise<any>;
export function getCart(cartId: string, options?: any): Promise<any>;
export function getLineItemsBySupplier(cartId: string, options?: any): Promise<any>;
export function updateShippingsBySupplier(cartId: string, data: any[], options?: any): Promise<any>;
export function createCheckout(cartId: string, options?: any): Promise<any>;
export function updateCheckout(variables: any, options?: any): Promise<any>;
export function getCheckout(checkoutId: string, options?: any): Promise<any>;
export function getAvailablePaymentMethods(options?: any): Promise<any>;
export function createPaymentStripe(variables: any, options?: any): Promise<any>;
export function createPaymentVipps(variables: any, options?: any): Promise<any>;
export function getVippsStatus(variables: any, options?: any): Promise<any>;

export const SDK_VERSION: string;
export const VioTokens: any;

/** Mirrors VioThemeOverrides in vio-web-sdk/src/ui/tokens.ts. Typed on purpose:
 *  a mistyped key here is silently ignored at runtime, so let tsc catch it. */
export interface VioThemeOverrides {
  colorText?: string;
  colorTextSecondary?: string;
  colorTextTertiary?: string;
  colorTextOnPrimary?: string;
  colorAccent?: string;
  colorSurface?: string;
  colorSurfaceMuted?: string;
  colorSurfaceHover?: string;
  colorBorder?: string;
  colorBorderDefault?: string;
  fontSerif?: string;
  fontSans?: string;
  radiusSm?: string;
  radiusMd?: string;
  radiusLg?: string;
  radiusXl?: string;
  spaceSm?: string;
  spaceMd?: string;
  spaceLg?: string;
  spaceXl?: string;
}
export function applyVioTheme(overrides: VioThemeOverrides, target?: any): void;

export function ensureVippsButton(timeoutMs?: number): Promise<boolean>;
export function vippsButtonAttributes(verb?: string, opts?: Record<string, any>): Record<string, string>;
