import React from "react";
import { registerVevComponent } from "@vev/react";
import VioConfig, { VioApiKeyEditor, VioCampaignSelector, VioSponsorSelector } from "./vio-config";
import { KondomerietDetailHost } from "./kondomeriet-detail";
import { DEFAULT_ENVIRONMENT } from "./vio-helpers";

/**
 * Kondomeriet Config (SDK) — the Vio Config for Kondomeriet pages: the same
 * connection (API key, sponsor, campaign, environment), page identity,
 * slots, theme and analytics, but NO Vio cart, checkout, product detail or
 * cart button. Payment is always kondomeriet.no's own Vipps Hurtigkasse, so
 * the only overlay it mounts is the Kondomeriet detail drawer.
 *
 * It is the Vio Config itself with `overlaysOverride` — one implementation of
 * the connection flow, not a copy that drifts. Place ONE per page (one Config
 * of either kind: the first one mounted owns the page).
 */

type Props = Record<string, any>;

export default function KondomerietConfig(props: Props) {
  return <VioConfig {...props} cartButton="never" overlaysOverride={<KondomerietDetailHost />} />;
}

registerVevComponent(KondomerietConfig, {
  name: "Kondomeriet Config (SDK)",
  size: { width: 320, height: "auto" },
  props: [
    { name: "apiKey", title: "Vio API Key", type: "string", initialValue: "", component: VioApiKeyEditor as any },
    { name: "sponsorId", title: "Active Sponsor", type: "number", component: VioSponsorSelector as any },
    { name: "campaignId", title: "Campaign", type: "number", component: VioCampaignSelector as any },
    {
      name: "environment",
      title: "Environment",
      type: "select",
      initialValue: DEFAULT_ENVIRONMENT,
      options: {
        display: "dropdown",
        items: [
          { value: "development", label: "Development" },
          { value: "staging", label: "Staging" },
          { value: "production", label: "Production" },
        ],
      },
    } as any,
    // Theme — the same fields as Vio Config's; blank = the default look.
    { name: "themeColorAccent", title: "Theme · Accent color", type: "string", initialValue: "" },
    { name: "themeColorText", title: "Theme · Text color", type: "string", initialValue: "" },
    { name: "themeColorTextSecondary", title: "Theme · Secondary text", type: "string", initialValue: "" },
    { name: "themeColorSurface", title: "Theme · Background", type: "string", initialValue: "" },
    { name: "themeColorSurfaceMuted", title: "Theme · Muted background", type: "string", initialValue: "" },
    { name: "themeColorBorder", title: "Theme · Border color", type: "string", initialValue: "" },
    { name: "themeFontSerif", title: "Theme · Heading font", type: "string", initialValue: "" },
    { name: "themeFontSans", title: "Theme · Body font", type: "string", initialValue: "" },
    {
      name: "themeCorners",
      title: "Theme · Corners",
      type: "select",
      initialValue: "default",
      options: {
        display: "dropdown",
        items: [
          { value: "default", label: "Default" },
          { value: "sharp", label: "Sharp" },
          { value: "rounded", label: "Rounded" },
        ],
      },
    },
    { name: "analytics", title: "Analytics (GA4 / dataLayer)", type: "boolean", initialValue: true },
    { name: "sendToVio", title: "Send to Vio Analytics", type: "boolean", initialValue: true },
    { name: "analyticsDebug", title: "Analytics debug + inspector", type: "boolean", initialValue: false },
  ],
});
