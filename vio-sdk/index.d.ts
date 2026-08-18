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

export const VioTokens: any;
export function applyVioTheme(overrides: any, target?: any): void;
