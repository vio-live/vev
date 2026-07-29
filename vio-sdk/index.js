import {
  createCart as gqlCreateCart,
  addItem as gqlAddItem,
  deleteItem as gqlDeleteItem,
  updateItem as gqlUpdateItem,
  getCart as gqlGetCart,
  getLineItemsBySupplier as gqlGetLineItemsBySupplier,
  updateShippingsBySupplier as gqlUpdateShippingsBySupplier,
  createCheckout as gqlCreateCheckout,
  updateCheckout as gqlUpdateCheckout,
  getCheckout as gqlGetCheckout,
  getAvailablePaymentMethods as gqlGetAvailablePaymentMethods,
  createPaymentStripe as gqlCreatePaymentStripe,
  createPaymentVipps as gqlCreatePaymentVipps,
  CREATE_CART_MUTATION,
  ADD_ITEM_MUTATION,
  DELETE_ITEM_MUTATION,
  UPDATE_ITEM_MUTATION,
  GET_CART_QUERY,
  GET_LINE_ITEMS_BY_SUPPLIER_QUERY,
  UPDATE_SHIPPINGS_BY_SUPPLIER_MUTATION,
  CREATE_CHECKOUT_MUTATION,
  UPDATE_CHECKOUT_MUTATION,
  GET_CHECKOUT_QUERY,
  GET_AVAILABLE_PAYMENT_METHODS_QUERY,
  CREATE_PAYMENT_STRIPE_MUTATION,
  CREATE_PAYMENT_VIPPS_MUTATION
} from "./cart-queries.js";

var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __decorateClass = (decorators, target, key, kind) => {
  var result = kind > 1 ? void 0 : kind ? __getOwnPropDesc(target, key) : target;
  for (var i5 = decorators.length - 1, decorator; i5 >= 0; i5--)
    if (decorator = decorators[i5])
      result = (kind ? decorator(target, key, result) : decorator(result)) || result;
  if (kind && result) __defProp(target, key, result);
  return result;
};

// src/core/configuration.ts
var DEFAULT_URLS = {
  development: {
    apiBase: "https://api-dev.vio.live",
    graphQLBase: "https://graph-ql-dev.vio.live"
  },
  testing: {
    apiBase: "https://api-dev.vio.live",
    graphQLBase: "https://graph-ql-dev.vio.live"
  },
  production: {
    apiBase: "https://api.vio.live",
    graphQLBase: "https://graph-ql.vio.live"
  }
};
var ConfigurationSingleton = class {
  constructor() {
    this.resolved = null;
  }
  init(input) {
    if (!input.apiKey || typeof input.apiKey !== "string") {
      throw new Error("[Vio] apiKey is required in Vio.init({ apiKey })");
    }
    const env = input.environment ?? "development";
    const defaults = DEFAULT_URLS[env];
    this.resolved = {
      apiKey: input.apiKey,
      environment: env,
      apiBase: input.apiBase ?? defaults.apiBase,
      graphQLBase: input.graphQLBase ?? defaults.graphQLBase,
      stripePublishableKey: input.stripePublishableKey,
      klarnaClientId: input.klarnaClientId,
      // Sandbox by default — live Klarna must be opted into explicitly.
      klarnaEnvironment: input.klarnaEnvironment ?? "playground"
    };
    if (typeof console !== "undefined") {
      const masked = input.apiKey.length > 4 ? "*".repeat(Math.max(0, input.apiKey.length - 4)) + input.apiKey.slice(-4) : "****";
      console.info("[Vio] Initialized", {
        environment: env,
        apiBase: this.resolved.apiBase,
        apiKey: masked,
        stripeConfigured: !!input.stripePublishableKey,
        klarnaConfigured: !!input.klarnaClientId,
        klarnaEnvironment: this.resolved.klarnaEnvironment
      });
    }
  }
  get() {
    if (!this.resolved) {
      throw new Error(
        "[Vio] Not initialized. Call Vio.init({ apiKey }) before using the SDK."
      );
    }
    return this.resolved;
  }
  get isInitialized() {
    return this.resolved !== null;
  }
  /** For tests only. */
  reset() {
    this.resolved = null;
  }
};
var Configuration = /* @__PURE__ */ new ConfigurationSingleton();

// src/core/api/vio.ts
var VioApi = class {
  constructor(options) {
    if (!options.apiBase) throw new Error("[VioApi] apiBase is required");
    if (!options.apiKey) throw new Error("[VioApi] apiKey is required");
    this.apiBase = options.apiBase.replace(/\/+$/, "");
    this.apiKey = options.apiKey;
  }
  /**
   * Bootstrap — fetches client app config (sponsors with commerce keys,
   * default market, campaign id). Called once at SDK init.
   */
  async bootstrap() {
    return this.get("/v2/mobile/config");
  }
  /**
   * Get placement components for a campaign. Used by the carousel auto-fetch
   * mode (`<vio-product-carousel campaign-id="36" location="news-favorites">`).
   */
  async getComponents(campaignId) {
    const path = `/v2/mobile/campaigns/${encodeURIComponent(String(campaignId))}/components`;
    const res = await this.get(path);
    return Array.isArray(res) ? res : res?.components ?? [];
  }
  // MARK: - HTTP plumbing
  async get(path) {
    const url = `${this.apiBase}${path}`;
    const res = await fetch(url, {
      method: "GET",
      headers: {
        "X-API-Key": this.apiKey,
        Accept: "application/json"
      }
    });
    if (!res.ok) {
      throw new VioApiError(res.status, await safeText(res), `GET ${path}`);
    }
    return await res.json();
  }
};
var VioApiError = class extends Error {
  constructor(status, body, endpoint) {
    super(`[VioApi] ${endpoint} \u2192 HTTP ${status}: ${body.slice(0, 200)}`);
    this.status = status;
    this.body = body;
    this.endpoint = endpoint;
    this.name = "VioApiError";
  }
};
async function safeText(res) {
  try {
    return await res.text();
  } catch {
    return "";
  }
}
function createVioApi(options) {
  return new VioApi(options);
}

// node_modules/graphql-request/build/legacy/classes/ClientError.js
var ClientError = class _ClientError extends Error {
  response;
  request;
  constructor(response, request2) {
    const message = `${_ClientError.extractMessage(response)}: ${JSON.stringify({
      response,
      request: request2
    })}`;
    super(message);
    Object.setPrototypeOf(this, _ClientError.prototype);
    this.response = response;
    this.request = request2;
    if (typeof Error.captureStackTrace === `function`) {
      Error.captureStackTrace(this, _ClientError);
    }
  }
  static extractMessage(response) {
    return response.errors?.[0]?.message ?? `GraphQL Error (Code: ${String(response.status)})`;
  }
};

// node_modules/graphql-request/build/lib/prelude.js
var uppercase = (str) => str.toUpperCase();
var callOrIdentity = (value) => {
  return typeof value === `function` ? value() : value;
};
var zip = (a3, b3) => a3.map((k2, i5) => [k2, b3[i5]]);
var HeadersInitToPlainObject = (headers) => {
  let oHeaders = {};
  if (headers instanceof Headers) {
    oHeaders = HeadersInstanceToPlainObject(headers);
  } else if (Array.isArray(headers)) {
    headers.forEach(([name, value]) => {
      if (name && value !== void 0) {
        oHeaders[name] = value;
      }
    });
  } else if (headers) {
    oHeaders = headers;
  }
  return oHeaders;
};
var HeadersInstanceToPlainObject = (headers) => {
  const o7 = {};
  headers.forEach((v2, k2) => {
    o7[k2] = v2;
  });
  return o7;
};
var tryCatch = (fn) => {
  try {
    const result = fn();
    if (isPromiseLikeValue(result)) {
      return result.catch((error) => {
        return errorFromMaybeError(error);
      });
    }
    return result;
  } catch (error) {
    return errorFromMaybeError(error);
  }
};
var errorFromMaybeError = (maybeError) => {
  if (maybeError instanceof Error)
    return maybeError;
  return new Error(String(maybeError));
};
var isPromiseLikeValue = (value) => {
  return typeof value === `object` && value !== null && `then` in value && typeof value.then === `function` && `catch` in value && typeof value.catch === `function` && `finally` in value && typeof value.finally === `function`;
};
var casesExhausted = (value) => {
  throw new Error(`Unhandled case: ${String(value)}`);
};
var isPlainObject = (value) => {
  return typeof value === `object` && value !== null && !Array.isArray(value);
};

// node_modules/graphql-request/build/legacy/functions/batchRequests.js
var parseBatchRequestArgs = (documentsOrOptions, requestHeaders) => {
  return documentsOrOptions.documents ? documentsOrOptions : {
    documents: documentsOrOptions,
    requestHeaders,
    signal: void 0
  };
};

// node_modules/graphql-request/build/legacy/functions/rawRequest.js
var parseRawRequestArgs = (queryOrOptions, variables, requestHeaders) => {
  return queryOrOptions.query ? queryOrOptions : {
    query: queryOrOptions,
    variables,
    requestHeaders,
    signal: void 0
  };
};

// node_modules/graphql/jsutils/devAssert.mjs
function devAssert(condition, message) {
  const booleanCondition = Boolean(condition);
  if (!booleanCondition) {
    throw new Error(message);
  }
}

// node_modules/graphql/jsutils/isObjectLike.mjs
function isObjectLike(value) {
  return typeof value == "object" && value !== null;
}

// node_modules/graphql/jsutils/invariant.mjs
function invariant(condition, message) {
  const booleanCondition = Boolean(condition);
  if (!booleanCondition) {
    throw new Error(
      message != null ? message : "Unexpected invariant triggered."
    );
  }
}

// node_modules/graphql/language/location.mjs
var LineRegExp = /\r\n|[\n\r]/g;
function getLocation(source, position) {
  let lastLineStart = 0;
  let line = 1;
  for (const match of source.body.matchAll(LineRegExp)) {
    typeof match.index === "number" || invariant(false);
    if (match.index >= position) {
      break;
    }
    lastLineStart = match.index + match[0].length;
    line += 1;
  }
  return {
    line,
    column: position + 1 - lastLineStart
  };
}

// node_modules/graphql/language/printLocation.mjs
function printLocation(location) {
  return printSourceLocation(
    location.source,
    getLocation(location.source, location.start)
  );
}
function printSourceLocation(source, sourceLocation) {
  const firstLineColumnOffset = source.locationOffset.column - 1;
  const body = "".padStart(firstLineColumnOffset) + source.body;
  const lineIndex = sourceLocation.line - 1;
  const lineOffset = source.locationOffset.line - 1;
  const lineNum = sourceLocation.line + lineOffset;
  const columnOffset = sourceLocation.line === 1 ? firstLineColumnOffset : 0;
  const columnNum = sourceLocation.column + columnOffset;
  const locationStr = `${source.name}:${lineNum}:${columnNum}
`;
  const lines = body.split(/\r\n|[\n\r]/g);
  const locationLine = lines[lineIndex];
  if (locationLine.length > 120) {
    const subLineIndex = Math.floor(columnNum / 80);
    const subLineColumnNum = columnNum % 80;
    const subLines = [];
    for (let i5 = 0; i5 < locationLine.length; i5 += 80) {
      subLines.push(locationLine.slice(i5, i5 + 80));
    }
    return locationStr + printPrefixedLines([
      [`${lineNum} |`, subLines[0]],
      ...subLines.slice(1, subLineIndex + 1).map((subLine) => ["|", subLine]),
      ["|", "^".padStart(subLineColumnNum)],
      ["|", subLines[subLineIndex + 1]]
    ]);
  }
  return locationStr + printPrefixedLines([
    // Lines specified like this: ["prefix", "string"],
    [`${lineNum - 1} |`, lines[lineIndex - 1]],
    [`${lineNum} |`, locationLine],
    ["|", "^".padStart(columnNum)],
    [`${lineNum + 1} |`, lines[lineIndex + 1]]
  ]);
}
function printPrefixedLines(lines) {
  const existingLines = lines.filter(([_2, line]) => line !== void 0);
  const padLen = Math.max(...existingLines.map(([prefix]) => prefix.length));
  return existingLines.map(([prefix, line]) => prefix.padStart(padLen) + (line ? " " + line : "")).join("\n");
}

// node_modules/graphql/error/GraphQLError.mjs
function toNormalizedOptions(args) {
  const firstArg = args[0];
  if (firstArg == null || "kind" in firstArg || "length" in firstArg) {
    return {
      nodes: firstArg,
      source: args[1],
      positions: args[2],
      path: args[3],
      originalError: args[4],
      extensions: args[5]
    };
  }
  return firstArg;
}
var GraphQLError = class _GraphQLError extends Error {
  /**
   * An array of `{ line, column }` locations within the source GraphQL document
   * which correspond to this error.
   *
   * Errors during validation often contain multiple locations, for example to
   * point out two things with the same name. Errors during execution include a
   * single location, the field which produced the error.
   *
   * Enumerable, and appears in the result of JSON.stringify().
   */
  /**
   * An array describing the JSON-path into the execution response which
   * corresponds to this error. Only included for errors during execution.
   *
   * Enumerable, and appears in the result of JSON.stringify().
   */
  /**
   * An array of GraphQL AST Nodes corresponding to this error.
   */
  /**
   * The source GraphQL document for the first location of this error.
   *
   * Note that if this Error represents more than one node, the source may not
   * represent nodes after the first node.
   */
  /**
   * An array of character offsets within the source GraphQL document
   * which correspond to this error.
   */
  /**
   * The original error thrown from a field resolver during execution.
   */
  /**
   * Extension fields to add to the formatted error.
   */
  /**
   * @deprecated Please use the `GraphQLErrorOptions` constructor overload instead.
   */
  constructor(message, ...rawArgs) {
    var _this$nodes, _nodeLocations$, _ref;
    const { nodes, source, positions, path, originalError, extensions } = toNormalizedOptions(rawArgs);
    super(message);
    this.name = "GraphQLError";
    this.path = path !== null && path !== void 0 ? path : void 0;
    this.originalError = originalError !== null && originalError !== void 0 ? originalError : void 0;
    this.nodes = undefinedIfEmpty(
      Array.isArray(nodes) ? nodes : nodes ? [nodes] : void 0
    );
    const nodeLocations = undefinedIfEmpty(
      (_this$nodes = this.nodes) === null || _this$nodes === void 0 ? void 0 : _this$nodes.map((node) => node.loc).filter((loc) => loc != null)
    );
    this.source = source !== null && source !== void 0 ? source : nodeLocations === null || nodeLocations === void 0 ? void 0 : (_nodeLocations$ = nodeLocations[0]) === null || _nodeLocations$ === void 0 ? void 0 : _nodeLocations$.source;
    this.positions = positions !== null && positions !== void 0 ? positions : nodeLocations === null || nodeLocations === void 0 ? void 0 : nodeLocations.map((loc) => loc.start);
    this.locations = positions && source ? positions.map((pos) => getLocation(source, pos)) : nodeLocations === null || nodeLocations === void 0 ? void 0 : nodeLocations.map((loc) => getLocation(loc.source, loc.start));
    const originalExtensions = isObjectLike(
      originalError === null || originalError === void 0 ? void 0 : originalError.extensions
    ) ? originalError === null || originalError === void 0 ? void 0 : originalError.extensions : void 0;
    this.extensions = (_ref = extensions !== null && extensions !== void 0 ? extensions : originalExtensions) !== null && _ref !== void 0 ? _ref : /* @__PURE__ */ Object.create(null);
    Object.defineProperties(this, {
      message: {
        writable: true,
        enumerable: true
      },
      name: {
        enumerable: false
      },
      nodes: {
        enumerable: false
      },
      source: {
        enumerable: false
      },
      positions: {
        enumerable: false
      },
      originalError: {
        enumerable: false
      }
    });
    if (originalError !== null && originalError !== void 0 && originalError.stack) {
      Object.defineProperty(this, "stack", {
        value: originalError.stack,
        writable: true,
        configurable: true
      });
    } else if (Error.captureStackTrace) {
      Error.captureStackTrace(this, _GraphQLError);
    } else {
      Object.defineProperty(this, "stack", {
        value: Error().stack,
        writable: true,
        configurable: true
      });
    }
  }
  get [Symbol.toStringTag]() {
    return "GraphQLError";
  }
  toString() {
    let output = this.message;
    if (this.nodes) {
      for (const node of this.nodes) {
        if (node.loc) {
          output += "\n\n" + printLocation(node.loc);
        }
      }
    } else if (this.source && this.locations) {
      for (const location of this.locations) {
        output += "\n\n" + printSourceLocation(this.source, location);
      }
    }
    return output;
  }
  toJSON() {
    const formattedError = {
      message: this.message
    };
    if (this.locations != null) {
      formattedError.locations = this.locations;
    }
    if (this.path != null) {
      formattedError.path = this.path;
    }
    if (this.extensions != null && Object.keys(this.extensions).length > 0) {
      formattedError.extensions = this.extensions;
    }
    return formattedError;
  }
};
function undefinedIfEmpty(array) {
  return array === void 0 || array.length === 0 ? void 0 : array;
}

// node_modules/graphql/error/syntaxError.mjs
function syntaxError(source, position, description) {
  return new GraphQLError(`Syntax Error: ${description}`, {
    source,
    positions: [position]
  });
}

// node_modules/graphql/language/ast.mjs
var Location = class {
  /**
   * The character offset at which this Node begins.
   */
  /**
   * The character offset at which this Node ends.
   */
  /**
   * The Token at which this Node begins.
   */
  /**
   * The Token at which this Node ends.
   */
  /**
   * The Source document the AST represents.
   */
  constructor(startToken, endToken, source) {
    this.start = startToken.start;
    this.end = endToken.end;
    this.startToken = startToken;
    this.endToken = endToken;
    this.source = source;
  }
  get [Symbol.toStringTag]() {
    return "Location";
  }
  toJSON() {
    return {
      start: this.start,
      end: this.end
    };
  }
};
var Token = class {
  /**
   * The kind of Token.
   */
  /**
   * The character offset at which this Node begins.
   */
  /**
   * The character offset at which this Node ends.
   */
  /**
   * The 1-indexed line number on which this Token appears.
   */
  /**
   * The 1-indexed column number at which this Token begins.
   */
  /**
   * For non-punctuation tokens, represents the interpreted value of the token.
   *
   * Note: is undefined for punctuation tokens, but typed as string for
   * convenience in the parser.
   */
  /**
   * Tokens exist as nodes in a double-linked-list amongst all tokens
   * including ignored tokens. <SOF> is always the first node and <EOF>
   * the last.
   */
  constructor(kind, start, end, line, column, value) {
    this.kind = kind;
    this.start = start;
    this.end = end;
    this.line = line;
    this.column = column;
    this.value = value;
    this.prev = null;
    this.next = null;
  }
  get [Symbol.toStringTag]() {
    return "Token";
  }
  toJSON() {
    return {
      kind: this.kind,
      value: this.value,
      line: this.line,
      column: this.column
    };
  }
};
var QueryDocumentKeys = {
  Name: [],
  Document: ["definitions"],
  OperationDefinition: [
    "description",
    "name",
    "variableDefinitions",
    "directives",
    "selectionSet"
  ],
  VariableDefinition: [
    "description",
    "variable",
    "type",
    "defaultValue",
    "directives"
  ],
  Variable: ["name"],
  SelectionSet: ["selections"],
  Field: ["alias", "name", "arguments", "directives", "selectionSet"],
  Argument: ["name", "value"],
  FragmentSpread: ["name", "directives"],
  InlineFragment: ["typeCondition", "directives", "selectionSet"],
  FragmentDefinition: [
    "description",
    "name",
    // Note: fragment variable definitions are deprecated and will removed in v17.0.0
    "variableDefinitions",
    "typeCondition",
    "directives",
    "selectionSet"
  ],
  IntValue: [],
  FloatValue: [],
  StringValue: [],
  BooleanValue: [],
  NullValue: [],
  EnumValue: [],
  ListValue: ["values"],
  ObjectValue: ["fields"],
  ObjectField: ["name", "value"],
  Directive: ["name", "arguments"],
  NamedType: ["name"],
  ListType: ["type"],
  NonNullType: ["type"],
  SchemaDefinition: ["description", "directives", "operationTypes"],
  OperationTypeDefinition: ["type"],
  ScalarTypeDefinition: ["description", "name", "directives"],
  ObjectTypeDefinition: [
    "description",
    "name",
    "interfaces",
    "directives",
    "fields"
  ],
  FieldDefinition: ["description", "name", "arguments", "type", "directives"],
  InputValueDefinition: [
    "description",
    "name",
    "type",
    "defaultValue",
    "directives"
  ],
  InterfaceTypeDefinition: [
    "description",
    "name",
    "interfaces",
    "directives",
    "fields"
  ],
  UnionTypeDefinition: ["description", "name", "directives", "types"],
  EnumTypeDefinition: ["description", "name", "directives", "values"],
  EnumValueDefinition: ["description", "name", "directives"],
  InputObjectTypeDefinition: ["description", "name", "directives", "fields"],
  DirectiveDefinition: [
    "description",
    "name",
    "arguments",
    "directives",
    "locations"
  ],
  SchemaExtension: ["directives", "operationTypes"],
  DirectiveExtension: ["name", "directives"],
  ScalarTypeExtension: ["name", "directives"],
  ObjectTypeExtension: ["name", "interfaces", "directives", "fields"],
  InterfaceTypeExtension: ["name", "interfaces", "directives", "fields"],
  UnionTypeExtension: ["name", "directives", "types"],
  EnumTypeExtension: ["name", "directives", "values"],
  InputObjectTypeExtension: ["name", "directives", "fields"],
  TypeCoordinate: ["name"],
  MemberCoordinate: ["name", "memberName"],
  ArgumentCoordinate: ["name", "fieldName", "argumentName"],
  DirectiveCoordinate: ["name"],
  DirectiveArgumentCoordinate: ["name", "argumentName"]
};
var kindValues = new Set(Object.keys(QueryDocumentKeys));
function isNode(maybeNode) {
  const maybeKind = maybeNode === null || maybeNode === void 0 ? void 0 : maybeNode.kind;
  return typeof maybeKind === "string" && kindValues.has(maybeKind);
}
var OperationTypeNode;
(function(OperationTypeNode2) {
  OperationTypeNode2["QUERY"] = "query";
  OperationTypeNode2["MUTATION"] = "mutation";
  OperationTypeNode2["SUBSCRIPTION"] = "subscription";
})(OperationTypeNode || (OperationTypeNode = {}));

// node_modules/graphql/language/directiveLocation.mjs
var DirectiveLocation;
(function(DirectiveLocation2) {
  DirectiveLocation2["QUERY"] = "QUERY";
  DirectiveLocation2["MUTATION"] = "MUTATION";
  DirectiveLocation2["SUBSCRIPTION"] = "SUBSCRIPTION";
  DirectiveLocation2["FIELD"] = "FIELD";
  DirectiveLocation2["FRAGMENT_DEFINITION"] = "FRAGMENT_DEFINITION";
  DirectiveLocation2["FRAGMENT_SPREAD"] = "FRAGMENT_SPREAD";
  DirectiveLocation2["INLINE_FRAGMENT"] = "INLINE_FRAGMENT";
  DirectiveLocation2["VARIABLE_DEFINITION"] = "VARIABLE_DEFINITION";
  DirectiveLocation2["SCHEMA"] = "SCHEMA";
  DirectiveLocation2["SCALAR"] = "SCALAR";
  DirectiveLocation2["OBJECT"] = "OBJECT";
  DirectiveLocation2["FIELD_DEFINITION"] = "FIELD_DEFINITION";
  DirectiveLocation2["ARGUMENT_DEFINITION"] = "ARGUMENT_DEFINITION";
  DirectiveLocation2["INTERFACE"] = "INTERFACE";
  DirectiveLocation2["UNION"] = "UNION";
  DirectiveLocation2["ENUM"] = "ENUM";
  DirectiveLocation2["ENUM_VALUE"] = "ENUM_VALUE";
  DirectiveLocation2["INPUT_OBJECT"] = "INPUT_OBJECT";
  DirectiveLocation2["INPUT_FIELD_DEFINITION"] = "INPUT_FIELD_DEFINITION";
  DirectiveLocation2["DIRECTIVE_DEFINITION"] = "DIRECTIVE_DEFINITION";
})(DirectiveLocation || (DirectiveLocation = {}));

// node_modules/graphql/language/kinds.mjs
var Kind;
(function(Kind2) {
  Kind2["NAME"] = "Name";
  Kind2["DOCUMENT"] = "Document";
  Kind2["OPERATION_DEFINITION"] = "OperationDefinition";
  Kind2["VARIABLE_DEFINITION"] = "VariableDefinition";
  Kind2["SELECTION_SET"] = "SelectionSet";
  Kind2["FIELD"] = "Field";
  Kind2["ARGUMENT"] = "Argument";
  Kind2["FRAGMENT_SPREAD"] = "FragmentSpread";
  Kind2["INLINE_FRAGMENT"] = "InlineFragment";
  Kind2["FRAGMENT_DEFINITION"] = "FragmentDefinition";
  Kind2["VARIABLE"] = "Variable";
  Kind2["INT"] = "IntValue";
  Kind2["FLOAT"] = "FloatValue";
  Kind2["STRING"] = "StringValue";
  Kind2["BOOLEAN"] = "BooleanValue";
  Kind2["NULL"] = "NullValue";
  Kind2["ENUM"] = "EnumValue";
  Kind2["LIST"] = "ListValue";
  Kind2["OBJECT"] = "ObjectValue";
  Kind2["OBJECT_FIELD"] = "ObjectField";
  Kind2["DIRECTIVE"] = "Directive";
  Kind2["NAMED_TYPE"] = "NamedType";
  Kind2["LIST_TYPE"] = "ListType";
  Kind2["NON_NULL_TYPE"] = "NonNullType";
  Kind2["SCHEMA_DEFINITION"] = "SchemaDefinition";
  Kind2["OPERATION_TYPE_DEFINITION"] = "OperationTypeDefinition";
  Kind2["SCALAR_TYPE_DEFINITION"] = "ScalarTypeDefinition";
  Kind2["OBJECT_TYPE_DEFINITION"] = "ObjectTypeDefinition";
  Kind2["FIELD_DEFINITION"] = "FieldDefinition";
  Kind2["INPUT_VALUE_DEFINITION"] = "InputValueDefinition";
  Kind2["INTERFACE_TYPE_DEFINITION"] = "InterfaceTypeDefinition";
  Kind2["UNION_TYPE_DEFINITION"] = "UnionTypeDefinition";
  Kind2["ENUM_TYPE_DEFINITION"] = "EnumTypeDefinition";
  Kind2["ENUM_VALUE_DEFINITION"] = "EnumValueDefinition";
  Kind2["INPUT_OBJECT_TYPE_DEFINITION"] = "InputObjectTypeDefinition";
  Kind2["DIRECTIVE_DEFINITION"] = "DirectiveDefinition";
  Kind2["SCHEMA_EXTENSION"] = "SchemaExtension";
  Kind2["DIRECTIVE_EXTENSION"] = "DirectiveExtension";
  Kind2["SCALAR_TYPE_EXTENSION"] = "ScalarTypeExtension";
  Kind2["OBJECT_TYPE_EXTENSION"] = "ObjectTypeExtension";
  Kind2["INTERFACE_TYPE_EXTENSION"] = "InterfaceTypeExtension";
  Kind2["UNION_TYPE_EXTENSION"] = "UnionTypeExtension";
  Kind2["ENUM_TYPE_EXTENSION"] = "EnumTypeExtension";
  Kind2["INPUT_OBJECT_TYPE_EXTENSION"] = "InputObjectTypeExtension";
  Kind2["TYPE_COORDINATE"] = "TypeCoordinate";
  Kind2["MEMBER_COORDINATE"] = "MemberCoordinate";
  Kind2["ARGUMENT_COORDINATE"] = "ArgumentCoordinate";
  Kind2["DIRECTIVE_COORDINATE"] = "DirectiveCoordinate";
  Kind2["DIRECTIVE_ARGUMENT_COORDINATE"] = "DirectiveArgumentCoordinate";
})(Kind || (Kind = {}));

// node_modules/graphql/language/characterClasses.mjs
function isWhiteSpace(code) {
  return code === 9 || code === 32;
}
function isDigit(code) {
  return code >= 48 && code <= 57;
}
function isLetter(code) {
  return code >= 97 && code <= 122 || // A-Z
  code >= 65 && code <= 90;
}
function isNameStart(code) {
  return isLetter(code) || code === 95;
}
function isNameContinue(code) {
  return isLetter(code) || isDigit(code) || code === 95;
}

// node_modules/graphql/language/blockString.mjs
function dedentBlockStringLines(lines) {
  var _firstNonEmptyLine2;
  let commonIndent = Number.MAX_SAFE_INTEGER;
  let firstNonEmptyLine = null;
  let lastNonEmptyLine = -1;
  for (let i5 = 0; i5 < lines.length; ++i5) {
    var _firstNonEmptyLine;
    const line = lines[i5];
    const indent2 = leadingWhitespace(line);
    if (indent2 === line.length) {
      continue;
    }
    firstNonEmptyLine = (_firstNonEmptyLine = firstNonEmptyLine) !== null && _firstNonEmptyLine !== void 0 ? _firstNonEmptyLine : i5;
    lastNonEmptyLine = i5;
    if (i5 !== 0 && indent2 < commonIndent) {
      commonIndent = indent2;
    }
  }
  return lines.map((line, i5) => i5 === 0 ? line : line.slice(commonIndent)).slice(
    (_firstNonEmptyLine2 = firstNonEmptyLine) !== null && _firstNonEmptyLine2 !== void 0 ? _firstNonEmptyLine2 : 0,
    lastNonEmptyLine + 1
  );
}
function leadingWhitespace(str) {
  let i5 = 0;
  while (i5 < str.length && isWhiteSpace(str.charCodeAt(i5))) {
    ++i5;
  }
  return i5;
}
function printBlockString(value, options) {
  const escapedValue = value.replace(/"""/g, '\\"""');
  const lines = escapedValue.split(/\r\n|[\n\r]/g);
  const isSingleLine = lines.length === 1;
  const forceLeadingNewLine = lines.length > 1 && lines.slice(1).every((line) => line.length === 0 || isWhiteSpace(line.charCodeAt(0)));
  const hasTrailingTripleQuotes = escapedValue.endsWith('\\"""');
  const hasTrailingQuote = value.endsWith('"') && !hasTrailingTripleQuotes;
  const hasTrailingSlash = value.endsWith("\\");
  const forceTrailingNewline = hasTrailingQuote || hasTrailingSlash;
  const printAsMultipleLines = !(options !== null && options !== void 0 && options.minimize) && // add leading and trailing new lines only if it improves readability
  (!isSingleLine || value.length > 70 || forceTrailingNewline || forceLeadingNewLine || hasTrailingTripleQuotes);
  let result = "";
  const skipLeadingNewLine = isSingleLine && isWhiteSpace(value.charCodeAt(0));
  if (printAsMultipleLines && !skipLeadingNewLine || forceLeadingNewLine) {
    result += "\n";
  }
  result += escapedValue;
  if (printAsMultipleLines || forceTrailingNewline) {
    result += "\n";
  }
  return '"""' + result + '"""';
}

// node_modules/graphql/language/tokenKind.mjs
var TokenKind;
(function(TokenKind2) {
  TokenKind2["SOF"] = "<SOF>";
  TokenKind2["EOF"] = "<EOF>";
  TokenKind2["BANG"] = "!";
  TokenKind2["DOLLAR"] = "$";
  TokenKind2["AMP"] = "&";
  TokenKind2["PAREN_L"] = "(";
  TokenKind2["PAREN_R"] = ")";
  TokenKind2["DOT"] = ".";
  TokenKind2["SPREAD"] = "...";
  TokenKind2["COLON"] = ":";
  TokenKind2["EQUALS"] = "=";
  TokenKind2["AT"] = "@";
  TokenKind2["BRACKET_L"] = "[";
  TokenKind2["BRACKET_R"] = "]";
  TokenKind2["BRACE_L"] = "{";
  TokenKind2["PIPE"] = "|";
  TokenKind2["BRACE_R"] = "}";
  TokenKind2["NAME"] = "Name";
  TokenKind2["INT"] = "Int";
  TokenKind2["FLOAT"] = "Float";
  TokenKind2["STRING"] = "String";
  TokenKind2["BLOCK_STRING"] = "BlockString";
  TokenKind2["COMMENT"] = "Comment";
})(TokenKind || (TokenKind = {}));

// node_modules/graphql/language/lexer.mjs
var Lexer = class {
  /**
   * The previously focused non-ignored token.
   */
  /**
   * The currently focused non-ignored token.
   */
  /**
   * The (1-indexed) line containing the current token.
   */
  /**
   * The character offset at which the current line begins.
   */
  constructor(source) {
    const startOfFileToken = new Token(TokenKind.SOF, 0, 0, 0, 0);
    this.source = source;
    this.lastToken = startOfFileToken;
    this.token = startOfFileToken;
    this.line = 1;
    this.lineStart = 0;
  }
  get [Symbol.toStringTag]() {
    return "Lexer";
  }
  /**
   * Advances the token stream to the next non-ignored token.
   */
  advance() {
    this.lastToken = this.token;
    const token = this.token = this.lookahead();
    return token;
  }
  /**
   * Looks ahead and returns the next non-ignored token, but does not change
   * the state of Lexer.
   */
  lookahead() {
    let token = this.token;
    if (token.kind !== TokenKind.EOF) {
      do {
        if (token.next) {
          token = token.next;
        } else {
          const nextToken = readNextToken(this, token.end);
          token.next = nextToken;
          nextToken.prev = token;
          token = nextToken;
        }
      } while (token.kind === TokenKind.COMMENT);
    }
    return token;
  }
};
function isPunctuatorTokenKind(kind) {
  return kind === TokenKind.BANG || kind === TokenKind.DOLLAR || kind === TokenKind.AMP || kind === TokenKind.PAREN_L || kind === TokenKind.PAREN_R || kind === TokenKind.DOT || kind === TokenKind.SPREAD || kind === TokenKind.COLON || kind === TokenKind.EQUALS || kind === TokenKind.AT || kind === TokenKind.BRACKET_L || kind === TokenKind.BRACKET_R || kind === TokenKind.BRACE_L || kind === TokenKind.PIPE || kind === TokenKind.BRACE_R;
}
function isUnicodeScalarValue(code) {
  return code >= 0 && code <= 55295 || code >= 57344 && code <= 1114111;
}
function isSupplementaryCodePoint(body, location) {
  return isLeadingSurrogate(body.charCodeAt(location)) && isTrailingSurrogate(body.charCodeAt(location + 1));
}
function isLeadingSurrogate(code) {
  return code >= 55296 && code <= 56319;
}
function isTrailingSurrogate(code) {
  return code >= 56320 && code <= 57343;
}
function printCodePointAt(lexer, location) {
  const code = lexer.source.body.codePointAt(location);
  if (code === void 0) {
    return TokenKind.EOF;
  } else if (code >= 32 && code <= 126) {
    const char = String.fromCodePoint(code);
    return char === '"' ? `'"'` : `"${char}"`;
  }
  return "U+" + code.toString(16).toUpperCase().padStart(4, "0");
}
function createToken(lexer, kind, start, end, value) {
  const line = lexer.line;
  const col = 1 + start - lexer.lineStart;
  return new Token(kind, start, end, line, col, value);
}
function readNextToken(lexer, start) {
  const body = lexer.source.body;
  const bodyLength = body.length;
  let position = start;
  while (position < bodyLength) {
    const code = body.charCodeAt(position);
    switch (code) {
      // Ignored ::
      //   - UnicodeBOM
      //   - WhiteSpace
      //   - LineTerminator
      //   - Comment
      //   - Comma
      //
      // UnicodeBOM :: "Byte Order Mark (U+FEFF)"
      //
      // WhiteSpace ::
      //   - "Horizontal Tab (U+0009)"
      //   - "Space (U+0020)"
      //
      // Comma :: ,
      case 65279:
      // <BOM>
      case 9:
      // \t
      case 32:
      // <space>
      case 44:
        ++position;
        continue;
      // LineTerminator ::
      //   - "New Line (U+000A)"
      //   - "Carriage Return (U+000D)" [lookahead != "New Line (U+000A)"]
      //   - "Carriage Return (U+000D)" "New Line (U+000A)"
      case 10:
        ++position;
        ++lexer.line;
        lexer.lineStart = position;
        continue;
      case 13:
        if (body.charCodeAt(position + 1) === 10) {
          position += 2;
        } else {
          ++position;
        }
        ++lexer.line;
        lexer.lineStart = position;
        continue;
      // Comment
      case 35:
        return readComment(lexer, position);
      // Token ::
      //   - Punctuator
      //   - Name
      //   - IntValue
      //   - FloatValue
      //   - StringValue
      //
      // Punctuator :: one of ! $ & ( ) ... : = @ [ ] { | }
      case 33:
        return createToken(lexer, TokenKind.BANG, position, position + 1);
      case 36:
        return createToken(lexer, TokenKind.DOLLAR, position, position + 1);
      case 38:
        return createToken(lexer, TokenKind.AMP, position, position + 1);
      case 40:
        return createToken(lexer, TokenKind.PAREN_L, position, position + 1);
      case 41:
        return createToken(lexer, TokenKind.PAREN_R, position, position + 1);
      case 46:
        if (body.charCodeAt(position + 1) === 46 && body.charCodeAt(position + 2) === 46) {
          return createToken(lexer, TokenKind.SPREAD, position, position + 3);
        }
        break;
      case 58:
        return createToken(lexer, TokenKind.COLON, position, position + 1);
      case 61:
        return createToken(lexer, TokenKind.EQUALS, position, position + 1);
      case 64:
        return createToken(lexer, TokenKind.AT, position, position + 1);
      case 91:
        return createToken(lexer, TokenKind.BRACKET_L, position, position + 1);
      case 93:
        return createToken(lexer, TokenKind.BRACKET_R, position, position + 1);
      case 123:
        return createToken(lexer, TokenKind.BRACE_L, position, position + 1);
      case 124:
        return createToken(lexer, TokenKind.PIPE, position, position + 1);
      case 125:
        return createToken(lexer, TokenKind.BRACE_R, position, position + 1);
      // StringValue
      case 34:
        if (body.charCodeAt(position + 1) === 34 && body.charCodeAt(position + 2) === 34) {
          return readBlockString(lexer, position);
        }
        return readString(lexer, position);
    }
    if (isDigit(code) || code === 45) {
      return readNumber(lexer, position, code);
    }
    if (isNameStart(code)) {
      return readName(lexer, position);
    }
    throw syntaxError(
      lexer.source,
      position,
      code === 39 ? `Unexpected single quote character ('), did you mean to use a double quote (")?` : isUnicodeScalarValue(code) || isSupplementaryCodePoint(body, position) ? `Unexpected character: ${printCodePointAt(lexer, position)}.` : `Invalid character: ${printCodePointAt(lexer, position)}.`
    );
  }
  return createToken(lexer, TokenKind.EOF, bodyLength, bodyLength);
}
function readComment(lexer, start) {
  const body = lexer.source.body;
  const bodyLength = body.length;
  let position = start + 1;
  while (position < bodyLength) {
    const code = body.charCodeAt(position);
    if (code === 10 || code === 13) {
      break;
    }
    if (isUnicodeScalarValue(code)) {
      ++position;
    } else if (isSupplementaryCodePoint(body, position)) {
      position += 2;
    } else {
      break;
    }
  }
  return createToken(
    lexer,
    TokenKind.COMMENT,
    start,
    position,
    body.slice(start + 1, position)
  );
}
function readNumber(lexer, start, firstCode) {
  const body = lexer.source.body;
  let position = start;
  let code = firstCode;
  let isFloat = false;
  if (code === 45) {
    code = body.charCodeAt(++position);
  }
  if (code === 48) {
    code = body.charCodeAt(++position);
    if (isDigit(code)) {
      throw syntaxError(
        lexer.source,
        position,
        `Invalid number, unexpected digit after 0: ${printCodePointAt(
          lexer,
          position
        )}.`
      );
    }
  } else {
    position = readDigits(lexer, position, code);
    code = body.charCodeAt(position);
  }
  if (code === 46) {
    isFloat = true;
    code = body.charCodeAt(++position);
    position = readDigits(lexer, position, code);
    code = body.charCodeAt(position);
  }
  if (code === 69 || code === 101) {
    isFloat = true;
    code = body.charCodeAt(++position);
    if (code === 43 || code === 45) {
      code = body.charCodeAt(++position);
    }
    position = readDigits(lexer, position, code);
    code = body.charCodeAt(position);
  }
  if (code === 46 || isNameStart(code)) {
    throw syntaxError(
      lexer.source,
      position,
      `Invalid number, expected digit but got: ${printCodePointAt(
        lexer,
        position
      )}.`
    );
  }
  return createToken(
    lexer,
    isFloat ? TokenKind.FLOAT : TokenKind.INT,
    start,
    position,
    body.slice(start, position)
  );
}
function readDigits(lexer, start, firstCode) {
  if (!isDigit(firstCode)) {
    throw syntaxError(
      lexer.source,
      start,
      `Invalid number, expected digit but got: ${printCodePointAt(
        lexer,
        start
      )}.`
    );
  }
  const body = lexer.source.body;
  let position = start + 1;
  while (isDigit(body.charCodeAt(position))) {
    ++position;
  }
  return position;
}
function readString(lexer, start) {
  const body = lexer.source.body;
  const bodyLength = body.length;
  let position = start + 1;
  let chunkStart = position;
  let value = "";
  while (position < bodyLength) {
    const code = body.charCodeAt(position);
    if (code === 34) {
      value += body.slice(chunkStart, position);
      return createToken(lexer, TokenKind.STRING, start, position + 1, value);
    }
    if (code === 92) {
      value += body.slice(chunkStart, position);
      const escape = body.charCodeAt(position + 1) === 117 ? body.charCodeAt(position + 2) === 123 ? readEscapedUnicodeVariableWidth(lexer, position) : readEscapedUnicodeFixedWidth(lexer, position) : readEscapedCharacter(lexer, position);
      value += escape.value;
      position += escape.size;
      chunkStart = position;
      continue;
    }
    if (code === 10 || code === 13) {
      break;
    }
    if (isUnicodeScalarValue(code)) {
      ++position;
    } else if (isSupplementaryCodePoint(body, position)) {
      position += 2;
    } else {
      throw syntaxError(
        lexer.source,
        position,
        `Invalid character within String: ${printCodePointAt(
          lexer,
          position
        )}.`
      );
    }
  }
  throw syntaxError(lexer.source, position, "Unterminated string.");
}
function readEscapedUnicodeVariableWidth(lexer, position) {
  const body = lexer.source.body;
  let point = 0;
  let size = 3;
  while (size < 12) {
    const code = body.charCodeAt(position + size++);
    if (code === 125) {
      if (size < 5 || !isUnicodeScalarValue(point)) {
        break;
      }
      return {
        value: String.fromCodePoint(point),
        size
      };
    }
    point = point << 4 | readHexDigit(code);
    if (point < 0) {
      break;
    }
  }
  throw syntaxError(
    lexer.source,
    position,
    `Invalid Unicode escape sequence: "${body.slice(
      position,
      position + size
    )}".`
  );
}
function readEscapedUnicodeFixedWidth(lexer, position) {
  const body = lexer.source.body;
  const code = read16BitHexCode(body, position + 2);
  if (isUnicodeScalarValue(code)) {
    return {
      value: String.fromCodePoint(code),
      size: 6
    };
  }
  if (isLeadingSurrogate(code)) {
    if (body.charCodeAt(position + 6) === 92 && body.charCodeAt(position + 7) === 117) {
      const trailingCode = read16BitHexCode(body, position + 8);
      if (isTrailingSurrogate(trailingCode)) {
        return {
          value: String.fromCodePoint(code, trailingCode),
          size: 12
        };
      }
    }
  }
  throw syntaxError(
    lexer.source,
    position,
    `Invalid Unicode escape sequence: "${body.slice(position, position + 6)}".`
  );
}
function read16BitHexCode(body, position) {
  return readHexDigit(body.charCodeAt(position)) << 12 | readHexDigit(body.charCodeAt(position + 1)) << 8 | readHexDigit(body.charCodeAt(position + 2)) << 4 | readHexDigit(body.charCodeAt(position + 3));
}
function readHexDigit(code) {
  return code >= 48 && code <= 57 ? code - 48 : code >= 65 && code <= 70 ? code - 55 : code >= 97 && code <= 102 ? code - 87 : -1;
}
function readEscapedCharacter(lexer, position) {
  const body = lexer.source.body;
  const code = body.charCodeAt(position + 1);
  switch (code) {
    case 34:
      return {
        value: '"',
        size: 2
      };
    case 92:
      return {
        value: "\\",
        size: 2
      };
    case 47:
      return {
        value: "/",
        size: 2
      };
    case 98:
      return {
        value: "\b",
        size: 2
      };
    case 102:
      return {
        value: "\f",
        size: 2
      };
    case 110:
      return {
        value: "\n",
        size: 2
      };
    case 114:
      return {
        value: "\r",
        size: 2
      };
    case 116:
      return {
        value: "	",
        size: 2
      };
  }
  throw syntaxError(
    lexer.source,
    position,
    `Invalid character escape sequence: "${body.slice(
      position,
      position + 2
    )}".`
  );
}
function readBlockString(lexer, start) {
  const body = lexer.source.body;
  const bodyLength = body.length;
  let lineStart = lexer.lineStart;
  let position = start + 3;
  let chunkStart = position;
  let currentLine = "";
  const blockLines = [];
  while (position < bodyLength) {
    const code = body.charCodeAt(position);
    if (code === 34 && body.charCodeAt(position + 1) === 34 && body.charCodeAt(position + 2) === 34) {
      currentLine += body.slice(chunkStart, position);
      blockLines.push(currentLine);
      const token = createToken(
        lexer,
        TokenKind.BLOCK_STRING,
        start,
        position + 3,
        // Return a string of the lines joined with U+000A.
        dedentBlockStringLines(blockLines).join("\n")
      );
      lexer.line += blockLines.length - 1;
      lexer.lineStart = lineStart;
      return token;
    }
    if (code === 92 && body.charCodeAt(position + 1) === 34 && body.charCodeAt(position + 2) === 34 && body.charCodeAt(position + 3) === 34) {
      currentLine += body.slice(chunkStart, position);
      chunkStart = position + 1;
      position += 4;
      continue;
    }
    if (code === 10 || code === 13) {
      currentLine += body.slice(chunkStart, position);
      blockLines.push(currentLine);
      if (code === 13 && body.charCodeAt(position + 1) === 10) {
        position += 2;
      } else {
        ++position;
      }
      currentLine = "";
      chunkStart = position;
      lineStart = position;
      continue;
    }
    if (isUnicodeScalarValue(code)) {
      ++position;
    } else if (isSupplementaryCodePoint(body, position)) {
      position += 2;
    } else {
      throw syntaxError(
        lexer.source,
        position,
        `Invalid character within String: ${printCodePointAt(
          lexer,
          position
        )}.`
      );
    }
  }
  throw syntaxError(lexer.source, position, "Unterminated string.");
}
function readName(lexer, start) {
  const body = lexer.source.body;
  const bodyLength = body.length;
  let position = start + 1;
  while (position < bodyLength) {
    const code = body.charCodeAt(position);
    if (isNameContinue(code)) {
      ++position;
    } else {
      break;
    }
  }
  return createToken(
    lexer,
    TokenKind.NAME,
    start,
    position,
    body.slice(start, position)
  );
}

// node_modules/graphql/jsutils/inspect.mjs
var MAX_ARRAY_LENGTH = 10;
var MAX_RECURSIVE_DEPTH = 2;
function inspect(value) {
  return formatValue(value, []);
}
function formatValue(value, seenValues) {
  switch (typeof value) {
    case "string":
      return JSON.stringify(value);
    case "function":
      return value.name ? `[function ${value.name}]` : "[function]";
    case "object":
      return formatObjectValue(value, seenValues);
    default:
      return String(value);
  }
}
function formatObjectValue(value, previouslySeenValues) {
  if (value === null) {
    return "null";
  }
  if (previouslySeenValues.includes(value)) {
    return "[Circular]";
  }
  const seenValues = [...previouslySeenValues, value];
  if (isJSONable(value)) {
    const jsonValue = value.toJSON();
    if (jsonValue !== value) {
      return typeof jsonValue === "string" ? jsonValue : formatValue(jsonValue, seenValues);
    }
  } else if (Array.isArray(value)) {
    return formatArray(value, seenValues);
  }
  return formatObject(value, seenValues);
}
function isJSONable(value) {
  return typeof value.toJSON === "function";
}
function formatObject(object, seenValues) {
  const entries = Object.entries(object);
  if (entries.length === 0) {
    return "{}";
  }
  if (seenValues.length > MAX_RECURSIVE_DEPTH) {
    return "[" + getObjectTag(object) + "]";
  }
  const properties = entries.map(
    ([key, value]) => key + ": " + formatValue(value, seenValues)
  );
  return "{ " + properties.join(", ") + " }";
}
function formatArray(array, seenValues) {
  if (array.length === 0) {
    return "[]";
  }
  if (seenValues.length > MAX_RECURSIVE_DEPTH) {
    return "[Array]";
  }
  const len = Math.min(MAX_ARRAY_LENGTH, array.length);
  const remaining = array.length - len;
  const items = [];
  for (let i5 = 0; i5 < len; ++i5) {
    items.push(formatValue(array[i5], seenValues));
  }
  if (remaining === 1) {
    items.push("... 1 more item");
  } else if (remaining > 1) {
    items.push(`... ${remaining} more items`);
  }
  return "[" + items.join(", ") + "]";
}
function getObjectTag(object) {
  const tag = Object.prototype.toString.call(object).replace(/^\[object /, "").replace(/]$/, "");
  if (tag === "Object" && typeof object.constructor === "function") {
    const name = object.constructor.name;
    if (typeof name === "string" && name !== "") {
      return name;
    }
  }
  return tag;
}

// node_modules/graphql/jsutils/instanceOf.mjs
var isProduction = globalThis.process && // eslint-disable-next-line no-undef
false;
var instanceOf = (
  /* c8 ignore next 6 */
  // FIXME: https://github.com/graphql/graphql-js/issues/2317
  isProduction ? function instanceOf2(value, constructor) {
    return value instanceof constructor;
  } : function instanceOf3(value, constructor) {
    if (value instanceof constructor) {
      return true;
    }
    if (typeof value === "object" && value !== null) {
      var _value$constructor;
      const className = constructor.prototype[Symbol.toStringTag];
      const valueClassName = (
        // We still need to support constructor's name to detect conflicts with older versions of this library.
        Symbol.toStringTag in value ? value[Symbol.toStringTag] : (_value$constructor = value.constructor) === null || _value$constructor === void 0 ? void 0 : _value$constructor.name
      );
      if (className === valueClassName) {
        const stringifiedValue = inspect(value);
        throw new Error(`Cannot use ${className} "${stringifiedValue}" from another module or realm.

Ensure that there is only one instance of "graphql" in the node_modules
directory. If different versions of "graphql" are the dependencies of other
relied on modules, use "resolutions" to ensure only one version is installed.

https://yarnpkg.com/en/docs/selective-version-resolutions

Duplicate "graphql" modules cannot be used at the same time since different
versions may have different capabilities and behavior. The data from one
version used in the function from another could produce confusing and
spurious results.`);
      }
    }
    return false;
  }
);

// node_modules/graphql/language/source.mjs
var Source = class {
  constructor(body, name = "GraphQL request", locationOffset = {
    line: 1,
    column: 1
  }) {
    typeof body === "string" || devAssert(false, `Body must be a string. Received: ${inspect(body)}.`);
    this.body = body;
    this.name = name;
    this.locationOffset = locationOffset;
    this.locationOffset.line > 0 || devAssert(
      false,
      "line in locationOffset is 1-indexed and must be positive."
    );
    this.locationOffset.column > 0 || devAssert(
      false,
      "column in locationOffset is 1-indexed and must be positive."
    );
  }
  get [Symbol.toStringTag]() {
    return "Source";
  }
};
function isSource(source) {
  return instanceOf(source, Source);
}

// node_modules/graphql/language/parser.mjs
function parse(source, options) {
  const parser = new Parser(source, options);
  const document2 = parser.parseDocument();
  Object.defineProperty(document2, "tokenCount", {
    enumerable: false,
    value: parser.tokenCount
  });
  return document2;
}
var Parser = class {
  constructor(source, options = {}) {
    const { lexer, ..._options } = options;
    if (lexer) {
      this._lexer = lexer;
    } else {
      const sourceObj = isSource(source) ? source : new Source(source);
      this._lexer = new Lexer(sourceObj);
    }
    this._options = _options;
    this._tokenCounter = 0;
  }
  get tokenCount() {
    return this._tokenCounter;
  }
  /**
   * Converts a name lex token into a name parse node.
   */
  parseName() {
    const token = this.expectToken(TokenKind.NAME);
    return this.node(token, {
      kind: Kind.NAME,
      value: token.value
    });
  }
  // Implements the parsing rules in the Document section.
  /**
   * Document : Definition+
   */
  parseDocument() {
    return this.node(this._lexer.token, {
      kind: Kind.DOCUMENT,
      definitions: this.many(
        TokenKind.SOF,
        this.parseDefinition,
        TokenKind.EOF
      )
    });
  }
  /**
   * Definition :
   *   - ExecutableDefinition
   *   - TypeSystemDefinition
   *   - TypeSystemExtension
   *
   * ExecutableDefinition :
   *   - OperationDefinition
   *   - FragmentDefinition
   *
   * TypeSystemDefinition :
   *   - SchemaDefinition
   *   - TypeDefinition
   *   - DirectiveDefinition
   *
   * TypeDefinition :
   *   - ScalarTypeDefinition
   *   - ObjectTypeDefinition
   *   - InterfaceTypeDefinition
   *   - UnionTypeDefinition
   *   - EnumTypeDefinition
   *   - InputObjectTypeDefinition
   */
  parseDefinition() {
    if (this.peek(TokenKind.BRACE_L)) {
      return this.parseOperationDefinition();
    }
    const hasDescription = this.peekDescription();
    const keywordToken = hasDescription ? this._lexer.lookahead() : this._lexer.token;
    if (hasDescription && keywordToken.kind === TokenKind.BRACE_L) {
      throw syntaxError(
        this._lexer.source,
        this._lexer.token.start,
        "Unexpected description, descriptions are not supported on shorthand queries."
      );
    }
    if (keywordToken.kind === TokenKind.NAME) {
      switch (keywordToken.value) {
        case "schema":
          return this.parseSchemaDefinition();
        case "scalar":
          return this.parseScalarTypeDefinition();
        case "type":
          return this.parseObjectTypeDefinition();
        case "interface":
          return this.parseInterfaceTypeDefinition();
        case "union":
          return this.parseUnionTypeDefinition();
        case "enum":
          return this.parseEnumTypeDefinition();
        case "input":
          return this.parseInputObjectTypeDefinition();
        case "directive":
          return this.parseDirectiveDefinition();
      }
      switch (keywordToken.value) {
        case "query":
        case "mutation":
        case "subscription":
          return this.parseOperationDefinition();
        case "fragment":
          return this.parseFragmentDefinition();
      }
      if (hasDescription) {
        throw syntaxError(
          this._lexer.source,
          this._lexer.token.start,
          "Unexpected description, only GraphQL definitions support descriptions."
        );
      }
      switch (keywordToken.value) {
        case "extend":
          return this.parseTypeSystemExtension();
      }
    }
    throw this.unexpected(keywordToken);
  }
  // Implements the parsing rules in the Operations section.
  /**
   * OperationDefinition :
   *  - SelectionSet
   *  - OperationType Name? VariableDefinitions? Directives? SelectionSet
   */
  parseOperationDefinition() {
    const start = this._lexer.token;
    if (this.peek(TokenKind.BRACE_L)) {
      return this.node(start, {
        kind: Kind.OPERATION_DEFINITION,
        operation: OperationTypeNode.QUERY,
        description: void 0,
        name: void 0,
        variableDefinitions: [],
        directives: [],
        selectionSet: this.parseSelectionSet()
      });
    }
    const description = this.parseDescription();
    const operation = this.parseOperationType();
    let name;
    if (this.peek(TokenKind.NAME)) {
      name = this.parseName();
    }
    return this.node(start, {
      kind: Kind.OPERATION_DEFINITION,
      operation,
      description,
      name,
      variableDefinitions: this.parseVariableDefinitions(),
      directives: this.parseDirectives(false),
      selectionSet: this.parseSelectionSet()
    });
  }
  /**
   * OperationType : one of query mutation subscription
   */
  parseOperationType() {
    const operationToken = this.expectToken(TokenKind.NAME);
    switch (operationToken.value) {
      case "query":
        return OperationTypeNode.QUERY;
      case "mutation":
        return OperationTypeNode.MUTATION;
      case "subscription":
        return OperationTypeNode.SUBSCRIPTION;
    }
    throw this.unexpected(operationToken);
  }
  /**
   * VariableDefinitions : ( VariableDefinition+ )
   */
  parseVariableDefinitions() {
    return this.optionalMany(
      TokenKind.PAREN_L,
      this.parseVariableDefinition,
      TokenKind.PAREN_R
    );
  }
  /**
   * VariableDefinition : Variable : Type DefaultValue? Directives[Const]?
   */
  parseVariableDefinition() {
    return this.node(this._lexer.token, {
      kind: Kind.VARIABLE_DEFINITION,
      description: this.parseDescription(),
      variable: this.parseVariable(),
      type: (this.expectToken(TokenKind.COLON), this.parseTypeReference()),
      defaultValue: this.expectOptionalToken(TokenKind.EQUALS) ? this.parseConstValueLiteral() : void 0,
      directives: this.parseConstDirectives()
    });
  }
  /**
   * Variable : $ Name
   */
  parseVariable() {
    const start = this._lexer.token;
    this.expectToken(TokenKind.DOLLAR);
    return this.node(start, {
      kind: Kind.VARIABLE,
      name: this.parseName()
    });
  }
  /**
   * ```
   * SelectionSet : { Selection+ }
   * ```
   */
  parseSelectionSet() {
    return this.node(this._lexer.token, {
      kind: Kind.SELECTION_SET,
      selections: this.many(
        TokenKind.BRACE_L,
        this.parseSelection,
        TokenKind.BRACE_R
      )
    });
  }
  /**
   * Selection :
   *   - Field
   *   - FragmentSpread
   *   - InlineFragment
   */
  parseSelection() {
    return this.peek(TokenKind.SPREAD) ? this.parseFragment() : this.parseField();
  }
  /**
   * Field : Alias? Name Arguments? Directives? SelectionSet?
   *
   * Alias : Name :
   */
  parseField() {
    const start = this._lexer.token;
    const nameOrAlias = this.parseName();
    let alias;
    let name;
    if (this.expectOptionalToken(TokenKind.COLON)) {
      alias = nameOrAlias;
      name = this.parseName();
    } else {
      name = nameOrAlias;
    }
    return this.node(start, {
      kind: Kind.FIELD,
      alias,
      name,
      arguments: this.parseArguments(false),
      directives: this.parseDirectives(false),
      selectionSet: this.peek(TokenKind.BRACE_L) ? this.parseSelectionSet() : void 0
    });
  }
  /**
   * Arguments[Const] : ( Argument[?Const]+ )
   */
  parseArguments(isConst) {
    const item = isConst ? this.parseConstArgument : this.parseArgument;
    return this.optionalMany(TokenKind.PAREN_L, item, TokenKind.PAREN_R);
  }
  /**
   * Argument[Const] : Name : Value[?Const]
   */
  parseArgument(isConst = false) {
    const start = this._lexer.token;
    const name = this.parseName();
    this.expectToken(TokenKind.COLON);
    return this.node(start, {
      kind: Kind.ARGUMENT,
      name,
      value: this.parseValueLiteral(isConst)
    });
  }
  parseConstArgument() {
    return this.parseArgument(true);
  }
  // Implements the parsing rules in the Fragments section.
  /**
   * Corresponds to both FragmentSpread and InlineFragment in the spec.
   *
   * FragmentSpread : ... FragmentName Directives?
   *
   * InlineFragment : ... TypeCondition? Directives? SelectionSet
   */
  parseFragment() {
    const start = this._lexer.token;
    this.expectToken(TokenKind.SPREAD);
    const hasTypeCondition = this.expectOptionalKeyword("on");
    if (!hasTypeCondition && this.peek(TokenKind.NAME)) {
      return this.node(start, {
        kind: Kind.FRAGMENT_SPREAD,
        name: this.parseFragmentName(),
        directives: this.parseDirectives(false)
      });
    }
    return this.node(start, {
      kind: Kind.INLINE_FRAGMENT,
      typeCondition: hasTypeCondition ? this.parseNamedType() : void 0,
      directives: this.parseDirectives(false),
      selectionSet: this.parseSelectionSet()
    });
  }
  /**
   * FragmentDefinition :
   *   - fragment FragmentName on TypeCondition Directives? SelectionSet
   *
   * TypeCondition : NamedType
   */
  parseFragmentDefinition() {
    const start = this._lexer.token;
    const description = this.parseDescription();
    this.expectKeyword("fragment");
    if (this._options.allowLegacyFragmentVariables === true) {
      return this.node(start, {
        kind: Kind.FRAGMENT_DEFINITION,
        description,
        name: this.parseFragmentName(),
        variableDefinitions: this.parseVariableDefinitions(),
        typeCondition: (this.expectKeyword("on"), this.parseNamedType()),
        directives: this.parseDirectives(false),
        selectionSet: this.parseSelectionSet()
      });
    }
    return this.node(start, {
      kind: Kind.FRAGMENT_DEFINITION,
      description,
      name: this.parseFragmentName(),
      typeCondition: (this.expectKeyword("on"), this.parseNamedType()),
      directives: this.parseDirectives(false),
      selectionSet: this.parseSelectionSet()
    });
  }
  /**
   * FragmentName : Name but not `on`
   */
  parseFragmentName() {
    if (this._lexer.token.value === "on") {
      throw this.unexpected();
    }
    return this.parseName();
  }
  // Implements the parsing rules in the Values section.
  /**
   * Value[Const] :
   *   - [~Const] Variable
   *   - IntValue
   *   - FloatValue
   *   - StringValue
   *   - BooleanValue
   *   - NullValue
   *   - EnumValue
   *   - ListValue[?Const]
   *   - ObjectValue[?Const]
   *
   * BooleanValue : one of `true` `false`
   *
   * NullValue : `null`
   *
   * EnumValue : Name but not `true`, `false` or `null`
   */
  parseValueLiteral(isConst) {
    const token = this._lexer.token;
    switch (token.kind) {
      case TokenKind.BRACKET_L:
        return this.parseList(isConst);
      case TokenKind.BRACE_L:
        return this.parseObject(isConst);
      case TokenKind.INT:
        this.advanceLexer();
        return this.node(token, {
          kind: Kind.INT,
          value: token.value
        });
      case TokenKind.FLOAT:
        this.advanceLexer();
        return this.node(token, {
          kind: Kind.FLOAT,
          value: token.value
        });
      case TokenKind.STRING:
      case TokenKind.BLOCK_STRING:
        return this.parseStringLiteral();
      case TokenKind.NAME:
        this.advanceLexer();
        switch (token.value) {
          case "true":
            return this.node(token, {
              kind: Kind.BOOLEAN,
              value: true
            });
          case "false":
            return this.node(token, {
              kind: Kind.BOOLEAN,
              value: false
            });
          case "null":
            return this.node(token, {
              kind: Kind.NULL
            });
          default:
            return this.node(token, {
              kind: Kind.ENUM,
              value: token.value
            });
        }
      case TokenKind.DOLLAR:
        if (isConst) {
          this.expectToken(TokenKind.DOLLAR);
          if (this._lexer.token.kind === TokenKind.NAME) {
            const varName = this._lexer.token.value;
            throw syntaxError(
              this._lexer.source,
              token.start,
              `Unexpected variable "$${varName}" in constant value.`
            );
          } else {
            throw this.unexpected(token);
          }
        }
        return this.parseVariable();
      default:
        throw this.unexpected();
    }
  }
  parseConstValueLiteral() {
    return this.parseValueLiteral(true);
  }
  parseStringLiteral() {
    const token = this._lexer.token;
    this.advanceLexer();
    return this.node(token, {
      kind: Kind.STRING,
      value: token.value,
      block: token.kind === TokenKind.BLOCK_STRING
    });
  }
  /**
   * ListValue[Const] :
   *   - [ ]
   *   - [ Value[?Const]+ ]
   */
  parseList(isConst) {
    const item = () => this.parseValueLiteral(isConst);
    return this.node(this._lexer.token, {
      kind: Kind.LIST,
      values: this.any(TokenKind.BRACKET_L, item, TokenKind.BRACKET_R)
    });
  }
  /**
   * ```
   * ObjectValue[Const] :
   *   - { }
   *   - { ObjectField[?Const]+ }
   * ```
   */
  parseObject(isConst) {
    const item = () => this.parseObjectField(isConst);
    return this.node(this._lexer.token, {
      kind: Kind.OBJECT,
      fields: this.any(TokenKind.BRACE_L, item, TokenKind.BRACE_R)
    });
  }
  /**
   * ObjectField[Const] : Name : Value[?Const]
   */
  parseObjectField(isConst) {
    const start = this._lexer.token;
    const name = this.parseName();
    this.expectToken(TokenKind.COLON);
    return this.node(start, {
      kind: Kind.OBJECT_FIELD,
      name,
      value: this.parseValueLiteral(isConst)
    });
  }
  // Implements the parsing rules in the Directives section.
  /**
   * Directives[Const] : Directive[?Const]+
   */
  parseDirectives(isConst) {
    const directives = [];
    while (this.peek(TokenKind.AT)) {
      directives.push(this.parseDirective(isConst));
    }
    return directives;
  }
  parseConstDirectives() {
    return this.parseDirectives(true);
  }
  /**
   * ```
   * Directive[Const] : @ Name Arguments[?Const]?
   * ```
   */
  parseDirective(isConst) {
    const start = this._lexer.token;
    this.expectToken(TokenKind.AT);
    return this.node(start, {
      kind: Kind.DIRECTIVE,
      name: this.parseName(),
      arguments: this.parseArguments(isConst)
    });
  }
  // Implements the parsing rules in the Types section.
  /**
   * Type :
   *   - NamedType
   *   - ListType
   *   - NonNullType
   */
  parseTypeReference() {
    const start = this._lexer.token;
    let type;
    if (this.expectOptionalToken(TokenKind.BRACKET_L)) {
      const innerType = this.parseTypeReference();
      this.expectToken(TokenKind.BRACKET_R);
      type = this.node(start, {
        kind: Kind.LIST_TYPE,
        type: innerType
      });
    } else {
      type = this.parseNamedType();
    }
    if (this.expectOptionalToken(TokenKind.BANG)) {
      return this.node(start, {
        kind: Kind.NON_NULL_TYPE,
        type
      });
    }
    return type;
  }
  /**
   * NamedType : Name
   */
  parseNamedType() {
    return this.node(this._lexer.token, {
      kind: Kind.NAMED_TYPE,
      name: this.parseName()
    });
  }
  // Implements the parsing rules in the Type Definition section.
  peekDescription() {
    return this.peek(TokenKind.STRING) || this.peek(TokenKind.BLOCK_STRING);
  }
  /**
   * Description : StringValue
   */
  parseDescription() {
    if (this.peekDescription()) {
      return this.parseStringLiteral();
    }
  }
  /**
   * ```
   * SchemaDefinition : Description? schema Directives[Const]? { OperationTypeDefinition+ }
   * ```
   */
  parseSchemaDefinition() {
    const start = this._lexer.token;
    const description = this.parseDescription();
    this.expectKeyword("schema");
    const directives = this.parseConstDirectives();
    const operationTypes = this.many(
      TokenKind.BRACE_L,
      this.parseOperationTypeDefinition,
      TokenKind.BRACE_R
    );
    return this.node(start, {
      kind: Kind.SCHEMA_DEFINITION,
      description,
      directives,
      operationTypes
    });
  }
  /**
   * OperationTypeDefinition : OperationType : NamedType
   */
  parseOperationTypeDefinition() {
    const start = this._lexer.token;
    const operation = this.parseOperationType();
    this.expectToken(TokenKind.COLON);
    const type = this.parseNamedType();
    return this.node(start, {
      kind: Kind.OPERATION_TYPE_DEFINITION,
      operation,
      type
    });
  }
  /**
   * ScalarTypeDefinition : Description? scalar Name Directives[Const]?
   */
  parseScalarTypeDefinition() {
    const start = this._lexer.token;
    const description = this.parseDescription();
    this.expectKeyword("scalar");
    const name = this.parseName();
    const directives = this.parseConstDirectives();
    return this.node(start, {
      kind: Kind.SCALAR_TYPE_DEFINITION,
      description,
      name,
      directives
    });
  }
  /**
   * ObjectTypeDefinition :
   *   Description?
   *   type Name ImplementsInterfaces? Directives[Const]? FieldsDefinition?
   */
  parseObjectTypeDefinition() {
    const start = this._lexer.token;
    const description = this.parseDescription();
    this.expectKeyword("type");
    const name = this.parseName();
    const interfaces = this.parseImplementsInterfaces();
    const directives = this.parseConstDirectives();
    const fields = this.parseFieldsDefinition();
    return this.node(start, {
      kind: Kind.OBJECT_TYPE_DEFINITION,
      description,
      name,
      interfaces,
      directives,
      fields
    });
  }
  /**
   * ImplementsInterfaces :
   *   - implements `&`? NamedType
   *   - ImplementsInterfaces & NamedType
   */
  parseImplementsInterfaces() {
    return this.expectOptionalKeyword("implements") ? this.delimitedMany(TokenKind.AMP, this.parseNamedType) : [];
  }
  /**
   * ```
   * FieldsDefinition : { FieldDefinition+ }
   * ```
   */
  parseFieldsDefinition() {
    return this.optionalMany(
      TokenKind.BRACE_L,
      this.parseFieldDefinition,
      TokenKind.BRACE_R
    );
  }
  /**
   * FieldDefinition :
   *   - Description? Name ArgumentsDefinition? : Type Directives[Const]?
   */
  parseFieldDefinition() {
    const start = this._lexer.token;
    const description = this.parseDescription();
    const name = this.parseName();
    const args = this.parseArgumentDefs();
    this.expectToken(TokenKind.COLON);
    const type = this.parseTypeReference();
    const directives = this.parseConstDirectives();
    return this.node(start, {
      kind: Kind.FIELD_DEFINITION,
      description,
      name,
      arguments: args,
      type,
      directives
    });
  }
  /**
   * ArgumentsDefinition : ( InputValueDefinition+ )
   */
  parseArgumentDefs() {
    return this.optionalMany(
      TokenKind.PAREN_L,
      this.parseInputValueDef,
      TokenKind.PAREN_R
    );
  }
  /**
   * InputValueDefinition :
   *   - Description? Name : Type DefaultValue? Directives[Const]?
   */
  parseInputValueDef() {
    const start = this._lexer.token;
    const description = this.parseDescription();
    const name = this.parseName();
    this.expectToken(TokenKind.COLON);
    const type = this.parseTypeReference();
    let defaultValue;
    if (this.expectOptionalToken(TokenKind.EQUALS)) {
      defaultValue = this.parseConstValueLiteral();
    }
    const directives = this.parseConstDirectives();
    return this.node(start, {
      kind: Kind.INPUT_VALUE_DEFINITION,
      description,
      name,
      type,
      defaultValue,
      directives
    });
  }
  /**
   * InterfaceTypeDefinition :
   *   - Description? interface Name Directives[Const]? FieldsDefinition?
   */
  parseInterfaceTypeDefinition() {
    const start = this._lexer.token;
    const description = this.parseDescription();
    this.expectKeyword("interface");
    const name = this.parseName();
    const interfaces = this.parseImplementsInterfaces();
    const directives = this.parseConstDirectives();
    const fields = this.parseFieldsDefinition();
    return this.node(start, {
      kind: Kind.INTERFACE_TYPE_DEFINITION,
      description,
      name,
      interfaces,
      directives,
      fields
    });
  }
  /**
   * UnionTypeDefinition :
   *   - Description? union Name Directives[Const]? UnionMemberTypes?
   */
  parseUnionTypeDefinition() {
    const start = this._lexer.token;
    const description = this.parseDescription();
    this.expectKeyword("union");
    const name = this.parseName();
    const directives = this.parseConstDirectives();
    const types = this.parseUnionMemberTypes();
    return this.node(start, {
      kind: Kind.UNION_TYPE_DEFINITION,
      description,
      name,
      directives,
      types
    });
  }
  /**
   * UnionMemberTypes :
   *   - = `|`? NamedType
   *   - UnionMemberTypes | NamedType
   */
  parseUnionMemberTypes() {
    return this.expectOptionalToken(TokenKind.EQUALS) ? this.delimitedMany(TokenKind.PIPE, this.parseNamedType) : [];
  }
  /**
   * EnumTypeDefinition :
   *   - Description? enum Name Directives[Const]? EnumValuesDefinition?
   */
  parseEnumTypeDefinition() {
    const start = this._lexer.token;
    const description = this.parseDescription();
    this.expectKeyword("enum");
    const name = this.parseName();
    const directives = this.parseConstDirectives();
    const values = this.parseEnumValuesDefinition();
    return this.node(start, {
      kind: Kind.ENUM_TYPE_DEFINITION,
      description,
      name,
      directives,
      values
    });
  }
  /**
   * ```
   * EnumValuesDefinition : { EnumValueDefinition+ }
   * ```
   */
  parseEnumValuesDefinition() {
    return this.optionalMany(
      TokenKind.BRACE_L,
      this.parseEnumValueDefinition,
      TokenKind.BRACE_R
    );
  }
  /**
   * EnumValueDefinition : Description? EnumValue Directives[Const]?
   */
  parseEnumValueDefinition() {
    const start = this._lexer.token;
    const description = this.parseDescription();
    const name = this.parseEnumValueName();
    const directives = this.parseConstDirectives();
    return this.node(start, {
      kind: Kind.ENUM_VALUE_DEFINITION,
      description,
      name,
      directives
    });
  }
  /**
   * EnumValue : Name but not `true`, `false` or `null`
   */
  parseEnumValueName() {
    if (this._lexer.token.value === "true" || this._lexer.token.value === "false" || this._lexer.token.value === "null") {
      throw syntaxError(
        this._lexer.source,
        this._lexer.token.start,
        `${getTokenDesc(
          this._lexer.token
        )} is reserved and cannot be used for an enum value.`
      );
    }
    return this.parseName();
  }
  /**
   * InputObjectTypeDefinition :
   *   - Description? input Name Directives[Const]? InputFieldsDefinition?
   */
  parseInputObjectTypeDefinition() {
    const start = this._lexer.token;
    const description = this.parseDescription();
    this.expectKeyword("input");
    const name = this.parseName();
    const directives = this.parseConstDirectives();
    const fields = this.parseInputFieldsDefinition();
    return this.node(start, {
      kind: Kind.INPUT_OBJECT_TYPE_DEFINITION,
      description,
      name,
      directives,
      fields
    });
  }
  /**
   * ```
   * InputFieldsDefinition : { InputValueDefinition+ }
   * ```
   */
  parseInputFieldsDefinition() {
    return this.optionalMany(
      TokenKind.BRACE_L,
      this.parseInputValueDef,
      TokenKind.BRACE_R
    );
  }
  /**
   * TypeSystemExtension :
   *   - SchemaExtension
   *   - TypeExtension
   *
   * TypeExtension :
   *   - ScalarTypeExtension
   *   - ObjectTypeExtension
   *   - InterfaceTypeExtension
   *   - UnionTypeExtension
   *   - EnumTypeExtension
   *   - InputObjectTypeDefinition
   *   - DirectiveDefinitionExtension
   */
  parseTypeSystemExtension() {
    const keywordToken = this._lexer.lookahead();
    if (keywordToken.kind === TokenKind.NAME) {
      switch (keywordToken.value) {
        case "schema":
          return this.parseSchemaExtension();
        case "scalar":
          return this.parseScalarTypeExtension();
        case "type":
          return this.parseObjectTypeExtension();
        case "interface":
          return this.parseInterfaceTypeExtension();
        case "union":
          return this.parseUnionTypeExtension();
        case "enum":
          return this.parseEnumTypeExtension();
        case "input":
          return this.parseInputObjectTypeExtension();
        case "directive":
          if (this._options.experimentalDirectivesOnDirectiveDefinitions) {
            return this.parseDirectiveDefinitionExtension();
          }
          break;
      }
    }
    throw this.unexpected(keywordToken);
  }
  /**
   * ```
   * SchemaExtension :
   *  - extend schema Directives[Const]? { OperationTypeDefinition+ }
   *  - extend schema Directives[Const]
   * ```
   */
  parseSchemaExtension() {
    const start = this._lexer.token;
    this.expectKeyword("extend");
    this.expectKeyword("schema");
    const directives = this.parseConstDirectives();
    const operationTypes = this.optionalMany(
      TokenKind.BRACE_L,
      this.parseOperationTypeDefinition,
      TokenKind.BRACE_R
    );
    if (directives.length === 0 && operationTypes.length === 0) {
      throw this.unexpected();
    }
    return this.node(start, {
      kind: Kind.SCHEMA_EXTENSION,
      directives,
      operationTypes
    });
  }
  /**
   * ScalarTypeExtension :
   *   - extend scalar Name Directives[Const]
   */
  parseScalarTypeExtension() {
    const start = this._lexer.token;
    this.expectKeyword("extend");
    this.expectKeyword("scalar");
    const name = this.parseName();
    const directives = this.parseConstDirectives();
    if (directives.length === 0) {
      throw this.unexpected();
    }
    return this.node(start, {
      kind: Kind.SCALAR_TYPE_EXTENSION,
      name,
      directives
    });
  }
  /**
   * ObjectTypeExtension :
   *  - extend type Name ImplementsInterfaces? Directives[Const]? FieldsDefinition
   *  - extend type Name ImplementsInterfaces? Directives[Const]
   *  - extend type Name ImplementsInterfaces
   */
  parseObjectTypeExtension() {
    const start = this._lexer.token;
    this.expectKeyword("extend");
    this.expectKeyword("type");
    const name = this.parseName();
    const interfaces = this.parseImplementsInterfaces();
    const directives = this.parseConstDirectives();
    const fields = this.parseFieldsDefinition();
    if (interfaces.length === 0 && directives.length === 0 && fields.length === 0) {
      throw this.unexpected();
    }
    return this.node(start, {
      kind: Kind.OBJECT_TYPE_EXTENSION,
      name,
      interfaces,
      directives,
      fields
    });
  }
  /**
   * InterfaceTypeExtension :
   *  - extend interface Name ImplementsInterfaces? Directives[Const]? FieldsDefinition
   *  - extend interface Name ImplementsInterfaces? Directives[Const]
   *  - extend interface Name ImplementsInterfaces
   */
  parseInterfaceTypeExtension() {
    const start = this._lexer.token;
    this.expectKeyword("extend");
    this.expectKeyword("interface");
    const name = this.parseName();
    const interfaces = this.parseImplementsInterfaces();
    const directives = this.parseConstDirectives();
    const fields = this.parseFieldsDefinition();
    if (interfaces.length === 0 && directives.length === 0 && fields.length === 0) {
      throw this.unexpected();
    }
    return this.node(start, {
      kind: Kind.INTERFACE_TYPE_EXTENSION,
      name,
      interfaces,
      directives,
      fields
    });
  }
  /**
   * UnionTypeExtension :
   *   - extend union Name Directives[Const]? UnionMemberTypes
   *   - extend union Name Directives[Const]
   */
  parseUnionTypeExtension() {
    const start = this._lexer.token;
    this.expectKeyword("extend");
    this.expectKeyword("union");
    const name = this.parseName();
    const directives = this.parseConstDirectives();
    const types = this.parseUnionMemberTypes();
    if (directives.length === 0 && types.length === 0) {
      throw this.unexpected();
    }
    return this.node(start, {
      kind: Kind.UNION_TYPE_EXTENSION,
      name,
      directives,
      types
    });
  }
  /**
   * EnumTypeExtension :
   *   - extend enum Name Directives[Const]? EnumValuesDefinition
   *   - extend enum Name Directives[Const]
   */
  parseEnumTypeExtension() {
    const start = this._lexer.token;
    this.expectKeyword("extend");
    this.expectKeyword("enum");
    const name = this.parseName();
    const directives = this.parseConstDirectives();
    const values = this.parseEnumValuesDefinition();
    if (directives.length === 0 && values.length === 0) {
      throw this.unexpected();
    }
    return this.node(start, {
      kind: Kind.ENUM_TYPE_EXTENSION,
      name,
      directives,
      values
    });
  }
  /**
   * InputObjectTypeExtension :
   *   - extend input Name Directives[Const]? InputFieldsDefinition
   *   - extend input Name Directives[Const]
   */
  parseInputObjectTypeExtension() {
    const start = this._lexer.token;
    this.expectKeyword("extend");
    this.expectKeyword("input");
    const name = this.parseName();
    const directives = this.parseConstDirectives();
    const fields = this.parseInputFieldsDefinition();
    if (directives.length === 0 && fields.length === 0) {
      throw this.unexpected();
    }
    return this.node(start, {
      kind: Kind.INPUT_OBJECT_TYPE_EXTENSION,
      name,
      directives,
      fields
    });
  }
  parseDirectiveDefinitionExtension() {
    const start = this._lexer.token;
    this.expectKeyword("extend");
    this.expectKeyword("directive");
    this.expectToken(TokenKind.AT);
    const name = this.parseName();
    const directives = this.parseConstDirectives();
    if (directives.length === 0) {
      throw this.unexpected();
    }
    return this.node(start, {
      kind: Kind.DIRECTIVE_EXTENSION,
      name,
      directives
    });
  }
  /**
   * ```
   * DirectiveDefinition :
   *   - Description? directive @ Name ArgumentsDefinition? `repeatable`? on DirectiveLocations
   * ```
   */
  parseDirectiveDefinition() {
    const start = this._lexer.token;
    const description = this.parseDescription();
    this.expectKeyword("directive");
    this.expectToken(TokenKind.AT);
    const name = this.parseName();
    const args = this.parseArgumentDefs();
    const directives = this._options.experimentalDirectivesOnDirectiveDefinitions ? this.parseConstDirectives() : [];
    const repeatable = this.expectOptionalKeyword("repeatable");
    this.expectKeyword("on");
    const locations = this.parseDirectiveLocations();
    return this.node(start, {
      kind: Kind.DIRECTIVE_DEFINITION,
      description,
      name,
      arguments: args,
      directives,
      repeatable,
      locations
    });
  }
  /**
   * DirectiveLocations :
   *   - `|`? DirectiveLocation
   *   - DirectiveLocations | DirectiveLocation
   */
  parseDirectiveLocations() {
    return this.delimitedMany(TokenKind.PIPE, this.parseDirectiveLocation);
  }
  /*
   * DirectiveLocation :
   *   - ExecutableDirectiveLocation
   *   - TypeSystemDirectiveLocation
   *
   * ExecutableDirectiveLocation : one of
   *   `QUERY`
   *   `MUTATION`
   *   `SUBSCRIPTION`
   *   `FIELD`
   *   `FRAGMENT_DEFINITION`
   *   `FRAGMENT_SPREAD`
   *   `INLINE_FRAGMENT`
   *
   * TypeSystemDirectiveLocation : one of
   *   `SCHEMA`
   *   `SCALAR`
   *   `OBJECT`
   *   `FIELD_DEFINITION`
   *   `ARGUMENT_DEFINITION`
   *   `INTERFACE`
   *   `UNION`
   *   `ENUM`
   *   `ENUM_VALUE`
   *   `INPUT_OBJECT`
   *   `INPUT_FIELD_DEFINITION`
   *   `DIRECTIVE_DEFINITION`
   */
  parseDirectiveLocation() {
    const start = this._lexer.token;
    const name = this.parseName();
    if (Object.prototype.hasOwnProperty.call(DirectiveLocation, name.value)) {
      return name;
    }
    throw this.unexpected(start);
  }
  // Schema Coordinates
  /**
   * SchemaCoordinate :
   *   - Name
   *   - Name . Name
   *   - Name . Name ( Name : )
   *   - \@ Name
   *   - \@ Name ( Name : )
   */
  parseSchemaCoordinate() {
    const start = this._lexer.token;
    const ofDirective = this.expectOptionalToken(TokenKind.AT);
    const name = this.parseName();
    let memberName;
    if (!ofDirective && this.expectOptionalToken(TokenKind.DOT)) {
      memberName = this.parseName();
    }
    let argumentName;
    if ((ofDirective || memberName) && this.expectOptionalToken(TokenKind.PAREN_L)) {
      argumentName = this.parseName();
      this.expectToken(TokenKind.COLON);
      this.expectToken(TokenKind.PAREN_R);
    }
    if (ofDirective) {
      if (argumentName) {
        return this.node(start, {
          kind: Kind.DIRECTIVE_ARGUMENT_COORDINATE,
          name,
          argumentName
        });
      }
      return this.node(start, {
        kind: Kind.DIRECTIVE_COORDINATE,
        name
      });
    } else if (memberName) {
      if (argumentName) {
        return this.node(start, {
          kind: Kind.ARGUMENT_COORDINATE,
          name,
          fieldName: memberName,
          argumentName
        });
      }
      return this.node(start, {
        kind: Kind.MEMBER_COORDINATE,
        name,
        memberName
      });
    }
    return this.node(start, {
      kind: Kind.TYPE_COORDINATE,
      name
    });
  }
  // Core parsing utility functions
  /**
   * Returns a node that, if configured to do so, sets a "loc" field as a
   * location object, used to identify the place in the source that created a
   * given parsed object.
   */
  node(startToken, node) {
    if (this._options.noLocation !== true) {
      node.loc = new Location(
        startToken,
        this._lexer.lastToken,
        this._lexer.source
      );
    }
    return node;
  }
  /**
   * Determines if the next token is of a given kind
   */
  peek(kind) {
    return this._lexer.token.kind === kind;
  }
  /**
   * If the next token is of the given kind, return that token after advancing the lexer.
   * Otherwise, do not change the parser state and throw an error.
   */
  expectToken(kind) {
    const token = this._lexer.token;
    if (token.kind === kind) {
      this.advanceLexer();
      return token;
    }
    throw syntaxError(
      this._lexer.source,
      token.start,
      `Expected ${getTokenKindDesc(kind)}, found ${getTokenDesc(token)}.`
    );
  }
  /**
   * If the next token is of the given kind, return "true" after advancing the lexer.
   * Otherwise, do not change the parser state and return "false".
   */
  expectOptionalToken(kind) {
    const token = this._lexer.token;
    if (token.kind === kind) {
      this.advanceLexer();
      return true;
    }
    return false;
  }
  /**
   * If the next token is a given keyword, advance the lexer.
   * Otherwise, do not change the parser state and throw an error.
   */
  expectKeyword(value) {
    const token = this._lexer.token;
    if (token.kind === TokenKind.NAME && token.value === value) {
      this.advanceLexer();
    } else {
      throw syntaxError(
        this._lexer.source,
        token.start,
        `Expected "${value}", found ${getTokenDesc(token)}.`
      );
    }
  }
  /**
   * If the next token is a given keyword, return "true" after advancing the lexer.
   * Otherwise, do not change the parser state and return "false".
   */
  expectOptionalKeyword(value) {
    const token = this._lexer.token;
    if (token.kind === TokenKind.NAME && token.value === value) {
      this.advanceLexer();
      return true;
    }
    return false;
  }
  /**
   * Helper function for creating an error when an unexpected lexed token is encountered.
   */
  unexpected(atToken) {
    const token = atToken !== null && atToken !== void 0 ? atToken : this._lexer.token;
    return syntaxError(
      this._lexer.source,
      token.start,
      `Unexpected ${getTokenDesc(token)}.`
    );
  }
  /**
   * Returns a possibly empty list of parse nodes, determined by the parseFn.
   * This list begins with a lex token of openKind and ends with a lex token of closeKind.
   * Advances the parser to the next lex token after the closing token.
   */
  any(openKind, parseFn, closeKind) {
    this.expectToken(openKind);
    const nodes = [];
    while (!this.expectOptionalToken(closeKind)) {
      nodes.push(parseFn.call(this));
    }
    return nodes;
  }
  /**
   * Returns a list of parse nodes, determined by the parseFn.
   * It can be empty only if open token is missing otherwise it will always return non-empty list
   * that begins with a lex token of openKind and ends with a lex token of closeKind.
   * Advances the parser to the next lex token after the closing token.
   */
  optionalMany(openKind, parseFn, closeKind) {
    if (this.expectOptionalToken(openKind)) {
      const nodes = [];
      do {
        nodes.push(parseFn.call(this));
      } while (!this.expectOptionalToken(closeKind));
      return nodes;
    }
    return [];
  }
  /**
   * Returns a non-empty list of parse nodes, determined by the parseFn.
   * This list begins with a lex token of openKind and ends with a lex token of closeKind.
   * Advances the parser to the next lex token after the closing token.
   */
  many(openKind, parseFn, closeKind) {
    this.expectToken(openKind);
    const nodes = [];
    do {
      nodes.push(parseFn.call(this));
    } while (!this.expectOptionalToken(closeKind));
    return nodes;
  }
  /**
   * Returns a non-empty list of parse nodes, determined by the parseFn.
   * This list may begin with a lex token of delimiterKind followed by items separated by lex tokens of tokenKind.
   * Advances the parser to the next lex token after last item in the list.
   */
  delimitedMany(delimiterKind, parseFn) {
    this.expectOptionalToken(delimiterKind);
    const nodes = [];
    do {
      nodes.push(parseFn.call(this));
    } while (this.expectOptionalToken(delimiterKind));
    return nodes;
  }
  advanceLexer() {
    const { maxTokens } = this._options;
    const token = this._lexer.advance();
    if (token.kind !== TokenKind.EOF) {
      ++this._tokenCounter;
      if (maxTokens !== void 0 && this._tokenCounter > maxTokens) {
        throw syntaxError(
          this._lexer.source,
          token.start,
          `Document contains more that ${maxTokens} tokens. Parsing aborted.`
        );
      }
    }
  }
};
function getTokenDesc(token) {
  const value = token.value;
  return getTokenKindDesc(token.kind) + (value != null ? ` "${value}"` : "");
}
function getTokenKindDesc(kind) {
  return isPunctuatorTokenKind(kind) ? `"${kind}"` : kind;
}

// node_modules/graphql/language/printString.mjs
function printString(str) {
  return `"${str.replace(escapedRegExp, escapedReplacer)}"`;
}
var escapedRegExp = /[\x00-\x1f\x22\x5c\x7f-\x9f]/g;
function escapedReplacer(str) {
  return escapeSequences[str.charCodeAt(0)];
}
var escapeSequences = [
  "\\u0000",
  "\\u0001",
  "\\u0002",
  "\\u0003",
  "\\u0004",
  "\\u0005",
  "\\u0006",
  "\\u0007",
  "\\b",
  "\\t",
  "\\n",
  "\\u000B",
  "\\f",
  "\\r",
  "\\u000E",
  "\\u000F",
  "\\u0010",
  "\\u0011",
  "\\u0012",
  "\\u0013",
  "\\u0014",
  "\\u0015",
  "\\u0016",
  "\\u0017",
  "\\u0018",
  "\\u0019",
  "\\u001A",
  "\\u001B",
  "\\u001C",
  "\\u001D",
  "\\u001E",
  "\\u001F",
  "",
  "",
  '\\"',
  "",
  "",
  "",
  "",
  "",
  "",
  "",
  "",
  "",
  "",
  "",
  "",
  "",
  // 2F
  "",
  "",
  "",
  "",
  "",
  "",
  "",
  "",
  "",
  "",
  "",
  "",
  "",
  "",
  "",
  "",
  // 3F
  "",
  "",
  "",
  "",
  "",
  "",
  "",
  "",
  "",
  "",
  "",
  "",
  "",
  "",
  "",
  "",
  // 4F
  "",
  "",
  "",
  "",
  "",
  "",
  "",
  "",
  "",
  "",
  "",
  "",
  "\\\\",
  "",
  "",
  "",
  // 5F
  "",
  "",
  "",
  "",
  "",
  "",
  "",
  "",
  "",
  "",
  "",
  "",
  "",
  "",
  "",
  "",
  // 6F
  "",
  "",
  "",
  "",
  "",
  "",
  "",
  "",
  "",
  "",
  "",
  "",
  "",
  "",
  "",
  "\\u007F",
  "\\u0080",
  "\\u0081",
  "\\u0082",
  "\\u0083",
  "\\u0084",
  "\\u0085",
  "\\u0086",
  "\\u0087",
  "\\u0088",
  "\\u0089",
  "\\u008A",
  "\\u008B",
  "\\u008C",
  "\\u008D",
  "\\u008E",
  "\\u008F",
  "\\u0090",
  "\\u0091",
  "\\u0092",
  "\\u0093",
  "\\u0094",
  "\\u0095",
  "\\u0096",
  "\\u0097",
  "\\u0098",
  "\\u0099",
  "\\u009A",
  "\\u009B",
  "\\u009C",
  "\\u009D",
  "\\u009E",
  "\\u009F"
];

// node_modules/graphql/language/visitor.mjs
var BREAK = Object.freeze({});
function visit(root, visitor, visitorKeys = QueryDocumentKeys) {
  const enterLeaveMap = /* @__PURE__ */ new Map();
  for (const kind of Object.values(Kind)) {
    enterLeaveMap.set(kind, getEnterLeaveForKind(visitor, kind));
  }
  let stack = void 0;
  let inArray = Array.isArray(root);
  let keys = [root];
  let index = -1;
  let edits = [];
  let node = root;
  let key = void 0;
  let parent = void 0;
  const path = [];
  const ancestors = [];
  do {
    index++;
    const isLeaving = index === keys.length;
    const isEdited = isLeaving && edits.length !== 0;
    if (isLeaving) {
      key = ancestors.length === 0 ? void 0 : path[path.length - 1];
      node = parent;
      parent = ancestors.pop();
      if (isEdited) {
        if (inArray) {
          node = node.slice();
          let editOffset = 0;
          for (const [editKey, editValue] of edits) {
            const arrayKey = editKey - editOffset;
            if (editValue === null) {
              node.splice(arrayKey, 1);
              editOffset++;
            } else {
              node[arrayKey] = editValue;
            }
          }
        } else {
          node = { ...node };
          for (const [editKey, editValue] of edits) {
            node[editKey] = editValue;
          }
        }
      }
      index = stack.index;
      keys = stack.keys;
      edits = stack.edits;
      inArray = stack.inArray;
      stack = stack.prev;
    } else if (parent) {
      key = inArray ? index : keys[index];
      node = parent[key];
      if (node === null || node === void 0) {
        continue;
      }
      path.push(key);
    }
    let result;
    if (!Array.isArray(node)) {
      var _enterLeaveMap$get, _enterLeaveMap$get2;
      isNode(node) || devAssert(false, `Invalid AST Node: ${inspect(node)}.`);
      const visitFn = isLeaving ? (_enterLeaveMap$get = enterLeaveMap.get(node.kind)) === null || _enterLeaveMap$get === void 0 ? void 0 : _enterLeaveMap$get.leave : (_enterLeaveMap$get2 = enterLeaveMap.get(node.kind)) === null || _enterLeaveMap$get2 === void 0 ? void 0 : _enterLeaveMap$get2.enter;
      result = visitFn === null || visitFn === void 0 ? void 0 : visitFn.call(visitor, node, key, parent, path, ancestors);
      if (result === BREAK) {
        break;
      }
      if (result === false) {
        if (!isLeaving) {
          path.pop();
          continue;
        }
      } else if (result !== void 0) {
        edits.push([key, result]);
        if (!isLeaving) {
          if (isNode(result)) {
            node = result;
          } else {
            path.pop();
            continue;
          }
        }
      }
    }
    if (result === void 0 && isEdited) {
      edits.push([key, node]);
    }
    if (isLeaving) {
      path.pop();
    } else {
      var _node$kind;
      stack = {
        inArray,
        index,
        keys,
        edits,
        prev: stack
      };
      inArray = Array.isArray(node);
      keys = inArray ? node : (_node$kind = visitorKeys[node.kind]) !== null && _node$kind !== void 0 ? _node$kind : [];
      index = -1;
      edits = [];
      if (parent) {
        ancestors.push(parent);
      }
      parent = node;
    }
  } while (stack !== void 0);
  if (edits.length !== 0) {
    return edits[edits.length - 1][1];
  }
  return root;
}
function getEnterLeaveForKind(visitor, kind) {
  const kindVisitor = visitor[kind];
  if (typeof kindVisitor === "object") {
    return kindVisitor;
  } else if (typeof kindVisitor === "function") {
    return {
      enter: kindVisitor,
      leave: void 0
    };
  }
  return {
    enter: visitor.enter,
    leave: visitor.leave
  };
}

// node_modules/graphql/language/printer.mjs
function print(ast) {
  return visit(ast, printDocASTReducer);
}
var MAX_LINE_LENGTH = 80;
var printDocASTReducer = {
  Name: {
    leave: (node) => node.value
  },
  Variable: {
    leave: (node) => "$" + node.name
  },
  // Document
  Document: {
    leave: (node) => join(node.definitions, "\n\n")
  },
  OperationDefinition: {
    leave(node) {
      const varDefs = hasMultilineItems(node.variableDefinitions) ? wrap("(\n", join(node.variableDefinitions, "\n"), "\n)") : wrap("(", join(node.variableDefinitions, ", "), ")");
      const prefix = wrap("", node.description, "\n") + join(
        [
          node.operation,
          join([node.name, varDefs]),
          join(node.directives, " ")
        ],
        " "
      );
      return (prefix === "query" ? "" : prefix + " ") + node.selectionSet;
    }
  },
  VariableDefinition: {
    leave: ({ variable, type, defaultValue, directives, description }) => wrap("", description, "\n") + variable + ": " + type + wrap(" = ", defaultValue) + wrap(" ", join(directives, " "))
  },
  SelectionSet: {
    leave: ({ selections }) => block(selections)
  },
  Field: {
    leave({ alias, name, arguments: args, directives, selectionSet }) {
      const prefix = wrap("", alias, ": ") + name;
      let argsLine = prefix + wrap("(", join(args, ", "), ")");
      if (argsLine.length > MAX_LINE_LENGTH) {
        argsLine = prefix + wrap("(\n", indent(join(args, "\n")), "\n)");
      }
      return join([argsLine, join(directives, " "), selectionSet], " ");
    }
  },
  Argument: {
    leave: ({ name, value }) => name + ": " + value
  },
  // Fragments
  FragmentSpread: {
    leave: ({ name, directives }) => "..." + name + wrap(" ", join(directives, " "))
  },
  InlineFragment: {
    leave: ({ typeCondition, directives, selectionSet }) => join(
      [
        "...",
        wrap("on ", typeCondition),
        join(directives, " "),
        selectionSet
      ],
      " "
    )
  },
  FragmentDefinition: {
    leave: ({
      name,
      typeCondition,
      variableDefinitions,
      directives,
      selectionSet,
      description
    }) => wrap("", description, "\n") + // Note: fragment variable definitions are experimental and may be changed
    // or removed in the future.
    `fragment ${name}${wrap("(", join(variableDefinitions, ", "), ")")} on ${typeCondition} ${wrap("", join(directives, " "), " ")}` + selectionSet
  },
  // Value
  IntValue: {
    leave: ({ value }) => value
  },
  FloatValue: {
    leave: ({ value }) => value
  },
  StringValue: {
    leave: ({ value, block: isBlockString }) => isBlockString ? printBlockString(value) : printString(value)
  },
  BooleanValue: {
    leave: ({ value }) => value ? "true" : "false"
  },
  NullValue: {
    leave: () => "null"
  },
  EnumValue: {
    leave: ({ value }) => value
  },
  ListValue: {
    leave: ({ values }) => "[" + join(values, ", ") + "]"
  },
  ObjectValue: {
    leave: ({ fields }) => "{" + join(fields, ", ") + "}"
  },
  ObjectField: {
    leave: ({ name, value }) => name + ": " + value
  },
  // Directive
  Directive: {
    leave: ({ name, arguments: args }) => "@" + name + wrap("(", join(args, ", "), ")")
  },
  // Type
  NamedType: {
    leave: ({ name }) => name
  },
  ListType: {
    leave: ({ type }) => "[" + type + "]"
  },
  NonNullType: {
    leave: ({ type }) => type + "!"
  },
  // Type System Definitions
  SchemaDefinition: {
    leave: ({ description, directives, operationTypes }) => wrap("", description, "\n") + join(["schema", join(directives, " "), block(operationTypes)], " ")
  },
  OperationTypeDefinition: {
    leave: ({ operation, type }) => operation + ": " + type
  },
  ScalarTypeDefinition: {
    leave: ({ description, name, directives }) => wrap("", description, "\n") + join(["scalar", name, join(directives, " ")], " ")
  },
  ObjectTypeDefinition: {
    leave: ({ description, name, interfaces, directives, fields }) => wrap("", description, "\n") + join(
      [
        "type",
        name,
        wrap("implements ", join(interfaces, " & ")),
        join(directives, " "),
        block(fields)
      ],
      " "
    )
  },
  FieldDefinition: {
    leave: ({ description, name, arguments: args, type, directives }) => wrap("", description, "\n") + name + (hasMultilineItems(args) ? wrap("(\n", indent(join(args, "\n")), "\n)") : wrap("(", join(args, ", "), ")")) + ": " + type + wrap(" ", join(directives, " "))
  },
  InputValueDefinition: {
    leave: ({ description, name, type, defaultValue, directives }) => wrap("", description, "\n") + join(
      [name + ": " + type, wrap("= ", defaultValue), join(directives, " ")],
      " "
    )
  },
  InterfaceTypeDefinition: {
    leave: ({ description, name, interfaces, directives, fields }) => wrap("", description, "\n") + join(
      [
        "interface",
        name,
        wrap("implements ", join(interfaces, " & ")),
        join(directives, " "),
        block(fields)
      ],
      " "
    )
  },
  UnionTypeDefinition: {
    leave: ({ description, name, directives, types }) => wrap("", description, "\n") + join(
      ["union", name, join(directives, " "), wrap("= ", join(types, " | "))],
      " "
    )
  },
  EnumTypeDefinition: {
    leave: ({ description, name, directives, values }) => wrap("", description, "\n") + join(["enum", name, join(directives, " "), block(values)], " ")
  },
  EnumValueDefinition: {
    leave: ({ description, name, directives }) => wrap("", description, "\n") + join([name, join(directives, " ")], " ")
  },
  InputObjectTypeDefinition: {
    leave: ({ description, name, directives, fields }) => wrap("", description, "\n") + join(["input", name, join(directives, " "), block(fields)], " ")
  },
  DirectiveDefinition: {
    leave: ({
      description,
      name,
      arguments: args,
      directives,
      repeatable,
      locations
    }) => wrap("", description, "\n") + "directive @" + name + (hasMultilineItems(args) ? wrap("(\n", indent(join(args, "\n")), "\n)") : wrap("(", join(args, ", "), ")")) + wrap(" ", join(directives, " ")) + (repeatable ? " repeatable" : "") + " on " + join(locations, " | ")
  },
  SchemaExtension: {
    leave: ({ directives, operationTypes }) => join(
      ["extend schema", join(directives, " "), block(operationTypes)],
      " "
    )
  },
  ScalarTypeExtension: {
    leave: ({ name, directives }) => join(["extend scalar", name, join(directives, " ")], " ")
  },
  ObjectTypeExtension: {
    leave: ({ name, interfaces, directives, fields }) => join(
      [
        "extend type",
        name,
        wrap("implements ", join(interfaces, " & ")),
        join(directives, " "),
        block(fields)
      ],
      " "
    )
  },
  InterfaceTypeExtension: {
    leave: ({ name, interfaces, directives, fields }) => join(
      [
        "extend interface",
        name,
        wrap("implements ", join(interfaces, " & ")),
        join(directives, " "),
        block(fields)
      ],
      " "
    )
  },
  UnionTypeExtension: {
    leave: ({ name, directives, types }) => join(
      [
        "extend union",
        name,
        join(directives, " "),
        wrap("= ", join(types, " | "))
      ],
      " "
    )
  },
  EnumTypeExtension: {
    leave: ({ name, directives, values }) => join(["extend enum", name, join(directives, " "), block(values)], " ")
  },
  InputObjectTypeExtension: {
    leave: ({ name, directives, fields }) => join(["extend input", name, join(directives, " "), block(fields)], " ")
  },
  DirectiveExtension: {
    leave: ({ name, directives }) => join(["extend directive @" + name, join(directives, " ")], " ")
  },
  // Schema Coordinates
  TypeCoordinate: {
    leave: ({ name }) => name
  },
  MemberCoordinate: {
    leave: ({ name, memberName }) => join([name, wrap(".", memberName)])
  },
  ArgumentCoordinate: {
    leave: ({ name, fieldName, argumentName }) => join([name, wrap(".", fieldName), wrap("(", argumentName, ":)")])
  },
  DirectiveCoordinate: {
    leave: ({ name }) => join(["@", name])
  },
  DirectiveArgumentCoordinate: {
    leave: ({ name, argumentName }) => join(["@", name, wrap("(", argumentName, ":)")])
  }
};
function join(maybeArray, separator = "") {
  var _maybeArray$filter$jo;
  return (_maybeArray$filter$jo = maybeArray === null || maybeArray === void 0 ? void 0 : maybeArray.filter((x2) => x2).join(separator)) !== null && _maybeArray$filter$jo !== void 0 ? _maybeArray$filter$jo : "";
}
function block(array) {
  return wrap("{\n", indent(join(array, "\n")), "\n}");
}
function wrap(start, maybeString, end = "") {
  return maybeString != null && maybeString !== "" ? start + maybeString + end : "";
}
function indent(str) {
  return wrap("  ", str.replace(/\n/g, "\n  "));
}
function hasMultilineItems(maybeArray) {
  var _maybeArray$some;
  return (_maybeArray$some = maybeArray === null || maybeArray === void 0 ? void 0 : maybeArray.some((str) => str.includes("\n"))) !== null && _maybeArray$some !== void 0 ? _maybeArray$some : false;
}

// node_modules/graphql-request/build/lib/http.js
var ACCEPT_HEADER = `Accept`;
var CONTENT_TYPE_HEADER = `Content-Type`;
var CONTENT_TYPE_JSON = `application/json`;
var CONTENT_TYPE_GQL = `application/graphql-response+json`;

// node_modules/graphql-request/build/legacy/lib/graphql.js
var cleanQuery = (str) => str.replace(/([\s,]|#[^\n\r]+)+/g, ` `).trim();
var isGraphQLContentType = (contentType) => {
  const contentTypeLower = contentType.toLowerCase();
  return contentTypeLower.includes(CONTENT_TYPE_GQL) || contentTypeLower.includes(CONTENT_TYPE_JSON);
};
var parseGraphQLExecutionResult = (result) => {
  try {
    if (Array.isArray(result)) {
      return {
        _tag: `Batch`,
        executionResults: result.map(parseExecutionResult)
      };
    } else if (isPlainObject(result)) {
      return {
        _tag: `Single`,
        executionResult: parseExecutionResult(result)
      };
    } else {
      throw new Error(`Invalid execution result: result is not object or array. 
Got:
${String(result)}`);
    }
  } catch (e7) {
    return e7;
  }
};
var parseExecutionResult = (result) => {
  if (typeof result !== `object` || result === null) {
    throw new Error(`Invalid execution result: result is not object`);
  }
  let errors = void 0;
  let data = void 0;
  let extensions = void 0;
  if (`errors` in result) {
    if (!isPlainObject(result.errors) && !Array.isArray(result.errors)) {
      throw new Error(`Invalid execution result: errors is not plain object OR array`);
    }
    errors = result.errors;
  }
  if (`data` in result) {
    if (!isPlainObject(result.data) && result.data !== null) {
      throw new Error(`Invalid execution result: data is not plain object`);
    }
    data = result.data;
  }
  if (`extensions` in result) {
    if (!isPlainObject(result.extensions))
      throw new Error(`Invalid execution result: extensions is not plain object`);
    extensions = result.extensions;
  }
  return {
    data,
    errors,
    extensions
  };
};
var isRequestResultHaveErrors = (result) => result._tag === `Batch` ? result.executionResults.some(isExecutionResultHaveErrors) : isExecutionResultHaveErrors(result.executionResult);
var isExecutionResultHaveErrors = (result) => Array.isArray(result.errors) ? result.errors.length > 0 : Boolean(result.errors);
var isOperationDefinitionNode = (definition) => {
  return typeof definition === `object` && definition !== null && `kind` in definition && definition.kind === Kind.OPERATION_DEFINITION;
};

// node_modules/graphql-request/build/legacy/helpers/analyzeDocument.js
var extractOperationName = (document2) => {
  let operationName = void 0;
  const defs = document2.definitions.filter(isOperationDefinitionNode);
  if (defs.length === 1) {
    operationName = defs[0].name?.value;
  }
  return operationName;
};
var extractIsMutation = (document2) => {
  let isMutation = false;
  const defs = document2.definitions.filter(isOperationDefinitionNode);
  if (defs.length === 1) {
    isMutation = defs[0].operation === `mutation`;
  }
  return isMutation;
};
var analyzeDocument = (document2, excludeOperationName) => {
  const normalizedDocument = typeof document2 === `string` || `kind` in document2 ? document2 : String(document2);
  const expression = typeof normalizedDocument === `string` ? normalizedDocument : print(normalizedDocument);
  let isMutation = false;
  let operationName = void 0;
  if (excludeOperationName) {
    return { expression, isMutation, operationName };
  }
  const docNode = tryCatch(() => typeof normalizedDocument === `string` ? parse(normalizedDocument) : normalizedDocument);
  if (docNode instanceof Error) {
    return { expression, isMutation, operationName };
  }
  operationName = extractOperationName(docNode);
  isMutation = extractIsMutation(docNode);
  return { expression, operationName, isMutation };
};

// node_modules/graphql-request/build/legacy/helpers/defaultJsonSerializer.js
var defaultJsonSerializer = JSON;

// node_modules/graphql-request/build/legacy/helpers/runRequest.js
var runRequest = async (input) => {
  const config = {
    ...input,
    method: input.request._tag === `Single` ? input.request.document.isMutation ? `POST` : uppercase(input.method ?? `post`) : input.request.hasMutations ? `POST` : uppercase(input.method ?? `post`),
    fetchOptions: {
      ...input.fetchOptions,
      errorPolicy: input.fetchOptions.errorPolicy ?? `none`
    }
  };
  const fetcher = createFetcher(config.method);
  const fetchResponse = await fetcher(config);
  const body = await fetchResponse.text();
  let result;
  try {
    result = parseResultFromText(body, fetchResponse.headers.get(CONTENT_TYPE_HEADER), input.fetchOptions.jsonSerializer ?? defaultJsonSerializer);
  } catch (error) {
    result = error;
  }
  const clientResponseBase = {
    status: fetchResponse.status,
    headers: fetchResponse.headers,
    body
  };
  if (!fetchResponse.ok) {
    if (result instanceof Error) {
      return new ClientError({ ...clientResponseBase }, {
        query: input.request._tag === `Single` ? input.request.document.expression : input.request.query,
        variables: input.request.variables
      });
    }
    const clientResponse = result._tag === `Batch` ? { ...result.executionResults, ...clientResponseBase } : {
      ...result.executionResult,
      ...clientResponseBase
    };
    return new ClientError(clientResponse, {
      query: input.request._tag === `Single` ? input.request.document.expression : input.request.query,
      variables: input.request.variables
    });
  }
  if (result instanceof Error)
    throw result;
  if (isRequestResultHaveErrors(result) && config.fetchOptions.errorPolicy === `none`) {
    const clientResponse = result._tag === `Batch` ? { ...result.executionResults, ...clientResponseBase } : {
      ...result.executionResult,
      ...clientResponseBase
    };
    return new ClientError(clientResponse, {
      query: input.request._tag === `Single` ? input.request.document.expression : input.request.query,
      variables: input.request.variables
    });
  }
  switch (result._tag) {
    case `Single`:
      return {
        ...clientResponseBase,
        ...executionResultClientResponseFields(config)(result.executionResult)
      };
    case `Batch`:
      return {
        ...clientResponseBase,
        data: result.executionResults.map(executionResultClientResponseFields(config))
      };
    default:
      casesExhausted(result);
  }
};
var executionResultClientResponseFields = ($params) => (executionResult) => {
  return {
    extensions: executionResult.extensions,
    data: executionResult.data,
    errors: $params.fetchOptions.errorPolicy === `all` ? executionResult.errors : void 0
  };
};
var parseResultFromText = (text, contentType, jsonSerializer) => {
  if (contentType && isGraphQLContentType(contentType)) {
    return parseGraphQLExecutionResult(jsonSerializer.parse(text));
  } else {
    return parseGraphQLExecutionResult(text);
  }
};
var createFetcher = (method) => async (params) => {
  const headers = new Headers(params.headers);
  let searchParams = null;
  let body = void 0;
  if (!headers.has(ACCEPT_HEADER)) {
    headers.set(ACCEPT_HEADER, [CONTENT_TYPE_GQL, CONTENT_TYPE_JSON].join(`, `));
  }
  if (method === `POST`) {
    const $jsonSerializer = params.fetchOptions.jsonSerializer ?? defaultJsonSerializer;
    body = $jsonSerializer.stringify(buildBody(params));
    if (typeof body === `string` && !headers.has(CONTENT_TYPE_HEADER)) {
      headers.set(CONTENT_TYPE_HEADER, CONTENT_TYPE_JSON);
    }
  } else {
    searchParams = buildQueryParams(params);
  }
  const init = { method, headers, body, ...params.fetchOptions };
  let url = new URL(params.url);
  let initResolved = init;
  if (params.middleware) {
    const result = await Promise.resolve(params.middleware({
      ...init,
      url: params.url,
      operationName: params.request._tag === `Single` ? params.request.document.operationName : void 0,
      variables: params.request.variables
    }));
    const { url: urlNew, ...initNew } = result;
    url = new URL(urlNew);
    initResolved = initNew;
  }
  if (searchParams) {
    searchParams.forEach((value, name) => {
      url.searchParams.append(name, value);
    });
  }
  const $fetch = params.fetch ?? fetch;
  return await $fetch(url, initResolved);
};
var buildBody = (params) => {
  switch (params.request._tag) {
    case `Single`:
      return {
        query: params.request.document.expression,
        variables: params.request.variables,
        operationName: params.request.document.operationName
      };
    case `Batch`:
      return zip(params.request.query, params.request.variables ?? []).map(([query, variables]) => ({
        query,
        variables
      }));
    default:
      throw casesExhausted(params.request);
  }
};
var buildQueryParams = (params) => {
  const $jsonSerializer = params.fetchOptions.jsonSerializer ?? defaultJsonSerializer;
  const searchParams = new URLSearchParams();
  switch (params.request._tag) {
    case `Single`: {
      searchParams.append(`query`, cleanQuery(params.request.document.expression));
      if (params.request.variables) {
        searchParams.append(`variables`, $jsonSerializer.stringify(params.request.variables));
      }
      if (params.request.document.operationName) {
        searchParams.append(`operationName`, params.request.document.operationName);
      }
      return searchParams;
    }
    case `Batch`: {
      const variablesSerialized = params.request.variables?.map((v2) => $jsonSerializer.stringify(v2)) ?? [];
      const queriesCleaned = params.request.query.map(cleanQuery);
      const payload = zip(queriesCleaned, variablesSerialized).map(([query, variables]) => ({
        query,
        variables
      }));
      searchParams.append(`query`, $jsonSerializer.stringify(payload));
      return searchParams;
    }
    default:
      throw casesExhausted(params.request);
  }
};

// node_modules/graphql-request/build/legacy/classes/GraphQLClient.js
var GraphQLClient = class {
  url;
  requestConfig;
  constructor(url, requestConfig = {}) {
    this.url = url;
    this.requestConfig = requestConfig;
  }
  /**
   * Send a GraphQL query to the server.
   */
  rawRequest = async (...args) => {
    const [queryOrOptions, variables, requestHeaders] = args;
    const rawRequestOptions = parseRawRequestArgs(queryOrOptions, variables, requestHeaders);
    const { headers, fetch: fetch2 = globalThis.fetch, method = `POST`, requestMiddleware, responseMiddleware, excludeOperationName, ...fetchOptions } = this.requestConfig;
    const { url } = this;
    if (rawRequestOptions.signal !== void 0) {
      fetchOptions.signal = rawRequestOptions.signal;
    }
    const document2 = analyzeDocument(rawRequestOptions.query, excludeOperationName);
    const response = await runRequest({
      url,
      request: {
        _tag: `Single`,
        document: document2,
        variables: rawRequestOptions.variables
      },
      headers: {
        ...HeadersInitToPlainObject(callOrIdentity(headers)),
        ...HeadersInitToPlainObject(rawRequestOptions.requestHeaders)
      },
      fetch: fetch2,
      method,
      fetchOptions,
      middleware: requestMiddleware
    });
    if (responseMiddleware) {
      await responseMiddleware(response, {
        operationName: document2.operationName,
        variables,
        url: this.url
      });
    }
    if (response instanceof Error) {
      throw response;
    }
    return response;
  };
  async request(documentOrOptions, ...variablesAndRequestHeaders) {
    const [variables, requestHeaders] = variablesAndRequestHeaders;
    const requestOptions = parseRequestArgs(documentOrOptions, variables, requestHeaders);
    const { headers, fetch: fetch2 = globalThis.fetch, method = `POST`, requestMiddleware, responseMiddleware, excludeOperationName, ...fetchOptions } = this.requestConfig;
    const { url } = this;
    if (requestOptions.signal !== void 0) {
      fetchOptions.signal = requestOptions.signal;
    }
    const analyzedDocument = analyzeDocument(requestOptions.document, excludeOperationName);
    const response = await runRequest({
      url,
      request: {
        _tag: `Single`,
        document: analyzedDocument,
        variables: requestOptions.variables
      },
      headers: {
        ...HeadersInitToPlainObject(callOrIdentity(headers)),
        ...HeadersInitToPlainObject(requestOptions.requestHeaders)
      },
      fetch: fetch2,
      method,
      fetchOptions,
      middleware: requestMiddleware
    });
    if (responseMiddleware) {
      await responseMiddleware(response, {
        operationName: analyzedDocument.operationName,
        variables: requestOptions.variables,
        url: this.url
      });
    }
    if (response instanceof Error) {
      throw response;
    }
    return response.data;
  }
  async batchRequests(documentsOrOptions, requestHeaders) {
    const batchRequestOptions = parseBatchRequestArgs(documentsOrOptions, requestHeaders);
    const { headers, excludeOperationName, ...fetchOptions } = this.requestConfig;
    if (batchRequestOptions.signal !== void 0) {
      fetchOptions.signal = batchRequestOptions.signal;
    }
    const analyzedDocuments = batchRequestOptions.documents.map(({ document: document2 }) => analyzeDocument(document2, excludeOperationName));
    const expressions = analyzedDocuments.map(({ expression }) => expression);
    const hasMutations = analyzedDocuments.some(({ isMutation }) => isMutation);
    const variables = batchRequestOptions.documents.map(({ variables: variables2 }) => variables2);
    const response = await runRequest({
      url: this.url,
      request: {
        _tag: `Batch`,
        operationName: void 0,
        query: expressions,
        hasMutations,
        variables
      },
      headers: {
        ...HeadersInitToPlainObject(callOrIdentity(headers)),
        ...HeadersInitToPlainObject(batchRequestOptions.requestHeaders)
      },
      fetch: this.requestConfig.fetch ?? globalThis.fetch,
      method: this.requestConfig.method || `POST`,
      fetchOptions,
      middleware: this.requestConfig.requestMiddleware
    });
    if (this.requestConfig.responseMiddleware) {
      await this.requestConfig.responseMiddleware(response, {
        operationName: void 0,
        variables,
        url: this.url
      });
    }
    if (response instanceof Error) {
      throw response;
    }
    return response.data;
  }
  setHeaders(headers) {
    this.requestConfig.headers = headers;
    return this;
  }
  /**
   * Attach a header to the client. All subsequent requests will have this header.
   */
  setHeader(key, value) {
    const { headers } = this.requestConfig;
    if (headers) {
      headers[key] = value;
    } else {
      this.requestConfig.headers = { [key]: value };
    }
    return this;
  }
  /**
   * Change the client endpoint. All subsequent requests will send to this endpoint.
   */
  setEndpoint(value) {
    this.url = value;
    return this;
  }
};

// node_modules/graphql-request/build/legacy/functions/request.js
var parseRequestArgs = (documentOrOptions, variables, requestHeaders) => {
  return documentOrOptions.document ? documentOrOptions : {
    document: documentOrOptions,
    variables,
    requestHeaders,
    signal: void 0
  };
};

// src/core/api/commerce.ts
var GET_PRODUCTS_BY_IDS = (
  /* GraphQL */
  `
  query GetProductsByIds(
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
        tags
        sku
        quantity
        price {
          amount
          currency_code
          compare_at
          amount_incl_taxes
          compare_at_incl_taxes
          tax_amount
          tax_rate
        }
        variants {
          id
          barcode
          quantity
          sku
          title
          price {
            amount
            currency_code
            compare_at
            amount_incl_taxes
            compare_at_incl_taxes
            tax_amount
            tax_rate
          }
          images {
            id
            url
            width
            height
            order
          }
        }
        barcode
        options {
          id
          name
          order
          values
        }
        categories {
          id
          name
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
`
);
var ChannelProduct = class {
  constructor(client) {
    this.client = client;
  }
  /**
   * Fetch a batch of products by their numeric ids.
   * Returns an empty array if no ids are provided.
   */
  async getByIds(options) {
    if (!options.product_ids || options.product_ids.length === 0) return [];
    const variables = {
      productIds: options.product_ids,
      currency: options.currency ?? null,
      imageSize: options.image_size ?? "large",
      useCache: options.useCache ?? true,
      shippingCountryCode: options.shipping_country_code ?? null
    };
    const data = await this.client.request(GET_PRODUCTS_BY_IDS, variables);
    return data.Channel?.GetProductsByIds ?? [];
  }
};
var Channel = class {
  constructor(client) {
    this.product = new ChannelProduct(client);
  }
};
var CommerceClient = class {
  constructor(options) {
    if (!options.endpoint) throw new Error("[VioCommerce] endpoint is required");
    if (!options.apiKey) throw new Error("[VioCommerce] apiKey is required");
    this.raw = new GraphQLClient(options.endpoint, {
      headers: { Authorization: options.apiKey }
    });
    this.channel = new Channel(this.raw);
  }
};
function createCommerceClient(options) {
  return new CommerceClient(options);
}

// src/core/types.ts
function displayPrice(product) {
  const p3 = product.price;
  const amount = p3.amount_incl_taxes ?? p3.amount;
  return formatPrice(amount, p3.currency_code);
}
function getGlobalCurrency() {
  if (typeof globalThis !== "undefined" && globalThis.__VIO_CURRENCY__) {
    return globalThis.__VIO_CURRENCY__;
  }
  if (typeof localStorage !== "undefined") {
    try {
      const v = localStorage.getItem("vio.currency");
      if (v) return v;
    } catch {}
  }
  return "NOK";
}

function formatPrice(amount, currency) {
  const activeCurrency = currency || getGlobalCurrency();
  const formatted = amount.toLocaleString("no-NO", { minimumFractionDigits: 0, maximumFractionDigits: 2 }).replace(/ /g, " ");
  const symbol = activeCurrency === "NOK" ? "kr" : activeCurrency;
  return `${formatted} ${symbol}`;
}
function primaryImageUrl(product) {
  const variantImage = product.variants[0]?.images[0]?.url;
  if (variantImage) return variantImage;
  return product.images[0]?.url;
}

async function getCartGraphQLOptions(sponsorId) {
  if (typeof Vio !== "undefined" && typeof Vio.bootstrap === "function" && !Vio.cachedBootstrap) {
    try {
      await Vio.bootstrap();
    } catch (err) {
      console.warn("[Vio] getCartGraphQLOptions bootstrap await failed:", err);
    }
  }

  const cfg = Configuration.isInitialized ? Configuration.get() : {
    apiBase: "https://api-dev.vio.live",
    graphQLBase: "https://graph-ql-dev.vio.live"
  };
  let commerceKey = cfg.apiKey;
  if (sponsorId && typeof Vio !== "undefined" && typeof Vio.findSponsor === "function") {
    const sponsor = Vio.findSponsor(sponsorId);
    if (sponsor?.commerce?.apiKey) {
      commerceKey = sponsor.commerce.apiKey;
    }
  }
  return {
    endpoint: cfg.graphQLBase || "https://graph-ql-dev.vio.live",
    apiKey: cfg.apiKey,
    commerceKey
  };
}

function getCustomerSessionId() {
  if (typeof localStorage === "undefined") return "cs_session_default";
  let id = localStorage.getItem("vio.customer_session_id.v1");
  if (!id) {
    id = "cs_" + Math.random().toString(36).slice(2, 11) + Date.now().toString(36);
    localStorage.setItem("vio.customer_session_id.v1", id);
  }
  return id;
}

// src/core/cart/cart-manager.ts
var STORAGE_KEY = "vio.cart.v1";
function lineId() {
  return "li_" + Math.random().toString(36).slice(2, 10) + Date.now().toString(36);
}
function normId(val) {
  if (val === null || val === undefined || val === 0 || val === "0" || val === "null" || val === "undefined") {
    return "";
  }
  return String(val).trim();
}
var CartManager = class extends EventTarget {
  constructor() {
    super();
    this.cartsBySponsor = this.loadFromStorage();
  }

  async ensureCartId(sponsorId, currency, shippingCountry = 'NO') {
    const activeCurrency = currency || (typeof globalThis !== 'undefined' && globalThis.__VIO_CURRENCY__) || (typeof localStorage !== 'undefined' && localStorage.getItem('vio.currency')) || "NOK";
    let cart = this.cartsBySponsor.get(sponsorId);
    if (!cart) {
      cart = {
        sponsorId,
        items: [],
        currency: activeCurrency
      };
      this.cartsBySponsor.set(sponsorId, cart);
    }
    if (!cart.cartId) {
      const opts = await getCartGraphQLOptions(sponsorId);
      const customerSessionId = getCustomerSessionId();
      try {
        const backendCart = await gqlCreateCart(customerSessionId, activeCurrency, shippingCountry, opts);
        if (backendCart?.cart_id) {
          cart.cartId = backendCart.cart_id;
          this.updateFromBackendCart(sponsorId, backendCart);
        }
      } catch (err) {
        console.warn("[CartManager] createCart failed:", err);
      }
    }
    return cart.cartId;
  }

  updateFromBackendCart(sponsorId, backendCart) {
    const cart = this.cartsBySponsor.get(sponsorId);
    if (!cart) return;
    if (backendCart.cart_id) cart.cartId = backendCart.cart_id;
    if (backendCart.currency) cart.currency = backendCart.currency;
    if (backendCart.shipping_country) cart.shippingCountry = backendCart.shipping_country;
    if (backendCart.subtotal != null) cart.subtotal = backendCart.subtotal;
    if (backendCart.shipping != null) cart.shipping = backendCart.shipping;
    if (backendCart.available_shipping_countries) cart.availableShippingCountries = backendCart.available_shipping_countries;

    if (Array.isArray(backendCart.line_items)) {
      cart.items = backendCart.line_items.map((li) => ({
        id: li.id,
        cartItemId: li.id,
        productId: li.product_id,
        sponsorId,
        variantId: li.variant_id,
        brand: li.brand || "",
        name: li.title ? (li.variant_title ? `${li.title} \u2014 ${li.variant_title}` : li.title) : "",
        unitPrice: li.price?.amount_incl_taxes ?? li.price?.amount ?? 0,
        currency: li.price?.currency_code || backendCart.currency,
        imageUrl: li.image?.url || "",
        quantity: li.quantity,
        shipping: li.shipping,
        availableShippings: li.available_shippings
      }));
    }
    this.persist();
    this.emit();
  }

  // MARK: - Mutations
  /** Add a Product DTO to a sponsor's cart. Bumps quantity if already present.
   * When a variantId is given, the line uses the VARIANT's price / image / title
   * (not the product base), so different combinations are priced correctly. */
  addProduct(opts) {
    const variant = opts.variantId != null ? opts.product.variants?.find((v2) => v2.id === opts.variantId) : void 0;
    const price = variant?.price ?? opts.product.price;
    const unitPrice = price.amount_incl_taxes ?? price.amount ?? 0;
    const imageUrl = variant?.images?.[0]?.url ?? primaryImageUrl(opts.product) ?? "";
    const name = variant?.title ? `${opts.product.title} \u2014 ${variant.title}` : opts.product.title;
    return this.addManual({
      productId: opts.product.id,
      sponsorId: opts.sponsorId,
      sponsorName: opts.sponsorName,
      brand: opts.product.brand ?? "",
      name,
      unitPrice,
      currency: price.currency_code,
      imageUrl,
      quantity: opts.quantity,
      variantId: opts.variantId
    });
  }
  /** Add a manually-specified line item (no Product DTO). */
  addManual(opts) {
    const qty = Math.max(1, opts.quantity ?? 1);
    let cart = this.cartsBySponsor.get(opts.sponsorId);
    if (!cart) {
      cart = {
        sponsorId: opts.sponsorId,
        sponsorName: opts.sponsorName,
        items: [],
        currency: opts.currency
      };
      this.cartsBySponsor.set(opts.sponsorId, cart);
    } else if (opts.sponsorName && !cart.sponsorName) {
      cart.sponsorName = opts.sponsorName;
    }
    const existing = cart.items.find((i5) => {
      const p1 = normId(i5.productId ?? i5.product_id);
      const p2 = normId(opts.productId);
      const v1 = normId(i5.variantId ?? i5.variant_id);
      const v2 = normId(opts.variantId);
      if (p1 && p2 && p1 === p2 && v1 === v2) return true;
      if (v1 && v2 && v1 === v2) return true;
      if (p1 && p2 && p1 === p2 && !v1 && !v2) return true;
      const n1 = (i5.name || i5.title || "").trim().toLowerCase();
      const n2 = (opts.name || "").trim().toLowerCase();
      if (n1 && n2 && n1 === n2 && v1 === v2) return true;
      return false;
    });
    if (existing) {
      existing.quantity += qty;
    } else {
      const item = {
        id: lineId(),
        productId: opts.productId,
        sponsorId: opts.sponsorId,
        variantId: opts.variantId,
        brand: opts.brand,
        name: opts.name,
        unitPrice: opts.unitPrice,
        currency: opts.currency,
        imageUrl: opts.imageUrl,
        quantity: qty
      };
      cart.items.push(item);
    }
    this.persist();
    this.emit();

    const addedItem = existing || cart.items[cart.items.length - 1];

    // Async sync with GraphQL backend
    (async () => {
      try {
        const cartId = await this.ensureCartId(opts.sponsorId, opts.currency || "NOK");
        if (cartId) {
          const gqlOpts = await getCartGraphQLOptions(opts.sponsorId);
          const lineItemsInput = [
            {
              product_id: Number(opts.productId || 0),
              quantity: qty,
              variant_id: opts.variantId ? Number(opts.variantId) : null
            }
          ];
          const resCart = await gqlAddItem(cartId, lineItemsInput, gqlOpts);
          if (resCart && Array.isArray(resCart.line_items)) {
            this.updateFromBackendCart(opts.sponsorId, resCart);
          }
        }
      } catch (err) {
        console.warn("[CartManager] GraphQL AddItem failed:", err);
      }
    })();

    return addedItem;
  }

  updateQuantity(lineItemId, sponsorId, quantity) {
    const cart = this.cartsBySponsor.get(sponsorId);
    if (!cart) return;
    const item = cart.items.find((i5) => i5.id === lineItemId || i5.cartItemId === lineItemId);
    if (!item) return;
    const targetItemId = item.cartItemId || item.id;
    if (quantity <= 0) {
      cart.items = cart.items.filter((i5) => i5 !== item);
    } else {
      item.quantity = quantity;
    }
    if (cart.items.length === 0) this.cartsBySponsor.delete(sponsorId);
    this.persist();
    this.emit();

    if (cart && cart.cartId) {
      (async () => {
        try {
          const gqlOpts = await getCartGraphQLOptions(sponsorId);
          let resCart;
          if (quantity <= 0) {
            resCart = await gqlDeleteItem(cart.cartId, targetItemId, gqlOpts);
          } else {
            resCart = await gqlUpdateItem(cart.cartId, targetItemId, null, quantity, gqlOpts);
          }
          if (resCart && Array.isArray(resCart.line_items)) {
            this.updateFromBackendCart(sponsorId, resCart);
          }
        } catch (err) {
          console.warn("[CartManager] GraphQL Update/DeleteItem failed:", err);
        }
      })();
    }
  }

  removeItem(lineItemId, sponsorId) {
    this.updateQuantity(lineItemId, sponsorId, 0);
  }

  clearSponsorCart(sponsorId) {
    if (this.cartsBySponsor.delete(sponsorId)) {
      this.persist();
      this.emit();
    }
  }

  clearAllCarts() {
    if (this.cartsBySponsor.size === 0) return;
    this.cartsBySponsor.clear();
    this.persist();
    this.emit();
  }

  async fetchCartFromBackend(sponsorId) {
    const cart = this.cartsBySponsor.get(sponsorId);
    if (!cart?.cartId) return null;
    const gqlOpts = await getCartGraphQLOptions(sponsorId);
    const resCart = await gqlGetCart(cart.cartId, gqlOpts);
    if (resCart) {
      this.updateFromBackendCart(sponsorId, resCart);
    }
    return resCart;
  }

  async fetchLineItemsBySupplier(sponsorId) {
    const cart = this.cartsBySponsor.get(sponsorId);
    if (!cart?.cartId) return null;
    const gqlOpts = await getCartGraphQLOptions(sponsorId);
    return await gqlGetLineItemsBySupplier(cart.cartId, gqlOpts);
  }

  async updateShippingsBySupplier(sponsorId, data) {
    const cart = this.cartsBySponsor.get(sponsorId);
    if (!cart?.cartId) return null;
    const gqlOpts = await getCartGraphQLOptions(sponsorId);
    const resCart = await gqlUpdateShippingsBySupplier(cart.cartId, data, gqlOpts);
    if (resCart && Array.isArray(resCart.line_items)) {
      this.updateFromBackendCart(sponsorId, resCart);
    }
    return resCart;
  }

  // MARK: - Read accessors
  getAllCarts() {
    return new Map(this.cartsBySponsor);
  }
  getCart(sponsorId) {
    return this.cartsBySponsor.get(sponsorId);
  }
  get itemCount() {
    let count = 0;
    for (const cart of this.cartsBySponsor.values()) {
      for (const item of cart.items) count += item.quantity;
    }
    return count;
  }
  subtotalForSponsor(sponsorId) {
    const cart = this.cartsBySponsor.get(sponsorId);
    if (!cart) return 0;
    return cart.items.reduce((sum, i5) => sum + i5.unitPrice * i5.quantity, 0);
  }
  get totalAcrossSponsors() {
    let sum = 0;
    for (const cart of this.cartsBySponsor.values()) {
      for (const item of cart.items) sum += item.unitPrice * item.quantity;
    }
    return sum;
  }
  get primaryCurrency() {
    for (const cart of this.cartsBySponsor.values()) return cart.currency;
    return "NOK";
  }
  formatTotal() {
    return formatPrice(this.totalAcrossSponsors, this.primaryCurrency);
  }
  // MARK: - Persistence
  persist() {
    if (typeof localStorage === "undefined") return;
    try {
      const obj = {};
      for (const [k2, v2] of this.cartsBySponsor) obj[String(k2)] = v2;
      localStorage.setItem(STORAGE_KEY, JSON.stringify(obj));
    } catch {
    }
  }
  loadFromStorage() {
    if (typeof localStorage === "undefined") return /* @__PURE__ */ new Map();
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return /* @__PURE__ */ new Map();
      const obj = JSON.parse(raw);
      const map = /* @__PURE__ */ new Map();
      for (const [k2, v2] of Object.entries(obj)) {
        const id = parseInt(k2, 10);
        if (!Number.isNaN(id) && v2 && Array.isArray(v2.items)) map.set(id, v2);
      }
      return map;
    } catch {
      return /* @__PURE__ */ new Map();
    }
  }
  emit() {
    const detail = {
      cartsBySponsor: this.getAllCarts(),
      itemCount: this.itemCount
    };
    this.dispatchEvent(new CustomEvent("change", { detail }));
  }
};

// src/core/checkout/payments/apple-pay.ts
var STRIPE_JS_URL = "https://js.stripe.com/v3";
var stripeJsPromise = null;
function loadStripeJs() {
  if (stripeJsPromise) return stripeJsPromise;
  if (typeof document === "undefined") {
    return Promise.reject(new Error("[VioApplePay] Stripe.js requires a browser environment"));
  }
  stripeJsPromise = new Promise((resolve, reject) => {
    const w2 = window;
    if (w2.Stripe) {
      resolve(w2.Stripe);
      return;
    }
    const existing = document.querySelector(
      `script[src^="${STRIPE_JS_URL}"]`
    );
    if (existing) {
      existing.addEventListener("load", () => resolve(w2.Stripe));
      existing.addEventListener(
        "error",
        () => reject(new Error("[VioApplePay] Failed to load Stripe.js"))
      );
      return;
    }
    const script = document.createElement("script");
    script.src = STRIPE_JS_URL;
    script.async = true;
    script.addEventListener("load", () => resolve(w2.Stripe));
    script.addEventListener(
      "error",
      () => reject(new Error("[VioApplePay] Failed to load Stripe.js"))
    );
    document.head.appendChild(script);
  });
  return stripeJsPromise;
}
async function getStripe(config) {
  const Stripe = await loadStripeJs();
  return Stripe(
    config.publishableKey,
    config.connectedAccount ? { stripeAccount: config.connectedAccount } : void 0
  );
}
function buildRequestOptions(config) {
  const ship = config.shippingOptions;
  const preselectedShipping = ship && ship.length > 0 ? ship[0].amount : 0;
  return {
    country: config.country,
    currency: config.currency.toLowerCase(),
    total: { label: config.label, amount: config.amount + preselectedShipping },
    requestPayerName: config.requestPayerName ?? true,
    requestPayerEmail: config.requestPayerEmail ?? true,
    requestShipping: ship && ship.length > 0 ? true : config.requestShipping ?? false,
    ...ship && ship.length > 0 ? { shippingOptions: ship } : {},
    disableWallets: ["link", "googlePay"]
  };
}
async function checkApplePayAvailability(config) {
  if (typeof window === "undefined") return false;
  if (typeof window.ApplePaySession === "undefined") {
    return false;
  }
  if (!config.publishableKey) return false;
  try {
    const stripe = await getStripe(config);
    const pr = stripe.paymentRequest(buildRequestOptions(config));
    const result = await pr.canMakePayment();
    return !!result?.applePay;
  } catch (err) {
    if (typeof console !== "undefined") {
      console.warn("[VioApplePay] availability check failed:", err);
    }
    return false;
  }
}
async function showApplePaySheet(config) {
  if (!config.publishableKey) {
    throw new Error("[VioApplePay] publishableKey is required");
  }
  const stripe = await getStripe(config);
  const pr = stripe.paymentRequest(buildRequestOptions(config));
  const canMake = await pr.canMakePayment();
  if (!canMake?.applePay) {
    throw new Error("[VioApplePay] Apple Pay is not available on this device");
  }
  return new Promise((resolve, reject) => {
    let settled = false;
    pr.on("paymentmethod", (raw) => {
      const ev = raw;
      settled = true;
      ev.complete("success");
      resolve({
        paymentMethodId: ev.paymentMethod.id,
        payerName: ev.payerName,
        payerEmail: ev.payerEmail,
        payerPhone: ev.payerPhone,
        shippingAddress: ev.shippingAddress
      });
    });
    pr.on("cancel", () => {
      if (settled) return;
      reject(new Error("[VioApplePay] User cancelled Apple Pay"));
    });
    pr.show();
  });
}
async function prepareApplePay(config) {
  const unavailable = (msg) => ({
    available: false,
    show: () => Promise.reject(new Error(msg))
  });
  if (typeof window === "undefined" || !config.publishableKey) {
    return unavailable("[VioApplePay] unavailable");
  }
  if (typeof window.ApplePaySession === "undefined") {
    return unavailable("[VioApplePay] ApplePaySession not available");
  }
  try {
    const stripe = await getStripe(config);
    const pr = stripe.paymentRequest(buildRequestOptions(config));
    if (config.shippingOptions && config.shippingOptions.length > 0) {
      pr.on("shippingoptionchange", (raw) => {
        const ev = raw;
        const opt = config.shippingOptions?.find((o7) => o7.id === ev.shippingOption?.id);
        ev.updateWith({
          status: "success",
          total: { label: config.label, amount: config.amount + (opt?.amount ?? 0) }
        });
      });
    }
    const result = await pr.canMakePayment();
    if (!result?.applePay) return unavailable("[VioApplePay] Apple Pay not available");
    return {
      available: true,
      show() {
        return new Promise((resolve, reject) => {
          let settled = false;
          pr.on("paymentmethod", (raw) => {
            const ev = raw;
            settled = true;
            ev.complete("success");
            resolve({
              paymentMethodId: ev.paymentMethod.id,
              payerName: ev.payerName,
              payerEmail: ev.payerEmail,
              payerPhone: ev.payerPhone,
              shippingAddress: ev.shippingAddress
            });
          });
          pr.on("cancel", () => {
            if (!settled) reject(new Error("[VioApplePay] User cancelled Apple Pay"));
          });
          pr.show();
        });
      }
    };
  } catch (err) {
    if (typeof console !== "undefined") {
      console.warn("[VioApplePay] prepare failed:", err);
    }
    return unavailable("[VioApplePay] prepare failed");
  }
}

// src/core/checkout/payments/klarna.ts
var KLARNA_SDK_URL = "https://js.klarna.com/web-sdk/v2/klarna.mjs";
var sdkCache = /* @__PURE__ */ new Map();
function loadKlarnaSdk(config) {
  if (typeof window === "undefined") {
    return Promise.reject(new Error("[VioKlarna] requires a browser environment"));
  }
  if (!config.clientId) {
    return Promise.reject(new Error("[VioKlarna] clientId is required"));
  }
  const cacheKey = `${config.clientId}:${config.environment ?? "default"}`;
  const cached = sdkCache.get(cacheKey);
  if (cached) return cached;
  const url = KLARNA_SDK_URL;
  const promise = import(
    /* @vite-ignore */
    url
  ).then((mod) => {
    const factory = mod.KlarnaSDK ?? mod.default;
    if (typeof factory !== "function") {
      throw new Error("[VioKlarna] KlarnaSDK factory not found in module");
    }
    return factory({
      clientId: config.clientId,
      products: ["PAYMENT"],
      ...config.locale ? { locale: config.locale } : {},
      ...config.environment ? { environment: config.environment } : {}
    });
  }).catch((err) => {
    sdkCache.delete(cacheKey);
    throw err;
  });
  sdkCache.set(cacheKey, promise);
  return promise;
}
async function isKlarnaAvailable(config) {
  if (typeof window === "undefined" || !config.clientId) return false;
  try {
    await loadKlarnaSdk(config);
    return true;
  } catch (err) {
    if (typeof console !== "undefined") {
      console.warn("[VioKlarna] availability check failed:", err);
    }
    return false;
  }
}
function findAuthToken(value, depth = 0) {
  if (!value || depth > 4 || typeof value !== "object") return void 0;
  const o7 = value;
  for (const key of ["authorizationToken", "authorization_token", "authToken"]) {
    if (typeof o7[key] === "string" && o7[key].length > 0) return o7[key];
  }
  for (const k2 of Object.keys(o7)) {
    const found = findAuthToken(o7[k2], depth + 1);
    if (found) return found;
  }
  return void 0;
}
async function mountKlarnaExpressButton(opts) {
  const sdk = await loadKlarnaSdk(opts.config);
  const button = sdk.Payment.button({
    id: "vio-klarna-express",
    // `PAY` = one-time purchase (vs BUY/SUBSCRIBE). Must be an array.
    intents: ["PAY"],
    // initiationMode belongs on the BUTTON config (per Klarna Web SDK docs),
    // NOT inside the initiate() data — when set only in initiate() the SDK
    // falls back to its default (DEVICE_BEST → desktop popup), which opened
    // and closed without completing. Forcing REDIRECT here makes the click do
    // a full-page navigation to Klarna's hosted journey, returning via
    // `returnUrl` (recovered by resumeKlarnaReturn()).
    initiationMode: "REDIRECT"
  });
  const returnUrl = opts.returnUrl ?? (typeof window !== "undefined" ? window.location.origin + window.location.pathname : "");
  let settled = false;
  button.on("click", () => {
    if (opts.pendingKey && opts.pendingContext && typeof sessionStorage !== "undefined") {
      try {
        sessionStorage.setItem(opts.pendingKey, JSON.stringify(opts.pendingContext));
      } catch {
      }
    }
    const promise = sdk.Payment.initiate(() => ({
      currency: opts.paymentRequest.currency,
      paymentAmount: opts.paymentRequest.amount,
      intents: ["PAY"],
      locale: "nb-NO",
      // REDIRECT = full-page navigation to Klarna's hosted journey, then back
      // to `returnUrl` with the result. We force this (vs DEVICE_BEST's desktop
      // popup) because the popup proved unreliable here — it opened and closed
      // without completing. The redirect flow has no popup-blocker / window-
      // messaging failure modes; the return is recovered via resumeKlarnaReturn().
      initiationMode: "REDIRECT",
      returnUrl,
      ...opts.paymentRequest.supplementaryPurchaseData ? { supplementaryPurchaseData: opts.paymentRequest.supplementaryPurchaseData } : {}
    }));
    Promise.resolve(promise).then((result) => {
      if (settled) return;
      const token = findAuthToken(result);
      if (token) {
        settled = true;
        opts.onAuthorize({ authorizationToken: token, raw: result });
      } else if (typeof console !== "undefined") {
        console.warn("[VioKlarna] authorize resolved without a token:", result);
      }
    }).catch((err) => {
      opts.onError?.(err);
    });
    return promise;
  });
  button.mount(opts.container);
  return {
    unmount: () => {
      try {
        button.unmount();
      } catch {
      }
    }
  };
}
function readKlarnaTokenFromUrl() {
  if (typeof window === "undefined") return null;
  const params = new URLSearchParams(window.location.search);
  for (const name of [
    "authorization_token",
    "authorizationToken",
    "klarna_authorization_token",
    "vio_klarna_token"
  ]) {
    const v2 = params.get(name);
    if (v2 && v2.length > 0 && v2 !== "{klarna.authorization_token}") {
      return { token: v2, param: name };
    }
  }
  return null;
}
function cleanUrlParams(params) {
  if (typeof window === "undefined" || !window.history?.replaceState) return;
  const url = new URL(window.location.href);
  let changed = false;
  for (const p3 of params) {
    if (url.searchParams.has(p3)) {
      url.searchParams.delete(p3);
      changed = true;
    }
  }
  if (changed) window.history.replaceState({}, "", url.toString());
}
async function listenForKlarnaCompletion(opts) {
  let sdk;
  try {
    sdk = await loadKlarnaSdk(opts.config);
  } catch (err) {
    if (typeof console !== "undefined") {
      console.warn("[VioKlarna] resume: SDK load failed:", err);
    }
    return;
  }
  let settled = false;
  const onComplete = (...args) => {
    if (settled) return;
    for (const a3 of args) {
      const token = findAuthToken(a3);
      if (token) {
        settled = true;
        opts.onComplete({ authorizationToken: token, raw: a3 });
        return;
      }
    }
  };
  try {
    sdk.Payment.on?.("complete", onComplete);
  } catch {
  }
  try {
    sdk.Payment.on?.("error", (...a3) => opts.onError?.(a3[0]));
  } catch {
  }
}

// src/core/checkout/payments/klarna-payments.ts
var KLARNA_KP_LIB_URL = "https://x.klarnacdn.net/kp/lib/v1/api.js";
var kpLoad = null;
function loadKpLib() {
  if (typeof window === "undefined" || typeof document === "undefined") {
    return Promise.reject(new Error("[VioKlarnaKP] requires a browser environment"));
  }
  if (window.Klarna?.Payments) return Promise.resolve(window.Klarna);
  if (kpLoad) return kpLoad;
  kpLoad = new Promise((resolve, reject) => {
    const timer = setTimeout(
      () => reject(new Error("[VioKlarnaKP] kp/lib/v1/api.js load timed out")),
      12e3
    );
    const ready = () => {
      clearTimeout(timer);
      if (window.Klarna?.Payments) resolve(window.Klarna);
      else reject(new Error("[VioKlarnaKP] Klarna global missing after ready"));
    };
    const prev = window.klarnaAsyncCallback;
    window.klarnaAsyncCallback = () => {
      if (typeof prev === "function") {
        try {
          prev();
        } catch {
        }
      }
      ready();
    };
    const existing = document.querySelector(
      `script[src="${KLARNA_KP_LIB_URL}"]`
    );
    if (existing) {
      if (window.Klarna?.Payments) ready();
    } else {
      const s4 = document.createElement("script");
      s4.src = KLARNA_KP_LIB_URL;
      s4.async = true;
      s4.onerror = () => {
        clearTimeout(timer);
        kpLoad = null;
        reject(new Error("[VioKlarnaKP] failed to load kp/lib/v1/api.js"));
      };
      document.head.appendChild(s4);
    }
  }).catch((err) => {
    kpLoad = null;
    throw err;
  });
  return kpLoad;
}
async function isKlarnaPaymentsAvailable() {
  if (typeof window === "undefined") return false;
  try {
    await loadKpLib();
    return true;
  } catch (err) {
    if (typeof console !== "undefined") {
      console.warn("[VioKlarnaKP] availability check failed:", err);
    }
    return false;
  }
}
async function createKlarnaPaymentsWidget(input) {
  const Klarna = await loadKpLib();
  Klarna.Payments.init({ client_token: input.clientToken });
  let selected = input.category ?? input.categories[0]?.identifier ?? "pay_later";
  return {
    categories: input.categories,
    get selected() {
      return selected;
    },
    load(category) {
      if (category) selected = category;
      return new Promise((resolve, reject) => {
        try {
          Klarna.Payments.load(
            { container: input.container, payment_method_category: selected },
            {},
            (res) => {
              if (res?.error) reject(res.error);
              else resolve({ showForm: res?.show_form !== false });
            }
          );
        } catch (err) {
          reject(err);
        }
      });
    },
    authorize(data) {
      return new Promise((resolve, reject) => {
        try {
          Klarna.Payments.authorize(
            { payment_method_category: selected, auto_finalize: true },
            data ?? {},
            (res) => {
              if (res?.approved && res.authorization_token) {
                resolve(res.authorization_token);
              } else if (res?.error) {
                reject(res.error);
              } else if (res?.finalize_required) {
                reject(new Error("Klarna requires a finalize step (multistep)"));
              } else {
                reject(new Error("Klarna authorization was not approved"));
              }
            }
          );
        } catch (err) {
          reject(err);
        }
      });
    }
  };
}

// src/core/checkout/checkout-manager.ts
function describeError(err) {
  if (err instanceof Error) return err.message;
  if (typeof err === "string") return err;
  if (err && typeof err === "object") {
    const o7 = err;
    for (const k2 of ["message", "error", "reason", "description"]) {
      if (typeof o7[k2] === "string" && o7[k2]) return o7[k2];
    }
    try {
      return JSON.stringify(err);
    } catch {
      return String(err);
    }
  }
  return String(err);
}
var KLARNA_PENDING_KEY = "vio.klarna.pending.v1";
var KLARNA_SHIPPING_OPTIONS = [
  {
    id: "standard",
    method: "Standard",
    description: "3\u20135 virkedager",
    price: 4900,
    tax_amount: 0,
    tax_rate: 0,
    preselected: true
  },
  {
    id: "express",
    method: "Express",
    description: "1\u20132 virkedager",
    price: 9900,
    tax_amount: 0,
    tax_rate: 0,
    preselected: false
  }
];

var CREATE_PAYMENT_KLARNA_NATIVE_MUTATION = `
mutation CreatePaymentKlarnaNative($checkoutId: String!, $countryCode: String, $currency: String, $locale: String, $returnUrl: String, $intent: String, $customer: KlarnaNativeCustomerInput, $billingAddress: KlarnaNativeAddressInput, $shippingAddress: KlarnaNativeAddressInput, $autoCapture: Boolean) {
  Payment {
    CreatePaymentKlarnaNative(checkout_id: $checkoutId, country_code: $countryCode, currency: $currency, locale: $locale, return_url: $returnUrl, intent: $intent, customer: $customer, billing_address: $billingAddress, shipping_address: $shippingAddress, auto_capture: $autoCapture) {
      client_token
      session_id
      purchase_country
      purchase_currency
      cart_id
      checkout_id
      payment_method_categories {
        identifier
        name
        asset_urls {
          descriptive
          standard
        }
      }
    }
  }
}
`;

var CONFIRM_PAYMENT_KLARNA_NATIVE_MUTATION = `
mutation ConfirmPaymentKlarnaNative($checkoutId: String!, $authorizationToken: String!, $autoCapture: Boolean, $billingAddress: KlarnaNativeAddressInput, $shippingAddress: KlarnaNativeAddressInput, $customer: KlarnaNativeCustomerInput) {
  Payment {
    ConfirmPaymentKlarnaNative(checkout_id: $checkoutId, authorization_token: $authorizationToken, auto_capture: $autoCapture, billing_address: $billingAddress, shipping_address: $shippingAddress, customer: $customer) {
      order_id
      checkout_id
      fraud_status
      order {
        order_id
        status
        purchase_country
        purchase_currency
        locale
        billing_address {
          given_name
          family_name
          email
          street_address
          postal_code
          city
          country
        }
        shipping_address {
          given_name
          family_name
          email
          street_address
          postal_code
          city
          country
        }
        order_amount
        order_tax_amount
        total_line_items_price
        order_lines {
          type
          name
          quantity
          unit_price
          tax_rate
          total_amount
          total_discount_amount
          total_tax_amount
          merchant_data
        }
        merchant_urls {
          terms
          checkout
          confirmation
          push
        }
        html_snippet
        started_at
        last_modified_at
        options {
          allow_separate_shipping_address
          date_of_birth_mandatory
          require_validate_callback_success
          phone_mandatory
          auto_capture
        }
        shipping_options {
          id
          name
          price
          tax_amount
          tax_rate
          preselected
        }
        merchant_data
        selected_shipping_option {
          id
          name
          price
          tax_amount
          tax_rate
          preselected
        }
      }
    }
  }
}
`;

function buildKlarnaCustomer(address) {
  if (!address) return null;
  return {
    dob: address.dob || address.date_of_birth || null,
    email: address.email || null,
    organization_registration_id: address.organization_registration_id || address.org_id || null,
    phone: address.phone || address.telephone || null,
    type: address.type || "person"
  };
}

function buildKlarnaAddress(address) {
  if (!address) return null;
  return {
    city: address.city || null,
    country: address.country || address.countryCode || "NO",
    email: address.email || null,
    family_name: address.familyName || address.family_name || address.last_name || address.lastName || null,
    given_name: address.givenName || address.given_name || address.first_name || address.firstName || null,
    phone: address.phone || null,
    postal_code: address.postalCode || address.postal_code || address.zip || null,
    region: address.region || address.state || null,
    street_address: address.streetAddress || address.street_address || address.address1 || address.street || null,
  };
}

function buildCheckoutAddress(address) {
  if (!address) return null;
  const firstName = address.firstName || address.first_name || address.givenName || address.given_name || null;
  const lastName = address.lastName || address.last_name || address.familyName || address.family_name || null;
  const address1 = address.address || address.address1 || address.street || address.street_address || null;
  const city = address.city || null;
  const zip = address.postalCode || address.postal_code || address.zip || null;
  const country_code = address.countryCode || address.country_code || address.country || "NO";

  if (!firstName && !lastName && !address1 && !city && !zip) return null;

  return {
    first_name: firstName,
    last_name: lastName,
    address1: address1,
    city: city,
    zip: zip,
    country_code: country_code
  };
}

function resolveHttpsReturnUrl(overrideUrl, params = null) {
  let url = overrideUrl;
  if (!url && typeof window !== "undefined" && window.location) {
    url = window.location.href;
  }
  if (!url || typeof url !== "string" || url.startsWith("about:") || url.startsWith("file:")) {
    url = "https://vev.design/checkout/confirmation";
  }
  if (url.startsWith("http://")) {
    url = "https://" + url.slice(7);
  } else if (!url.startsWith("https://")) {
    url = "https://" + url.replace(/^[a-zA-Z]+:\/\//, "");
  }

  if (params && typeof params === "object") {
    try {
      const parsed = new URL(url);
      Object.keys(params).forEach(k => {
        if (params[k] !== undefined && params[k] !== null) {
          parsed.searchParams.set(k, String(params[k]));
        }
      });
      return parsed.toString();
    } catch (e) {
      const queryStr = Object.keys(params)
        .filter(k => params[k] !== undefined && params[k] !== null)
        .map(k => `${encodeURIComponent(k)}=${encodeURIComponent(String(params[k]))}`)
        .join("&");
      if (queryStr) {
        url += (url.includes("?") ? "&" : "?") + queryStr;
      }
    }
  }

  return url;
}

async function executeKlarnaGraphQL(query, variables, sponsorId) {
  if (typeof Vio !== "undefined" && typeof Vio.bootstrap === "function" && !Vio.cachedBootstrap) {
    try {
      await Vio.bootstrap();
    } catch (err) {
      console.warn("[Vio] executeKlarnaGraphQL bootstrap await failed:", err);
    }
  }

  const cfg = Configuration.get();
  const endpoint = cfg.graphQLBase || "https://graph-ql-dev.vio.live";
  
  let commerceKey = cfg.apiKey;
  if (sponsorId && typeof Vio !== "undefined" && typeof Vio.findSponsor === "function") {
    const sponsor = Vio.findSponsor(sponsorId);
    if (sponsor?.commerce?.apiKey) {
      commerceKey = sponsor.commerce.apiKey;
    }
  }

  const res = await fetch(endpoint, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-API-Key": cfg.apiKey,
      "Authorization": commerceKey
    },
    body: JSON.stringify({ query, variables })
  });

  const json = await res.json().catch(() => ({}));
  if (!res.ok || json.errors) {
    const errMsg = json.errors?.[0]?.message || `GraphQL request failed (HTTP ${res.status})`;
    throw new Error(errMsg);
  }
  return json;
}

var CheckoutManager = class extends EventTarget {
  constructor(cartManager) {
    super();
    this.cartManager = cartManager;
    this.state = null;
    this.applePayAvailableCache = null;
    this.klarnaAvailableCache = null;
    this.klarnaOrderInFlight = false;
  }
  open(sponsorId) {
    const cart = this.cartManager.getCart(sponsorId);
    if (!cart || cart.items.length === 0) {
      throw new Error(`[VioCheckout] sponsor ${sponsorId} has no cart items`);
    }
    const activeCurrency = getGlobalCurrency();
    this.state = {
      sponsorId,
      subtotal: this.cartManager.subtotalForSponsor(sponsorId),
      currency: activeCurrency
    };
    this.emit();
    return this.state;
  }
  close() {
    this.state = null;
    this.applePayAvailableCache = null;
    this.klarnaAvailableCache = null;
    this.emit();
  }
  async createCheckout(sponsorId) {
    const cart = this.cartManager.getCart(sponsorId);
    let cartId = cart?.cartId;
    if (!cartId) {
      cartId = await this.cartManager.ensureCartId(sponsorId, cart?.currency || "NOK");
      if (!cartId) {
        throw new Error(`[CheckoutManager] Failed to obtain cart_id for sponsor ${sponsorId}`);
      }
    }
    const opts = await getCartGraphQLOptions(sponsorId);
    const checkout = await gqlCreateCheckout(cartId, opts);
    if (checkout?.id) {
      this.state = {
        ...(this.state || {}),
        sponsorId,
        checkoutId: checkout.id,
        checkout
      };
      this.emit();
      try {
        const updated = await gqlUpdateCheckout({
          checkoutId: checkout.id,
          buyerAcceptsPurchaseConditions: true,
          buyerAcceptsTermsConditions: true
        }, opts);
        if (updated?.id) {
          this.state.checkout = updated;
          this.emit();
          return updated;
        }
      } catch (err) {
        console.warn("[CheckoutManager] Failed to auto-accept terms & purchase conditions:", err);
      }
    }
    return checkout;
  }

  async updateCheckout(variables, sponsorId) {
    const opts = await getCartGraphQLOptions(sponsorId || this.state?.sponsorId);
    const fullVars = {
      buyerAcceptsPurchaseConditions: true,
      buyerAcceptsTermsConditions: true,
      ...variables
    };
    const updated = await gqlUpdateCheckout(fullVars, opts);
    if (updated?.id) {
      this.state = {
        ...(this.state || {}),
        checkoutId: updated.id,
        checkout: updated
      };
      this.emit();
    }
    return updated;
  }

  async getCheckout(checkoutId, sponsorId) {
    const opts = await getCartGraphQLOptions(sponsorId || this.state?.sponsorId);
    return await gqlGetCheckout(checkoutId, opts);
  }

  async getAvailablePaymentMethods(sponsorId) {
    const spId = sponsorId || this.state?.sponsorId || 4;
    if (!this.paymentMethodsCache) this.paymentMethodsCache = new Map();
    if (!this.paymentMethodsPromises) this.paymentMethodsPromises = new Map();

    if (this.paymentMethodsCache.has(spId)) {
      return this.paymentMethodsCache.get(spId);
    }
    if (this.paymentMethodsPromises.has(spId)) {
      return await this.paymentMethodsPromises.get(spId);
    }

    const opts = await getCartGraphQLOptions(spId);
    const promise = (async () => {
      try {
        const res = await gqlGetAvailablePaymentMethods(opts);
        this.paymentMethodsCache.set(spId, res);
        return res;
      } finally {
        this.paymentMethodsPromises.delete(spId);
      }
    })();

    this.paymentMethodsPromises.set(spId, promise);
    return await promise;
  }

  clearPaymentMethodsCache() {
    if (this.paymentMethodsCache) this.paymentMethodsCache.clear();
    if (this.paymentMethodsPromises) this.paymentMethodsPromises.clear();
  }

  async fetchAvailableShippings(sponsorId) {
    try {
      const spId = sponsorId || this.state?.sponsorId || 4;
      const cart = this.cartManager.getCart(spId);
      let cartId = cart?.cartId;
      if (!cartId) {
        cartId = await this.cartManager.ensureCartId(spId);
      }
      if (!cartId) return [];
      const opts = await getCartGraphQLOptions(spId);
      const supplierGroups = await gqlGetLineItemsBySupplier(cartId, opts);
      const firstGroup = Array.isArray(supplierGroups) ? supplierGroups[0] : null;
      const shippings = firstGroup?.available_shippings ?? [];
      if (Array.isArray(shippings) && shippings.length > 0) {
        const supplierId = firstGroup?.supplier?.id;
        const mapped = shippings.map((s, idx) => {
          const priceObj = s.price ?? {};
          const amount = typeof priceObj.amount_incl_taxes === "number"
            ? priceObj.amount_incl_taxes
            : (typeof priceObj.amount === "number" ? priceObj.amount : 0);
          const priceInMinor = Math.round(amount * 100);
          return {
            id: String(s.id),
            supplierId: supplierId ? String(supplierId) : undefined,
            method: s.name || "Default Shipping",
            name: s.name || "Default Shipping",
            description: s.description || "",
            country_code: s.country_code || "NO",
            price: priceInMinor,
            priceMajor: amount,
            currency: priceObj.currency_code || (typeof globalThis !== "undefined" && globalThis.__VIO_CURRENCY__) || "NOK",
            tax_amount: Math.round((priceObj.tax_amount ?? 0) * 100),
            tax_rate: Math.round((priceObj.tax_rate ?? 0) * 100),
            preselected: idx === 0
          };
        });
        this.lastFetchedShippings = mapped;
        return mapped;
      }
    } catch (err) {
      console.warn("[CheckoutManager] fetchAvailableShippings failed:", err);
    }
    return [];
  }

  async updateShippingsBySupplier(data, sponsorId) {
    const spId = sponsorId || this.state?.sponsorId || 4;
    const cart = this.cartManager.getCart(spId);
    let cartId = cart?.cartId;
    if (!cartId) return null;
    const opts = await getCartGraphQLOptions(spId);
    const updated = await gqlUpdateShippingsBySupplier(cartId, data, opts);
    if (updated) {
      this.cartManager.updateFromBackendCart(spId, updated);
    }
    return updated;
  }

  async startStripePayment(sponsorId, formData) {
    const spId = sponsorId || this.state?.sponsorId || 4;
    const cart = this.cartManager.getCart(spId);
    let cartId = cart?.cartId;
    if (!cartId) {
      cartId = await this.cartManager.ensureCartId(spId);
    }
    if (!cartId) {
      throw new Error(`[CheckoutManager] Failed to obtain cart_id for sponsor ${spId}`);
    }

    const opts = await getCartGraphQLOptions(spId);
    let checkoutId = this.state?.checkoutId;
    if (!checkoutId) {
      const checkoutRes = await gqlCreateCheckout(cartId, opts);
      checkoutId = checkoutRes?.id;
    }
    if (!checkoutId) {
      checkoutId = String(spId);
    }

    const addr = typeof formData === "object" && formData !== null ? formData : this.state?.address;
    const addressObj = buildCheckoutAddress(addr);
    const emailVal = (typeof formData === "string" ? formData : formData?.email) || this.state?.address?.email || "customer@example.com";

    const updateVars = {
      checkoutId,
      email: emailVal,
      buyerAcceptsPurchaseConditions: true,
      buyerAcceptsTermsConditions: true
    };
    if (addressObj) {
      updateVars.shippingAddress = addressObj;
      updateVars.billingAddress = addressObj;
    }

    try {
      const updated = await gqlUpdateCheckout(updateVars, opts);
      if (updated?.id) {
        this.state = {
          ...(this.state || {}),
          sponsorId: spId,
          checkoutId: updated.id,
          checkout: updated
        };
        this.emit();
      }
    } catch (err) {
      console.warn("[CheckoutManager] UpdateCheckout during Stripe payment setup failed:", err);
    }

    const successUrl = resolveHttpsReturnUrl(null, {
      vio_payment: "success",
      vio_method: "stripe",
      vio_sponsor: spId,
      checkout_id: checkoutId
    });
    const stripeRes = await gqlCreatePaymentStripe({
      checkoutId,
      successUrl,
      paymentMethod: "Stripe",
      email: emailVal
    }, opts);

    if (stripeRes?.checkout_url) {
      if (typeof window !== "undefined") {
        try {
          if (window.top && window.top !== window) {
            window.top.location.href = stripeRes.checkout_url;
          } else {
            window.location.href = stripeRes.checkout_url;
          }
        } catch (e) {
          window.open(stripeRes.checkout_url, "_top") || window.open(stripeRes.checkout_url, "_blank");
        }
      }
      return stripeRes;
    } else {
      throw new Error("Stripe payment link generation failed: missing checkout_url");
    }
  }

  async startVippsPayment(sponsorId, formData) {
    const spId = sponsorId || this.state?.sponsorId || 4;
    const cart = this.cartManager.getCart(spId);
    let cartId = cart?.cartId;
    if (!cartId) {
      cartId = await this.cartManager.ensureCartId(spId);
    }
    if (!cartId) {
      throw new Error(`[CheckoutManager] Failed to obtain cart_id for sponsor ${spId}`);
    }

    const opts = await getCartGraphQLOptions(spId);
    let checkoutId = this.state?.checkoutId;
    if (!checkoutId) {
      const checkoutRes = await gqlCreateCheckout(cartId, opts);
      checkoutId = checkoutRes?.id;
    }
    if (!checkoutId) {
      checkoutId = String(spId);
    }

    const addr = typeof formData === "object" && formData !== null ? formData : this.state?.address;
    const addressObj = buildCheckoutAddress(addr);
    const emailVal = (typeof formData === "string" ? formData : formData?.email) || this.state?.address?.email || "customer@example.com";

    const updateVars = {
      checkoutId,
      email: emailVal,
      paymentMethod: "Vipps",
      buyerAcceptsPurchaseConditions: true,
      buyerAcceptsTermsConditions: true
    };
    if (addressObj) {
      updateVars.shippingAddress = addressObj;
      updateVars.billingAddress = addressObj;
    }

    try {
      const updated = await gqlUpdateCheckout(updateVars, opts);
      if (updated?.id) {
        this.state = {
          ...(this.state || {}),
          sponsorId: spId,
          checkoutId: updated.id,
          checkout: updated
        };
        this.emit();
      }
    } catch (err) {
      console.warn("[CheckoutManager] UpdateCheckout during Vipps payment setup failed:", err);
    }

    const returnUrl = resolveHttpsReturnUrl(null, {
      vio_payment: "success",
      vio_method: "vipps",
      vio_sponsor: spId,
      checkout_id: checkoutId
    });
    const vippsRes = await gqlCreatePaymentVipps({
      checkoutId,
      email: emailVal,
      returnUrl
    }, opts);

    if (vippsRes?.payment_url) {
      if (typeof window !== "undefined") {
        try {
          if (window.top && window.top !== window) {
            window.top.location.href = vippsRes.payment_url;
          } else {
            window.location.href = vippsRes.payment_url;
          }
        } catch (e) {
          window.open(vippsRes.payment_url, "_top") || window.open(vippsRes.payment_url, "_blank");
        }
      }
      return vippsRes;
    } else {
      throw new Error("Vipps payment link generation failed: missing payment_url");
    }
  }

  setAddress(address) {
    if (!this.state) return;
    this.state = { ...this.state, address };
    this.emit();
  }
  selectPaymentMethod(method) {
    if (!this.state) return;
    this.state = { ...this.state, paymentMethod: method };
    this.emit();
    this.dispatchEvent(
      new CustomEvent("payment-select", {
        detail: { method, state: this.state }
      })
    );
  }
  // MARK: - Apple Pay (Stripe Payment Request)
  /**
   * Returns true if Apple Pay can be shown on this device + Stripe config.
   * Result is memoised — call `clearApplePayCache()` if config changes.
   */
  async isApplePayAvailable(country = "NO") {
    if (this.applePayAvailableCache !== null) return this.applePayAvailableCache;
    const cfg = Configuration.isInitialized ? Configuration.get() : null;
    const publishableKey = cfg?.stripePublishableKey ?? "";
    if (!publishableKey || !this.state) {
      this.applePayAvailableCache = false;
      return false;
    }
    const amount = toSmallestUnit(this.state.subtotal, this.state.currency);
    const available = await checkApplePayAvailability({
      publishableKey,
      connectedAccount: this.findStripeConnectAccount() ?? void 0,
      amount,
      currency: this.state.currency,
      country,
      label: "Vio"
    });
    this.applePayAvailableCache = available;
    return available;
  }
  clearApplePayCache() {
    this.applePayAvailableCache = null;
  }
  /**
   * Prepare Apple Pay for the product-page express button (no active checkout
   * needed). Pre-creates the Stripe PaymentRequest + resolves canMakePayment so
   * the returned `show()` can fire synchronously inside the tap (Apple blocks
   * the sheet if `show()` is reached after an await). `show()` resolves the
   * sheet, then dispatches `payment-complete` (→ confirmation) or
   * `payment-error`. `available` is true only when Apple Pay will actually work.
   */
  async prepareApplePayFor(amount, currency, country = "NO") {
    const cfg = Configuration.isInitialized ? Configuration.get() : null;
    if (!cfg?.stripePublishableKey) return { available: false, show: async () => {
    } };
    const prepared = await prepareApplePay({
      publishableKey: cfg.stripePublishableKey,
      amount: toSmallestUnit(amount, currency),
      currency,
      country,
      label: "Vio",
      // Native Apple Pay shipping — same Standard/Express options as Klarna.
      shippingOptions: KLARNA_SHIPPING_OPTIONS.map((o7) => ({
        id: o7.id,
        label: o7.method,
        detail: o7.description,
        amount: o7.price
      }))
    });
    return {
      available: prepared.available,
      show: async () => {
        try {
          const result = await prepared.show();
          this.selectPaymentMethod("apple-pay");
          const state = this.state ?? { sponsorId: 0, subtotal: amount, currency };
          this.dispatchEvent(
            new CustomEvent("payment-complete", {
              detail: { method: "apple-pay", state, result }
            })
          );
        } catch (err) {
          if (typeof console !== "undefined") {
            console.warn("[VioCheckout] Apple Pay express failed:", err);
          }
          this.dispatchEvent(
            new CustomEvent("payment-error", {
              detail: { method: "apple-pay", error: describeError(err) }
            })
          );
        }
      }
    };
  }
  /**
   * Prepare an Apple Pay express charge for an arbitrary amount (e.g. the whole
   * cart) with NO active checkout. Unlike `prepareApplePayFor`, the returned
   * `show()` RESOLVES with the result (or `null` on cancel/failure) and does
   * NOT dispatch the global `payment-complete` — so no checkout overlay appears.
   * The caller (the cart drawer) renders its own confirmation. `show()` must be
   * called synchronously inside the tap (Apple's user-gesture rule).
   */
  async prepareApplePayExpress(amount, currency, country = "NO") {
    const cfg = Configuration.isInitialized ? Configuration.get() : null;
    if (!cfg?.stripePublishableKey) return { available: false, show: async () => null };
    const prepared = await prepareApplePay({
      publishableKey: cfg.stripePublishableKey,
      amount: toSmallestUnit(amount, currency),
      currency,
      country,
      label: "Vio",
      // Native Apple Pay shipping (same Standard/Express options as Klarna) —
      // selected inside the sheet, so it's not a separate checkout step.
      shippingOptions: KLARNA_SHIPPING_OPTIONS.map((o7) => ({
        id: o7.id,
        label: o7.method,
        detail: o7.description,
        amount: o7.price
      }))
    });
    return {
      available: prepared.available,
      show: async () => {
        try {
          return await prepared.show();
        } catch (err) {
          if (typeof console !== "undefined") {
            console.warn("[VioCheckout] cart Apple Pay express failed:", err);
          }
          return null;
        }
      }
    };
  }
  /**
   * Launches the Apple Pay sheet. Resolves with the Stripe PaymentMethod
   * id once the user authorises — the backend then confirms the
   * PaymentIntent with that id to actually capture the funds.
   */
  async startApplePay(options = {}) {
    if (!this.state) throw new Error("[VioCheckout] no active checkout \u2014 call open() first");
    const cfg = Configuration.get();
    if (!cfg.stripePublishableKey) {
      throw new Error(
        "[VioCheckout] No Stripe publishable key configured. Pass `stripePublishableKey` to Vio.init({ ... })."
      );
    }
    const amount = toSmallestUnit(this.state.subtotal, this.state.currency);
    const result = await showApplePaySheet({
      publishableKey: cfg.stripePublishableKey,
      connectedAccount: this.findStripeConnectAccount() ?? void 0,
      amount,
      currency: this.state.currency,
      country: options.country ?? "NO",
      label: options.label ?? "Vio"
    });
    this.selectPaymentMethod("apple-pay");
    this.dispatchEvent(
      new CustomEvent("payment-complete", {
        detail: { method: "apple-pay", state: this.state, result }
      })
    );
    return result;
  }
  // MARK: - Klarna Express Checkout (Klarna Web SDK v2)
  /**
   * True if the Klarna Express button can be offered (clientId configured +
   * SDK loads). Memoised per active checkout. Never throws.
   */
  async isKlarnaExpressAvailable() {
    if (this.klarnaAvailableCache !== null) return this.klarnaAvailableCache;
    const cfg = Configuration.isInitialized ? Configuration.get() : null;
    const clientId = cfg?.klarnaClientId ?? "";
    if (!clientId || !this.state) {
      this.klarnaAvailableCache = false;
      return false;
    }
    const available = await isKlarnaAvailable({
      clientId,
      locale: "nb-NO",
      environment: cfg?.klarnaEnvironment
    });
    this.klarnaAvailableCache = available;
    return available;
  }
  clearKlarnaCache() {
    this.klarnaAvailableCache = null;
  }
  /**
   * Build the Klarna payment request from the active cart — amounts in the
   * currency's minor unit (øre/cents), one line item per cart line.
   */
  buildKlarnaPaymentRequest() {
    if (!this.state) throw new Error("[VioCheckout] no active checkout \u2014 call open() first");
    const currency = this.state.currency;
    const lineItems = this.items.map((item) => {
      const unitPrice = toSmallestUnit(item.unitPrice, currency);
      return {
        name: item.name || item.brand || "Produkt",
        quantity: item.quantity,
        unitPrice,
        totalAmount: unitPrice * item.quantity,
        reference: String(item.productId),
        ...item.imageUrl ? { imageUrl: item.imageUrl } : {}
      };
    });
    return {
      currency,
      amount: toSmallestUnit(this.state.subtotal, currency),
      supplementaryPurchaseData: { lineItems }
    };
  }
  /**
   * Mount the Klarna Express button into `container`. On a successful
   * authorization, fires `payment-complete` with the authorization token —
   * the host (or vio-backend) then creates the Klarna order server-side.
   *
   * Returns the button handle so the UI can unmount on teardown.
   */
  async mountKlarnaExpress(container) {
    if (!this.state) throw new Error("[VioCheckout] no active checkout \u2014 call open() first");
    const cfg = Configuration.get();
    if (!cfg.klarnaClientId) {
      throw new Error(
        "[VioCheckout] No Klarna client id configured. Pass `klarnaClientId` to Vio.init({ ... })."
      );
    }
    const pendingContext = this.buildKlarnaPendingContext();
    return mountKlarnaExpressButton({
      config: {
        clientId: cfg.klarnaClientId,
        locale: "nb-NO",
        environment: cfg.klarnaEnvironment
      },
      container,
      paymentRequest: this.buildKlarnaPaymentRequest(),
      pendingKey: KLARNA_PENDING_KEY,
      pendingContext,
      // POPUP path: the initiate() promise resolves in-page with the token.
      onAuthorize: (result) => {
        void this.completeKlarnaOrder(result.authorizationToken, pendingContext, result);
      },
      onError: (err) => {
        if (typeof console !== "undefined") {
          console.warn("[VioCheckout] Klarna Express cancelled/error:", err);
        }
        this.dispatchEvent(
          new CustomEvent("payment-error", {
            detail: { method: "klarna", error: describeError(err) }
          })
        );
      }
    });
  }
  /**
   * Klarna Payments — classic widget flow (server client_token). Creates a
   * session on vio-backend, then mounts Klarna's inline widget into
   * `container`. Returns a handle to switch category and to authorize → which
   * on approval creates the order via the same backend /orders route as KEC.
   *
   * Unlike `mountKlarnaExpress`, this needs no public `klarnaClientId` and no
   * origin handshake — auth is the server-side API key.
   */
  async mountKlarnaPayments(container, opts) {
    if (!this.state) throw new Error("[VioCheckout] no active checkout \u2014 call open() first");
    const cfg = Configuration.get();
    const sponsorId = this.state?.sponsorId || 4;

    const fetchedShippings = await this.fetchAvailableShippings(sponsorId);
    const shippings = fetchedShippings.length > 0 ? fetchedShippings : KLARNA_SHIPPING_OPTIONS;

    const { ctx, shippingOptions } = opts?.withShipping
      ? this.buildKlarnaInstantContext(opts.shippingId, shippings)
      : { ctx: this.buildKlarnaPendingContext(), shippingOptions: shippings };

    const selectedOpt = shippings.find((s) => s.id === opts?.shippingId) || shippings[0];
    if (selectedOpt?.id && selectedOpt?.supplierId) {
      try {
        await this.updateShippingsBySupplier([{ shipping_id: selectedOpt.id, supplier_id: Number(selectedOpt.supplierId) }], sponsorId);
      } catch (err) {
        console.warn("[CheckoutManager] updateShippingsBySupplier failed during mount:", err);
      }
    }

    let checkoutId = ctx.checkoutId || this.state?.checkoutId;
    try {
      const checkoutRes = await this.createCheckout(sponsorId);
      if (checkoutRes?.id) {
        checkoutId = checkoutRes.id;
        ctx.checkoutId = checkoutRes.id;
      }
    } catch (err) {
      console.warn("[CheckoutManager] CreateCheckout before Klarna init failed:", err);
    }
    if (!checkoutId) {
      checkoutId = String(sponsorId);
    }

    const address = this.state?.address;
    const activeCurrency = getGlobalCurrency();
    if (this.state) this.state.currency = activeCurrency;
    if (ctx) ctx.currency = activeCurrency;
    console.log("[VioCheckout] mountKlarnaPayments → active currency:", activeCurrency, "| globalThis.__VIO_CURRENCY__:", typeof globalThis !== "undefined" ? globalThis.__VIO_CURRENCY__ : null, "| localStorage:", typeof localStorage !== "undefined" ? localStorage.getItem("vio.currency") : null);
    const variables = {
      checkoutId,
      countryCode: "NO",
      currency: activeCurrency,
      locale: "nb-NO",
      returnUrl: resolveHttpsReturnUrl(null, {
        vio_payment: "success",
        vio_method: "klarna",
        vio_sponsor: sponsorId,
        checkout_id: checkoutId
      }),
      intent: "buy",
      customer: buildKlarnaCustomer(address),
      billingAddress: buildKlarnaAddress(address),
      shippingAddress: buildKlarnaAddress(address),
      autoCapture: true
    };
    console.log("[VioCheckout] CreatePaymentKlarnaNative variables →", JSON.stringify(variables, null, 2));

    const json = await executeKlarnaGraphQL(CREATE_PAYMENT_KLARNA_NATIVE_MUTATION, variables, sponsorId);
    const nativeRes = json?.data?.Payment?.CreatePaymentKlarnaNative;
    if (!nativeRes || !nativeRes.client_token) {
      throw new Error("Klarna session creation failed: missing client_token");
    }

    if (nativeRes.checkout_id) {
      ctx.checkoutId = nativeRes.checkout_id;
      this.state.checkoutId = nativeRes.checkout_id;
    }
    if (nativeRes.session_id) {
      ctx.sessionId = nativeRes.session_id;
      this.state.sessionId = nativeRes.session_id;
    }
    if (nativeRes.client_token) {
      ctx.clientToken = nativeRes.client_token;
      this.state.clientToken = nativeRes.client_token;
    }

    const widget = await createKlarnaPaymentsWidget({
      clientToken: nativeRes.client_token,
      sessionId: nativeRes.session_id,
      categories: nativeRes.payment_method_categories ?? [],
      container
    });
    await widget.load();
    return {
      categories: widget.categories,
      shippings,
      get selected() {
        return widget.selected;
      },
      load: (category) => widget.load(category),
      authorize: async () => {
        try {
          const token = await widget.authorize();
          await this.completeKlarnaOrder(token, ctx, { authorizationToken: token });
        } catch (err) {
          if (typeof console !== "undefined") {
            console.warn("[VioCheckout] Klarna Payments authorize failed:", err);
          }
          this.dispatchEvent(
            new CustomEvent("payment-error", {
              detail: { method: "klarna", error: describeError(err) }
            })
          );
        }
      },
      unmount: () => {
        try {
          container.innerHTML = "";
        } catch {
        }
      }
    };
  }
  /** True if the Klarna Payments widget lib can load (UI gate). */
  async klarnaPaymentsAvailable() {
    return isKlarnaPaymentsAvailable();
  }
  /** Cart snapshot + chosen shipping line/amount, for express purchases. */
  buildKlarnaInstantContext(shippingId, availableShippings = []) {
    const base = this.buildKlarnaPendingContext();
    const options = availableShippings.length > 0 ? availableShippings : KLARNA_SHIPPING_OPTIONS;
    const shipping = (shippingId ? options.find((o7) => o7.id === shippingId) : void 0) ?? options.find((o7) => o7.preselected) ?? options[0];
    const orderLines = [...base.orderLines];
    if (shipping) {
      orderLines.push({
        name: `Frakt \u2013 ${shipping.method || shipping.name}`,
        quantity: 1,
        unit_price: shipping.price,
        total_amount: shipping.price,
        reference: `shipping:${shipping.id}`,
        type: "shipping_fee"
      });
    }
    return {
      ctx: {
        ...base,
        orderLines,
        orderAmount: base.orderAmount + (shipping?.price ?? 0)
      },
      shippingOptions: options
    };
  }
  /**
   * Express instant purchase — go straight to Klarna's own modal, no checkout
   * overlay. Creates a session (with shipping options), loads the widget into a
   * hidden container, then authorizes (which opens Klarna's confirm modal). On
   * approval creates the order → `payment-complete` (host shows confirmation);
   * on failure → `payment-error`. Call `open(sponsorId)` first.
   */
  async startKlarnaInstant() {
    if (!this.state) throw new Error("[VioCheckout] no active checkout \u2014 call open() first");
    const cfg = Configuration.get();
    const sponsorId = this.state?.sponsorId || 4;
    const fetchedShippings = await this.fetchAvailableShippings(sponsorId);
    const shippings = fetchedShippings.length > 0 ? fetchedShippings : KLARNA_SHIPPING_OPTIONS;
    const { ctx, shippingOptions } = this.buildKlarnaInstantContext(undefined, shippings);
    let clientToken;
    let categories;
    try {
      let checkoutId = ctx.checkoutId || this.state?.checkoutId;
      try {
        const checkoutRes = await this.createCheckout(sponsorId);
        if (checkoutRes?.id) {
          checkoutId = checkoutRes.id;
          ctx.checkoutId = checkoutRes.id;
        }
      } catch (err) {
        console.warn("[CheckoutManager] CreateCheckout before Klarna instant failed:", err);
      }
      if (!checkoutId) {
        checkoutId = String(sponsorId);
      }

      const address = this.state?.address;
      const activeCurrency = getGlobalCurrency();
      if (this.state) this.state.currency = activeCurrency;
      if (ctx) ctx.currency = activeCurrency;
      console.log("[VioCheckout] startKlarnaInstant → active currency:", activeCurrency);
      const variables = {
        checkoutId,
        countryCode: "NO",
        currency: activeCurrency,
        locale: "nb-NO",
        returnUrl: resolveHttpsReturnUrl(null, {
          vio_payment: "success",
          vio_method: "klarna",
          vio_sponsor: sponsorId,
          checkout_id: checkoutId
        }),
        intent: "buy",
        customer: buildKlarnaCustomer(address),
        billingAddress: buildKlarnaAddress(address),
        shippingAddress: buildKlarnaAddress(address),
        autoCapture: true
      };
      console.log("[VioCheckout] CreatePaymentKlarnaNative instant variables →", JSON.stringify(variables, null, 2));

      const json = await executeKlarnaGraphQL(CREATE_PAYMENT_KLARNA_NATIVE_MUTATION, variables, sponsorId);
      const nativeRes = json?.data?.Payment?.CreatePaymentKlarnaNative;
      if (!nativeRes || !nativeRes.client_token) {
        throw new Error("Klarna instant session failed: missing client_token");
      }
      if (nativeRes.checkout_id) {
        ctx.checkoutId = nativeRes.checkout_id;
        this.state.checkoutId = nativeRes.checkout_id;
      }
      if (nativeRes.session_id) {
        ctx.sessionId = nativeRes.session_id;
        this.state.sessionId = nativeRes.session_id;
      }
      if (nativeRes.client_token) {
        ctx.clientToken = nativeRes.client_token;
        this.state.clientToken = nativeRes.client_token;
      }
      clientToken = nativeRes.client_token;
      categories = nativeRes.payment_method_categories ?? [];
    } catch (err) {
      this.dispatchEvent(
        new CustomEvent("payment-error", {
          detail: { method: "klarna", error: describeError(err) }
        })
      );
      return;
    }
    const container = document.createElement("div");
    container.setAttribute("aria-hidden", "true");
    container.style.cssText = "position:fixed;left:-9999px;top:0;width:1px;height:1px;overflow:hidden;";
    document.body.appendChild(container);
    try {
      const widget = await createKlarnaPaymentsWidget({ clientToken, sessionId: ctx.sessionId, categories, container });
      await widget.load();
      const token = await widget.authorize();
      await this.completeKlarnaOrder(token, ctx, { authorizationToken: token });
    } catch (err) {
      if (typeof console !== "undefined") {
        console.warn("[VioCheckout] Klarna instant failed:", err);
      }
      this.dispatchEvent(
        new CustomEvent("payment-error", {
          detail: { method: "klarna", error: describeError(err) }
        })
      );
    } finally {
      try {
        container.remove();
      } catch {
      }
    }
  }
  /**
   * REDIRECT path: call once on app load. If a Klarna purchase was launched
   * (pending context persisted) and we're back with a token — from the URL or
   * the SDK's resumed `complete` event — finish creating the order + confirm.
   */
  async resumeKlarnaReturn() {
    if (typeof sessionStorage === "undefined") return;
    const raw = sessionStorage.getItem(KLARNA_PENDING_KEY);
    if (!raw) return;
    let pending;
    try {
      pending = JSON.parse(raw);
    } catch {
      sessionStorage.removeItem(KLARNA_PENDING_KEY);
      return;
    }
    const fromUrl = readKlarnaTokenFromUrl();
    if (fromUrl) {
      cleanUrlParams([fromUrl.param]);
      await this.completeKlarnaOrder(fromUrl.token, pending, { authorizationToken: fromUrl.token });
      return;
    }
    if (typeof window !== "undefined" && typeof console !== "undefined" && window.location.search) {
      console.warn(
        "[VioCheckout] Klarna return: no known token param. URL was:",
        window.location.search
      );
    }
    const cfg = Configuration.isInitialized ? Configuration.get() : null;
    if (!cfg?.klarnaClientId) return;
    await listenForKlarnaCompletion({
      config: { clientId: cfg.klarnaClientId, locale: "nb-NO", environment: cfg.klarnaEnvironment },
      onComplete: (result) => {
        void this.completeKlarnaOrder(result.authorizationToken, pending, result);
      },
      onError: (err) => {
        if (typeof console !== "undefined") {
          console.warn("[VioCheckout] Klarna resume error:", err);
        }
      }
    });
  }
  /** Snapshot of the active cart for redirect recovery (minor units). */
  buildKlarnaPendingContext() {
    if (!this.state) throw new Error("[VioCheckout] no active checkout");
    const currency = this.state.currency;
    return {
      sponsorId: this.state.sponsorId,
      currency,
      orderAmount: toSmallestUnit(this.state.subtotal, currency),
      orderLines: this.items.map((item) => {
        const unitPrice = toSmallestUnit(item.unitPrice, currency);
        return {
          name: item.name || item.brand || "Produkt",
          quantity: item.quantity,
          unit_price: unitPrice,
          total_amount: unitPrice * item.quantity,
          reference: String(item.productId)
        };
      })
    };
  }
  /**
   * POST the token + order lines to vio-backend (it holds the secret API key
   * and creates the real Klarna order). On success → `payment-complete`; on
   * failure → `payment-error`. Idempotent: clears the pending key so the
   * popup and redirect paths can't double-fire.
   */
  async completeKlarnaOrder(authorizationToken, ctx, result) {
    if (typeof sessionStorage !== "undefined") {
      if (this.klarnaOrderInFlight) return;
      this.klarnaOrderInFlight = true;
      sessionStorage.removeItem(KLARNA_PENDING_KEY);
    }
    const cfg = Configuration.get();
    try {
      const checkoutId = ctx?.checkoutId || this.state?.checkoutId || String(ctx?.sponsorId || this.state?.sponsorId || 4);
      const address = this.state?.address;
      const variables = {
        checkoutId,
        authorizationToken,
        autoCapture: true,
        billingAddress: buildKlarnaAddress(address),
        shippingAddress: buildKlarnaAddress(address),
        customer: buildKlarnaCustomer(address)
      };

      const json = await executeKlarnaGraphQL(CONFIRM_PAYMENT_KLARNA_NATIVE_MUTATION, variables, ctx?.sponsorId || this.state?.sponsorId);
      const confirmRes = json?.data?.Payment?.ConfirmPaymentKlarnaNative;
      if (!confirmRes) {
        throw new Error("Klarna order confirmation failed: missing response data");
      }

      const orderData = confirmRes.order || confirmRes;
      const state = this.state ?? { sponsorId: ctx.sponsorId, subtotal: ctx.orderAmount, currency: ctx.currency };
      this.dispatchEvent(
        new CustomEvent("payment-complete", {
          detail: {
            method: "klarna",
            state,
            result: { ...result, order: orderData, chargedTotal: ctx.orderAmount / 100 }
          }
        })
      );
    } catch (err) {
      if (typeof console !== "undefined") {
        console.error("[VioCheckout] Klarna order creation failed:", err);
      }
      this.dispatchEvent(
        new CustomEvent("payment-error", {
          detail: { method: "klarna", error: err instanceof Error ? err.message : String(err) }
        })
      );
    } finally {
      this.klarnaOrderInFlight = false;
    }
  }
  // MARK: - Accessors
  get currentState() {
    return this.state;
  }
  get items() {
    if (!this.state) return [];
    return this.cartManager.getCart(this.state.sponsorId)?.items ?? [];
  }
  // MARK: - Internals
  /**
   * Resolve the Stripe Connect account for the active sponsor — for now
   * pulled from bootstrap cache if present. Returns undefined if not set
   * (Stripe will route to the platform account in that case).
   */
  findStripeConnectAccount() {
    return void 0;
  }
  emit() {
    this.dispatchEvent(
      new CustomEvent("change", { detail: { state: this.state } })
    );
  }
};
function toSmallestUnit(amount, currency) {
  const zeroDecimal = /* @__PURE__ */ new Set(["JPY", "KRW", "VND"]);
  if (zeroDecimal.has(currency.toUpperCase())) return Math.round(amount);
  return Math.round(amount * 100);
}

// src/core/client.ts
var VioFacade = class {
  constructor() {
    this.apiInstance = null;
    this.commerceClients = /* @__PURE__ */ new Map();
    this.bootstrapPromise = null;
    this.cachedBootstrap = null;
    // Client-side managers — created lazily on first access. They don't
    // need Vio.init() to work (state is purely local).
    this.cartManager = null;
    this.checkoutManager = null;
  }
  init(config) {
    Configuration.init(config);
    this.apiInstance = null;
    this.commerceClients.clear();
    this.bootstrapPromise = null;
    this.cachedBootstrap = null;
  }
  get isInitialized() {
    return Configuration.isInitialized;
  }
  get config() {
    return Configuration.get();
  }
  // MARK: - Client-side managers (no init required)
  /** Multi-sponsor cart manager. Reactive — listen via addEventListener('change', ...). */
  get cart() {
    if (!this.cartManager) this.cartManager = new CartManager();
    return this.cartManager;
  }
  /** Checkout flow manager. Subscribes to cart state via the CartManager. */
  get checkout() {
    if (!this.checkoutManager) this.checkoutManager = new CheckoutManager(this.cart);
    return this.checkoutManager;
  }
  // MARK: - Backend-bound
  /** Lazy VioApi for REST endpoints on `api-dev.vio.live`. */
  get api() {
    if (!this.apiInstance) {
      const cfg = Configuration.get();
      this.apiInstance = createVioApi({ apiBase: cfg.apiBase, apiKey: cfg.apiKey });
    }
    return this.apiInstance;
  }
  /**
   * Bootstrap — fetches client config and caches it. Dedupes in-flight
   * concurrent requests.
   */
  async bootstrap() {
    if (this.cachedBootstrap) return this.cachedBootstrap;
    if (this.bootstrapPromise) return this.bootstrapPromise;
    this.bootstrapPromise = this.api.bootstrap().then((res) => {
      this.cachedBootstrap = res;
      return res;
    }).finally(() => {
      this.bootstrapPromise = null;
    });
    return this.bootstrapPromise;
  }
  get bootstrapCache() {
    return this.cachedBootstrap;
  }
  /**
   * Get a CommerceClient scoped to a specific sponsor (via bootstrap).
   * Throws if bootstrap hasn't been called or the sponsor is unknown.
   */
  commerceFor(sponsorId) {
    sponsorId = Number(sponsorId);
    const existing = this.commerceClients.get(sponsorId);
    if (existing) return existing;
    const sponsor = this.findSponsor(sponsorId);
    if (!sponsor) {
      throw new Error(
        `[Vio] Sponsor ${sponsorId} not found in bootstrap. Call Vio.bootstrap() first or pass commerce-key directly.`
      );
    }
    const cfg = Configuration.get();
    const client = createCommerceClient({ endpoint: cfg.graphQLBase, apiKey: sponsor.commerce.apiKey });
    this.commerceClients.set(sponsorId, client);
    return client;
  }
  /** Get a CommerceClient using an explicit commerce apiKey (skip bootstrap). */
  commerceWithKey(commerceApiKey) {
    const cfg = Configuration.get();
    return createCommerceClient({ endpoint: cfg.graphQLBase, apiKey: commerceApiKey });
  }
  findSponsor(sponsorId) {
    const boot = this.cachedBootstrap;
    if (!boot) return void 0;
    const id = Number(sponsorId);
    if (Number(boot.primarySponsor?.id) === id) return boot.primarySponsor;
    return boot.secondarySponsors?.find((s4) => Number(s4.id) === id);
  }
};
var _vioGlobal = globalThis;
var Vio = _vioGlobal.__VIO_FACADE__ ?? (_vioGlobal.__VIO_FACADE__ = new VioFacade());

// src/react/index.ts
import * as React from "react";

// node_modules/@lit/react/create-component.js
var e = /* @__PURE__ */ new Set(["children", "localName", "ref", "style", "className"]);
var n = /* @__PURE__ */ new WeakMap();
var t = (e7, t4, o7, l3, a3) => {
  const s4 = a3?.[t4];
  void 0 === s4 ? (e7[t4] = o7, null == o7 && t4 in HTMLElement.prototype && e7.removeAttribute(t4)) : o7 !== l3 && ((e8, t5, o8) => {
    let l4 = n.get(e8);
    void 0 === l4 && n.set(e8, l4 = /* @__PURE__ */ new Map());
    let a4 = l4.get(t5);
    void 0 !== o8 ? void 0 === a4 ? (l4.set(t5, a4 = { handleEvent: o8 }), e8.addEventListener(t5, a4)) : a4.handleEvent = o8 : void 0 !== a4 && (l4.delete(t5), e8.removeEventListener(t5, a4));
  })(e7, s4, o7);
};
var o = ({ react: n6, tagName: o7, elementClass: l3, events: a3, displayName: s4 }) => {
  const c4 = new Set(Object.keys(a3 ?? {})), r6 = n6.forwardRef(((s5, r7) => {
    const i5 = n6.useRef(/* @__PURE__ */ new Map()), d3 = n6.useRef(null), f3 = {}, u3 = {};
    for (const [n7, t4] of Object.entries(s5)) e.has(n7) ? f3["className" === n7 ? "class" : n7] = t4 : c4.has(n7) || n7 in l3.prototype ? u3[n7] = t4 : f3[n7] = t4;
    return n6.useLayoutEffect((() => {
      if (null === d3.current) return;
      const e7 = /* @__PURE__ */ new Map();
      for (const n7 in u3) t(d3.current, n7, s5[n7], i5.current.get(n7), a3), i5.current.delete(n7), e7.set(n7, s5[n7]);
      for (const [e8, n7] of i5.current) t(d3.current, e8, void 0, n7, a3);
      i5.current = e7;
    })), n6.useLayoutEffect((() => {
      d3.current?.removeAttribute("defer-hydration");
    }), []), f3.suppressHydrationWarning = true, n6.createElement(o7, { ...f3, ref: n6.useCallback(((e7) => {
      d3.current = e7, "function" == typeof r7 ? r7(e7) : null !== r7 && (r7.current = e7);
    }), [r7]) });
  }));
  return r6.displayName = s4 ?? l3.name, r6;
};

// node_modules/@lit/reactive-element/css-tag.js
var t2 = globalThis;
var e2 = t2.ShadowRoot && (void 0 === t2.ShadyCSS || t2.ShadyCSS.nativeShadow) && "adoptedStyleSheets" in Document.prototype && "replace" in CSSStyleSheet.prototype;
var s = Symbol();
var o2 = /* @__PURE__ */ new WeakMap();
var n2 = class {
  constructor(t4, e7, o7) {
    if (this._$cssResult$ = true, o7 !== s) throw Error("CSSResult is not constructable. Use `unsafeCSS` or `css` instead.");
    this.cssText = t4, this.t = e7;
  }
  get styleSheet() {
    let t4 = this.o;
    const s4 = this.t;
    if (e2 && void 0 === t4) {
      const e7 = void 0 !== s4 && 1 === s4.length;
      e7 && (t4 = o2.get(s4)), void 0 === t4 && ((this.o = t4 = new CSSStyleSheet()).replaceSync(this.cssText), e7 && o2.set(s4, t4));
    }
    return t4;
  }
  toString() {
    return this.cssText;
  }
};
var r = (t4) => new n2("string" == typeof t4 ? t4 : t4 + "", void 0, s);
var i = (t4, ...e7) => {
  const o7 = 1 === t4.length ? t4[0] : e7.reduce((e8, s4, o8) => e8 + ((t5) => {
    if (true === t5._$cssResult$) return t5.cssText;
    if ("number" == typeof t5) return t5;
    throw Error("Value passed to 'css' function must be a 'css' function result: " + t5 + ". Use 'unsafeCSS' to pass non-literal values, but take care to ensure page security.");
  })(s4) + t4[o8 + 1], t4[0]);
  return new n2(o7, t4, s);
};
var S = (s4, o7) => {
  if (e2) s4.adoptedStyleSheets = o7.map((t4) => t4 instanceof CSSStyleSheet ? t4 : t4.styleSheet);
  else for (const e7 of o7) {
    const o8 = document.createElement("style"), n6 = t2.litNonce;
    void 0 !== n6 && o8.setAttribute("nonce", n6), o8.textContent = e7.cssText, s4.appendChild(o8);
  }
};
var c = e2 ? (t4) => t4 : (t4) => t4 instanceof CSSStyleSheet ? ((t5) => {
  let e7 = "";
  for (const s4 of t5.cssRules) e7 += s4.cssText;
  return r(e7);
})(t4) : t4;

// node_modules/@lit/reactive-element/reactive-element.js
var { is: i2, defineProperty: e3, getOwnPropertyDescriptor: h, getOwnPropertyNames: r2, getOwnPropertySymbols: o3, getPrototypeOf: n3 } = Object;
var a = globalThis;
var c2 = a.trustedTypes;
var l = c2 ? c2.emptyScript : "";
var p = a.reactiveElementPolyfillSupport;
var d = (t4, s4) => t4;
var u = { toAttribute(t4, s4) {
  switch (s4) {
    case Boolean:
      t4 = t4 ? l : null;
      break;
    case Object:
    case Array:
      t4 = null == t4 ? t4 : JSON.stringify(t4);
  }
  return t4;
}, fromAttribute(t4, s4) {
  let i5 = t4;
  switch (s4) {
    case Boolean:
      i5 = null !== t4;
      break;
    case Number:
      i5 = null === t4 ? null : Number(t4);
      break;
    case Object:
    case Array:
      try {
        i5 = JSON.parse(t4);
      } catch (t5) {
        i5 = null;
      }
  }
  return i5;
} };
var f = (t4, s4) => !i2(t4, s4);
var b = { attribute: true, type: String, converter: u, reflect: false, useDefault: false, hasChanged: f };
Symbol.metadata ??= Symbol("metadata"), a.litPropertyMetadata ??= /* @__PURE__ */ new WeakMap();
var y = class extends HTMLElement {
  static addInitializer(t4) {
    this._$Ei(), (this.l ??= []).push(t4);
  }
  static get observedAttributes() {
    return this.finalize(), this._$Eh && [...this._$Eh.keys()];
  }
  static createProperty(t4, s4 = b) {
    if (s4.state && (s4.attribute = false), this._$Ei(), this.prototype.hasOwnProperty(t4) && ((s4 = Object.create(s4)).wrapped = true), this.elementProperties.set(t4, s4), !s4.noAccessor) {
      const i5 = Symbol(), h3 = this.getPropertyDescriptor(t4, i5, s4);
      void 0 !== h3 && e3(this.prototype, t4, h3);
    }
  }
  static getPropertyDescriptor(t4, s4, i5) {
    const { get: e7, set: r6 } = h(this.prototype, t4) ?? { get() {
      return this[s4];
    }, set(t5) {
      this[s4] = t5;
    } };
    return { get: e7, set(s5) {
      const h3 = e7?.call(this);
      r6?.call(this, s5), this.requestUpdate(t4, h3, i5);
    }, configurable: true, enumerable: true };
  }
  static getPropertyOptions(t4) {
    return this.elementProperties.get(t4) ?? b;
  }
  static _$Ei() {
    if (this.hasOwnProperty(d("elementProperties"))) return;
    const t4 = n3(this);
    t4.finalize(), void 0 !== t4.l && (this.l = [...t4.l]), this.elementProperties = new Map(t4.elementProperties);
  }
  static finalize() {
    if (this.hasOwnProperty(d("finalized"))) return;
    if (this.finalized = true, this._$Ei(), this.hasOwnProperty(d("properties"))) {
      const t5 = this.properties, s4 = [...r2(t5), ...o3(t5)];
      for (const i5 of s4) this.createProperty(i5, t5[i5]);
    }
    const t4 = this[Symbol.metadata];
    if (null !== t4) {
      const s4 = litPropertyMetadata.get(t4);
      if (void 0 !== s4) for (const [t5, i5] of s4) this.elementProperties.set(t5, i5);
    }
    this._$Eh = /* @__PURE__ */ new Map();
    for (const [t5, s4] of this.elementProperties) {
      const i5 = this._$Eu(t5, s4);
      void 0 !== i5 && this._$Eh.set(i5, t5);
    }
    this.elementStyles = this.finalizeStyles(this.styles);
  }
  static finalizeStyles(s4) {
    const i5 = [];
    if (Array.isArray(s4)) {
      const e7 = new Set(s4.flat(1 / 0).reverse());
      for (const s5 of e7) i5.unshift(c(s5));
    } else void 0 !== s4 && i5.push(c(s4));
    return i5;
  }
  static _$Eu(t4, s4) {
    const i5 = s4.attribute;
    return false === i5 ? void 0 : "string" == typeof i5 ? i5 : "string" == typeof t4 ? t4.toLowerCase() : void 0;
  }
  constructor() {
    super(), this._$Ep = void 0, this.isUpdatePending = false, this.hasUpdated = false, this._$Em = null, this._$Ev();
  }
  _$Ev() {
    this._$ES = new Promise((t4) => this.enableUpdating = t4), this._$AL = /* @__PURE__ */ new Map(), this._$E_(), this.requestUpdate(), this.constructor.l?.forEach((t4) => t4(this));
  }
  addController(t4) {
    (this._$EO ??= /* @__PURE__ */ new Set()).add(t4), void 0 !== this.renderRoot && this.isConnected && t4.hostConnected?.();
  }
  removeController(t4) {
    this._$EO?.delete(t4);
  }
  _$E_() {
    const t4 = /* @__PURE__ */ new Map(), s4 = this.constructor.elementProperties;
    for (const i5 of s4.keys()) this.hasOwnProperty(i5) && (t4.set(i5, this[i5]), delete this[i5]);
    t4.size > 0 && (this._$Ep = t4);
  }
  createRenderRoot() {
    const t4 = this.shadowRoot ?? this.attachShadow(this.constructor.shadowRootOptions);
    return S(t4, this.constructor.elementStyles), t4;
  }
  connectedCallback() {
    this.renderRoot ??= this.createRenderRoot(), this.enableUpdating(true), this._$EO?.forEach((t4) => t4.hostConnected?.());
  }
  enableUpdating(t4) {
  }
  disconnectedCallback() {
    this._$EO?.forEach((t4) => t4.hostDisconnected?.());
  }
  attributeChangedCallback(t4, s4, i5) {
    this._$AK(t4, i5);
  }
  _$ET(t4, s4) {
    const i5 = this.constructor.elementProperties.get(t4), e7 = this.constructor._$Eu(t4, i5);
    if (void 0 !== e7 && true === i5.reflect) {
      const h3 = (void 0 !== i5.converter?.toAttribute ? i5.converter : u).toAttribute(s4, i5.type);
      this._$Em = t4, null == h3 ? this.removeAttribute(e7) : this.setAttribute(e7, h3), this._$Em = null;
    }
  }
  _$AK(t4, s4) {
    const i5 = this.constructor, e7 = i5._$Eh.get(t4);
    if (void 0 !== e7 && this._$Em !== e7) {
      const t5 = i5.getPropertyOptions(e7), h3 = "function" == typeof t5.converter ? { fromAttribute: t5.converter } : void 0 !== t5.converter?.fromAttribute ? t5.converter : u;
      this._$Em = e7;
      const r6 = h3.fromAttribute(s4, t5.type);
      this[e7] = r6 ?? this._$Ej?.get(e7) ?? r6, this._$Em = null;
    }
  }
  requestUpdate(t4, s4, i5, e7 = false, h3) {
    if (void 0 !== t4) {
      const r6 = this.constructor;
      if (false === e7 && (h3 = this[t4]), i5 ??= r6.getPropertyOptions(t4), !((i5.hasChanged ?? f)(h3, s4) || i5.useDefault && i5.reflect && h3 === this._$Ej?.get(t4) && !this.hasAttribute(r6._$Eu(t4, i5)))) return;
      this.C(t4, s4, i5);
    }
    false === this.isUpdatePending && (this._$ES = this._$EP());
  }
  C(t4, s4, { useDefault: i5, reflect: e7, wrapped: h3 }, r6) {
    i5 && !(this._$Ej ??= /* @__PURE__ */ new Map()).has(t4) && (this._$Ej.set(t4, r6 ?? s4 ?? this[t4]), true !== h3 || void 0 !== r6) || (this._$AL.has(t4) || (this.hasUpdated || i5 || (s4 = void 0), this._$AL.set(t4, s4)), true === e7 && this._$Em !== t4 && (this._$Eq ??= /* @__PURE__ */ new Set()).add(t4));
  }
  async _$EP() {
    this.isUpdatePending = true;
    try {
      await this._$ES;
    } catch (t5) {
      Promise.reject(t5);
    }
    const t4 = this.scheduleUpdate();
    return null != t4 && await t4, !this.isUpdatePending;
  }
  scheduleUpdate() {
    return this.performUpdate();
  }
  performUpdate() {
    if (!this.isUpdatePending) return;
    if (!this.hasUpdated) {
      if (this.renderRoot ??= this.createRenderRoot(), this._$Ep) {
        for (const [t6, s5] of this._$Ep) this[t6] = s5;
        this._$Ep = void 0;
      }
      const t5 = this.constructor.elementProperties;
      if (t5.size > 0) for (const [s5, i5] of t5) {
        const { wrapped: t6 } = i5, e7 = this[s5];
        true !== t6 || this._$AL.has(s5) || void 0 === e7 || this.C(s5, void 0, i5, e7);
      }
    }
    let t4 = false;
    const s4 = this._$AL;
    try {
      t4 = this.shouldUpdate(s4), t4 ? (this.willUpdate(s4), this._$EO?.forEach((t5) => t5.hostUpdate?.()), this.update(s4)) : this._$EM();
    } catch (s5) {
      throw t4 = false, this._$EM(), s5;
    }
    t4 && this._$AE(s4);
  }
  willUpdate(t4) {
  }
  _$AE(t4) {
    this._$EO?.forEach((t5) => t5.hostUpdated?.()), this.hasUpdated || (this.hasUpdated = true, this.firstUpdated(t4)), this.updated(t4);
  }
  _$EM() {
    this._$AL = /* @__PURE__ */ new Map(), this.isUpdatePending = false;
  }
  get updateComplete() {
    return this.getUpdateComplete();
  }
  getUpdateComplete() {
    return this._$ES;
  }
  shouldUpdate(t4) {
    return true;
  }
  update(t4) {
    this._$Eq &&= this._$Eq.forEach((t5) => this._$ET(t5, this[t5])), this._$EM();
  }
  updated(t4) {
  }
  firstUpdated(t4) {
  }
};
y.elementStyles = [], y.shadowRootOptions = { mode: "open" }, y[d("elementProperties")] = /* @__PURE__ */ new Map(), y[d("finalized")] = /* @__PURE__ */ new Map(), p?.({ ReactiveElement: y }), (a.reactiveElementVersions ??= []).push("2.1.2");

// node_modules/lit-html/lit-html.js
var t3 = globalThis;
var i3 = (t4) => t4;
var s2 = t3.trustedTypes;
var e4 = s2 ? s2.createPolicy("lit-html", { createHTML: (t4) => t4 }) : void 0;
var h2 = "$lit$";
var o4 = `lit$${Math.random().toFixed(9).slice(2)}$`;
var n4 = "?" + o4;
var r3 = `<${n4}>`;
var l2 = document;
var c3 = () => l2.createComment("");
var a2 = (t4) => null === t4 || "object" != typeof t4 && "function" != typeof t4;
var u2 = Array.isArray;
var d2 = (t4) => u2(t4) || "function" == typeof t4?.[Symbol.iterator];
var f2 = "[ 	\n\f\r]";
var v = /<(?:(!--|\/[^a-zA-Z])|(\/?[a-zA-Z][^>\s]*)|(\/?$))/g;
var _ = /-->/g;
var m = />/g;
var p2 = RegExp(`>|${f2}(?:([^\\s"'>=/]+)(${f2}*=${f2}*(?:[^ 	
\f\r"'\`<>=]|("|')|))|$)`, "g");
var g = /'/g;
var $ = /"/g;
var y2 = /^(?:script|style|textarea|title)$/i;
var x = (t4) => (i5, ...s4) => ({ _$litType$: t4, strings: i5, values: s4 });
var b2 = x(1);
var w = x(2);
var T = x(3);
var E = Symbol.for("lit-noChange");
var A = Symbol.for("lit-nothing");
var C = /* @__PURE__ */ new WeakMap();
var P = l2.createTreeWalker(l2, 129);
function V(t4, i5) {
  if (!u2(t4) || !t4.hasOwnProperty("raw")) throw Error("invalid template strings array");
  return void 0 !== e4 ? e4.createHTML(i5) : i5;
}
var N = (t4, i5) => {
  const s4 = t4.length - 1, e7 = [];
  let n6, l3 = 2 === i5 ? "<svg>" : 3 === i5 ? "<math>" : "", c4 = v;
  for (let i6 = 0; i6 < s4; i6++) {
    const s5 = t4[i6];
    let a3, u3, d3 = -1, f3 = 0;
    for (; f3 < s5.length && (c4.lastIndex = f3, u3 = c4.exec(s5), null !== u3); ) f3 = c4.lastIndex, c4 === v ? "!--" === u3[1] ? c4 = _ : void 0 !== u3[1] ? c4 = m : void 0 !== u3[2] ? (y2.test(u3[2]) && (n6 = RegExp("</" + u3[2], "g")), c4 = p2) : void 0 !== u3[3] && (c4 = p2) : c4 === p2 ? ">" === u3[0] ? (c4 = n6 ?? v, d3 = -1) : void 0 === u3[1] ? d3 = -2 : (d3 = c4.lastIndex - u3[2].length, a3 = u3[1], c4 = void 0 === u3[3] ? p2 : '"' === u3[3] ? $ : g) : c4 === $ || c4 === g ? c4 = p2 : c4 === _ || c4 === m ? c4 = v : (c4 = p2, n6 = void 0);
    const x2 = c4 === p2 && t4[i6 + 1].startsWith("/>") ? " " : "";
    l3 += c4 === v ? s5 + r3 : d3 >= 0 ? (e7.push(a3), s5.slice(0, d3) + h2 + s5.slice(d3) + o4 + x2) : s5 + o4 + (-2 === d3 ? i6 : x2);
  }
  return [V(t4, l3 + (t4[s4] || "<?>") + (2 === i5 ? "</svg>" : 3 === i5 ? "</math>" : "")), e7];
};
var S2 = class _S {
  constructor({ strings: t4, _$litType$: i5 }, e7) {
    let r6;
    this.parts = [];
    let l3 = 0, a3 = 0;
    const u3 = t4.length - 1, d3 = this.parts, [f3, v2] = N(t4, i5);
    if (this.el = _S.createElement(f3, e7), P.currentNode = this.el.content, 2 === i5 || 3 === i5) {
      const t5 = this.el.content.firstChild;
      t5.replaceWith(...t5.childNodes);
    }
    for (; null !== (r6 = P.nextNode()) && d3.length < u3; ) {
      if (1 === r6.nodeType) {
        if (r6.hasAttributes()) for (const t5 of r6.getAttributeNames()) if (t5.endsWith(h2)) {
          const i6 = v2[a3++], s4 = r6.getAttribute(t5).split(o4), e8 = /([.?@])?(.*)/.exec(i6);
          d3.push({ type: 1, index: l3, name: e8[2], strings: s4, ctor: "." === e8[1] ? I : "?" === e8[1] ? L : "@" === e8[1] ? z : H }), r6.removeAttribute(t5);
        } else t5.startsWith(o4) && (d3.push({ type: 6, index: l3 }), r6.removeAttribute(t5));
        if (y2.test(r6.tagName)) {
          const t5 = r6.textContent.split(o4), i6 = t5.length - 1;
          if (i6 > 0) {
            r6.textContent = s2 ? s2.emptyScript : "";
            for (let s4 = 0; s4 < i6; s4++) r6.append(t5[s4], c3()), P.nextNode(), d3.push({ type: 2, index: ++l3 });
            r6.append(t5[i6], c3());
          }
        }
      } else if (8 === r6.nodeType) if (r6.data === n4) d3.push({ type: 2, index: l3 });
      else {
        let t5 = -1;
        for (; -1 !== (t5 = r6.data.indexOf(o4, t5 + 1)); ) d3.push({ type: 7, index: l3 }), t5 += o4.length - 1;
      }
      l3++;
    }
  }
  static createElement(t4, i5) {
    const s4 = l2.createElement("template");
    return s4.innerHTML = t4, s4;
  }
};
function M(t4, i5, s4 = t4, e7) {
  if (i5 === E) return i5;
  let h3 = void 0 !== e7 ? s4._$Co?.[e7] : s4._$Cl;
  const o7 = a2(i5) ? void 0 : i5._$litDirective$;
  return h3?.constructor !== o7 && (h3?._$AO?.(false), void 0 === o7 ? h3 = void 0 : (h3 = new o7(t4), h3._$AT(t4, s4, e7)), void 0 !== e7 ? (s4._$Co ??= [])[e7] = h3 : s4._$Cl = h3), void 0 !== h3 && (i5 = M(t4, h3._$AS(t4, i5.values), h3, e7)), i5;
}
var R = class {
  constructor(t4, i5) {
    this._$AV = [], this._$AN = void 0, this._$AD = t4, this._$AM = i5;
  }
  get parentNode() {
    return this._$AM.parentNode;
  }
  get _$AU() {
    return this._$AM._$AU;
  }
  u(t4) {
    const { el: { content: i5 }, parts: s4 } = this._$AD, e7 = (t4?.creationScope ?? l2).importNode(i5, true);
    P.currentNode = e7;
    let h3 = P.nextNode(), o7 = 0, n6 = 0, r6 = s4[0];
    for (; void 0 !== r6; ) {
      if (o7 === r6.index) {
        let i6;
        2 === r6.type ? i6 = new k(h3, h3.nextSibling, this, t4) : 1 === r6.type ? i6 = new r6.ctor(h3, r6.name, r6.strings, this, t4) : 6 === r6.type && (i6 = new Z(h3, this, t4)), this._$AV.push(i6), r6 = s4[++n6];
      }
      o7 !== r6?.index && (h3 = P.nextNode(), o7++);
    }
    return P.currentNode = l2, e7;
  }
  p(t4) {
    let i5 = 0;
    for (const s4 of this._$AV) void 0 !== s4 && (void 0 !== s4.strings ? (s4._$AI(t4, s4, i5), i5 += s4.strings.length - 2) : s4._$AI(t4[i5])), i5++;
  }
};
var k = class _k {
  get _$AU() {
    return this._$AM?._$AU ?? this._$Cv;
  }
  constructor(t4, i5, s4, e7) {
    this.type = 2, this._$AH = A, this._$AN = void 0, this._$AA = t4, this._$AB = i5, this._$AM = s4, this.options = e7, this._$Cv = e7?.isConnected ?? true;
  }
  get parentNode() {
    let t4 = this._$AA.parentNode;
    const i5 = this._$AM;
    return void 0 !== i5 && 11 === t4?.nodeType && (t4 = i5.parentNode), t4;
  }
  get startNode() {
    return this._$AA;
  }
  get endNode() {
    return this._$AB;
  }
  _$AI(t4, i5 = this) {
    t4 = M(this, t4, i5), a2(t4) ? t4 === A || null == t4 || "" === t4 ? (this._$AH !== A && this._$AR(), this._$AH = A) : t4 !== this._$AH && t4 !== E && this._(t4) : void 0 !== t4._$litType$ ? this.$(t4) : void 0 !== t4.nodeType ? this.T(t4) : d2(t4) ? this.k(t4) : this._(t4);
  }
  O(t4) {
    return this._$AA.parentNode.insertBefore(t4, this._$AB);
  }
  T(t4) {
    this._$AH !== t4 && (this._$AR(), this._$AH = this.O(t4));
  }
  _(t4) {
    this._$AH !== A && a2(this._$AH) ? this._$AA.nextSibling.data = t4 : this.T(l2.createTextNode(t4)), this._$AH = t4;
  }
  $(t4) {
    const { values: i5, _$litType$: s4 } = t4, e7 = "number" == typeof s4 ? this._$AC(t4) : (void 0 === s4.el && (s4.el = S2.createElement(V(s4.h, s4.h[0]), this.options)), s4);
    if (this._$AH?._$AD === e7) this._$AH.p(i5);
    else {
      const t5 = new R(e7, this), s5 = t5.u(this.options);
      t5.p(i5), this.T(s5), this._$AH = t5;
    }
  }
  _$AC(t4) {
    let i5 = C.get(t4.strings);
    return void 0 === i5 && C.set(t4.strings, i5 = new S2(t4)), i5;
  }
  k(t4) {
    u2(this._$AH) || (this._$AH = [], this._$AR());
    const i5 = this._$AH;
    let s4, e7 = 0;
    for (const h3 of t4) e7 === i5.length ? i5.push(s4 = new _k(this.O(c3()), this.O(c3()), this, this.options)) : s4 = i5[e7], s4._$AI(h3), e7++;
    e7 < i5.length && (this._$AR(s4 && s4._$AB.nextSibling, e7), i5.length = e7);
  }
  _$AR(t4 = this._$AA.nextSibling, s4) {
    for (this._$AP?.(false, true, s4); t4 !== this._$AB; ) {
      const s5 = i3(t4).nextSibling;
      i3(t4).remove(), t4 = s5;
    }
  }
  setConnected(t4) {
    void 0 === this._$AM && (this._$Cv = t4, this._$AP?.(t4));
  }
};
var H = class {
  get tagName() {
    return this.element.tagName;
  }
  get _$AU() {
    return this._$AM._$AU;
  }
  constructor(t4, i5, s4, e7, h3) {
    this.type = 1, this._$AH = A, this._$AN = void 0, this.element = t4, this.name = i5, this._$AM = e7, this.options = h3, s4.length > 2 || "" !== s4[0] || "" !== s4[1] ? (this._$AH = Array(s4.length - 1).fill(new String()), this.strings = s4) : this._$AH = A;
  }
  _$AI(t4, i5 = this, s4, e7) {
    const h3 = this.strings;
    let o7 = false;
    if (void 0 === h3) t4 = M(this, t4, i5, 0), o7 = !a2(t4) || t4 !== this._$AH && t4 !== E, o7 && (this._$AH = t4);
    else {
      const e8 = t4;
      let n6, r6;
      for (t4 = h3[0], n6 = 0; n6 < h3.length - 1; n6++) r6 = M(this, e8[s4 + n6], i5, n6), r6 === E && (r6 = this._$AH[n6]), o7 ||= !a2(r6) || r6 !== this._$AH[n6], r6 === A ? t4 = A : t4 !== A && (t4 += (r6 ?? "") + h3[n6 + 1]), this._$AH[n6] = r6;
    }
    o7 && !e7 && this.j(t4);
  }
  j(t4) {
    t4 === A ? this.element.removeAttribute(this.name) : this.element.setAttribute(this.name, t4 ?? "");
  }
};
var I = class extends H {
  constructor() {
    super(...arguments), this.type = 3;
  }
  j(t4) {
    this.element[this.name] = t4 === A ? void 0 : t4;
  }
};
var L = class extends H {
  constructor() {
    super(...arguments), this.type = 4;
  }
  j(t4) {
    this.element.toggleAttribute(this.name, !!t4 && t4 !== A);
  }
};
var z = class extends H {
  constructor(t4, i5, s4, e7, h3) {
    super(t4, i5, s4, e7, h3), this.type = 5;
  }
  _$AI(t4, i5 = this) {
    if ((t4 = M(this, t4, i5, 0) ?? A) === E) return;
    const s4 = this._$AH, e7 = t4 === A && s4 !== A || t4.capture !== s4.capture || t4.once !== s4.once || t4.passive !== s4.passive, h3 = t4 !== A && (s4 === A || e7);
    e7 && this.element.removeEventListener(this.name, this, s4), h3 && this.element.addEventListener(this.name, this, t4), this._$AH = t4;
  }
  handleEvent(t4) {
    "function" == typeof this._$AH ? this._$AH.call(this.options?.host ?? this.element, t4) : this._$AH.handleEvent(t4);
  }
};
var Z = class {
  constructor(t4, i5, s4) {
    this.element = t4, this.type = 6, this._$AN = void 0, this._$AM = i5, this.options = s4;
  }
  get _$AU() {
    return this._$AM._$AU;
  }
  _$AI(t4) {
    M(this, t4);
  }
};
var B = t3.litHtmlPolyfillSupport;
B?.(S2, k), (t3.litHtmlVersions ??= []).push("3.3.3");
var D = (t4, i5, s4) => {
  const e7 = s4?.renderBefore ?? i5;
  let h3 = e7._$litPart$;
  if (void 0 === h3) {
    const t5 = s4?.renderBefore ?? null;
    e7._$litPart$ = h3 = new k(i5.insertBefore(c3(), t5), t5, void 0, s4 ?? {});
  }
  return h3._$AI(t4), h3;
};

// node_modules/lit-element/lit-element.js
var s3 = globalThis;
var i4 = class extends y {
  constructor() {
    super(...arguments), this.renderOptions = { host: this }, this._$Do = void 0;
  }
  createRenderRoot() {
    const t4 = super.createRenderRoot();
    return this.renderOptions.renderBefore ??= t4.firstChild, t4;
  }
  update(t4) {
    const r6 = this.render();
    this.hasUpdated || (this.renderOptions.isConnected = this.isConnected), super.update(t4), this._$Do = D(r6, this.renderRoot, this.renderOptions);
  }
  connectedCallback() {
    super.connectedCallback(), this._$Do?.setConnected(true);
  }
  disconnectedCallback() {
    super.disconnectedCallback(), this._$Do?.setConnected(false);
  }
  render() {
    return E;
  }
};
i4._$litElement$ = true, i4["finalized"] = true, s3.litElementHydrateSupport?.({ LitElement: i4 });
var o5 = s3.litElementPolyfillSupport;
o5?.({ LitElement: i4 });
(s3.litElementVersions ??= []).push("4.2.2");

// node_modules/@lit/reactive-element/decorators/property.js
var o6 = { attribute: true, type: String, converter: u, reflect: false, hasChanged: f };
var r4 = (t4 = o6, e7, r6) => {
  const { kind: n6, metadata: i5 } = r6;
  let s4 = globalThis.litPropertyMetadata.get(i5);
  if (void 0 === s4 && globalThis.litPropertyMetadata.set(i5, s4 = /* @__PURE__ */ new Map()), "setter" === n6 && ((t4 = Object.create(t4)).wrapped = true), s4.set(r6.name, t4), "accessor" === n6) {
    const { name: o7 } = r6;
    return { set(r7) {
      const n7 = e7.get.call(this);
      e7.set.call(this, r7), this.requestUpdate(o7, n7, t4, true, r7);
    }, init(e8) {
      return void 0 !== e8 && this.C(o7, void 0, t4, e8), e8;
    } };
  }
  if ("setter" === n6) {
    const { name: o7 } = r6;
    return function(r7) {
      const n7 = this[o7];
      e7.call(this, r7), this.requestUpdate(o7, n7, t4, true, r7);
    };
  }
  throw Error("Unsupported decorator location: " + n6);
};
function n5(t4) {
  return (e7, o7) => "object" == typeof o7 ? r4(t4, e7, o7) : ((t5, e8, o8) => {
    const r6 = e8.hasOwnProperty(o8);
    return e8.constructor.createProperty(o8, t5), r6 ? Object.getOwnPropertyDescriptor(e8, o8) : void 0;
  })(t4, e7, o7);
}

// node_modules/@lit/reactive-element/decorators/state.js
function r5(r6) {
  return n5({ ...r6, state: true, attribute: false });
}

// node_modules/@lit/reactive-element/decorators/base.js
var e5 = (e7, t4, c4) => (c4.configurable = true, c4.enumerable = true, Reflect.decorate && "object" != typeof t4 && Object.defineProperty(e7, t4, c4), c4);

// node_modules/@lit/reactive-element/decorators/query.js
function e6(e7, r6) {
  return (n6, s4, i5) => {
    const o7 = (t4) => t4.renderRoot?.querySelector(e7) ?? null;
    if (r6) {
      const { get: e8, set: r7 } = "object" == typeof s4 ? n6 : i5 ?? (() => {
        const t4 = Symbol();
        return { get() {
          return this[t4];
        }, set(e9) {
          this[t4] = e9;
        } };
      })();
      return e5(n6, s4, { get() {
        let t4 = e8.call(this);
        return void 0 === t4 && (t4 = o7(this), (null !== t4 || this.hasUpdated) && r7.call(this, t4)), t4;
      } });
    }
    return e5(n6, s4, { get() {
      return o7(this);
    } });
  };
}

// src/ui/components/vio-product.ts
var VioProduct = class extends i4 {
  constructor() {
    super(...arguments);
    this.brand = "";
    this.name = "";
    this.price = "";
    this.retailer = "";
    this.imageUrl = "";
    this.productId = "";
    this.sponsorId = "";
    this.hasVariants = false;
    this.hideMeta = false;
    this.inCart = false;
    this.cartQty = 0;
    this.justAdded = false;
    this.boundCartChange = () => this.updateInCart();
  }
  static {
    this.styles = i`
    :host {
      display: block;
      box-sizing: border-box;
      width: 100%;
      cursor: pointer;
      font-family: var(--vio-font-sans, -apple-system, sans-serif);
      color: var(--vio-color-text, #0a0a0a);
      -webkit-tap-highlight-color: transparent;
    }
    .card {
      display: flex;
      flex-direction: column;
      height: 100%;
    }
    .image {
      position: relative;
      aspect-ratio: 1 / 1;
      width: 100%;
      background-color: var(--vio-color-surface-muted, #f2f2f2);
      display: flex;
      align-items: center;
      justify-content: center;
      overflow: hidden;
      transition: opacity 0.2s ease;
    }
    :host(:hover) .image img { opacity: 0.92; }

    /* Quick add-to-cart button — overlaid bottom-right of the image, like the
       reference card's wishlist heart but wired to add the product to the cart. */
    .add-btn {
      position: absolute;
      right: 10px;
      bottom: 10px;
      width: 40px;
      height: 40px;
      border-radius: 50%;
      background: rgba(255, 255, 255, 0.96);
      border: none;
      display: flex;
      align-items: center;
      justify-content: center;
      cursor: pointer;
      color: #0a0a0a;
      box-shadow: 0 2px 10px rgba(0, 0, 0, 0.16);
      transition: transform 0.14s ease, background 0.14s ease, color 0.14s ease;
      padding: 0;
      z-index: 2;
    }
    .add-btn:hover { background: #fff; transform: scale(1.08); }
    .add-btn:active { transform: scale(0.95); }
    /* In cart → black circle with a white tick (matches the floating cart). */
    .add-btn.in-cart { background: #0a0a0a; color: #fff; }
    .add-btn.in-cart:hover { background: #222; }
    .add-btn.pop { animation: vio-add-pop 0.42s cubic-bezier(0.34, 1.56, 0.64, 1); }
    .add-btn svg { width: 18px; height: 18px; }
    .add-btn .add-count { font-size: 15px; font-weight: 700; line-height: 1; }
    @keyframes vio-add-pop {
      0% { transform: scale(1); }
      35% { transform: scale(1.32); }
      60% { transform: scale(0.9); }
      100% { transform: scale(1); }
    }
    .image img {
      width: 100%;
      height: 100%;
      object-fit: cover;
      display: block;
    }
    .meta {
      padding-top: 14px;
      display: flex;
      flex-direction: column;
      flex: 1;
    }
    .brand {
      font-size: var(--vio-size-xs, 12px);
      letter-spacing: var(--vio-tracking-label, 0.1em);
      text-transform: uppercase;
      color: var(--vio-color-text-secondary, #666);
      font-weight: 500;
      margin-bottom: 6px;
    }
    .name {
      font-size: var(--vio-size-md, 16px);
      font-weight: 500;
      line-height: 1.3;
      margin: 0 0 10px;
      display: -webkit-box;
      -webkit-line-clamp: 2;
      line-clamp: 2;
      -webkit-box-orient: vertical;
      overflow: hidden;
    }
    .price {
      font-size: var(--vio-size-md, 16px);
      font-weight: 700;
      margin-bottom: 16px;
    }
    .retailer {
      font-size: var(--vio-size-xs, 12px);
      letter-spacing: var(--vio-tracking-label, 0.1em);
      text-transform: uppercase;
      color: var(--vio-color-text-tertiary, #999);
      font-weight: 500;
      margin-top: auto;
    }
  `;
  }
  connectedCallback() {
    super.connectedCallback();
    this.updateInCart();
    Vio.cart.addEventListener("change", this.boundCartChange);
  }
  disconnectedCallback() {
    Vio.cart.removeEventListener("change", this.boundCartChange);
    super.disconnectedCallback();
  }
  updated(changed) {
    if (changed.has("productId") || changed.has("sponsorId")) this.updateInCart();
  }
  /** Reflect whether (and how many units of) this product sit in the cart. */
  updateInCart() {
    const pid = Number(this.productId);
    if (!Number.isFinite(pid) || pid <= 0) {
      this.inCart = false;
      this.cartQty = 0;
      return;
    }
    const sid = Number(this.sponsorId);
    let qty = 0;
    for (const cart of Vio.cart.getAllCarts().values()) {
      if (Number.isFinite(sid) && sid > 0 && cart.sponsorId !== sid) continue;
      for (const i5 of cart.items) if (Number(i5.productId) === pid) qty += i5.quantity;
    }
    this.inCart = qty > 0;
    this.cartQty = qty;
  }
  onClick() {
    this.dispatchEvent(
      new CustomEvent("vio:product-click", {
        bubbles: true,
        composed: true,
        detail: {
          productId: this.productId,
          sponsorId: this.sponsorId,
          brand: this.brand,
          name: this.name,
          price: this.price,
          retailer: this.retailer,
          imageUrl: this.imageUrl
        }
      })
    );
  }
  onKeydown(e7) {
    if (e7.key === "Enter" || e7.key === " ") {
      e7.preventDefault();
      this.onClick();
    }
  }
  /** Quick add-to-cart. If the product has selectable variants, open the detail
   * to pick one instead (the host can't choose for the user). Otherwise emit
   * `vio:product-add` so the host adds it (bumping quantity on repeat taps). */
  onAdd(e7) {
    e7.stopPropagation();
    if (this.hasVariants) {
      this.onClick();
      return;
    }
    this.dispatchEvent(
      new CustomEvent("vio:product-add", {
        bubbles: true,
        composed: true,
        detail: {
          productId: this.productId,
          sponsorId: this.sponsorId,
          brand: this.brand,
          name: this.name,
          price: this.price,
          retailer: this.retailer,
          imageUrl: this.imageUrl
        }
      })
    );
    this.justAdded = true;
    setTimeout(() => {
      this.justAdded = false;
    }, 450);
  }
  render() {
    return b2`
      <div
        class="card"
        @click=${this.onClick}
        @keydown=${this.onKeydown}
        role="button"
        tabindex="0"
        aria-label=${`${this.brand} ${this.name} ${this.price}`}
      >
        <div class="image">
          ${this.imageUrl ? b2`<img src=${this.imageUrl} alt=${this.name || this.brand} loading="lazy" />` : ""}
          <button
            class="add-btn ${this.inCart ? "in-cart" : ""} ${this.justAdded ? "pop" : ""}"
            @click=${this.onAdd}
            aria-label=${this.inCart ? "I handlekurven \u2013 legg til en til" : "Legg i kurv"}
            title=${this.inCart ? "I handlekurven" : "Legg i kurv"}
          >
            ${this.inCart ? this.cartQty > 1 ? b2`<span class="add-count">${this.cartQty}</span>` : b2`<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4">
                    <polyline points="20 6 9 17 4 12"></polyline>
                  </svg>` : b2`<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7">
                  <path d="M6 2L3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4z"></path>
                  <line x1="3" y1="6" x2="21" y2="6"></line>
                  <path d="M16 10a4 4 0 0 1-8 0"></path>
                </svg>`}
          </button>
        </div>
        ${this.hideMeta ? "" : b2`
        <div class="meta">
          ${this.brand ? b2`<div class="brand">${this.brand}</div>` : ""}
          ${this.name ? b2`<div class="name">${this.name}</div>` : ""}
          ${this.price ? b2`<div class="price">${this.price}</div>` : ""}
          ${this.retailer ? b2`<div class="retailer">${this.retailer}</div>` : ""}
        </div>`}
      </div>
    `;
  }
};
__decorateClass([
  n5({ type: String })
], VioProduct.prototype, "brand", 2);
__decorateClass([
  n5({ type: String })
], VioProduct.prototype, "name", 2);
__decorateClass([
  n5({ type: String })
], VioProduct.prototype, "price", 2);
__decorateClass([
  n5({ type: String })
], VioProduct.prototype, "retailer", 2);
__decorateClass([
  n5({ type: String, attribute: "image-url" })
], VioProduct.prototype, "imageUrl", 2);
__decorateClass([
  n5({ type: String, attribute: "product-id" })
], VioProduct.prototype, "productId", 2);
__decorateClass([
  n5({ type: String, attribute: "sponsor-id" })
], VioProduct.prototype, "sponsorId", 2);
__decorateClass([
  n5({ type: Boolean, attribute: "has-variants" })
], VioProduct.prototype, "hasVariants", 2);
__decorateClass([
  n5({ type: Boolean, attribute: "hide-meta" })
], VioProduct.prototype, "hideMeta", 2);
__decorateClass([
  r5()
], VioProduct.prototype, "inCart", 2);
__decorateClass([
  r5()
], VioProduct.prototype, "cartQty", 2);
__decorateClass([
  r5()
], VioProduct.prototype, "justAdded", 2);

// src/ui/components/vio-product-carousel.ts
var VioProductCarousel = class extends i4 {
  constructor() {
    super(...arguments);
    this.label = "";
    this.heading = "";
    this.disclaimer = "";
    this.seeAllHref = "";
    this.seeAllLabel = "Se alle";
    this.productIds = "";
    this.commerceKey = "";
    this.sponsorId = 0;
    this.productRefs = "";
    this.currency = "NOK";
    this.fetched = null;
    this.isLoading = false;
    this.fetchError = "";
  }
  static {
    this.styles = i`
    :host {
      display: block;
      box-sizing: border-box;
      width: 100%;
      font-family: var(--vio-font-sans, -apple-system, sans-serif);
      color: var(--vio-color-text, #0a0a0a);
      padding: var(--vio-space-xl, 32px) 0;
    }
    .header {
      display: flex;
      align-items: flex-end;
      justify-content: space-between;
      gap: var(--vio-space-md, 16px);
      margin-bottom: var(--vio-space-lg, 24px);
      padding: 0 var(--vio-space-lg, 24px);
    }
    .header-text { flex: 1; min-width: 0; }
    .label {
      font-size: var(--vio-size-xs, 12px);
      letter-spacing: var(--vio-tracking-label, 0.1em);
      text-transform: uppercase;
      color: var(--vio-color-accent, #c14a3b);
      font-weight: 500;
      margin-bottom: var(--vio-space-sm, 8px);
    }
    .heading-row {
      display: flex;
      align-items: baseline;
      gap: var(--vio-space-sm, 8px);
      flex-wrap: wrap;
    }
    .heading {
      font-family: var(--vio-font-serif, Georgia, serif);
      font-size: clamp(28px, 4vw, 40px);
      font-weight: 400;
      line-height: 1.1;
      margin: 0;
    }
    .disclaimer {
      color: var(--vio-color-text-tertiary, #999);
      font-size: var(--vio-size-sm, 14px);
      font-style: italic;
    }
    .see-all {
      font-size: var(--vio-size-sm, 14px);
      color: var(--vio-color-text, #0a0a0a);
      text-decoration: underline;
      text-underline-offset: 4px;
      white-space: nowrap;
      font-weight: 500;
    }
    .see-all:hover { color: var(--vio-color-text-secondary, #666); }

    .viewport {
      position: relative;
    }
    .scroller {
      display: flex;
      gap: var(--vio-space-md, 16px);
      /* Extra left padding so the first card clears the prev chevron. */
      padding: 0 var(--vio-space-lg, 24px) 8px 72px;
      overflow-x: auto;
      scroll-snap-type: x mandatory;
      scrollbar-width: none;
      -ms-overflow-style: none;
      -webkit-overflow-scrolling: touch;
    }
    @media (max-width: 600px) {
      .scroller { padding: 0 var(--vio-space-lg, 24px) 8px; }
    }
    .scroller::-webkit-scrollbar { display: none; }
    ::slotted(*),
    vio-product {
      flex: 0 0 240px;
      scroll-snap-align: start;
    }
    @media (max-width: 600px) {
      ::slotted(*),
      vio-product {
        /* Two complete cards per screen (+ a sliver of the next), matching the
           reference: card = (viewport − side padding − gap) / 2. */
        flex: 0 0 calc((100vw - 64px) / 2);
      }
    }

    .nav-btn {
      position: absolute;
      top: 30%;
      width: 48px;
      height: 48px;
      border-radius: 50%;
      background: #fff;
      border: none;
      box-shadow: 0 2px 14px rgba(0, 0, 0, 0.1);
      cursor: pointer;
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 16px;
      color: #0a0a0a;
      z-index: 2;
      transition: background 0.15s, transform 0.15s;
      font-family: inherit;
      padding: 0;
    }
    .nav-btn:hover { background: #fafafa; transform: scale(1.05); }
    .nav-btn:active { transform: scale(0.98); }
    .nav-btn.prev { left: 8px; }
    .nav-btn.next { right: 8px; }
    @media (max-width: 600px) {
      .nav-btn { display: none; }
    }

    .state {
      padding: 60px var(--vio-space-lg, 24px);
      text-align: center;
      color: var(--vio-color-text-secondary, #666);
      font-size: 14px;
    }
    .state.error { color: var(--vio-color-accent, #c14a3b); }
    .skeleton {
      flex: 0 0 240px;
      scroll-snap-align: start;
    }
    .skeleton-image {
      aspect-ratio: 1 / 1;
      background: var(--vio-color-surface-muted, #f2f2f2);
      animation: vio-pulse 1.6s ease-in-out infinite;
    }
    .skeleton-text {
      height: 12px;
      background: var(--vio-color-surface-muted, #f2f2f2);
      margin-top: 12px;
      animation: vio-pulse 1.6s ease-in-out infinite;
    }
    .skeleton-text.shorter { width: 60%; }
    @keyframes vio-pulse {
      0%,
      100% { opacity: 1; }
      50% { opacity: 0.5; }
    }
  `;
  }
  connectedCallback() {
    super.connectedCallback();
    if (this.productRefs.trim() || this.productIds.trim()) {
      void this.autoFetch();
    }
  }
  updated(changed) {
    const propChanged = changed.has("productRefs") || changed.has("productIds") || changed.has("commerceKey") || changed.has("sponsorId");
    if (propChanged && (this.productRefs.trim() || this.productIds.trim())) {
      void this.autoFetch();
    }
  }
  async autoFetch() {
    if (!Vio.isInitialized) {
      this.fetchError = "Vio not initialized \u2014 call Vio.init({ apiKey }) first";
      return;
    }
    this.isLoading = true;
    this.fetchError = "";
    try {
      const refs = this.productRefs.trim() ? this.parseRefs(this.productRefs) : this.productIds.split(",").map((s4) => parseInt(s4.trim(), 10)).filter((n6) => !Number.isNaN(n6)).map((id) => ({ sponsorId: this.sponsorId, productId: id }));
      if (refs.length === 0) {
        this.fetched = [];
        return;
      }
      const bySponsor = /* @__PURE__ */ new Map();
      for (const r6 of refs) {
        const arr = bySponsor.get(r6.sponsorId) ?? [];
        arr.push(r6.productId);
        bySponsor.set(r6.sponsorId, arr);
      }
      const fetched = await Promise.all(
        Array.from(bySponsor.entries()).map(async ([sponsorId, ids]) => {
          const commerce = this.commerceKey && this.productRefs.trim() === "" ? Vio.commerceWithKey(this.commerceKey) : Vio.commerceFor(sponsorId);
          const products = await commerce.channel.product.getByIds({
            product_ids: ids,
            currency: this.currency,
            image_size: "large"
          });
          return { sponsorId, products };
        })
      );
      const lookup = /* @__PURE__ */ new Map();
      for (const { sponsorId, products } of fetched) {
        for (const p3 of products) lookup.set(`${sponsorId}:${p3.id}`, p3);
      }
      this.fetched = refs.map(({ sponsorId, productId }) => {
        const product = lookup.get(`${sponsorId}:${productId}`);
        return product ? { product, sponsorId } : null;
      }).filter((x2) => x2 !== null);
    } catch (err) {
      this.fetchError = err instanceof Error ? err.message : String(err);
    } finally {
      this.isLoading = false;
    }
  }
  parseRefs(raw) {
    return raw.split(",").map((pair) => pair.trim()).filter((s4) => s4.length > 0).map((pair) => {
      const [sidStr, pidStr] = pair.split(":");
      const sid = parseInt((sidStr ?? "").trim(), 10);
      const pid = parseInt((pidStr ?? "").trim(), 10);
      if (Number.isNaN(sid) || Number.isNaN(pid)) return null;
      return { sponsorId: sid, productId: pid };
    }).filter((x2) => x2 !== null);
  }
  scrollByDirection(direction) {
    if (!this.scroller) return;
    const item = this.scroller.querySelector(":scope > *");
    const step = (item?.offsetWidth ?? 240) + 16;
    this.scroller.scrollBy({ left: direction * step * 2, behavior: "smooth" });
  }
  renderScrollerContent() {
    if (this.isLoading && !this.fetched) {
      return b2`${Array.from({ length: 5 }).map(
        () => b2`
          <div class="skeleton">
            <div class="skeleton-image"></div>
            <div class="skeleton-text"></div>
            <div class="skeleton-text shorter"></div>
          </div>
        `
      )}`;
    }
    if (this.fetched && this.fetched.length > 0) {
      return b2`${this.fetched.map(({ product: p3, sponsorId }) => {
        const img = primaryImageUrl(p3) ?? "";
        const retailer = sponsorNameFromBootstrap(sponsorId) ?? p3.brand ?? "";
        return b2`
          <vio-product
            product-id=${String(p3.id)}
            sponsor-id=${String(sponsorId)}
            brand=${p3.brand ?? ""}
            name=${p3.title}
            price=${displayPrice(p3)}
            retailer=${retailer}
            image-url=${img}
            ?has-variants=${(p3.variants?.length ?? 0) > 1}
          ></vio-product>
        `;
      })}`;
    }
    return b2`<slot></slot>`;
  }
  render() {
    return b2`
      <div class="header">
        <div class="header-text">
          ${this.label ? b2`<div class="label">${this.label}</div>` : ""}
          <div class="heading-row">
            ${this.heading ? b2`<h2 class="heading">${this.heading}</h2>` : ""}
            ${this.disclaimer ? b2`<span class="disclaimer">(${this.disclaimer})</span>` : ""}
          </div>
        </div>
        ${this.seeAllHref ? b2`<a class="see-all" href=${this.seeAllHref}>${this.seeAllLabel}</a>` : ""}
      </div>
      <div class="viewport">
        <button
          class="nav-btn prev"
          @click=${() => this.scrollByDirection(-1)}
          aria-label="Forrige"
        >
          ‹
        </button>
        <div class="scroller">${this.renderScrollerContent()}</div>
        <button
          class="nav-btn next"
          @click=${() => this.scrollByDirection(1)}
          aria-label="Neste"
        >
          ›
        </button>
      </div>
      ${this.fetchError && !this.fetched ? b2`<div class="state error">${this.fetchError}</div>` : ""}
    `;
  }
};
__decorateClass([
  n5({ type: String })
], VioProductCarousel.prototype, "label", 2);
__decorateClass([
  n5({ type: String })
], VioProductCarousel.prototype, "heading", 2);
__decorateClass([
  n5({ type: String })
], VioProductCarousel.prototype, "disclaimer", 2);
__decorateClass([
  n5({ type: String, attribute: "see-all-href" })
], VioProductCarousel.prototype, "seeAllHref", 2);
__decorateClass([
  n5({ type: String, attribute: "see-all-label" })
], VioProductCarousel.prototype, "seeAllLabel", 2);
__decorateClass([
  n5({ type: String, attribute: "product-ids" })
], VioProductCarousel.prototype, "productIds", 2);
__decorateClass([
  n5({ type: String, attribute: "commerce-key" })
], VioProductCarousel.prototype, "commerceKey", 2);
__decorateClass([
  n5({ type: Number, attribute: "sponsor-id" })
], VioProductCarousel.prototype, "sponsorId", 2);
__decorateClass([
  n5({ type: String, attribute: "product-refs" })
], VioProductCarousel.prototype, "productRefs", 2);
__decorateClass([
  n5({ type: String })
], VioProductCarousel.prototype, "currency", 2);
__decorateClass([
  e6(".scroller")
], VioProductCarousel.prototype, "scroller", 2);
__decorateClass([
  r5()
], VioProductCarousel.prototype, "fetched", 2);
__decorateClass([
  r5()
], VioProductCarousel.prototype, "isLoading", 2);
__decorateClass([
  r5()
], VioProductCarousel.prototype, "fetchError", 2);
function sponsorNameFromBootstrap(sponsorId) {
  const boot = Vio.bootstrapCache;
  if (!boot) return void 0;
  if (boot.primarySponsor?.id === sponsorId) return boot.primarySponsor.name;
  return boot.secondarySponsors?.find((s4) => s4.id === sponsorId)?.name;
}

// src/ui/components/vio-product-detail.ts
var VioProductDetail = class extends i4 {
  constructor() {
    super(...arguments);
    this.open = false;
    this.productId = "";
    this.sponsorId = 0;
    this.autoOpen = true;
    this.currency = "NOK";
    this.product = null;
    this.isLoading = false;
    this.fetchError = "";
    this.selectedOptions = {};
    this.quantity = 1;
    this.activeImageIndex = 0;
    this.adding = false;
    this.applePayOk = false;
    this.availableMethods = [];
    /** Pre-prepared Apple Pay handle — show() fires synchronously on tap. */
    this.applePayHandle = null;
    this.boundProductClick = (e7) => {
      if (!this.autoOpen) return;
      const ev = e7;
      const productIdNum = parseInt(ev.detail.productId, 10);
      if (Number.isNaN(productIdNum)) return;
      const sponsorIdNum = parseInt(ev.detail.sponsorId, 10);
      if (Number.isNaN(sponsorIdNum) || sponsorIdNum <= 0) return;
      this.productId = ev.detail.productId;
      this.sponsorId = sponsorIdNum;
      if (ev.detail.currency) {
        this.currency = ev.detail.currency;
      } else {
        this.currency = (typeof globalThis !== "undefined" && globalThis.__VIO_CURRENCY__) || (typeof localStorage !== "undefined" && localStorage.getItem("vio.currency")) || "NOK";
      }
      this.show();
      void this.fetchProduct();
    };
  }
  static {
    this.styles = i`
    :host { display: contents; }

    .backdrop {
      position: fixed;
      inset: 0;
      background: rgba(0, 0, 0, 0.5);
      opacity: 0;
      pointer-events: none;
      transition: opacity 0.25s ease;
      z-index: 1100;
    }
    :host([open]) .backdrop { opacity: 1; pointer-events: auto; }

    .modal {
      position: fixed;
      inset: 0;
      background: var(--vio-color-surface, #fff);
      transform: translateY(100%);
      transition: transform 0.35s cubic-bezier(0.32, 0.72, 0, 1);
      display: flex;
      flex-direction: column;
      font-family: var(--vio-font-sans, -apple-system, sans-serif);
      color: var(--vio-color-text, #0a0a0a);
      z-index: 1101;
      overflow-y: auto;
    }
    :host([open]) .modal { transform: translateY(0); }

    .handle { display: none; }

    /* Mobile: bottom sheet (not fullscreen), rounded top, drag handle. */
    @media (max-width: 600px) {
      .modal {
        top: auto;
        height: 92vh;
        border-radius: 16px 16px 0 0;
        box-shadow: 0 -8px 24px rgba(0, 0, 0, 0.08);
      }
      .handle {
        display: flex;
        justify-content: center;
        padding: 10px 0 4px;
        flex-shrink: 0;
      }
      .handle::before {
        content: '';
        width: 40px;
        height: 4px;
        background: var(--vio-color-border, #e5e5e5);
        border-radius: 2px;
      }
    }

    /* Desktop: right-side drawer (matches the cart/checkout), so the product
       shows "al lado" instead of a centered modal. Info stacks in one column. */
    @media (min-width: 601px) {
      .modal {
        inset: 0 0 0 auto;
        width: min(440px, 100%);
        max-width: 440px;
        border-radius: 0;
        box-shadow: -8px 0 24px rgba(0, 0, 0, 0.1);
        transform: translateX(100%);
        transition: transform 0.3s cubic-bezier(0.32, 0.72, 0, 1);
      }
      :host([open]) .modal { transform: translateX(0); }
      /* Content overrides are prefixed with .modal so they beat the base
         .body / .name / .gallery-main rules defined LATER in this stylesheet
         (equal specificity, later wins; the extra class tips the cascade). */
      .modal .body {
        max-width: none;
        grid-template-columns: 1fr;
        gap: 20px;
        padding: 20px 24px 40px;
      }
      .modal .name { font-size: 26px; line-height: 1.2; }
      .modal .gallery-main { width: 100%; }
    }

    .topbar {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: 20px var(--vio-space-lg, 24px);
      position: sticky;
      top: 0;
      background: var(--vio-color-surface, #fff);
      border-bottom: 1px solid var(--vio-color-border, #e5e5e5);
      z-index: 1;
    }
    .topbar-brand {
      font-size: 12px;
      text-transform: uppercase;
      letter-spacing: var(--vio-tracking-label, 0.1em);
      color: var(--vio-color-text-secondary, #666);
      font-weight: 500;
    }
    .close {
      background: none;
      border: none;
      cursor: pointer;
      font-size: 28px;
      line-height: 1;
      padding: 0;
      color: var(--vio-color-text, #0a0a0a);
      font-family: inherit;
    }
    .close:hover { color: var(--vio-color-text-secondary, #666); }

    .body {
      flex: 1;
      max-width: 1200px;
      width: 100%;
      margin: 0 auto;
      padding: 48px var(--vio-space-lg, 24px) 80px;
      box-sizing: border-box;
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 64px;
    }
    @media (max-width: 800px) {
      .body { grid-template-columns: 1fr; gap: 32px; padding: 24px var(--vio-space-lg, 24px) 64px; }
    }

    /* Gallery */
    .gallery { display: flex; flex-direction: column; gap: 16px; }
    .gallery-main {
      aspect-ratio: 1;
      background: var(--vio-color-surface-muted, #f2f2f2);
      display: flex;
      align-items: center;
      justify-content: center;
      overflow: hidden;
    }
    .gallery-main img {
      width: 100%;
      height: 100%;
      object-fit: contain;
      padding: 24px;
      box-sizing: border-box;
    }
    .gallery-thumbs {
      display: flex;
      gap: 8px;
      flex-wrap: wrap;
    }
    .gallery-thumb {
      width: 72px;
      height: 72px;
      background: var(--vio-color-surface-muted, #f2f2f2);
      border: 1px solid transparent;
      cursor: pointer;
      padding: 0;
      overflow: hidden;
    }
    .gallery-thumb img {
      width: 100%;
      height: 100%;
      object-fit: contain;
      padding: 6px;
      box-sizing: border-box;
    }
    .gallery-thumb.active { border-color: var(--vio-color-text, #0a0a0a); }

    /* Info column */
    .info { display: flex; flex-direction: column; gap: 24px; }
    .brand {
      font-size: 12px;
      text-transform: uppercase;
      letter-spacing: var(--vio-tracking-label, 0.1em);
      color: var(--vio-color-text-secondary, #666);
      font-weight: 500;
    }
    .name {
      font-family: var(--vio-font-serif, Georgia, serif);
      font-size: clamp(28px, 4vw, 40px);
      font-weight: 400;
      line-height: 1.15;
      margin: 0;
      letter-spacing: -0.01em;
    }
    .price-row {
      display: flex;
      align-items: baseline;
      gap: 16px;
    }
    .price {
      font-size: 24px;
      font-weight: 700;
    }
    .compare-at {
      font-size: 16px;
      color: var(--vio-color-text-tertiary, #999);
      text-decoration: line-through;
    }
    .stock {
      font-size: 12px;
      text-transform: uppercase;
      letter-spacing: var(--vio-tracking-label, 0.1em);
      font-weight: 500;
    }
    .stock.in-stock { color: #2e7d32; }
    .stock.low-stock { color: #ed6c02; }
    .stock.out-of-stock { color: var(--vio-color-text-tertiary, #999); }

    /* Option pickers */
    .option-group { display: flex; flex-direction: column; gap: 8px; }
    .option-label {
      font-size: 11px;
      text-transform: uppercase;
      letter-spacing: var(--vio-tracking-label, 0.1em);
      color: var(--vio-color-text-secondary, #666);
      font-weight: 500;
    }
    .option-values { display: flex; flex-wrap: wrap; gap: 8px; }
    .option-pill {
      padding: 10px 18px;
      background: #fff;
      border: 1px solid var(--vio-color-border, #e5e5e5);
      cursor: pointer;
      font-family: inherit;
      font-size: 13px;
      font-weight: 500;
      color: inherit;
      transition: border-color 0.15s, background 0.15s;
    }
    .option-pill:hover { border-color: var(--vio-color-text, #0a0a0a); }
    .option-pill[aria-pressed='true'] {
      border-color: var(--vio-color-text, #0a0a0a);
      background: var(--vio-color-text, #0a0a0a);
      color: var(--vio-color-text-on-primary, #fff);
    }
    .option-pill.unavailable {
      opacity: 0.4;
      cursor: not-allowed;
      text-decoration: line-through;
      background: repeating-linear-gradient(-45deg, #fafafa, #fafafa 5px, #f0f0f0 5px, #f0f0f0 10px);
    }
    .option-pill.unavailable:hover { border-color: var(--vio-color-border, #e5e5e5); }

    /* Qty + CTA row */
    .qty-cta-row {
      display: grid;
      grid-template-columns: auto 1fr;
      gap: 16px;
      align-items: stretch;
    }
    .qty-stepper {
      display: flex;
      align-items: center;
      border: 1px solid var(--vio-color-border, #e5e5e5);
    }
    .qty-btn {
      width: 44px;
      height: 56px;
      background: #fff;
      border: none;
      cursor: pointer;
      font-size: 18px;
      color: var(--vio-color-text, #0a0a0a);
      font-family: inherit;
    }
    .qty-btn:hover { background: var(--vio-color-surface-hover, #fafafa); }
    .qty-value {
      width: 40px;
      text-align: center;
      font-weight: 600;
    }
    .add-to-cart {
      background: var(--vio-color-text, #0a0a0a);
      color: var(--vio-color-text-on-primary, #fff);
      border: none;
      padding: 18px 24px;
      font-size: 12px;
      text-transform: uppercase;
      letter-spacing: var(--vio-tracking-label, 0.1em);
      font-weight: 600;
      cursor: pointer;
      font-family: inherit;
      transition: background 0.15s;
    }
    .add-to-cart:hover:not(:disabled) { background: #222; }
    .add-to-cart:disabled {
      background: var(--vio-color-text-tertiary, #999);
      cursor: not-allowed;
    }
    /* Klarna express button — sits full-width below the add-to-cart row. */
    .buy-klarna {
      width: 100%;
      margin-top: 10px;
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 8px;
      background: #ffb3c7; /* Klarna pink */
      color: #0b051d;
      border: none;
      padding: 14px 24px;
      font-size: 12px;
      text-transform: uppercase;
      letter-spacing: var(--vio-tracking-label, 0.1em);
      font-weight: 700;
      cursor: pointer;
      font-family: inherit;
      transition: background 0.15s;
    }
    .buy-klarna .klarna-badge { height: 22px; width: auto; display: block; }
    .buy-klarna:hover:not(:disabled) { background: #ffa0b9; }
    .buy-klarna:disabled { opacity: 0.5; cursor: not-allowed; }
    .buy-applepay .ap-logo { width: 20px; height: 20px; }
    /* Vipps — brand orange buy button. */
    .buy-vipps {
      width: 100%;
      margin-top: 10px;
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 8px;
      background: #ff5b24;
      color: #fff;
      border: none;
      padding: 14px 24px;
      font-size: 12px;
      text-transform: uppercase;
      letter-spacing: var(--vio-tracking-label, 0.1em);
      font-weight: 700;
      cursor: pointer;
      font-family: inherit;
      transition: background 0.15s;
    }
    .buy-vipps .vipps-badge {
      font-size: 20px;
      font-weight: 800;
      letter-spacing: -0.02em;
      text-transform: none;
    }
    .buy-vipps:hover:not(:disabled) { background: #ec4f1c; }
    .buy-vipps:disabled { opacity: 0.5; cursor: not-allowed; }
    /* Apple Pay express button — black, per Apple's button guidelines. Only
       shown in Safari (canApplePay). The  glyph is the Apple logo (Safari). */
    .buy-applepay {
      width: 100%;
      margin-top: 10px;
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 4px;
      background: #000;
      color: #fff;
      border: none;
      padding: 15px 24px;
      font-size: 16px;
      font-weight: 600;
      cursor: pointer;
      font-family: inherit;
      letter-spacing: 0.01em;
    }
    .buy-applepay:hover:not(:disabled) { background: #1a1a1a; }
    .buy-applepay:disabled { opacity: 0.5; cursor: not-allowed; }

    /* Description */
    .description {
      font-size: 14px;
      line-height: 1.6;
      color: var(--vio-color-text-secondary, #444);
      margin-top: 8px;
    }
    .description-label {
      font-size: 11px;
      text-transform: uppercase;
      letter-spacing: var(--vio-tracking-label, 0.1em);
      color: var(--vio-color-text-secondary, #666);
      font-weight: 500;
      margin-bottom: 8px;
    }

    /* Skeleton loader: shimmer placeholders mirroring the product layout
       (image, brand, title, price, CTA) for a smooth load-in. */
    .skeleton {
      display: flex;
      flex-direction: column;
      gap: 14px;
      padding: 20px 24px 40px;
    }
    .skeleton > * {
      background: linear-gradient(
        100deg,
        var(--vio-color-surface-muted, #f1f1f1) 30%,
        rgba(255, 255, 255, 0.65) 50%,
        var(--vio-color-surface-muted, #f1f1f1) 70%
      );
      background-size: 200% 100%;
      animation: vio-skeleton-shimmer 1.4s ease-in-out infinite;
      border-radius: 8px;
    }
    .sk-image { width: 100%; aspect-ratio: 1; border-radius: 12px; }
    .sk-line { height: 14px; }
    .sk-brand { width: 38%; height: 10px; margin-top: 6px; }
    .sk-title { width: 85%; height: 26px; }
    .sk-title-2 { width: 55%; height: 26px; }
    .sk-price { width: 30%; height: 20px; margin-top: 6px; }
    .sk-button { width: 100%; height: 54px; border-radius: 0; margin-top: 10px; }
    @keyframes vio-skeleton-shimmer {
      0% { background-position: 200% 0; }
      100% { background-position: -200% 0; }
    }
    @media (prefers-reduced-motion: reduce) {
      .skeleton > * {
        animation: none;
        background: var(--vio-color-surface-muted, #f1f1f1);
      }
    }
    .error {
      padding: 80px 24px;
      text-align: center;
      color: var(--vio-color-accent, #c14a3b);
      font-size: 14px;
    }
  `;
  }
  connectedCallback() {
    super.connectedCallback();
    document.addEventListener("vio:product-click", this.boundProductClick);
  }
  disconnectedCallback() {
    document.removeEventListener("vio:product-click", this.boundProductClick);
    super.disconnectedCallback();
  }
  show() {
    this.open = true;
  }
  close() {
    this.open = false;
    setTimeout(() => {
      if (!this.open) {
        this.product = null;
        this.selectedOptions = {};
        this.quantity = 1;
        this.activeImageIndex = 0;
        this.fetchError = "";
      }
    }, 400);
  }
  async fetchProduct() {
    const productIdNum = parseInt(this.productId, 10);
    if (Number.isNaN(productIdNum) || !this.sponsorId) {
      this.product = null;
      return;
    }
    this.isLoading = true;
    this.fetchError = "";
    let products = null;
    let lastError = null;
    for (let attempt = 0; attempt < 4; attempt++) {
      try {
        const activeCurrency = (typeof globalThis !== "undefined" && globalThis.__VIO_CURRENCY__) || (typeof localStorage !== "undefined" && localStorage.getItem("vio.currency")) || this.currency || "NOK";
        this.currency = activeCurrency;
        const commerce = Vio.commerceFor(this.sponsorId);
        products = await commerce.channel.product.getByIds({
          product_ids: [productIdNum],
          currency: activeCurrency,
          image_size: "large"
        });
        lastError = null;
        break;
      } catch (err) {
        lastError = err;
        await new Promise((resolve) => setTimeout(resolve, 300));
      }
    }
    if (lastError) {
      this.fetchError = lastError instanceof Error ? lastError.message : String(lastError);
      console.warn("[VioDetail] fetch failed after retries \u2192", this.fetchError);
      this.isLoading = false;
      return;
    }
    this.product = products?.[0] ?? null;
    if (this.product) {
      const initial = {};
      for (const opt of this.product.options ?? []) {
        const values = normalizeValues(opt.values);
        if (values.length > 0) initial[opt.name] = values[0];
      }
      this.selectedOptions = initial;
      void Vio.checkout.prepareApplePayFor(this.unitPrice * this.quantity, this.currency).then((handle) => {
        this.applePayHandle = handle;
        this.applePayOk = handle.available;
      }).catch(() => {
        this.applePayHandle = null;
        this.applePayOk = false;
      });
      void this.loadAvailablePaymentMethods();
    }
    this.isLoading = false;
  }
  /** Option values a variant represents — variant titles join them with " / "
   * (or "|"). Exact parts, lowercased, so matching is combination-accurate
   * (avoids "M" matching "Medium"). */
  variantOptionValues(v2) {
    return (v2.title ?? "").split(/\s*[/|]\s*/).map((s4) => s4.trim().toLowerCase()).filter(Boolean);
  }
  /** Does a variant part represent this option value? Whole-token match, so the
   * value "30" matches the part "30 ml" but "M" does NOT match "Medium". */
  partMatchesValue(part, value) {
    if (part === value) return true;
    return part.split(/\s+/).includes(value);
  }
  /** Does a variant satisfy every currently-selected option value? */
  variantMatchesSelection(v2, selection) {
    const wanted = Object.values(selection).map((s4) => s4.trim().toLowerCase());
    if (wanted.length === 0) return true;
    const parts = this.variantOptionValues(v2);
    return wanted.every((w2) => parts.some((part) => this.partMatchesValue(part, w2)));
  }
  /** Resolve the active variant from the selected combination. Prefers a FULL
   * match (all options accounted for), then a partial match, then the first. */
  selectedVariant() {
    if (!this.product || this.product.variants.length === 0) return null;
    const sel = this.selectedOptions;
    const wanted = Object.values(sel).map((s4) => s4.trim().toLowerCase());
    if (wanted.length === 0) return this.product.variants[0] ?? null;
    const full = this.product.variants.find(
      (v2) => this.variantOptionValues(v2).length === wanted.length && this.variantMatchesSelection(v2, sel)
    );
    if (full) return full;
    const partial = this.product.variants.find((v2) => this.variantMatchesSelection(v2, sel));
    return partial ?? this.product.variants[0] ?? null;
  }
  /** True if picking `value` for `optionName` (with the rest of the current
   * selection) still yields an in-stock variant. When no variant reports stock
   * (missing data), never disables — lets the backend be the source of truth. */
  isValueAvailable(optionName, value) {
    if (!this.product) return true;
    const anyStock = this.product.variants.some((v2) => (v2.quantity ?? 0) > 0);
    if (!anyStock) return true;
    const trial = { ...this.selectedOptions, [optionName]: value };
    return this.product.variants.some(
      (v2) => this.variantMatchesSelection(v2, trial) && (v2.quantity ?? 0) > 0
    );
  }
  get unitPrice() {
    const v2 = this.selectedVariant();
    const price = v2?.price ?? this.product?.price;
    return price?.amount_incl_taxes ?? price?.amount ?? 0;
  }
  get compareAt() {
    const v2 = this.selectedVariant();
    const price = v2?.price ?? this.product?.price;
    return price?.compare_at_incl_taxes ?? price?.compare_at ?? null;
  }
  get availableQuantity() {
    const v2 = this.selectedVariant();
    if (v2) return v2.quantity ?? 0;
    return this.product?.quantity ?? 0;
  }
  stockLabel() {
    const qty = this.availableQuantity;
    if (qty <= 0) return { text: "Utsolgt", cls: "out-of-stock" };
    if (qty <= 3) return { text: `F\xE5 igjen \u2014 ${qty} stk`, cls: "low-stock" };
    return { text: "P\xE5 lager", cls: "in-stock" };
  }
  selectOption(optionName, value) {
    this.selectedOptions = { ...this.selectedOptions, [optionName]: value };
  }
  allImages() {
    if (!this.product) return [];
    const variantImages = this.selectedVariant()?.images ?? [];
    if (variantImages.length > 0) return variantImages;
    return this.product.images;
  }
  get activeImage() {
    return this.allImages()[this.activeImageIndex];
  }
  /** Add the current product + selected variant + qty to the cart. Returns the variant id used. */
  addCurrentToCart() {
    if (!this.product) return void 0;
    const variant = this.selectedVariant();
    const sponsor = Vio.bootstrapCache?.primarySponsor;
    const secondaries = Vio.bootstrapCache?.secondarySponsors ?? [];
    const sponsorName = sponsor?.id === this.sponsorId ? sponsor.name : secondaries.find((s4) => s4.id === this.sponsorId)?.name;
    Vio.cart.addProduct({
      product: this.product,
      sponsorId: this.sponsorId,
      sponsorName,
      quantity: this.quantity,
      variantId: variant?.id
    });
    return variant?.id;
  }
  async addToCart() {
    if (!this.product || this.availableQuantity <= 0 || this.adding) return;
    this.adding = true;
    try {
      const variantId = this.addCurrentToCart();
      this.dispatchEvent(
        new CustomEvent("vio:added-to-cart", {
          bubbles: true,
          composed: true,
          detail: {
            productId: this.product.id,
            sponsorId: this.sponsorId,
            quantity: this.quantity,
            variantId
          }
        })
      );
      this.close();
    } finally {
      this.adding = false;
    }
  }
  /**
   * Express buy: add to cart, then open the checkout overlay with Klarna
   * preselected. The host app handles `vio:checkout-open` (same event the cart
   * uses) — the `paymentMethod` hint tells it to preselect Klarna so its widget
   * loads immediately. Reuses the working Klarna Payments flow (no express SDK).
   */
  async buyWithKlarna() {
    if (!this.product || this.availableQuantity <= 0 || this.adding) return;
    this.adding = true;
    try {
      this.addCurrentToCart();
      this.close();
      this.dispatchEvent(
        new CustomEvent("vio:checkout-open", {
          bubbles: true,
          composed: true,
          detail: { sponsorId: this.sponsorId, paymentMethod: "klarna", express: true }
        })
      );
    } finally {
      this.adding = false;
    }
  }
  /** Buy with Vipps — opens the checkout with Vipps preselected. */
  buyWithVipps() {
    if (!this.product || this.availableQuantity <= 0 || this.adding) return;
    this.addCurrentToCart();
    this.close();
    this.dispatchEvent(
      new CustomEvent("vio:checkout-open", {
        bubbles: true,
        composed: true,
        detail: { sponsorId: this.sponsorId, paymentMethod: "vipps", express: false }
      })
    );
  }
  buyWithStripe() {
    if (!this.product || this.availableQuantity <= 0 || this.adding) return;
    this.addCurrentToCart();
    this.close();
    this.dispatchEvent(
      new CustomEvent("vio:checkout-open", {
        bubbles: true,
        composed: true,
        detail: { sponsorId: this.sponsorId, paymentMethod: "stripe", express: false }
      })
    );
  }
  async loadAvailablePaymentMethods() {
    const spId = this.sponsorId || (globalThis.__VIO_SPONSOR_ID__ ?? 4);
    try {
      const methods = await Vio.checkout.getAvailablePaymentMethods(spId);
      if (Array.isArray(methods)) {
        this.availableMethods = methods.map((m) => m.name);
      } else {
        this.availableMethods = ["Stripe", "Klarna", "Vipps"];
      }
    } catch (err) {
      if (typeof console !== "undefined") {
        console.warn("[VioProductDetail] Failed to load payment methods:", err);
      }
      this.availableMethods = ["Stripe", "Klarna", "Vipps"];
    }
  }
  /**
   * Express buy with Apple Pay. Runs synchronously inside the click so the
   * Apple Pay sheet keeps the user gesture: add to cart → open checkout (sets
   * state) → launch the sheet. On authorize, `payment-complete` drives the
   * confirmation drawer (same path as the in-checkout Apple Pay button).
   */
  buyWithApplePay() {
    if (!this.product || this.availableQuantity <= 0 || !this.applePayHandle) return;
    this.addCurrentToCart();
    try {
      Vio.checkout.open(this.sponsorId);
    } catch (err) {
      if (typeof console !== "undefined") {
        console.warn("[VioProductDetail] checkout open failed:", err);
      }
      return;
    }
    void this.applePayHandle.show();
    this.close();
  }
  render() {
    return b2`
      <div class="backdrop" @click=${this.close}></div>
      <div class="modal" role="dialog" aria-label="Produkt">
        <div class="handle" @click=${this.close} aria-hidden="true"></div>
        <div class="topbar">
          <span class="topbar-brand">${this.product?.brand ?? ""}</span>
          <button class="close" @click=${this.close} aria-label="Lukk">×</button>
        </div>

        ${this.renderBody()}
      </div>
    `;
  }
  renderBody() {
    if (this.isLoading && !this.product) {
      return b2`
        <div class="skeleton" role="status" aria-busy="true" aria-label="Laster produkt">
          <div class="sk-image"></div>
          <div class="sk-line sk-brand"></div>
          <div class="sk-line sk-title"></div>
          <div class="sk-line sk-title-2"></div>
          <div class="sk-line sk-price"></div>
          <div class="sk-button"></div>
        </div>
      `;
    }
    if (this.fetchError) {
      return b2`<div class="error">Kunne ikke laste produkt: ${this.fetchError}</div>`;
    }
    if (!this.product) return b2``;
    const p3 = this.product;
    const stock = this.stockLabel();
    const compare = this.compareAt;
    const showCompare = compare !== null && compare > this.unitPrice;
    const images = this.allImages();
    const activeImage = this.activeImage;
    return b2`
      <div class="body">
        <div class="gallery">
          <div class="gallery-main">
            ${activeImage?.url ? b2`<img src=${activeImage.url} alt=${p3.title} />` : ""}
          </div>
          ${images.length > 1 ? b2`
                <div class="gallery-thumbs">
                  ${images.map(
      (img, idx) => b2`
                      <button
                        class="gallery-thumb ${idx === this.activeImageIndex ? "active" : ""}"
                        @click=${() => this.activeImageIndex = idx}
                        aria-label=${`Bilde ${idx + 1}`}
                      >
                        <img src=${img.url} alt="" />
                      </button>
                    `
    )}
                </div>
              ` : ""}
        </div>

        <div class="info">
          ${p3.brand ? b2`<div class="brand">${p3.brand}</div>` : ""}
          <h2 class="name">${p3.title}</h2>

          <div class="price-row">
            <span class="price">${formatPrice(this.unitPrice, p3.price.currency_code)}</span>
            ${showCompare ? b2`<span class="compare-at">${formatPrice(
      compare,
      p3.price.currency_code
    )}</span>` : ""}
          </div>

          <div class="stock ${stock.cls}">${stock.text}</div>

          ${this.renderOptionPickers(p3.options)}

          <div class="qty-cta-row">
            <div class="qty-stepper">
              <button
                class="qty-btn"
                @click=${() => this.quantity = Math.max(1, this.quantity - 1)}
                aria-label="Reduser antall"
              >
                −
              </button>
              <span class="qty-value">${this.quantity}</span>
              <button
                class="qty-btn"
                @click=${() => this.quantity = Math.min(this.availableQuantity, this.quantity + 1)}
                aria-label="Øk antall"
                ?disabled=${this.quantity >= this.availableQuantity}
              >
                +
              </button>
            </div>
            <button
              class="add-to-cart"
              @click=${this.addToCart}
              ?disabled=${this.availableQuantity <= 0 || this.adding}
            >
              ${this.adding ? "Legger til\u2026" : this.availableQuantity <= 0 ? "Utsolgt" : "Legg i handlekurv"}
            </button>
          </div>

          ${this.availableQuantity > 0 && this.applePayOk && (this.availableMethods.length === 0 || this.availableMethods.some(m => m.toLowerCase() === "apple-pay" || m.toLowerCase() === "applepay")) ? b2`
                <button
                  class="buy-applepay"
                  @click=${this.buyWithApplePay}
                  ?disabled=${this.adding}
                  aria-label="Kjøp nå med Apple Pay"
                >
                  <span>Kjøp nå med</span>
                  <svg class="ap-logo" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M17.05 20.28c-.98.95-2.05.8-3.08.35-1.09-.46-2.09-.48-3.24 0-1.44.62-2.2.44-3.06-.35C2.79 15.25 3.51 7.59 9.05 7.31c1.35.07 2.29.74 3.08.8 1.18-.24 2.31-.93 3.57-.84 1.51.12 2.65.72 3.4 1.8-3.12 1.87-2.38 5.98.48 7.13-.57 1.5-1.31 2.99-2.54 4.09l.01-.01zM12.03 7.25c-.15-2.23 1.66-4.07 3.74-4.25.29 2.58-2.34 4.5-3.74 4.25z"/></svg>
                  <span>Apple Pay</span>
                </button>
              ` : ""}
          ${this.availableQuantity > 0 && (this.availableMethods.length === 0 || this.availableMethods.some(m => m.toLowerCase() === "stripe")) ? b2`
                <button
                  class="buy-stripe"
                  @click=${this.buyWithStripe}
                  ?disabled=${this.adding}
                  style="width: 100%; margin-top: 10px; display: flex; align-items: center; justify-content: center; gap: 6px; background: #635bff; color: #fff; border: none; padding: 14px 24px; font-size: 15px; font-weight: 600; cursor: pointer; font-family: inherit;"
                >
                  <span>Kjøp nå med</span>
                  <img src="vio-sdk/assets/stripe-blurple.svg" style="height: 20px; display: block; filter: brightness(0) invert(1);" alt="Stripe" />
                </button>
              ` : ""}
          ${this.availableQuantity > 0 && (this.availableMethods.length === 0 || this.availableMethods.some(m => m.toLowerCase() === "klarna")) ? b2`
                <button
                  class="buy-klarna"
                  @click=${this.buyWithKlarna}
                  ?disabled=${this.adding}
                >
                  <span>Kjøp nå med</span>
                  <img
                    class="klarna-badge"
                    src="https://x.klarnacdn.net/payment-method/assets/badges/generic/klarna.svg"
                    alt="Klarna"
                  />
                </button>
              ` : ""}

          ${this.availableQuantity > 0 && (this.availableMethods.length === 0 || this.availableMethods.some(m => m.toLowerCase() === "vipps")) ? b2`
                <button
                  class="buy-vipps"
                  @click=${this.buyWithVipps}
                  ?disabled=${this.adding}
                  aria-label="Kjøp nå med Vipps"
                >
                  <span>Kjøp nå med</span>
                  <span class="vipps-badge">vipps</span>
                </button>
              ` : ""}

          ${p3.description ? b2`
                <div>
                  <div class="description-label">Beskrivelse</div>
                  <div class="description">${this.stripHtml(p3.description)}</div>
                </div>
              ` : ""}
        </div>
      </div>
    `;
  }
  renderOptionPickers(options) {
    if (options.length === 0) return "";
    return b2`${options.map((opt) => {
      const values = normalizeValues(opt.values);
      if (values.length === 0) return "";
      return b2`
        <div class="option-group">
          <div class="option-label">${opt.name}</div>
          <div class="option-values">
            ${values.map((val) => {
        const available = this.isValueAvailable(opt.name, val);
        return b2`
                <button
                  class="option-pill ${available ? "" : "unavailable"}"
                  @click=${() => this.selectOption(opt.name, val)}
                  aria-pressed=${this.selectedOptions[opt.name] === val}
                  ?disabled=${!available}
                  title=${available ? "" : "Utsolgt"}
                >
                  ${val}
                </button>
              `;
      })}
          </div>
        </div>
      `;
    })}`;
  }
  /** Best-effort HTML strip for description. */
  stripHtml(html) {
    return html.replace(/<br\s*\/?>/gi, "\n").replace(/<\/p>/gi, "\n\n").replace(/<[^>]+>/g, "").replace(/&nbsp;/g, " ").replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">").trim();
  }
};
__decorateClass([
  n5({ type: Boolean, reflect: true })
], VioProductDetail.prototype, "open", 2);
__decorateClass([
  n5({ type: String, attribute: "product-id" })
], VioProductDetail.prototype, "productId", 2);
__decorateClass([
  n5({ type: Number, attribute: "sponsor-id" })
], VioProductDetail.prototype, "sponsorId", 2);
__decorateClass([
  n5({ type: Boolean, attribute: "auto-open" })
], VioProductDetail.prototype, "autoOpen", 2);
__decorateClass([
  n5({ type: String })
], VioProductDetail.prototype, "currency", 2);
__decorateClass([
  r5()
], VioProductDetail.prototype, "product", 2);
__decorateClass([
  r5()
], VioProductDetail.prototype, "isLoading", 2);
__decorateClass([
  r5()
], VioProductDetail.prototype, "fetchError", 2);
__decorateClass([
  r5()
], VioProductDetail.prototype, "selectedOptions", 2);
__decorateClass([
  r5()
], VioProductDetail.prototype, "quantity", 2);
__decorateClass([
  r5()
], VioProductDetail.prototype, "activeImageIndex", 2);
__decorateClass([
  r5()
], VioProductDetail.prototype, "adding", 2);
__decorateClass([
  r5()
], VioProductDetail.prototype, "applePayOk", 2);
__decorateClass([
  r5()
], VioProductDetail.prototype, "availableMethods", 2);
function normalizeValues(raw) {
  if (Array.isArray(raw)) {
    return raw.map((v2) => String(v2).trim()).filter((v2) => v2.length > 0);
  }
  if (typeof raw === "string") {
    return raw.split(",").map((v2) => v2.trim()).filter((v2) => v2.length > 0);
  }
  return [];
}

// src/ui/components/vio-cart.ts
var VioCart = class extends i4 {
  constructor() {
    super(...arguments);
    this.open = false;
    this.heading = "Handlekurv";
    this.emptyLabel = "Handlekurven er tom";
    this.subtotalLabel = "Sum";
    this.carts = /* @__PURE__ */ new Map();
    this.itemCount = 0;
    this.applePayAvailable = false;
    this.confirmedOrder = null;
    this.availableMethods = [];
    /** Pre-resolved Apple Pay handle; `show()` fires the sheet synchronously. */
    this.applePayHandle = null;
    /** Cart total Apple Pay was last prepared for (avoids redundant prep). */
    this.preparedTotal = -1;
    this.boundOnCartChange = (e7) => {
      const detail = e7.detail;
      this.carts = detail.cartsBySponsor;
      this.itemCount = detail.itemCount;
      if (!this.availableMethods || this.availableMethods.length === 0) {
        void this.loadAvailablePaymentMethods();
      }
    };
  }
  static {
    this.styles = i`
    :host { display: contents; }

    .backdrop {
      position: fixed;
      inset: 0;
      background: rgba(0, 0, 0, 0.4);
      opacity: 0;
      pointer-events: none;
      transition: opacity 0.25s ease;
      z-index: 998;
    }
    :host([open]) .backdrop { opacity: 1; pointer-events: auto; }

    .drawer {
      position: fixed;
      top: 0;
      right: 0;
      bottom: 0;
      width: min(440px, 100%);
      background: var(--vio-color-surface, #fff);
      transform: translateX(100%);
      transition: transform 0.3s cubic-bezier(0.32, 0.72, 0, 1);
      display: flex;
      flex-direction: column;
      font-family: var(--vio-font-sans, -apple-system, sans-serif);
      color: var(--vio-color-text, #0a0a0a);
      z-index: 999;
      box-shadow: -8px 0 24px rgba(0, 0, 0, 0.06);
    }
    :host([open]) .drawer { transform: translateX(0); }

    .handle { display: none; }

    /* Mobile: bottom sheet (slide up, rounded top, drag handle). */
    @media (max-width: 600px) {
      .drawer {
        top: auto;
        right: 0;
        left: 0;
        bottom: 0;
        width: 100%;
        height: 88vh;
        border-radius: 16px 16px 0 0;
        transform: translateY(100%);
        box-shadow: 0 -8px 24px rgba(0, 0, 0, 0.08);
      }
      :host([open]) .drawer { transform: translateY(0); }
      .handle {
        display: flex;
        justify-content: center;
        padding: 10px 0 4px;
      }
      .handle::before {
        content: '';
        width: 40px;
        height: 4px;
        background: var(--vio-color-border, #e5e5e5);
        border-radius: 2px;
      }
    }

    .header {
      padding: var(--vio-space-lg, 24px);
      border-bottom: 1px solid var(--vio-color-border, #e5e5e5);
      display: flex;
      justify-content: space-between;
      align-items: center;
    }
    .heading {
      font-family: var(--vio-font-serif, Georgia, serif);
      font-size: 24px;
      font-weight: 400;
      margin: 0;
    }
    .close {
      background: none;
      border: none;
      cursor: pointer;
      font-size: 28px;
      line-height: 1;
      padding: 0;
      color: var(--vio-color-text, #0a0a0a);
      font-family: inherit;
    }
    .close:hover { color: var(--vio-color-text-secondary, #666); }

    .body {
      flex: 1;
      overflow-y: auto;
    }

    .sponsor-group {
      padding: var(--vio-space-md, 16px) var(--vio-space-lg, 24px);
      border-bottom: 1px solid var(--vio-color-border, #e5e5e5);
    }
    .sponsor-group:last-child { border-bottom: none; }
    .sponsor-label {
      font-size: 11px;
      text-transform: uppercase;
      letter-spacing: var(--vio-tracking-label, 0.1em);
      color: var(--vio-color-text-tertiary, #999);
      font-weight: 500;
      margin: 0 0 var(--vio-space-md, 16px);
    }

    .item {
      display: grid;
      grid-template-columns: 80px 1fr;
      gap: var(--vio-space-md, 16px);
      padding: var(--vio-space-md, 16px) 0;
      border-bottom: 1px solid var(--vio-color-border, #e5e5e5);
    }
    .item:last-child { border-bottom: none; }
    .item-image {
      aspect-ratio: 1;
      background: var(--vio-color-surface-muted, #f2f2f2);
      overflow: hidden;
    }
    .item-image img { width: 100%; height: 100%; object-fit: cover; display: block; }
    .item-brand {
      font-size: 11px;
      text-transform: uppercase;
      letter-spacing: var(--vio-tracking-label, 0.1em);
      color: var(--vio-color-text-secondary, #666);
      font-weight: 500;
    }
    .item-name {
      font-size: 14px;
      margin: 4px 0;
      font-weight: 500;
      line-height: 1.3;
    }
    .item-row {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-top: var(--vio-space-sm, 8px);
    }
    .item-qty {
      display: flex;
      align-items: center;
      gap: 6px;
      color: var(--vio-color-text-secondary, #666);
      font-size: 12px;
    }
    .qty-btn {
      width: 24px;
      height: 24px;
      border: 1px solid var(--vio-color-border, #e5e5e5);
      background: #fff;
      border-radius: 2px;
      cursor: pointer;
      font-size: 12px;
      color: var(--vio-color-text, #0a0a0a);
      line-height: 1;
      padding: 0;
      font-family: inherit;
    }
    .qty-btn:hover { border-color: var(--vio-color-text, #0a0a0a); }
    .item-price { font-size: 14px; font-weight: 700; }

    .empty {
      padding: 80px var(--vio-space-lg, 24px);
      text-align: center;
      color: var(--vio-color-text-secondary, #666);
      font-size: 14px;
    }

    .footer {
      padding: var(--vio-space-lg, 24px);
      border-top: 1px solid var(--vio-color-border, #e5e5e5);
      background: var(--vio-color-surface, #fff);
    }
    .subtotal-row {
      display: flex;
      justify-content: space-between;
      margin-bottom: var(--vio-space-md, 16px);
      font-size: 14px;
    }
    .subtotal-label { color: var(--vio-color-text-secondary, #666); }
    .subtotal-value { font-weight: 700; font-size: 16px; }

    /* Apple Pay express — pay the whole cart directly. */
    .applepay-btn {
      width: 100%;
      padding: 15px;
      margin-bottom: 10px;
      background: #000;
      color: #fff;
      border: none;
      border-radius: 8px;
      font-size: 19px;
      font-weight: 500;
      line-height: 1;
      cursor: pointer;
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 5px;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
      transition: opacity 0.15s;
    }
    .applepay-btn:hover { opacity: 0.86; }
    .applepay-btn .ap-logo { width: 20px; height: 20px; }
    /* Klarna express — pink brand button, same express row as Apple Pay. */
    .klarna-btn {
      width: 100%;
      padding: 15px;
      margin-bottom: 10px;
      background: #ffb3c7;
      color: #0a0a0a;
      border: none;
      border-radius: 8px;
      font-size: 16px;
      font-weight: 600;
      cursor: pointer;
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 6px;
      font-family: var(--vio-font-sans, -apple-system, sans-serif);
      transition: background 0.15s;
    }
    .klarna-btn:hover { background: #ffa1ba; }
    .klarna-btn .klarna-logo { height: 15px; width: auto; display: inline-block; }
    /* Vipps — brand orange button, same express row. */
    .vipps-btn {
      width: 100%;
      padding: 15px;
      margin-bottom: 10px;
      background: #ff5b24;
      color: #fff;
      border: none;
      border-radius: 8px;
      cursor: pointer;
      display: flex;
      align-items: center;
      justify-content: center;
      font-family: var(--vio-font-sans, -apple-system, sans-serif);
      transition: background 0.15s;
    }
    .vipps-btn:hover { background: #ec4f1c; }
    .vipps-btn .vipps-logo {
      font-size: 20px;
      font-weight: 800;
      letter-spacing: -0.02em;
      line-height: 1;
    }
    .stripe-btn {
      width: 100%;
      padding: 15px;
      margin-bottom: 10px;
      background: #635bff;
      color: #fff;
      border: none;
      border-radius: 8px;
      font-size: 16px;
      font-weight: 600;
      cursor: pointer;
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 6px;
      font-family: var(--vio-font-sans, -apple-system, sans-serif);
      transition: background 0.15s;
    }
    .stripe-btn:hover { background: #5248ff; }
    .stripe-btn .stripe-logo { height: 20px; width: auto; display: inline-block; filter: brightness(0) invert(1); }

    /* In-drawer confirmation after Apple Pay (nothing else is shown). */
    .confirm {
      padding: 56px var(--vio-space-lg, 24px) 40px;
      text-align: center;
      display: flex;
      flex-direction: column;
      align-items: center;
    }
    .confirm-check {
      width: 64px;
      height: 64px;
      border-radius: 50%;
      background: #0a8a3f;
      color: #fff;
      font-size: 34px;
      display: flex;
      align-items: center;
      justify-content: center;
      margin-bottom: 20px;
    }
    .confirm h3 {
      font-family: var(--vio-font-serif, Georgia, serif);
      font-size: 24px;
      font-weight: 400;
      margin: 0 0 8px;
    }
    .confirm p {
      color: var(--vio-color-text-secondary, #666);
      font-size: 14px;
      margin: 0 0 24px;
    }
    .confirm-summary {
      width: 100%;
      border-top: 1px solid var(--vio-color-border, #e5e5e5);
      padding-top: 16px;
      margin-bottom: 28px;
      text-align: left;
    }
    .order-row {
      display: flex;
      justify-content: space-between;
      gap: 12px;
      font-size: 14px;
      margin-bottom: 10px;
      color: var(--vio-color-text, #0a0a0a);
    }
    .order-row.total {
      border-top: 1px solid var(--vio-color-border, #e5e5e5);
      padding-top: 12px;
      margin-top: 4px;
      font-weight: 700;
    }
    .confirm-close {
      width: 100%;
      padding: 16px;
      background: var(--vio-color-text, #0a0a0a);
      color: #fff;
      border: none;
      font-size: 12px;
      text-transform: uppercase;
      letter-spacing: var(--vio-tracking-label, 0.1em);
      cursor: pointer;
      font-weight: 600;
      font-family: var(--vio-font-sans, -apple-system, sans-serif);
    }
    .confirm-close:hover { background: #222; }
  `;
  }
  connectedCallback() {
    super.connectedCallback();
    this.carts = Vio.cart.getAllCarts();
    this.itemCount = Vio.cart.itemCount;
    Vio.cart.addEventListener("change", this.boundOnCartChange);
    void this.loadAvailablePaymentMethods();
  }
  disconnectedCallback() {
    Vio.cart.removeEventListener("change", this.boundOnCartChange);
    super.disconnectedCallback();
  }
  close() {
    this.open = false;
  }
  show() {
    this.open = true;
    void this.loadAvailablePaymentMethods();
  }
  async loadAvailablePaymentMethods() {
    if (this._loadingPaymentMethods) return;
    this._loadingPaymentMethods = true;
    const firstSponsorId = [...this.carts.keys()][0] ?? (globalThis.__VIO_SPONSOR_ID__ ?? 4);
    try {
      const methods = await Vio.checkout.getAvailablePaymentMethods(firstSponsorId);
      if (Array.isArray(methods)) {
        this.availableMethods = methods.map(m => m.name);
      } else {
        this.availableMethods = ["Stripe", "Klarna", "Vipps"];
      }
    } catch (err) {
      console.warn("[VioCart] Failed to load payment methods:", err);
      this.availableMethods = ["Stripe", "Klarna", "Vipps"];
    } finally {
      this._loadingPaymentMethods = false;
    }
  }
  onStripe() {
    if (this.itemCount === 0) return;
    const firstSponsorId = [...this.carts.keys()][0];
    if (firstSponsorId === void 0) return;
    this.dispatchEvent(
      new CustomEvent("vio:checkout-open", {
        bubbles: true,
        composed: true,
        detail: { sponsorId: firstSponsorId, paymentMethod: "stripe", express: false }
      })
    );
  }
  updated(changed) {
    if (changed.has("open") && this.open) {
      this.confirmedOrder = null;
      this.preparedTotal = -1;
    }
    if (this.open && this.itemCount > 0) {
      const total = this.totalAcrossSponsors;
      if (total !== this.preparedTotal) {
        this.preparedTotal = total;
        void this.refreshApplePay(total);
      }
    }
  }
  /** Pre-resolve the Apple Pay sheet for the current cart total. */
  async refreshApplePay(total) {
    if (total <= 0) {
      this.applePayHandle = null;
      this.applePayAvailable = false;
      return;
    }
    try {
      const handle = await Vio.checkout.prepareApplePayExpress(total, this.primaryCurrency);
      if (this.preparedTotal !== total) return;
      this.applePayHandle = handle;
      this.applePayAvailable = handle.available;
    } catch {
      this.applePayHandle = null;
      this.applePayAvailable = false;
    }
  }
  /** Apple Pay express — pay the whole cart, then show the confirmation. */
  onApplePay() {
    const handle = this.applePayHandle;
    if (!handle || !handle.available || this.itemCount === 0) return;
    const snapshot = this.buildConfirmation();
    void handle.show().then((result) => {
      if (!result) return;
      this.confirmedOrder = snapshot;
      for (const sponsorId of [...this.carts.keys()]) {
        Vio.cart.clearSponsorCart(sponsorId);
      }
      this.dispatchEvent(
        new CustomEvent("vio:payment-success", {
          bubbles: true,
          composed: true,
          detail: { method: "apple-pay", result }
        })
      );
    });
  }
  buildConfirmation() {
    const items = [];
    for (const cart of this.carts.values()) {
      for (const it of cart.items) {
        items.push({
          brand: it.brand,
          name: it.name,
          quantity: it.quantity,
          unitPrice: it.unitPrice,
          currency: it.currency
        });
      }
    }
    return { items, total: this.totalAcrossSponsors, currency: this.primaryCurrency };
  }
  closeConfirmation() {
    this.confirmedOrder = null;
    this.close();
  }
  /** Klarna express — opens the side-drawer Klarna checkout for the whole cart,
   * skipping the address form (leveringsadresse) and method picker
   * (betalingsmetode). The host's checkout-open handler closes this cart and
   * opens <vio-checkout> in express mode with Klarna preselected. */
  onKlarnaExpress() {
    if (this.itemCount === 0) return;
    const firstSponsorId = [...this.carts.keys()][0];
    if (firstSponsorId === void 0) return;
    this.dispatchEvent(
      new CustomEvent("vio:checkout-open", {
        bubbles: true,
        composed: true,
        detail: { sponsorId: firstSponsorId, paymentMethod: "klarna", express: true }
      })
    );
  }
  /** Vipps — opens the checkout with Vipps preselected. */
  onVipps() {
    if (this.itemCount === 0) return;
    const firstSponsorId = [...this.carts.keys()][0];
    if (firstSponsorId === void 0) return;
    this.dispatchEvent(
      new CustomEvent("vio:checkout-open", {
        bubbles: true,
        composed: true,
        detail: { sponsorId: firstSponsorId, paymentMethod: "vipps", express: false }
      })
    );
  }
  get totalAcrossSponsors() {
    let sum = 0;
    for (const cart of this.carts.values()) {
      for (const item of cart.items) sum += item.unitPrice * item.quantity;
    }
    return sum;
  }
  get primaryCurrency() {
    for (const cart of this.carts.values()) return cart.currency;
    return "NOK";
  }
  onIncrement(item) {
    Vio.cart.updateQuantity(item.id, item.sponsorId, item.quantity + 1);
  }
  onDecrement(item) {
    Vio.cart.updateQuantity(item.id, item.sponsorId, item.quantity - 1);
  }
  onRemove(item) {
    Vio.cart.removeItem(item.id, item.sponsorId);
  }
  render() {
    const isEmpty = this.itemCount === 0;
    const sponsorCarts = [...this.carts.values()].filter((c4) => c4.items.length > 0);
    return b2`
      <div class="backdrop" @click=${this.close}></div>
      <aside class="drawer" role="dialog" aria-label=${this.heading}>
        <div class="handle" @click=${this.close} aria-hidden="true"></div>
        <div class="header">
          <h2 class="heading">${this.confirmedOrder ? "Takk!" : this.heading}</h2>
          <button class="close" @click=${this.close} aria-label="Lukk">×</button>
        </div>

        ${this.confirmedOrder ? this.renderConfirmation() : isEmpty ? b2`<div class="empty">${this.emptyLabel}</div>` : b2`
              <div class="body">
                ${sponsorCarts.map(
      (cart) => b2`
                    <div class="sponsor-group">
                      ${cart.sponsorName ? b2`<div class="sponsor-label">${cart.sponsorName}</div>` : ""}
                      ${cart.items.map(
        (item) => b2`
                          <div class="item">
                            <div class="item-image">
                              ${item.imageUrl ? b2`<img src=${item.imageUrl} alt=${item.name} />` : ""}
                            </div>
                            <div>
                              <div class="item-brand">${item.brand}</div>
                              <div class="item-name">${item.name}</div>
                              <div class="item-row">
                                <span class="item-qty">
                                  <button
                                    class="qty-btn"
                                    @click=${() => this.onDecrement(item)}
                                    aria-label="Reduser"
                                  >
                                    −
                                  </button>
                                  ${item.quantity}
                                  <button
                                    class="qty-btn"
                                    @click=${() => this.onIncrement(item)}
                                    aria-label="Øk"
                                  >
                                    +
                                  </button>
                                  <button
                                    class="qty-btn"
                                    @click=${() => this.onRemove(item)}
                                    aria-label="Fjern"
                                    style="margin-left: 8px;"
                                  >
                                    ×
                                  </button>
                                </span>
                                <span class="item-price">
                                  ${formatPrice(
          item.unitPrice * item.quantity,
          item.currency
        )}
                                </span>
                              </div>
                            </div>
                          </div>
                        `
      )}
                    </div>
                  `
    )}
              </div>
              <div class="footer">
                <div class="subtotal-row">
                  <span class="subtotal-label">${this.subtotalLabel}</span>
                  <span class="subtotal-value">
                    ${formatPrice(this.totalAcrossSponsors, this.primaryCurrency)}
                  </span>
                </div>
                ${this.applePayAvailable ? b2`
                      <button
                        class="applepay-btn"
                        @click=${this.onApplePay}
                        aria-label="Betal med Apple Pay"
                      >
                        <svg class="ap-logo" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M17.05 20.28c-.98.95-2.05.8-3.08.35-1.09-.46-2.09-.48-3.24 0-1.44.62-2.2.44-3.06-.35C2.79 15.25 3.51 7.59 9.05 7.31c1.35.07 2.29.74 3.08.8 1.18-.24 2.31-.93 3.57-.84 1.51.12 2.65.72 3.4 1.8-3.12 1.87-2.38 5.98.48 7.13-.57 1.5-1.31 2.99-2.54 4.09l.01-.01zM12.03 7.25c-.15-2.23 1.66-4.07 3.74-4.25.29 2.58-2.34 4.5-3.74 4.25z"/></svg>
                        Apple Pay
                      </button>
                    ` : ""}
                ${(this.availableMethods.length === 0 || this.availableMethods.some(m => m.toLowerCase() === "stripe")) ? b2`
                      <button
                        class="stripe-btn"
                        @click=${this.onStripe}
                        aria-label="Betal med Stripe"
                      >
                        <img
                          class="stripe-logo"
                          src="vio-sdk/assets/stripe-blurple.svg"
                          alt="Stripe"
                          style="height: 20px; display: block;"
                        />
                      </button>
                    ` : ""}
                ${(this.availableMethods.length === 0 || this.availableMethods.some(m => m.toLowerCase() === "klarna")) ? b2`
                      <button
                        class="klarna-btn"
                        @click=${this.onKlarnaExpress}
                        aria-label="Betal med Klarna"
                      >
                        Kjøp med
                        <img
                          class="klarna-logo"
                          src="https://x.klarnacdn.net/payment-method/assets/badges/generic/klarna.svg"
                          alt="Klarna"
                        />
                      </button>
                    ` : ""}
                ${(this.availableMethods.length === 0 || this.availableMethods.some(m => m.toLowerCase() === "vipps")) ? b2`
                      <button
                        class="vipps-btn"
                        @click=${this.onVipps}
                        aria-label="Betal med Vipps"
                      >
                        <span class="vipps-logo">vipps</span>
                      </button>
                    ` : ""}
              </div>
            `}
      </aside>
    `;
  }
  renderConfirmation() {
    const o7 = this.confirmedOrder;
    if (!o7) return b2``;
    return b2`
      <div class="confirm">
        <div class="confirm-check" aria-hidden="true">✓</div>
        <h3>Takk for handelen!</h3>
        <p>Betaling med Apple Pay er bekreftet.</p>
        <div class="confirm-summary">
          ${o7.items.map(
      (it) => b2`
              <div class="order-row">
                <span>${it.brand ? `${it.brand} ` : ""}${it.name} ×${it.quantity}</span>
                <span>${formatPrice(it.unitPrice * it.quantity, it.currency)}</span>
              </div>
            `
    )}
          <div class="order-row total">
            <span>Totalt</span>
            <span>${formatPrice(o7.total, o7.currency)}</span>
          </div>
        </div>
        <button class="confirm-close" @click=${this.closeConfirmation}>Lukk</button>
      </div>
    `;
  }
};
__decorateClass([
  n5({ type: Boolean, reflect: true })
], VioCart.prototype, "open", 2);
__decorateClass([
  n5({ type: String })
], VioCart.prototype, "heading", 2);
__decorateClass([
  n5({ type: String, attribute: "empty-label" })
], VioCart.prototype, "emptyLabel", 2);
__decorateClass([
  n5({ type: String, attribute: "subtotal-label" })
], VioCart.prototype, "subtotalLabel", 2);
__decorateClass([
  r5()
], VioCart.prototype, "carts", 2);
__decorateClass([
  r5()
], VioCart.prototype, "itemCount", 2);
__decorateClass([
  r5()
], VioCart.prototype, "applePayAvailable", 2);
__decorateClass([
  r5()
], VioCart.prototype, "confirmedOrder", 2);
__decorateClass([
  r5()
], VioCart.prototype, "availableMethods", 2);

// src/ui/components/vio-checkout.ts
var VioCheckout = class extends i4 {
  constructor() {
    super(...arguments);
    this.open = false;
    this.heading = "Kasse";
    this.shippingLabel = "Beregnes ved kasse";
    this.express = false;
    this.checkoutState = null;
    this.items = [];
    this.applePayAvailable = false;
    this.applePayInProgress = false;
    this.klarnaAvailable = false;
    this.orderConfirmed = false;
    this.confirmedMethod = null;
    this.paymentError = null;
    this.confirmedOrder = null;
    this.availableMethods = [];
    this.stripeLoading = false;
    this.vippsLoading = false;
    /** Active Klarna Payments widget handle + the subtotal it was mounted for. */
    this.klarnaHandle = null;
    this.klarnaMountedAmount = null;
    this.klarnaMountedShipping = null;
    this.klarnaMounting = false;
    this.klarnaCategories = [];
    this.klarnaSelectedCat = "";
    this.klarnaAuthorizing = false;
    this.selectedShipping = KLARNA_SHIPPING_OPTIONS.find((o7) => o7.preselected)?.id ?? KLARNA_SHIPPING_OPTIONS[0]?.id ?? "";
    this.form = {
      firstName: "",
      lastName: "",
      email: "",
      address: "",
      postalCode: "",
      city: ""
    };
    this.boundOnCheckoutChange = (e7) => {
      const detail = e7.detail;
      const prevSponsorId = this.checkoutState?.sponsorId;
      const sponsorChanged = !prevSponsorId || prevSponsorId !== detail.state?.sponsorId;
      this.checkoutState = detail.state;
      this.items = Vio.checkout.items;
      if (this.checkoutState) {
        if (sponsorChanged || !this.availableMethods || this.availableMethods.length === 0) {
          void this.refreshApplePay();
          void this.refreshKlarna();
          void this.loadAvailablePaymentMethods();
        }
      } else {
        this.applePayAvailable = false;
        this.klarnaAvailable = false;
        this.orderConfirmed = false;
        this.confirmedMethod = null;
        this.confirmedOrder = null;
        this.paymentError = null;
        this.express = false;
        this.availableMethods = [];
        this.unmountKlarna();
      }
    };
    this.boundOnPaymentComplete = (e7) => {
      const detail = e7.detail;
      if (detail.method !== "klarna" && detail.method !== "apple-pay") return;
      const sponsorId = detail.state?.sponsorId ?? this.checkoutState?.sponsorId;
      if (sponsorId == null) return;
      this.confirmOrder(detail.method, sponsorId, detail.result);
    };
    this.boundOnPaymentError = (e7) => {
      const detail = e7.detail;
      this.paymentError = detail.method === "klarna" ? `Klarna-betalingen kunne ikke fullf\xF8res: ${detail.error}` : detail.error;
      this.open = true;
    };
  }
  static {
    this.styles = i`
    :host { display: contents; }
    .backdrop {
      position: fixed;
      inset: 0;
      background: rgba(0, 0, 0, 0.5);
      opacity: 0;
      pointer-events: none;
      transition: opacity 0.25s ease;
      z-index: 999;
    }
    :host([open]) .backdrop { opacity: 1; pointer-events: auto; }

    .modal {
      position: fixed;
      inset: 0;
      background: var(--vio-color-surface, #fff);
      transform: translateY(100%);
      transition: transform 0.35s cubic-bezier(0.32, 0.72, 0, 1);
      display: flex;
      flex-direction: column;
      font-family: var(--vio-font-sans, -apple-system, sans-serif);
      color: var(--vio-color-text, #0a0a0a);
      z-index: 1000;
      overflow-y: auto;
    }
    :host([open]) .modal { transform: translateY(0); }

    /* Confirmation drawer — compact bottom sheet, not the full-screen overlay. */
    .modal.as-drawer {
      inset: auto 0 0 0;
      height: auto;
      max-height: 88vh;
      max-width: 460px;
      margin: 0 auto;
      border-radius: 16px 16px 0 0;
      box-shadow: 0 -8px 32px rgba(0, 0, 0, 0.18);
    }
    .modal.as-drawer .handle {
      display: flex;
      justify-content: center;
      padding: 10px 0 4px;
      flex-shrink: 0;
    }
    .modal.as-drawer .handle::before {
      content: '';
      width: 40px;
      height: 4px;
      background: var(--vio-color-border, #e5e5e5);
      border-radius: 2px;
    }

    /* Express (Apple Pay-style): right-side drawer, like the cart. Slides in
       from the right instead of the full-screen overlay. */
    .modal.as-side {
      inset: 0 0 0 auto;
      width: min(440px, 100%);
      max-width: 440px;
      transform: translateX(100%);
      border-radius: 0;
      box-shadow: -8px 0 24px rgba(0, 0, 0, 0.1);
    }
    :host([open]) .modal.as-side { transform: translateX(0); }

    /* Desktop: the checkout ALWAYS lives as a right-side panel (like the cart,
       product detail and express drawer) — never a full-width overlay. Only the
       compact confirmation card stays centered. */
    @media (min-width: 601px) {
      .modal:not(.as-confirm) {
        inset: 0 0 0 auto;
        width: min(440px, 100%);
        max-width: 440px;
        transform: translateX(100%);
        border-radius: 0;
        box-shadow: -8px 0 24px rgba(0, 0, 0, 0.1);
      }
      :host([open]) .modal:not(.as-confirm) { transform: translateX(0); }
    }
    @media (max-width: 600px) {
      /* On phones, keep it a bottom sheet for reachability. */
      .modal.as-side {
        inset: auto 0 0 0;
        width: 100%;
        max-width: none;
        height: 92vh;
        transform: translateY(100%);
        border-radius: 16px 16px 0 0;
      }
      :host([open]) .modal.as-side { transform: translateY(0); }
    }

    /* Confirmation: a centered desktop dialog (the bottom-sheet looked like
       mobile on desktop). Falls back to a bottom sheet on phones. */
    .modal.as-confirm {
      inset: auto;
      top: 50%;
      left: 50%;
      width: min(92vw, 440px);
      max-width: 440px;
      height: auto;
      max-height: 88vh;
      border-radius: 16px;
      box-shadow: 0 30px 80px -24px rgba(0, 0, 0, 0.4);
      transform: translate(-50%, -50%) scale(0.96);
      opacity: 0;
    }
    :host([open]) .modal.as-confirm {
      transform: translate(-50%, -50%) scale(1);
      opacity: 1;
    }
    @media (max-width: 600px) {
      .modal.as-confirm {
        inset: auto 0 0 0;
        top: auto;
        left: 0;
        width: 100%;
        max-width: none;
        border-radius: 16px 16px 0 0;
        transform: translateY(100%) scale(1);
        opacity: 1;
      }
      :host([open]) .modal.as-confirm { transform: translateY(0); }
    }

    .handle { display: none; }

    /* Mobile: bottom sheet with rounded top + drag handle. */
    @media (max-width: 600px) {
      .modal {
        top: auto;
        height: 92vh;
        border-radius: 16px 16px 0 0;
        box-shadow: 0 -8px 24px rgba(0, 0, 0, 0.08);
      }
      .handle {
        display: flex;
        justify-content: center;
        padding: 10px 0 4px;
        flex-shrink: 0;
      }
      .handle::before {
        content: '';
        width: 40px;
        height: 4px;
        background: var(--vio-color-border, #e5e5e5);
        border-radius: 2px;
      }
    }

    .topbar {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: 20px var(--vio-space-lg, 24px);
      border-bottom: 1px solid var(--vio-color-border, #e5e5e5);
      position: sticky;
      top: 0;
      background: var(--vio-color-surface, #fff);
      z-index: 1;
    }
    .heading {
      font-family: var(--vio-font-serif, Georgia, serif);
      font-size: 24px;
      font-weight: 400;
      margin: 0;
    }
    .close {
      background: none;
      border: none;
      cursor: pointer;
      font-size: 28px;
      line-height: 1;
      padding: 0;
      color: var(--vio-color-text, #0a0a0a);
      font-family: inherit;
    }
    .close:hover { color: var(--vio-color-text-secondary, #666); }

    .body {
      max-width: 720px;
      margin: 0 auto;
      width: 100%;
      padding: 56px var(--vio-space-lg, 24px) 80px;
      box-sizing: border-box;
    }
    .section { margin-bottom: 56px; }
    .section-label {
      font-size: 12px;
      text-transform: uppercase;
      letter-spacing: var(--vio-tracking-label, 0.1em);
      color: var(--vio-color-accent, #c14a3b);
      margin-bottom: 12px;
      font-weight: 500;
    }
    .section-heading {
      font-family: var(--vio-font-serif, Georgia, serif);
      font-size: 28px;
      margin: 0 0 var(--vio-space-lg, 24px);
      font-weight: 400;
      line-height: 1.2;
    }

    .form-row {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: var(--vio-space-md, 16px);
    }
    .field {
      display: flex;
      flex-direction: column;
      gap: 6px;
      margin-bottom: var(--vio-space-md, 16px);
    }
    .field label {
      font-size: 11px;
      text-transform: uppercase;
      letter-spacing: var(--vio-tracking-label, 0.1em);
      color: var(--vio-color-text-secondary, #666);
      font-weight: 500;
    }
    .field input {
      padding: 12px 0;
      border: none;
      border-bottom: 1px solid var(--vio-color-border, #e5e5e5);
      font-size: 16px;
      font-family: inherit;
      color: inherit;
      background: transparent;
      outline: none;
      transition: border-color 0.15s;
    }
    .field input:focus { border-bottom-color: var(--vio-color-text, #0a0a0a); }

    .payment-grid {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: var(--vio-space-md, 16px);
    }
    .payment-btn {
      padding: 20px;
      background: #fff;
      border: 1px solid var(--vio-color-border, #e5e5e5);
      cursor: pointer;
      font-family: inherit;
      font-size: 14px;
      font-weight: 500;
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 8px;
      transition: border-color 0.15s, background 0.15s;
      color: var(--vio-color-text, #0a0a0a);
    }
    .payment-btn:hover:not(:disabled) {
      border-color: var(--vio-color-text, #0a0a0a);
      background: var(--vio-color-surface-hover, #fafafa);
    }
    .payment-btn:disabled {
      cursor: progress;
      opacity: 0.6;
    }
    .payment-btn.primary {
      background: var(--vio-color-text, #0a0a0a);
      color: var(--vio-color-text-on-primary, #fff);
      grid-column: 1 / -1;
      border-color: var(--vio-color-text, #0a0a0a);
      padding: 22px;
      font-weight: 600;
    }
    .payment-btn.primary:hover:not(:disabled) { background: #222; border-color: #222; }
    .payment-btn[aria-pressed='true'] {
      border-color: var(--vio-color-accent, #c14a3b);
    }
    .apple-pay-note {
      grid-column: 1 / -1;
      font-size: 12px;
      color: var(--vio-color-text-tertiary, #999);
      text-align: center;
      margin-top: 4px;
    }
    /* Klarna Payments — inline widget panel, shown once Klarna is selected. */
    .klarna-panel {
      grid-column: 1 / -1;
      display: flex;
      flex-direction: column;
      gap: 12px;
      margin-top: 4px;
    }
    .klarna-cats {
      display: flex;
      flex-wrap: wrap;
      gap: 8px;
    }
    .klarna-cat {
      flex: 1 1 auto;
      padding: 8px 12px;
      border: 1px solid var(--vio-color-border, #ddd);
      border-radius: 8px;
      background: #fff;
      font-size: 13px;
      cursor: pointer;
    }
    .klarna-cat.active {
      border-color: var(--vio-color-text, #111);
      background: var(--vio-color-surface-2, #f6f6f6);
      font-weight: 600;
    }
    .klarna-widget {
      min-height: 48px;
    }
    .express-summary {
      display: flex;
      flex-direction: column;
      gap: 6px;
      margin-bottom: 16px;
    }
    /* Shipping selector (express) — Standard / Express options. */
    .ship-select { display: flex; flex-direction: column; gap: 8px; }
    .ship-opt {
      display: flex; align-items: center; justify-content: space-between; gap: 12px;
      padding: 12px 14px; border: 1px solid var(--vio-color-border, #ddd);
      border-radius: 10px; background: #fff; cursor: pointer; font-family: inherit;
      text-align: left;
    }
    .ship-opt.active {
      border-color: var(--vio-color-text, #111);
      background: var(--vio-color-surface-2, #f6f6f6);
    }
    .ship-opt:disabled { opacity: 0.6; cursor: default; }
    .ship-meta { display: flex; flex-direction: column; gap: 2px; }
    .ship-meta b { font-weight: 600; font-size: 13px; }
    .ship-meta span { color: var(--vio-color-text-secondary, #666); font-size: 12px; }
    .ship-price { font-weight: 600; font-size: 13px; }
    .payment-error {
      grid-column: 1 / -1;
      padding: 12px 16px;
      background: #fdecea;
      border: 1px solid var(--vio-color-accent, #c14a3b);
      border-radius: 8px;
      font-size: 13px;
      color: var(--vio-color-accent, #c14a3b);
      text-align: center;
    }
    /* "Betal" CTA — sits full-width below the method grid once a method is
       picked. Reuses .payment-btn.primary (its grid-column spans the row). */
    .complete-cta { margin-top: 8px; }

    /* Order confirmation — compact, shown inside the drawer. */
    .confirmation {
      text-align: center;
      padding: 24px 24px 28px;
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 14px;
    }
    .confirm-check {
      width: 64px;
      height: 64px;
      border-radius: 50%;
      background: #2e7d32;
      color: #fff;
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 32px;
      line-height: 1;
    }
    .confirm-title {
      font-family: var(--vio-font-serif, Georgia, serif);
      font-size: 28px;
      font-weight: 400;
      margin: 0;
    }
    .confirm-text {
      font-size: 14px;
      color: var(--vio-color-text-secondary, #666);
      max-width: 360px;
      line-height: 1.6;
      margin: 0;
    }
    .confirm-order-id {
      font-size: 13px;
      color: var(--vio-color-text-secondary, #666);
    }
    .confirm-order-id b {
      color: var(--vio-color-text, #0a0a0a);
      font-variant-numeric: tabular-nums;
    }
    .confirm-summary {
      width: 100%;
      max-width: 360px;
      border-top: 1px solid var(--vio-color-border, #eee);
      padding-top: 14px;
      display: flex;
      flex-direction: column;
      gap: 8px;
      text-align: left;
      font-size: 13px;
    }
    .confirm-close {
      border: none;
      background: var(--vio-color-text, #0a0a0a);
      color: var(--vio-color-text-on-primary, #fff);
      padding: 16px 48px;
      font-size: 12px;
      text-transform: uppercase;
      letter-spacing: var(--vio-tracking-label, 0.1em);
      font-weight: 600;
      cursor: pointer;
      font-family: inherit;
      margin-top: 16px;
    }
    .confirm-close:hover { background: #222; }

    .order-summary {
      background: var(--vio-color-surface-muted, #f2f2f2);
      padding: var(--vio-space-lg, 24px);
      margin-top: var(--vio-space-xl, 32px);
    }
    .order-line {
      display: grid;
      grid-template-columns: 56px 1fr auto;
      gap: 12px;
      padding: 8px 0;
      align-items: center;
    }
    .order-line-img {
      aspect-ratio: 1;
      background: #fff;
      overflow: hidden;
    }
    .order-line-img img { width: 100%; height: 100%; object-fit: cover; display: block; }
    .order-line-meta { font-size: 13px; }
    .order-line-meta b { display: block; }
    .order-line-meta span {
      color: var(--vio-color-text-secondary, #666);
      font-size: 11px;
      text-transform: uppercase;
      letter-spacing: var(--vio-tracking-label, 0.1em);
    }
    .order-line-price { font-weight: 700; font-size: 14px; }
    .order-row {
      display: flex;
      justify-content: space-between;
      padding: 8px 0;
      font-size: 14px;
    }
    .order-row.total {
      border-top: 1px solid var(--vio-color-border-default, #ccc);
      margin-top: var(--vio-space-sm, 8px);
      padding-top: var(--vio-space-md, 16px);
      font-weight: 700;
      font-size: 16px;
    }

    @media (max-width: 600px) {
      .form-row { grid-template-columns: 1fr; gap: 0; }
      .payment-grid { grid-template-columns: 1fr; }
      .body { padding: 32px var(--vio-space-lg, 24px) 64px; }
    }
  `;
  }
  connectedCallback() {
    super.connectedCallback();
    this.checkoutState = Vio.checkout.currentState;
    this.items = Vio.checkout.items;
    Vio.checkout.addEventListener("change", this.boundOnCheckoutChange);
    Vio.checkout.addEventListener("payment-complete", this.boundOnPaymentComplete);
    Vio.checkout.addEventListener("payment-error", this.boundOnPaymentError);
    if (this.checkoutState) {
      void this.refreshApplePay();
      void this.refreshKlarna();
      void this.loadAvailablePaymentMethods();
    }
    this.checkReturnPaymentStatus();
  }
  checkReturnPaymentStatus() {
    if (typeof window === "undefined" || !window.location || !window.location.search) return;
    try {
      const urlParams = new URLSearchParams(window.location.search);
      const vioPayment = urlParams.get("vio_payment") || urlParams.get("payment_status") || urlParams.get("payment");
      const vioMethod = urlParams.get("vio_method") || urlParams.get("payment_method") || urlParams.get("method") || "stripe";
      const sponsorId = Number(urlParams.get("vio_sponsor") || urlParams.get("sponsor_id") || 4);
      const orderId = urlParams.get("order_id") || urlParams.get("checkout_id") || "";

      if (vioPayment === "success") {
        Vio.cart.clearSponsorCart(sponsorId);

        this.confirmedOrder = {
          items: [],
          currency: getGlobalCurrency(),
          total: 0,
          orderId: orderId || undefined
        };
        this.confirmedMethod = vioMethod;
        this.orderConfirmed = true;
        this.open = true;

        this.dispatchEvent(
          new CustomEvent("vio:payment-success", {
            bubbles: true,
            composed: true,
            detail: { method: vioMethod, sponsorId, orderId }
          })
        );

        this.cleanReturnQueryParams(["vio_payment", "payment_status", "payment", "vio_method", "payment_method", "method", "vio_sponsor", "sponsor_id", "order_id", "checkout_id"]);
      } else if (vioPayment === "cancel" || vioPayment === "error") {
        this.paymentError = "Betalingen ble avbrutt eller feilet. Vennligst prøv igjen.";
        this.open = true;
        this.cleanReturnQueryParams(["vio_payment", "payment_status", "payment", "vio_method", "payment_method", "method", "vio_sponsor", "sponsor_id", "order_id", "checkout_id"]);
      }
    } catch (err) {
      if (typeof console !== "undefined") {
        console.warn("[VioCheckout] checkReturnPaymentStatus failed:", err);
      }
    }
  }
  cleanReturnQueryParams(keys) {
    try {
      if (typeof window === "undefined" || !window.history || !window.location) return;
      const url = new URL(window.location.href);
      let changed = false;
      keys.forEach(k => {
        if (url.searchParams.has(k)) {
          url.searchParams.delete(k);
          changed = true;
        }
      });
      if (changed) {
        const newSearch = url.searchParams.toString();
        const newUrl = url.pathname + (newSearch ? "?" + newSearch : "") + url.hash;
        window.history.replaceState({}, document.title, newUrl);
      }
    } catch (e) {
      // Ignore URL cleanup failures
    }
  }
  disconnectedCallback() {
    Vio.checkout.removeEventListener("change", this.boundOnCheckoutChange);
    Vio.checkout.removeEventListener("payment-complete", this.boundOnPaymentComplete);
    Vio.checkout.removeEventListener("payment-error", this.boundOnPaymentError);
    this.unmountKlarna();
    super.disconnectedCallback();
  }
  updated() {
    void this.mountKlarnaIfNeeded();
  }
  close() {
    this.open = false;
    this.express = false;
    Vio.checkout.close();
  }
  show() {
    this.open = true;
  }
  async loadAvailablePaymentMethods() {
    if (!this.checkoutState) return;
    if (this._loadingPaymentMethods) return;
    this._loadingPaymentMethods = true;
    try {
      const sponsorId = this.checkoutState.sponsorId;
      const methods = await Vio.checkout.getAvailablePaymentMethods(sponsorId);

      if (Array.isArray(methods)) {
        this.availableMethods = methods.map(m => m.name);
      } else {
        this.availableMethods = ["Stripe", "Klarna", "Vipps"];
      }
    } catch (err) {
      console.warn("[VioCheckout] Failed to load payment methods:", err);
      this.availableMethods = ["Stripe", "Klarna", "Vipps"];
    } finally {
      this._loadingPaymentMethods = false;
    }
  }
  async refreshApplePay() {
    Vio.checkout.clearApplePayCache();
    this.applePayAvailable = await Vio.checkout.isApplePayAvailable("NO");
  }
  async refreshKlarna() {
    const available = await Vio.checkout.klarnaPaymentsAvailable();
    if (available !== this.klarnaAvailable) {
      if (!available) this.unmountKlarna();
      this.klarnaAvailable = available;
    }
  }
  /** Mount (or re-mount on amount change) the Klarna Payments widget. */
  async mountKlarnaIfNeeded() {
    if (!this.klarnaAvailable || !this.open || !this.checkoutState) return;
    if (this.checkoutState.paymentMethod !== "klarna" && !this.express) return;
    if (this.klarnaMounting) return;
    const amount = this.checkoutState.subtotal;
    if (this.klarnaHandle && this.klarnaMountedAmount === amount && this.klarnaMountedShipping === this.selectedShipping) {
      return;
    }
    const container = this.renderRoot?.querySelector(
      "#vio-klarna-payments-container"
    );
    if (!container) return;
    this.klarnaMounting = true;
    this.unmountKlarna();
    container.innerHTML = "";
    try {
      const handle = await Vio.checkout.mountKlarnaPayments(container, {
        withShipping: this.express,
        shippingId: this.selectedShipping
      });
      this.klarnaHandle = handle;
      this.klarnaMountedAmount = amount;
      this.klarnaMountedShipping = this.selectedShipping;
      this.klarnaCategories = handle.categories;
      this.klarnaSelectedCat = handle.selected;
      if (Array.isArray(handle.shippings) && handle.shippings.length > 0) {
        this.availableShippingsList = handle.shippings;
        if (!this.selectedShipping || !handle.shippings.some((s) => s.id === this.selectedShipping)) {
          this.selectedShipping = handle.shippings[0].id;
        }
      }
    } catch (err) {
      if (typeof console !== "undefined") {
        console.warn("[VioCheckout] Klarna Payments mount failed:", err);
      }
      this.paymentError = `Kunne ikke laste Klarna: ${err instanceof Error ? err.message : String(err)}`;
    } finally {
      this.klarnaMounting = false;
    }
  }
  unmountKlarna() {
    if (this.klarnaHandle) {
      this.klarnaHandle.unmount();
      this.klarnaHandle = null;
    }
    this.klarnaMountedAmount = null;
    this.klarnaMountedShipping = null;
    this.klarnaCategories = [];
    this.klarnaSelectedCat = "";
    this.klarnaAuthorizing = false;
  }
  /** Selected shipping option (express flow). */
  get shippingOption() {
    const list = this.availableShippingsList?.length > 0 ? this.availableShippingsList : KLARNA_SHIPPING_OPTIONS;
    return list.find((o7) => o7.id === this.selectedShipping) ?? list[0] ?? null;
  }
  /** Pick a shipping option → re-mounts the Klarna widget with the new total. */
  async onSelectShipping(id) {
    if (this.selectedShipping === id || this.klarnaMounting) return;
    this.selectedShipping = id;
    const list = this.availableShippingsList?.length > 0 ? this.availableShippingsList : KLARNA_SHIPPING_OPTIONS;
    const selectedOpt = list.find((s) => s.id === id);
    if (selectedOpt && selectedOpt.supplierId) {
      try {
        await Vio.checkout.updateShippingsBySupplier([{ shipping_id: selectedOpt.id, supplier_id: Number(selectedOpt.supplierId) }], this.checkoutState?.sponsorId);
      } catch (err) {
        console.warn("[VioCheckout] updateShippingsBySupplier failed:", err);
      }
    }
  }
  /** Switch the Klarna widget to a different payment_method_category. */
  async onKlarnaCategory(identifier) {
    if (!this.klarnaHandle || this.klarnaSelectedCat === identifier) return;
    this.klarnaSelectedCat = identifier;
    try {
      await this.klarnaHandle.load(identifier);
    } catch (err) {
      if (typeof console !== "undefined") {
        console.warn("[VioCheckout] Klarna category switch failed:", err);
      }
    }
  }
  /** Authorize the selected Klarna method → backend creates the order. */
  async onKlarnaAuthorize() {
    if (!this.klarnaHandle || this.klarnaAuthorizing) return;
    this.paymentError = null;
    this.klarnaAuthorizing = true;
    try {
      await this.klarnaHandle.authorize();
    } finally {
      this.klarnaAuthorizing = false;
    }
  }
  onFieldChange(field, value) {
    this.form = { ...this.form, [field]: value };
    Vio.checkout.setAddress(this.form);
  }
  async onApplePay() {
    if (this.applePayInProgress) return;
    this.applePayInProgress = true;
    try {
      await Vio.checkout.startApplePay({ country: "NO", label: "Vio" });
    } catch (err) {
      if (typeof console !== "undefined") {
        console.warn("[VioCheckout] Apple Pay flow ended:", err);
      }
    } finally {
      this.applePayInProgress = false;
    }
  }
  onPay(method) {
    this.paymentError = null;
    if (method === "apple-pay") {
      void this.onApplePay();
      return;
    }
    Vio.checkout.selectPaymentMethod(method);
    if (method === "stripe") {
      this.stripeLoading = true;
      void Vio.checkout.startStripePayment(this.checkoutState?.sponsorId, this.form)
        .catch((err) => {
          this.paymentError = `Kunne ikke starte Stripe-betaling: ${err instanceof Error ? err.message : String(err)}`;
        })
        .finally(() => {
          this.stripeLoading = false;
        });
    }
    if (method === "vipps") {
      this.vippsLoading = true;
      void Vio.checkout.startVippsPayment(this.checkoutState?.sponsorId, this.form)
        .catch((err) => {
          this.paymentError = `Kunne ikke starte Vipps-betaling: ${err instanceof Error ? err.message : String(err)}`;
        })
        .finally(() => {
          this.vippsLoading = false;
        });
    }
  }
  /**
   * Complete the order for the selected method (Vipps / Card / plain Klarna).
   * Apple Pay and Klarna Express finish inside their own sheet/popup, so they
   * never reach here. No real PSP is wired for Vipps/Card in this iteration —
   * the capture happens backend-side in the full flow — so this confirms the
   * order state-only and shows the confirmation screen.
   */
  onCompleteOrder() {
    const s4 = this.checkoutState;
    if (!s4 || !s4.paymentMethod) return;
    if (s4.paymentMethod === "stripe") {
      void this.onPay("stripe");
      return;
    }
    if (s4.paymentMethod === "vipps") {
      void this.onPay("vipps");
      return;
    }
    this.confirmOrder(s4.paymentMethod, s4.sponsorId);
  }
  /**
   * Shared order confirmation — reached from both the plain "Betal" CTA
   * (Vipps/Card/Klarna) and the Klarna Express authorize callback. Shows
   * the confirmation screen, emits `vio:payment-success`, and clears the
   * paid sponsor's cart so the badge + drawer reflect the purchase.
   */
  confirmOrder(method, sponsorId, result) {
    const r6 = result ?? {};
    this.confirmedOrder = {
      items: [...this.items],
      currency: this.checkoutState?.currency ?? "",
      total: typeof r6.chargedTotal === "number" ? r6.chargedTotal : this.checkoutState?.subtotal ?? 0,
      orderId: r6.order?.orderId
    };
    this.confirmedMethod = method;
    this.orderConfirmed = true;
    this.open = true;
    this.dispatchEvent(
      new CustomEvent("vio:payment-success", {
        bubbles: true,
        composed: true,
        detail: { method, sponsorId, result }
      })
    );
    Vio.cart.clearSponsorCart(sponsorId);
  }
  methodLabel(method) {
    switch (method) {
      case "apple-pay":
        return "Apple Pay";
      case "klarna":
        return "Klarna";
      case "vipps":
        return "Vipps";
      case "stripe":
        return "Stripe";
      case "card":
        return "Kort";
      default:
        return "";
    }
  }
  /** True for methods that complete via a separate sheet/widget, not the CTA. */
  isExpressMethod(method) {
    return method === "apple-pay" || method === "klarna";
  }
  orderTotal() {
    const s4 = this.checkoutState;
    if (!s4) return "";
    return formatPrice(s4.subtotal, s4.currency);
  }
  /** Shipping cost (major units) applied in express mode, else 0. */
  shippingMajor() {
    return this.express ? (this.shippingOption?.price ?? 0) / 100 : 0;
  }
  /** Total to charge — items + shipping (express). */
  payTotalLabel() {
    const s4 = this.checkoutState;
    if (!s4) return "";
    return formatPrice(s4.subtotal + this.shippingMajor(), s4.currency);
  }
  render() {
    return b2`
      <div class="backdrop" @click=${this.close}></div>
      <div
        class="modal ${this.express ? "as-side" : this.orderConfirmed ? "as-confirm" : ""}"
        role="dialog"
        aria-label=${this.heading}
      >
        <div class="handle" @click=${this.close} aria-hidden="true"></div>
        <div class="topbar">
          <h2 class="heading">${this.orderConfirmed ? "Takk!" : this.heading}</h2>
          <button class="close" @click=${this.close} aria-label="Lukk">×</button>
        </div>

        <div class="body">
          ${this.orderConfirmed ? this.renderConfirmation() : this.express ? this.renderKlarnaExpress() : this.renderCheckoutBody()}
        </div>
      </div>
    `;
  }
  renderConfirmation() {
    const o7 = this.confirmedOrder;
    return b2`
      <section class="confirmation">
        <div class="confirm-check" aria-hidden="true">✓</div>
        <h3 class="confirm-title">Takk for bestillingen!</h3>
        <p class="confirm-text">
          Betaling med ${this.methodLabel(this.confirmedMethod)} er bekreftet.${this.form.email ? b2` Kvittering sendes til ${this.form.email}.` : ""}
        </p>
        ${o7?.orderId ? b2`<div class="confirm-order-id">Ordrenummer: <b>${o7.orderId}</b></div>` : ""}
        ${o7 && o7.items.length > 0 ? b2`
              <div class="confirm-summary">
                ${o7.items.map(
      (it) => b2`
                    <div class="order-row">
                      <span>${it.brand ? `${it.brand} ` : ""}${it.name} ×${it.quantity}</span>
                      <span>${formatPrice(it.unitPrice * it.quantity, it.currency)}</span>
                    </div>
                  `
    )}
                <div class="order-row total">
                  <span>Totalt</span><span>${formatPrice(o7.total, o7.currency)}</span>
                </div>
              </div>
            ` : ""}
        <button class="confirm-close" @click=${this.close}>Lukk</button>
      </section>
    `;
  }
  /** Klarna Payments widget panel: shipping + category chips + widget + pay button. */
  renderKlarnaPanel() {
    const currency = this.checkoutState?.currency || (typeof globalThis !== "undefined" && globalThis.__VIO_CURRENCY__) || (typeof localStorage !== "undefined" && localStorage.getItem("vio.currency")) || "NOK";
    return b2`
      <div class="klarna-panel">
        ${this.express ? b2`
              <div class="ship-select" role="radiogroup" aria-label="Frakt">
                ${(this.availableShippingsList?.length > 0 ? this.availableShippingsList : KLARNA_SHIPPING_OPTIONS).map(
      (o7) => b2`
                    <button
                      class="ship-opt ${this.selectedShipping === o7.id ? "active" : ""}"
                      role="radio"
                      aria-checked=${this.selectedShipping === o7.id}
                      ?disabled=${this.klarnaMounting}
                      @click=${() => void this.onSelectShipping(o7.id)}
                    >
                      <span class="ship-meta">
                        <b>${o7.method || o7.name}</b><span>${o7.description}</span>
                      </span>
                      <span class="ship-price">${formatPrice(o7.priceMajor ?? (o7.price / 100), o7.currency || currency)}</span>
                    </button>
                  `
    )}
              </div>
            ` : ""}
        ${this.klarnaCategories.length > 1 ? b2`
              <div class="klarna-cats">
                ${this.klarnaCategories.map(
      (c4) => b2`
                    <button
                      class="klarna-cat ${this.klarnaSelectedCat === c4.identifier ? "active" : ""}"
                      @click=${() => void this.onKlarnaCategory(c4.identifier)}
                    >
                      ${c4.name}
                    </button>
                  `
    )}
              </div>
            ` : ""}
        ${this.klarnaMounting ? b2`
              <div style="padding: 20px; text-align: center; color: var(--vio-color-text-secondary, #666); font-size: 14px;">
                Klargjør Klarna-betaling…
              </div>
            ` : ""}
        <div class="klarna-widget" id="vio-klarna-payments-container"></div>
        <button
          class="payment-btn primary complete-cta"
          @click=${() => void this.onKlarnaAuthorize()}
          ?disabled=${this.klarnaAuthorizing || !this.klarnaHandle || this.klarnaMounting}
        >
          ${this.klarnaAuthorizing ? "Behandler\u2026" : this.klarnaMounting ? "Klargjør Klarna\u2026" : `Betal ${this.payTotalLabel()} med Klarna`}
        </button>
      </div>
    `;
  }
  /** Express layout — only the Klarna widget + a compact order summary. */
  renderKlarnaExpress() {
    const currency = this.checkoutState?.currency || (typeof globalThis !== "undefined" && globalThis.__VIO_CURRENCY__) || (typeof localStorage !== "undefined" && localStorage.getItem("vio.currency")) || "NOK";
    return b2`
      <section class="section">
        <h3 class="section-heading">Kjøp med Klarna</h3>
        ${this.items.length > 0 ? b2`
              <div class="express-summary">
                ${this.items.map(
      (item) => b2`
                    <div class="order-row">
                      <span>${item.brand ? `${item.brand} ` : ""}${item.name} ×${item.quantity}</span>
                      <span>${formatPrice(item.unitPrice * item.quantity, item.currency || currency)}</span>
                    </div>
                  `
    )}
                <div class="order-row">
                  <span>Frakt${this.shippingOption ? ` \u2013 ${this.shippingOption.method}` : ""}</span>
                  <span>${formatPrice(this.shippingMajor(), currency)}</span>
                </div>
                <div class="order-row total">
                  <span>Totalt</span><span>${this.payTotalLabel()}</span>
                </div>
              </div>
            ` : ""}
        ${this.renderKlarnaPanel()}
        ${this.paymentError ? b2`<div class="payment-error">${this.paymentError}</div>` : ""}
      </section>
    `;
  }
  renderCheckoutBody() {
    const method = this.checkoutState?.paymentMethod;
    const showCompleteCta = !!method && !this.isExpressMethod(method);
    return b2`
          <section class="section">
            <div class="section-label">Steg 1</div>
            <h3 class="section-heading">Leveringsadresse</h3>
            <div class="form-row">
              <div class="field">
                <label>Fornavn</label>
                <input
                  type="text"
                  autocomplete="given-name"
                  .value=${this.form.firstName}
                  @input=${(e7) => this.onFieldChange("firstName", e7.target.value)}
                />
              </div>
              <div class="field">
                <label>Etternavn</label>
                <input
                  type="text"
                  autocomplete="family-name"
                  .value=${this.form.lastName}
                  @input=${(e7) => this.onFieldChange("lastName", e7.target.value)}
                />
              </div>
            </div>
            <div class="field">
              <label>E-post</label>
              <input
                type="email"
                autocomplete="email"
                .value=${this.form.email}
                @input=${(e7) => this.onFieldChange("email", e7.target.value)}
              />
            </div>
            <div class="field">
              <label>Adresse</label>
              <input
                type="text"
                autocomplete="street-address"
                .value=${this.form.address}
                @input=${(e7) => this.onFieldChange("address", e7.target.value)}
              />
            </div>
            <div class="form-row">
              <div class="field">
                <label>Postnummer</label>
                <input
                  type="text"
                  autocomplete="postal-code"
                  .value=${this.form.postalCode}
                  @input=${(e7) => this.onFieldChange("postalCode", e7.target.value)}
                />
              </div>
              <div class="field">
                <label>Sted</label>
                <input
                  type="text"
                  autocomplete="address-level2"
                  .value=${this.form.city}
                  @input=${(e7) => this.onFieldChange("city", e7.target.value)}
                />
              </div>
            </div>
          </section>

          <section class="section">
            <div class="section-label">Steg 2</div>
            ${method ? b2`
              <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 12px;">
                <h3 class="section-heading" style="margin:0;">Betalingsmåte: <b>${this.methodLabel(method)}</b></h3>
                <button
                  type="button"
                  style="background:none; border:none; color:var(--vio-color-accent, #c14a3b); text-decoration:underline; font-size:13px; cursor:pointer;"
                  @click=${() => Vio.checkout.selectPaymentMethod("")}
                >
                  Endre
                </button>
              </div>

              ${method === "klarna" ? this.renderKlarnaPanel() : ""}
              ${method === "stripe" ? b2`
                <button
                  class="payment-btn primary complete-cta"
                  @click=${() => void this.onPay("stripe")}
                  ?disabled=${this.stripeLoading}
                >
                  ${this.stripeLoading ? "Går til Stripe…" : `Betal ${this.orderTotal()} med Stripe`}
                </button>
              ` : ""}
              ${method === "vipps" ? b2`
                <button
                  class="payment-btn primary complete-cta"
                  @click=${() => void this.onPay("vipps")}
                  ?disabled=${this.vippsLoading}
                >
                  ${this.vippsLoading ? "Går til Vipps…" : `Betal ${this.orderTotal()} med Vipps`}
                </button>
              ` : ""}
              ${method === "apple-pay" ? b2`
                <button
                  class="payment-btn primary complete-cta"
                  @click=${() => void this.onPay("apple-pay")}
                  ?disabled=${this.applePayInProgress}
                >
                  ${this.applePayInProgress ? "Åpner…" : `Betal ${this.orderTotal()} med Apple Pay`}
                </button>
              ` : ""}
            ` : b2`
              <h3 class="section-heading">Velg betalingsmåte</h3>
              <div class="payment-grid">
                ${this.applePayAvailable ? b2`
                      <button
                        class="payment-btn primary"
                        @click=${() => this.onPay("apple-pay")}
                        ?disabled=${this.applePayInProgress}
                      >
                        ${this.applePayInProgress ? "Åpner…" : b2`<span style="display:inline-flex;align-items:center;gap:6px"><svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true" style="width:18px;height:18px"><path d="M17.05 20.28c-.98.95-2.05.8-3.08.35-1.09-.46-2.09-.48-3.24 0-1.44.62-2.2.44-3.06-.35C2.79 15.25 3.51 7.59 9.05 7.31c1.35.07 2.29.74 3.08.8 1.18-.24 2.31-.93 3.57-.84 1.51.12 2.65.72 3.4 1.8-3.12 1.87-2.38 5.98.48 7.13-.57 1.5-1.31 2.99-2.54 4.09l.01-.01zM12.03 7.25c-.15-2.23 1.66-4.07 3.74-4.25.29 2.58-2.34 4.5-3.74 4.25z"/></svg>Apple Pay</span>`}
                      </button>
                    ` : ""}
                ${(this.availableMethods.length === 0 || this.availableMethods.some(m => m.toLowerCase() === "stripe")) ? b2`
                      <button
                        class="payment-btn"
                        @click=${() => this.onPay("stripe")}
                        ?disabled=${this.stripeLoading}
                      >
                        <img src="vio-sdk/assets/stripe-blurple.svg" style="height: 20px; display: block;" alt="Stripe" />
                      </button>
                    ` : ""}
                ${((this.availableMethods.length === 0 || this.availableMethods.some(m => m.toLowerCase() === "klarna")) && this.klarnaAvailable) ? b2`
                      <button
                        class="payment-btn"
                        @click=${() => this.onPay("klarna")}
                      >
                        Klarna
                      </button>
                    ` : ""}
                ${(this.availableMethods.length === 0 || this.availableMethods.some(m => m.toLowerCase() === "vipps")) ? b2`
                      <button
                        class="payment-btn"
                        @click=${() => this.onPay("vipps")}
                      >
                        <span style="color:#ff5b24;font-weight:800;font-size:17px;letter-spacing:-0.02em">vipps</span>
                      </button>
                    ` : ""}
                ${!this.applePayAvailable ? b2`
                      <div class="apple-pay-note">
                         Pay krever Safari på iOS eller macOS med Apple Pay konfigurert.
                      </div>
                    ` : ""}
              </div>
            `}
            ${this.paymentError ? b2`<div class="payment-error">${this.paymentError}</div>` : ""}
          </section>

          ${this.items.length > 0 ? b2`
                <section class="order-summary">
                  ${this.items.map(
      (item) => b2`
                      <div class="order-line">
                        <div class="order-line-img">
                          ${item.imageUrl ? b2`<img src=${item.imageUrl} alt=${item.name} />` : ""}
                        </div>
                        <div class="order-line-meta">
                          <span>${item.brand}</span>
                          <b>${item.name}</b>
                          <span>×${item.quantity}</span>
                        </div>
                        <div class="order-line-price">
                          ${formatPrice(item.unitPrice * item.quantity, item.currency)}
                        </div>
                      </div>
                    `
    )}
                  <div class="order-row" style="margin-top: 16px;">
                    <span>Sum</span><span>${this.orderTotal()}</span>
                  </div>
                  <div class="order-row">
                    <span>Frakt</span><span>${this.shippingLabel}</span>
                  </div>
                  <div class="order-row total">
                    <span>Totalt</span><span>${this.orderTotal()}</span>
                  </div>
                </section>
              ` : ""}
        </div>
      </div>
    `;
  }
};
__decorateClass([
  n5({ type: Boolean, reflect: true })
], VioCheckout.prototype, "open", 2);
__decorateClass([
  n5({ type: String })
], VioCheckout.prototype, "heading", 2);
__decorateClass([
  n5({ type: String, attribute: "shipping-label" })
], VioCheckout.prototype, "shippingLabel", 2);
__decorateClass([
  n5({ type: Boolean, reflect: true })
], VioCheckout.prototype, "express", 2);
__decorateClass([
  r5()
], VioCheckout.prototype, "checkoutState", 2);
__decorateClass([
  r5()
], VioCheckout.prototype, "items", 2);
__decorateClass([
  r5()
], VioCheckout.prototype, "applePayAvailable", 2);
__decorateClass([
  r5()
], VioCheckout.prototype, "applePayInProgress", 2);
__decorateClass([
  r5()
], VioCheckout.prototype, "klarnaAvailable", 2);
__decorateClass([
  r5()
], VioCheckout.prototype, "orderConfirmed", 2);
__decorateClass([
  r5()
], VioCheckout.prototype, "confirmedMethod", 2);
__decorateClass([
  r5()
], VioCheckout.prototype, "paymentError", 2);
__decorateClass([
  r5()
], VioCheckout.prototype, "confirmedOrder", 2);
__decorateClass([
  r5()
], VioCheckout.prototype, "klarnaCategories", 2);
__decorateClass([
  r5()
], VioCheckout.prototype, "klarnaSelectedCat", 2);
__decorateClass([
  r5()
], VioCheckout.prototype, "klarnaAuthorizing", 2);
__decorateClass([
  r5()
], VioCheckout.prototype, "selectedShipping", 2);
__decorateClass([
  r5()
], VioCheckout.prototype, "form", 2);
__decorateClass([
  r5()
], VioCheckout.prototype, "availableMethods", 2);
__decorateClass([
  r5()
], VioCheckout.prototype, "stripeLoading", 2);
__decorateClass([
  r5()
], VioCheckout.prototype, "vippsLoading", 2);

// src/ui/elements.ts
function registerVioElements() {
  if (typeof customElements === "undefined" || typeof customElements.get !== "function" || typeof customElements.define !== "function")
    return;
  const defs = [
    ["vio-product", VioProduct],
    ["vio-product-carousel", VioProductCarousel],
    ["vio-product-detail", VioProductDetail],
    ["vio-cart", VioCart],
    ["vio-checkout", VioCheckout]
  ];
  for (const [tag, ctor] of defs) {
    if (!customElements.get(tag)) customElements.define(tag, ctor);
  }
}

// src/react/index.ts
registerVioElements();
var VioProduct2 = o({
  react: React,
  tagName: "vio-product",
  elementClass: VioProduct,
  events: {
    onProductClick: "vio:product-click",
    onProductAdd: "vio:product-add"
  }
});
var VioProductCarousel2 = o({
  react: React,
  tagName: "vio-product-carousel",
  elementClass: VioProductCarousel,
  events: {}
});
var VioProductDetail2 = o({
  react: React,
  tagName: "vio-product-detail",
  elementClass: VioProductDetail,
  events: {
    onAddedToCart: "vio:added-to-cart",
    onCheckoutOpen: "vio:checkout-open"
  }
});
var VioCart2 = o({
  react: React,
  tagName: "vio-cart",
  elementClass: VioCart,
  events: {
    onPaymentSuccess: "vio:payment-success",
    onCheckoutOpen: "vio:checkout-open"
  }
});
var VioCheckout2 = o({
  react: React,
  tagName: "vio-checkout",
  elementClass: VioCheckout,
  events: {
    onPaymentSuccess: "vio:payment-success"
  }
});
export {
  CartManager,
  CheckoutManager,
  CommerceClient,
  Configuration,
  Vio,
  VioApi,
  VioApiError,
  VioCart2 as VioCart,
  VioCheckout2 as VioCheckout,
  VioProduct2 as VioProduct,
  VioProductCarousel2 as VioProductCarousel,
  VioProductDetail2 as VioProductDetail,
  checkApplePayAvailability,
  createCommerceClient,
  createVioApi,
  displayPrice,
  formatPrice,
  primaryImageUrl,
  showApplePaySheet,
  gqlCreateCart as createCart,
  gqlAddItem as addItem,
  gqlDeleteItem as deleteItem,
  gqlUpdateItem as updateItem,
  gqlGetCart as getCart,
  gqlGetLineItemsBySupplier as getLineItemsBySupplier,
  gqlUpdateShippingsBySupplier as updateShippingsBySupplier,
  gqlCreateCheckout as createCheckout,
  gqlUpdateCheckout as updateCheckout,
  gqlGetCheckout as getCheckout,
  gqlGetAvailablePaymentMethods as getAvailablePaymentMethods,
  gqlCreatePaymentStripe as createPaymentStripe,
  gqlCreatePaymentVipps as createPaymentVipps,
  CREATE_CART_MUTATION,
  ADD_ITEM_MUTATION,
  DELETE_ITEM_MUTATION,
  UPDATE_ITEM_MUTATION,
  GET_CART_QUERY,
  GET_LINE_ITEMS_BY_SUPPLIER_QUERY,
  UPDATE_SHIPPINGS_BY_SUPPLIER_MUTATION,
  CREATE_CHECKOUT_MUTATION,
  UPDATE_CHECKOUT_MUTATION,
  GET_CHECKOUT_QUERY,
  GET_AVAILABLE_PAYMENT_METHODS_QUERY,
  CREATE_PAYMENT_STRIPE_MUTATION,
  CREATE_PAYMENT_VIPPS_MUTATION
};
/*! Bundled license information:

@lit/react/create-component.js:
  (**
   * @license
   * Copyright 2018 Google LLC
   * SPDX-License-Identifier: BSD-3-Clause
   *)

@lit/reactive-element/css-tag.js:
  (**
   * @license
   * Copyright 2019 Google LLC
   * SPDX-License-Identifier: BSD-3-Clause
   *)

@lit/reactive-element/reactive-element.js:
lit-html/lit-html.js:
lit-element/lit-element.js:
@lit/reactive-element/decorators/custom-element.js:
@lit/reactive-element/decorators/property.js:
@lit/reactive-element/decorators/state.js:
@lit/reactive-element/decorators/event-options.js:
@lit/reactive-element/decorators/base.js:
@lit/reactive-element/decorators/query.js:
@lit/reactive-element/decorators/query-all.js:
@lit/reactive-element/decorators/query-async.js:
@lit/reactive-element/decorators/query-assigned-nodes.js:
  (**
   * @license
   * Copyright 2017 Google LLC
   * SPDX-License-Identifier: BSD-3-Clause
   *)

lit-html/is-server.js:
  (**
   * @license
   * Copyright 2022 Google LLC
   * SPDX-License-Identifier: BSD-3-Clause
   *)

@lit/reactive-element/decorators/query-assigned-elements.js:
  (**
   * @license
   * Copyright 2021 Google LLC
   * SPDX-License-Identifier: BSD-3-Clause
   *)
*/
