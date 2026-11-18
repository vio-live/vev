/**
 * The slice of the Vio web SDK the Kondomeriet package uses, compiled from the
 * SDK's own source (vio-web-sdk) so it behaves exactly the same: the analytics
 * manager (same events, same session and anon ids), the configuration, the
 * campaign / slot / sponsor rules, the Vipps button helper and the price and
 * image formatters. Nothing of the cart, the checkout or the UI elements.
 * Built into ../vio-sdk/sdk-lite.js by build-sdk-lite.mjs.
 */
export { AnalyticsManager, resolveCampaignId } from "@sdk/core/analytics/analytics-manager";
export { Configuration } from "@sdk/core/configuration";
export {
  resolveSlotCampaign,
  campaignCandidates,
  defaultCampaignEntry,
  toNumber,
  normalizeSlotId,
  normalizeSlotLocations,
  normalizeSlotKind,
  toCampaignId,
  activeCampaignEntry,
  slotDeclarationKey,
  pendingSlotKeys,
  rememberSlotKeys,
  slotDeclarationStorageKey,
  readSlotDeclaration,
  writeSlotDeclaration,
  SLOT_DECLARATION_TTL_MS,
  SLOT_DECLARATION_FAILURE_TTL_MS,
  MAX_LOCATIONS_PER_DECLARATION,
  MAX_DECLARATIONS_PER_LOAD,
} from "@sdk/core/slots";
export { sponsorCommerceIn, sponsorIdentityFrom, sellingBlocksIn, toSponsorId, channelIdOf } from "@sdk/core/sponsor-identity";
export { resolveContent } from "@sdk/core/content";
export { ensureVippsButton, vippsButtonAttributes } from "@sdk/core/checkout/payments/vipps-button";
export { formatPrice, primaryImageUrl } from "@sdk/core/types";
export { SDK_VERSION } from "@sdk/core/version";
// The design tokens on :root (a side effect of the module, as in the SDK) and the theme overrides.
export { applyVioTheme } from "@sdk/ui/tokens";
