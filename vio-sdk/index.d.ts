/**
 * The SDK facade (vio-web-sdk 0.23.1). Beyond init / bootstrap / cart /
 * checkout / analytics, the slot API of ADR-0027 / ADR-0034 the blocks use:
 *   registerSlot(id, displayName?) → release()   campaignForSlot(slot?)
 *   attribution(slot?, { sponsorId? }) → { slot?, campaignId?, sponsorId?, contentId?, contentTitle? }
 *   content() → { id?, title? }                   declareSlots(slots, { force? })
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
 *  analytics-manager.ts: the Vio order id of a `vio:payment-success` detail
 *  (redirect `orderId` → Apple Pay `result.confirmation.orderId` →
 *  `checkoutId`), never a provider's reference. `{}` when there is none. */
export function purchaseFromPaymentSuccess(detail: {
  method?: string;
  sponsorId?: number | string;
  orderId?: string | number;
  checkoutId?: string | number;
  result?: { confirmation?: { orderId?: string | number | null; status?: string } | null; [key: string]: unknown } | null;
}): { orderId?: string };

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
