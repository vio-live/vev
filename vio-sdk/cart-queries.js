// GraphQL Queries and Mutations for VIO Cart & Checkout Services

export const CREATE_CART_MUTATION = `
mutation CreateCart($customerSessionId: String!, $currency: String!, $shippingCountry: String) {
  Cart {
    CreateCart(customer_session_id: $customerSessionId, currency: $currency, shipping_country: $shippingCountry) {
      cart_id
      customer_session_id
      shipping_country
      line_items {
        id
        supplier
        image {
          id
          url
          width
          height
        }
        sku
        barcode
        brand
        product_id
        title
        variant_id
        variant_title
        variant {
          option
          value
        }
        quantity
        price {
          amount
          currency_code
          discount
          compare_at
          compare_at_incl_taxes
          amount_incl_taxes
          tax_amount
          tax_rate
        }
        shipping {
          id
          name
          description
          price {
            amount
            currency_code
            amount_incl_taxes
            tax_amount
            tax_rate
          }
        }
        available_shippings {
          id
          name
          description
          country_code
          price {
            amount
            currency_code
            amount_incl_taxes
            tax_amount
            tax_rate
          }
        }
      }
      subtotal
      shipping
      currency
      available_shipping_countries
    }
  }
}
`;

export const ADD_ITEM_MUTATION = `
mutation AddItem($cartId: String!, $lineItems: [LineItemInput!]!) {
  Cart {
    AddItem(cart_id: $cartId, line_items: $lineItems) {
      cart_id
      customer_session_id
      shipping_country
      line_items {
        id
        supplier
        image {
          id
          url
          width
          height
        }
        sku
        barcode
        brand
        product_id
        title
        variant_id
        variant_title
        variant {
          option
          value
        }
        quantity
        price {
          amount
          currency_code
          discount
          compare_at
          compare_at_incl_taxes
          amount_incl_taxes
          tax_amount
          tax_rate
        }
        shipping {
          id
          name
          description
          price {
            amount
            currency_code
            amount_incl_taxes
            tax_amount
            tax_rate
          }
        }
        available_shippings {
          id
          name
          description
          country_code
          price {
            amount
            currency_code
            amount_incl_taxes
            tax_amount
            tax_rate
          }
        }
      }
      subtotal
      shipping
      currency
      available_shipping_countries
    }
  }
}
`;

export const DELETE_ITEM_MUTATION = `
mutation DeleteItem($cartId: String!, $cartItemId: String!) {
  Cart {
    DeleteItem(cart_id: $cartId, cart_item_id: $cartItemId) {
      cart_id
      customer_session_id
      shipping_country
      line_items {
        id
        supplier
        image {
          id
          url
          width
          height
        }
        sku
        barcode
        brand
        product_id
        title
        variant_id
        variant_title
        variant {
          option
          value
        }
        quantity
        price {
          amount
          currency_code
          discount
          compare_at
          compare_at_incl_taxes
          amount_incl_taxes
          tax_amount
          tax_rate
        }
        shipping {
          id
          name
          description
          price {
            amount
            currency_code
            amount_incl_taxes
            tax_amount
            tax_rate
          }
        }
        available_shippings {
          id
          name
          description
          country_code
          price {
            amount
            currency_code
            amount_incl_taxes
            tax_amount
            tax_rate
          }
        }
      }
      subtotal
      shipping
      currency
      available_shipping_countries
    }
  }
}
`;

export const UPDATE_ITEM_MUTATION = `
mutation UpdateItem($cartId: String!, $cartItemId: String!, $shippingId: String, $qty: Int) {
  Cart {
    UpdateItem(cart_id: $cartId, cart_item_id: $cartItemId, shipping_id: $shippingId, qty: $qty) {
      cart_id
      customer_session_id
      shipping_country
      line_items {
        id
        supplier
        image {
          id
          url
          width
          height
        }
        sku
        barcode
        brand
        product_id
        title
        variant_id
        variant_title
        variant {
          option
          value
        }
        quantity
        price {
          amount
          currency_code
          discount
          compare_at
          compare_at_incl_taxes
          amount_incl_taxes
          tax_amount
          tax_rate
        }
        shipping {
          id
          name
          description
          price {
            amount
            currency_code
            amount_incl_taxes
            tax_amount
            tax_rate
          }
        }
        available_shippings {
          id
          name
          description
          country_code
          price {
            amount
            currency_code
            amount_incl_taxes
            tax_amount
            tax_rate
          }
        }
      }
      subtotal
      shipping
      currency
      available_shipping_countries
    }
  }
}
`;

export const GET_CART_QUERY = `
query GetCart($cartId: String!) {
  Cart {
    GetCart(cart_id: $cartId) {
      cart_id
      customer_session_id
      shipping_country
      line_items {
        id
        supplier
        image {
          id
          url
          width
          height
        }
        sku
        barcode
        brand
        product_id
        title
        variant_id
        variant_title
        variant {
          option
          value
        }
        quantity
        price {
          amount
          currency_code
          discount
          compare_at
          compare_at_incl_taxes
          amount_incl_taxes
          tax_amount
          tax_rate
        }
        shipping {
          id
          name
          description
          price {
            amount
            currency_code
            amount_incl_taxes
            tax_amount
            tax_rate
          }
        }
        available_shippings {
          id
          name
          description
          country_code
          price {
            amount
            currency_code
            amount_incl_taxes
            tax_amount
            tax_rate
          }
        }
      }
      subtotal
      shipping
      currency
      available_shipping_countries
    }
  }
}
`;

export const GET_LINE_ITEMS_BY_SUPPLIER_QUERY = `
query GetLineItemsBySupplier($cartId: String!) {
  Cart {
    GetLineItemsBySupplier(cart_id: $cartId) {
      supplier {
        id
        name
      }
      available_shippings {
        id
        name
        description
        country_code
        price {
          amount
          currency_code
          amount_incl_taxes
          tax_amount
          tax_rate
        }
      }
      line_items {
        id
        supplier
        image {
          id
          url
          width
          height
        }
        sku
        barcode
        brand
        product_id
        title
        variant_id
        variant_title
        variant {
          option
          value
        }
        quantity
        price {
          amount
          currency_code
          discount
          compare_at
          compare_at_incl_taxes
          amount_incl_taxes
          tax_amount
          tax_rate
        }
        shipping {
          id
          name
          description
          price {
            amount
            currency_code
            amount_incl_taxes
            tax_amount
            tax_rate
          }
        }
      }
    }
  }
}
`;

export const UPDATE_SHIPPINGS_BY_SUPPLIER_MUTATION = `
mutation UpdateShippingsBySupplier($cartId: String!, $data: [DataUpdateShippingsBySupplier!]!) {
  Cart {
    UpdateShippingsBySupplier(cart_id: $cartId, data: $data) {
      cart_id
      customer_session_id
      shipping_country
      line_items {
        id
        supplier
        image {
          id
          url
          width
          height
        }
        sku
        barcode
        brand
        product_id
        title
        variant_id
        variant_title
        variant {
          option
          value
        }
        quantity
        price {
          amount
          currency_code
          discount
          compare_at
          compare_at_incl_taxes
          amount_incl_taxes
          tax_amount
          tax_rate
        }
        shipping {
          id
          name
          description
          price {
            amount
            currency_code
            amount_incl_taxes
            tax_amount
            tax_rate
          }
        }
        available_shippings {
          id
          name
          description
          country_code
          price {
            amount
            currency_code
            amount_incl_taxes
            tax_amount
            tax_rate
          }
        }
      }
      subtotal
      shipping
      currency
      available_shipping_countries
    }
  }
}
`;

export const CREATE_CHECKOUT_MUTATION = `
mutation CreateCheckout($cartId: String!) {
  Checkout {
    CreateCheckout(cart_id: $cartId) {
      buyer_accepts_purchase_conditions
      buyer_accepts_terms_conditions
      created_at
      updated_at
      id
      deleted_at
      success_url
      cancel_url
      payment_method
      email
      status
      checkout_url
      origin_payment_id
      billing_address {
        id
        first_name
        last_name
        phone_code
        phone
        company
        address1
        address2
        city
        province
        province_code
        country
        country_code
        zip
      }
      shipping_address {
        id
        first_name
        last_name
        phone_code
        phone
        company
        address1
        address2
        city
        province
        province_code
        country
        country_code
        zip
      }
      available_payment_methods {
        name
      }
      discount_code
      cart {
        cart_id
        customer_session_id
        shipping_country
        line_items {
          id
          supplier
          image {
            id
            url
            width
            height
          }
          sku
          barcode
          brand
          product_id
          title
          variant_id
          variant_title
          variant {
            option
            value
          }
          quantity
          price {
            amount
            currency_code
            discount
            compare_at
            compare_at_incl_taxes
            amount_incl_taxes
            tax_amount
            tax_rate
          }
          shipping {
            id
            name
            description
            price {
              amount
              currency_code
              amount_incl_taxes
              tax_amount
              tax_rate
            }
          }
          available_shippings {
            id
            name
            description
            country_code
            price {
              amount
              currency_code
              amount_incl_taxes
              tax_amount
              tax_rate
            }
          }
        }
        subtotal
        shipping
        currency
        available_shipping_countries
      }
      totals {
        currency_code
        subtotal
        shipping
        total
        taxes
        tax_rate
        discounts
      }
    }
  }
}
`;

export const UPDATE_CHECKOUT_MUTATION = `
mutation UpdateCheckout($checkoutId: String!, $status: String, $successUrl: String, $email: String, $cancelUrl: String, $paymentMethod: String, $shippingAddress: AddressArgs, $billingAddress: AddressArgs, $buyerAcceptsPurchaseConditions: Boolean, $buyerAcceptsTermsConditions: Boolean) {
  Checkout {
    UpdateCheckout(checkout_id: $checkoutId, status: $status, success_url: $successUrl, email: $email, cancel_url: $cancelUrl, payment_method: $paymentMethod, shipping_address: $shippingAddress, billing_address: $billingAddress, buyer_accepts_purchase_conditions: $buyerAcceptsPurchaseConditions, buyer_accepts_terms_conditions: $buyerAcceptsTermsConditions) {
      buyer_accepts_purchase_conditions
      buyer_accepts_terms_conditions
      created_at
      updated_at
      id
      deleted_at
      success_url
      cancel_url
      payment_method
      email
      status
      checkout_url
      origin_payment_id
      billing_address {
        id
        first_name
        last_name
        phone_code
        phone
        company
        address1
        address2
        city
        province
        province_code
        country
        country_code
        zip
      }
      shipping_address {
        id
        first_name
        last_name
        phone_code
        phone
        company
        address1
        address2
        city
        province
        province_code
        country
        country_code
        zip
      }
      available_payment_methods {
        name
      }
      discount_code
      cart {
        cart_id
        customer_session_id
        shipping_country
        line_items {
          id
          supplier
          image {
            id
            url
            width
            height
          }
          sku
          barcode
          brand
          product_id
          title
          variant_id
          variant_title
          variant {
            option
            value
          }
          quantity
          price {
            amount
            currency_code
            discount
            compare_at
            compare_at_incl_taxes
            amount_incl_taxes
            tax_amount
            tax_rate
          }
          shipping {
            id
            name
            description
            price {
              amount
              currency_code
              amount_incl_taxes
              tax_amount
              tax_rate
            }
          }
          available_shippings {
            id
            name
            description
            country_code
            price {
              amount
              currency_code
              amount_incl_taxes
              tax_amount
              tax_rate
            }
          }
        }
        subtotal
        shipping
        currency
        available_shipping_countries
      }
      totals {
        currency_code
        subtotal
        shipping
        total
        taxes
        tax_rate
        discounts
      }
    }
  }
}
`;

export const GET_CHECKOUT_QUERY = `
query GetCheckout($checkoutId: String!) {
  Checkout {
    GetCheckout(checkout_id: $checkoutId) {
      buyer_accepts_purchase_conditions
      buyer_accepts_terms_conditions
      created_at
      updated_at
      id
      deleted_at
      success_url
      cancel_url
      payment_method
      email
      status
      checkout_url
      origin_payment_id
      billing_address {
        id
        first_name
        last_name
        phone_code
        phone
        company
        address1
        address2
        city
        province
        province_code
        country
        country_code
        zip
      }
      shipping_address {
        id
        first_name
        last_name
        phone_code
        phone
        company
        address1
        address2
        city
        province
        province_code
        country
        country_code
        zip
      }
      available_payment_methods {
        name
      }
      discount_code
      cart {
        cart_id
        customer_session_id
        shipping_country
        line_items {
          id
          supplier
          image {
            id
            url
            width
            height
          }
          sku
          barcode
          brand
          product_id
          title
          variant_id
          variant_title
          variant {
            option
            value
          }
          quantity
          price {
            amount
            currency_code
            discount
            compare_at
            compare_at_incl_taxes
            amount_incl_taxes
            tax_amount
            tax_rate
          }
          shipping {
            id
            name
            description
            price {
              amount
              currency_code
              amount_incl_taxes
              tax_amount
              tax_rate
            }
          }
          available_shippings {
            id
            name
            description
            country_code
            price {
              amount
              currency_code
              amount_incl_taxes
              tax_amount
              tax_rate
            }
          }
        }
        subtotal
        shipping
        currency
        available_shipping_countries
      }
      totals {
        currency_code
        subtotal
        shipping
        total
        taxes
        tax_rate
        discounts
      }
    }
  }
}
`;

export const GET_AVAILABLE_PAYMENT_METHODS_QUERY = `
query Config {
  Payment {
    GetAvailablePaymentMethods {
      config {
        name
        type
        value
      }
      name
    }
  }
}
`;

/** Helper function to execute GraphQL queries/mutations against the configured endpoint */
export async function executeCartGraphQL(query, variables, options = {}) {
  const { endpoint = "https://graph-ql-dev.vio.live", apiKey, commerceKey } = options;

  const headers = {
    "Content-Type": "application/json"
  };

  if (apiKey) {
    headers["X-API-Key"] = apiKey;
  }
  if (commerceKey || apiKey) {
    headers["Authorization"] = commerceKey || apiKey;
  }

  const res = await fetch(endpoint, {
    method: "POST",
    headers,
    body: JSON.stringify({ query, variables })
  });

  const json = await res.json().catch(() => ({}));
  if (!res.ok || json.errors) {
    const errMsg = json.errors?.[0]?.message || `GraphQL request failed (HTTP ${res.status})`;
    throw new Error(errMsg);
  }
  return json;
}

export async function createCart(customerSessionId, currency, shippingCountry, options) {
  const json = await executeCartGraphQL(
    CREATE_CART_MUTATION,
    { customerSessionId, currency, shippingCountry: shippingCountry || null },
    options
  );
  return json?.data?.Cart?.CreateCart;
}

export async function addItem(cartId, lineItems, options) {
  const json = await executeCartGraphQL(
    ADD_ITEM_MUTATION,
    { cartId, lineItems },
    options
  );
  return json?.data?.Cart?.AddItem;
}

export async function deleteItem(cartId, cartItemId, options) {
  const json = await executeCartGraphQL(
    DELETE_ITEM_MUTATION,
    { cartId, cartItemId },
    options
  );
  return json?.data?.Cart?.DeleteItem;
}

export async function updateItem(cartId, cartItemId, shippingId, qty, options) {
  const json = await executeCartGraphQL(
    UPDATE_ITEM_MUTATION,
    { cartId, cartItemId, shippingId: shippingId || null, qty: qty != null ? qty : null },
    options
  );
  return json?.data?.Cart?.UpdateItem;
}

export async function getCart(cartId, options) {
  const json = await executeCartGraphQL(
    GET_CART_QUERY,
    { cartId },
    options
  );
  return json?.data?.Cart?.GetCart;
}

export async function getLineItemsBySupplier(cartId, options) {
  const json = await executeCartGraphQL(
    GET_LINE_ITEMS_BY_SUPPLIER_QUERY,
    { cartId },
    options
  );
  return json?.data?.Cart?.GetLineItemsBySupplier;
}

export async function updateShippingsBySupplier(cartId, data, options) {
  const json = await executeCartGraphQL(
    UPDATE_SHIPPINGS_BY_SUPPLIER_MUTATION,
    { cartId, data },
    options
  );
  return json?.data?.Cart?.UpdateShippingsBySupplier;
}

export async function createCheckout(cartId, options) {
  const json = await executeCartGraphQL(
    CREATE_CHECKOUT_MUTATION,
    { cartId },
    options
  );
  return json?.data?.Checkout?.CreateCheckout;
}

export async function updateCheckout(variables, options) {
  const json = await executeCartGraphQL(
    UPDATE_CHECKOUT_MUTATION,
    variables,
    options
  );
  return json?.data?.Checkout?.UpdateCheckout;
}

export async function getCheckout(checkoutId, options) {
  const json = await executeCartGraphQL(
    GET_CHECKOUT_QUERY,
    { checkoutId },
    options
  );
  return json?.data?.Checkout?.GetCheckout;
}

export const CREATE_PAYMENT_STRIPE_MUTATION = `
mutation CreatePaymentStripe($checkoutId: String!, $successUrl: String!, $paymentMethod: String!, $email: String!) {
  Payment {
    CreatePaymentStripe(checkout_id: $checkoutId, success_url: $successUrl, payment_method: $paymentMethod, email: $email) {
      order_id
      checkout_url
    }
  }
}
`;

export async function getAvailablePaymentMethods(options) {
  const json = await executeCartGraphQL(
    GET_AVAILABLE_PAYMENT_METHODS_QUERY,
    {},
    options
  );
  return json?.data?.Payment?.GetAvailablePaymentMethods;
}

export async function createPaymentStripe(variables, options) {
  const json = await executeCartGraphQL(
    CREATE_PAYMENT_STRIPE_MUTATION,
    variables,
    options
  );
  return json?.data?.Payment?.CreatePaymentStripe;
}

export const CREATE_PAYMENT_VIPPS_MUTATION = `
mutation CreatePaymentVipps($checkoutId: String!, $email: String!, $returnUrl: String!) {
  Payment {
    CreatePaymentVipps(checkout_id: $checkoutId, email: $email, return_url: $returnUrl) {
      payment_url
    }
  }
}
`;

export async function createPaymentVipps(variables, options) {
  const json = await executeCartGraphQL(
    CREATE_PAYMENT_VIPPS_MUTATION,
    variables,
    options
  );
  return json?.data?.Payment?.CreatePaymentVipps;
}
