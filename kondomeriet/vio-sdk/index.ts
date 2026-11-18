/**
 * Vio, without the Vio web SDK bundle — the facade the Kondomeriet package's
 * code talks to (the same calls the blocks made on the SDK's `Vio`), over the
 * SDK's own code for everything that must behave the same (sdk-lite.js,
 * compiled from vio-web-sdk's source): analytics (events, session, anon id),
 * configuration, campaign / slot / sponsor rules, content, tokens.
 *
 * What it does not have: carts, checkout, payments, the `<vio-*>` elements.
 * The Kondomeriet blocks sell through kondomeriet.no's Vipps Hurtigkasse and
 * never used them.
 */
import {
  AnalyticsManager,
  Configuration,
  campaignCandidates,
  normalizeSlotId,
  normalizeSlotLocations,
  resolveCampaignId,
  resolveContent,
  resolveSlotCampaign,
  sponsorCommerceIn,
  sponsorIdentityFrom,
  channelIdOf,
  toNumber,
  toSponsorId,
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
} from "./sdk-lite.js";

export { ensureVippsButton, vippsButtonAttributes, formatPrice, primaryImageUrl, applyVioTheme, SDK_VERSION } from "./sdk-lite.js";

/** The SDK's payment-success reader: there is no Vio checkout here. */
export function purchaseFromPaymentSuccess(..._a: unknown[]): any {
  return null;
}

type InitOptions = { apiKey: string; environment?: string; platform?: string; campaignId?: number; contentId?: string; contentTitle?: string };

/** The REST client the facade hands out (`Vio.api`); its `bootstrap` is what kondomeriet-perf.ts wraps. */
class LiteApi {
  constructor(public apiBase: string, public apiKey: string) {}
  async bootstrap(platform?: string): Promise<any> {
    const url = `${this.apiBase}/v2/mobile/config?apiKey=${encodeURIComponent(this.apiKey)}` + (platform ? `&platform=${encodeURIComponent(platform)}` : "");
    const res = await fetch(url, { headers: { Accept: "application/json" } });
    if (!res.ok) throw new Error(`[Vio] GET /v2/mobile/config → HTTP ${res.status}`);
    return res.json();
  }
  async declareManifest(body: unknown): Promise<any> {
    const res = await fetch(`${this.apiBase}/v2/mobile/components/manifest`, {
      method: "POST",
      headers: { "X-API-Key": this.apiKey, Accept: "application/json", "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    if (!res.ok) throw new Error(`[Vio] POST /v2/mobile/components/manifest → HTTP ${res.status}`);
    return res.json().catch(() => null);
  }
}

const BOOTSTRAP_BACKOFF_MS = 5000;
const SLOT_DECLARATION_DEBOUNCE_MS = 1000;
/** A key remembered as failed is retried after the failure TTL (the SDK's `failedAt`). */
function failedAt(now: number): number {
  return now - (SLOT_DECLARATION_TTL_MS - SLOT_DECLARATION_FAILURE_TTL_MS);
}

class LiteVio {
  private cachedBootstrap: any = null;
  private bootstrapPromise: Promise<any> | null = null;
  private bootstrapFailedAt = 0;
  private generation = 0;
  private apiInstance: LiteApi | null = null;
  private slotRegistry = new Map<string, { count: number; displayName?: string; campaignId?: number; kind?: string }>();
  private slotsDirty = false;
  private slotTimer: any = null;
  private declarationsThisLoad = 0;
  /** The SDK's own analytics manager: same events, same `vio.session.v1` / `vio.anon.v1`. */
  readonly analytics = new AnalyticsManager();
  /** No Vio cart or checkout in this package. */
  readonly cart: any = undefined;
  readonly checkout: any = undefined;

  get isInitialized(): boolean {
    return Configuration.isInitialized;
  }
  get config(): any {
    return Configuration.get();
  }
  init(opts: InitOptions): void {
    Configuration.init({ ...opts, platform: opts.platform ?? "vev" });
    this.generation++;
    this.cachedBootstrap = null;
    this.bootstrapPromise = null;
    this.bootstrapFailedAt = 0;
    this.apiInstance = null;
    if (this.slotRegistry.size) this.slotsDirty = true;
  }
  get api(): LiteApi {
    if (!this.apiInstance) {
      const cfg = Configuration.get();
      this.apiInstance = new LiteApi(cfg.apiBase, cfg.apiKey);
    }
    return this.apiInstance;
  }
  get bootstrapCache(): any {
    return this.cachedBootstrap;
  }
  /** A newer answer for the same configuration (the API after the CDN's photo). */
  adoptBootstrap(res: any): void {
    if (res && typeof res === "object") this.cachedBootstrap = res;
  }
  bootstrap(): Promise<any> {
    if (this.cachedBootstrap) return Promise.resolve(this.cachedBootstrap);
    if (this.bootstrapPromise) return this.bootstrapPromise;
    if (this.bootstrapFailedAt && Date.now() - this.bootstrapFailedAt < BOOTSTRAP_BACKOFF_MS) {
      return Promise.reject(new Error("[Vio] bootstrap recently failed — backing off"));
    }
    const generation = this.generation;
    const promise: Promise<any> = this.api
      .bootstrap(Configuration.get().platform)
      .then(
        (res) => {
          if (generation !== this.generation) return this.bootstrap();
          this.cachedBootstrap = res;
          this.bootstrapFailedAt = 0;
          if (this.slotsDirty) this.scheduleSlotDeclaration();
          return res;
        },
        (err) => {
          if (generation !== this.generation) return this.bootstrap();
          this.bootstrapFailedAt = Date.now();
          throw err;
        }
      )
      .finally(() => {
        if (this.bootstrapPromise === promise) this.bootstrapPromise = null;
      });
    this.bootstrapPromise = promise;
    return promise;
  }

  // MARK: sponsors and campaigns (the SDK's rules, sponsor-identity.ts / slots.ts)

  private pageCampaignCandidates(hint?: unknown): number[] {
    const cfg = Configuration.isInitialized ? Configuration.get() : undefined;
    return campaignCandidates([...(Array.isArray(hint) ? hint : [hint]), cfg?.campaignId]);
  }
  sponsorCommerce(sponsorId: unknown, ctx: { campaignId?: unknown; channelId?: unknown } = {}): any {
    try {
      const id = toSponsorId(sponsorId);
      if (id === undefined) return null;
      const channel = channelIdOf(ctx?.channelId);
      if (channel !== undefined) return sponsorCommerceIn(this.cachedBootstrap, id, { channelId: channel }) ?? null;
      const campaignId = ctx?.campaignId === null ? [] : this.pageCampaignCandidates(ctx?.campaignId);
      return sponsorCommerceIn(this.cachedBootstrap, id, { campaignId }) ?? null;
    } catch {
      return null;
    }
  }
  sponsorIdentity(sponsorId: unknown): any {
    try {
      return sponsorIdentityFrom(this.cachedBootstrap, toSponsorId(sponsorId)) ?? null;
    } catch {
      return null;
    }
  }
  /** GraphQL for a sponsor's channel (the reads go GET in kondomeriet-helpers; this is the fallback). */
  commerceFor(sponsorId: number, ctx?: { campaignId?: unknown; channelId?: unknown }): any {
    const sponsor = this.sponsorCommerce(sponsorId, ctx ?? {});
    if (!sponsor) throw new Error(`[Vio] Sponsor ${sponsorId} not found in bootstrap.`);
    const endpoint = Configuration.get().graphQLBase;
    const apiKey = sponsor.commerce.apiKey;
    const request = async (query: string, variables: unknown) => {
      const res = await fetch(endpoint, { method: "POST", headers: { "Content-Type": "application/json", Authorization: apiKey }, body: JSON.stringify({ query, variables }) });
      if (!res.ok) throw new Error(`[Vio] GraphQL ${res.status}`);
      const json = await res.json();
      if (json?.errors?.length) throw new Error(`[Vio] GraphQL: ${json.errors[0]?.message ?? "error"}`);
      return json?.data;
    };
    return { raw: { request }, channel: { product: {} } };
  }
  campaignForSlot(slot?: string | null, hint: { campaignId?: unknown; sponsorId?: unknown } = {}): any {
    const cfg = Configuration.isInitialized ? Configuration.get() : undefined;
    return resolveSlotCampaign(this.cachedBootstrap, slot ?? null, Date.now(), cfg?.platform, this.pageCampaignCandidates(hint.campaignId), toNumber(hint.sponsorId));
  }
  content(): { id?: string; title?: string; url?: string } {
    try {
      const cfg = Configuration.isInitialized ? Configuration.get() : undefined;
      return resolveContent({ contentId: cfg?.contentId, contentTitle: cfg?.contentTitle }) ?? {};
    } catch {
      return {};
    }
  }
  /** As the SDK's `Vio.attribution`: slot, campaign and sponsor for the events and the order. */
  attribution(slot?: string | null, hint: { sponsorId?: unknown; campaignId?: unknown } = {}): any {
    const out: any = {};
    try {
      const name = normalizeSlotId(slot);
      if (name) out.slot = name;
      const boot = this.cachedBootstrap;
      const hinted = toNumber(hint?.sponsorId);
      const pageCampaignId = this.pageCampaignCandidates(hint?.campaignId);
      if (boot) {
        if (hinted !== undefined) {
          const campaignId = resolveCampaignId({ slot: name || undefined, sponsorId: hinted }, boot, { pageCampaignId });
          if (campaignId !== undefined) out.campaignId = campaignId;
          out.sponsorId = hinted;
        } else {
          const campaign = this.campaignForSlot(name || null, { campaignId: pageCampaignId });
          const campaignId = toNumber(campaign?.id);
          if (campaignId !== undefined) out.campaignId = campaignId;
          const sponsorId = campaign ? toNumber(campaign.primarySponsor?.id) : toNumber(boot.primarySponsor?.id);
          if (sponsorId !== undefined) out.sponsorId = sponsorId;
        }
      } else if (hinted !== undefined) {
        out.sponsorId = hinted;
      }
      const content = this.content();
      if (content.id) out.contentId = content.id;
      if (content.title) out.contentTitle = content.title;
      if (content.url) out.contentUrl = content.url;
    } catch {
      /* attribution never breaks a render or a click */
    }
    return out;
  }
  trackCta(input: unknown): void {
    try {
      this.analytics.trackCta(input);
    } catch {
      /* tracking never breaks the click */
    }
  }

  /** As the SDK's `Vio.pageCampaign()`: the page's campaign (`init({ campaignId })`) when the bootstrap lists it active. */
  pageCampaign(): any {
    const cfg = Configuration.isInitialized ? Configuration.get() : undefined;
    return activeCampaignEntry(this.cachedBootstrap, cfg?.campaignId);
  }

  // MARK: slots (ADR-0027 / ADR-0034) — the SDK's registerSlot / declareSlots, same memory and caps

  registerSlot(name: string, displayName?: string, campaignIdOrOptions?: unknown, options?: { campaignId?: unknown; kind?: string }): () => void {
    const id = normalizeSlotId(name);
    if (!id) return () => {};
    const label = typeof displayName === "string" && displayName.trim() ? displayName.trim() : undefined;
    const positional: any = campaignIdOrOptions !== null && typeof campaignIdOrOptions === "object" ? campaignIdOrOptions : { campaignId: campaignIdOrOptions };
    const merged = { ...positional, ...(options ?? {}) };
    const campaign = toCampaignId(merged.campaignId);
    const kind = normalizeSlotKind(merged.kind);
    const entry = this.slotRegistry.get(id);
    let changed = false;
    if (!entry) {
      this.slotRegistry.set(id, { count: 1, displayName: label, campaignId: campaign, kind });
      changed = true;
    } else {
      entry.count++;
      if (label !== undefined && label !== entry.displayName) {
        entry.displayName = label;
        changed = true;
      }
      if (campaign !== undefined && campaign !== entry.campaignId) {
        entry.campaignId = campaign;
        changed = true;
      }
      if (kind !== undefined && entry.kind === undefined) {
        entry.kind = kind;
        changed = true;
      }
    }
    if (changed) {
      this.slotsDirty = true;
      if (this.cachedBootstrap) this.scheduleSlotDeclaration();
    }
    let released = false;
    return () => {
      if (released) return;
      released = true;
      const current = this.slotRegistry.get(id);
      if (!current) return;
      if (current.count <= 1) this.slotRegistry.delete(id);
      else current.count--;
    };
  }
  private scheduleSlotDeclaration(): void {
    if (typeof window === "undefined") return;
    if (this.slotTimer) clearTimeout(this.slotTimer);
    this.slotTimer = setTimeout(() => {
      this.slotTimer = null;
      this.slotsDirty = false;
      void this.declareSlots(
        [...this.slotRegistry.entries()].map(([id, { displayName, campaignId, kind }]) => ({
          id,
          ...(displayName ? { displayName } : {}),
          ...(campaignId !== undefined ? { campaignId } : {}),
          ...(kind ? { kind } : {}),
        }))
      );
    }, SLOT_DECLARATION_DEBOUNCE_MS);
  }
  async declareSlots(slots: unknown[], opts: { force?: boolean } = {}): Promise<any> {
    let storageKey: string | undefined;
    let keys: string[] = [];
    let now = Date.now();
    try {
      const all = normalizeSlotLocations(slots);
      if (all.length === 0 || !Configuration.isInitialized) return null;
      const cfg = Configuration.get();
      storageKey = slotDeclarationStorageKey(cfg.platform, cfg.apiKey);
      now = Date.now();
      const pageCampaignId = cfg.campaignId;
      for (const l of all) if (l.campaignId !== undefined && l.campaignId === pageCampaignId) delete l.campaignId;
      const memory = readSlotDeclaration(storageKey);
      const keyOf = (l: any) => slotDeclarationKey(l, pageCampaignId);
      const pending = new Set(pendingSlotKeys(memory, all.map(keyOf), now));
      let locations = opts.force ? all : all.filter((l: any) => pending.has(keyOf(l)));
      if (locations.length === 0) return null;
      if (locations.length > MAX_LOCATIONS_PER_DECLARATION) locations = locations.slice(0, MAX_LOCATIONS_PER_DECLARATION);
      keys = locations.map(keyOf);
      if (!opts.force && this.declarationsThisLoad >= MAX_DECLARATIONS_PER_LOAD) return null;
      this.declarationsThisLoad++;
      const result = await this.api.declareManifest({
        platform: cfg.platform,
        mode: "merge",
        locations,
        ...(pageCampaignId !== undefined ? { campaignId: pageCampaignId } : {}),
      });
      if (result?.mode === "merge") {
        const unhandled = this.campaignNotTakenUp(result, locations, pageCampaignId);
        const settled = keys.filter((k) => !unhandled.has(k));
        let next = rememberSlotKeys(memory, settled, now);
        if (unhandled.size > 0) next = rememberSlotKeys(next, [...unhandled], failedAt(now));
        writeSlotDeclaration(storageKey, next);
      } else {
        writeSlotDeclaration(storageKey, rememberSlotKeys(memory, keys, failedAt(now)));
      }
      return result;
    } catch {
      if (storageKey && keys.length > 0) writeSlotDeclaration(storageKey, rememberSlotKeys(readSlotDeclaration(storageKey), keys, failedAt(now)));
      return null;
    }
  }
  private campaignNotTakenUp(result: any, sent: any[], pageCampaignId: number | undefined): Set<string> {
    const out = new Set<string>();
    const withCampaign = sent.filter((l) => (l.campaignId ?? pageCampaignId) !== undefined);
    if (withCampaign.length === 0) return out;
    const answered: any[] = Array.isArray(result?.locations) ? result.locations : [];
    const anyAssignment = answered.some((l) => l && typeof l === "object" && !!l.assignment);
    for (const l of withCampaign) {
      const answer = answered.find((a) => a && a.locationId === l.id);
      const campaignId = l.campaignId ?? pageCampaignId;
      const notTaken = !anyAssignment || (answer?.assignment === "none" && activeCampaignEntry(this.cachedBootstrap, campaignId) !== null);
      if (notTaken) out.add(slotDeclarationKey(l, pageCampaignId));
    }
    return out;
  }
}

const g = globalThis as { __KND_VIO__?: LiteVio };
/** One per page, whichever copy of the package created it (Vev may serve the package twice). */
export const Vio: LiteVio = g.__KND_VIO__ ?? (g.__KND_VIO__ = new LiteVio());

/**
 * The SDK's drawers (cart, checkout, product detail) do not exist here. Vio
 * Config's code references them, but the Kondomeriet Config always replaces
 * its overlays (`overlaysOverride`) with its own product info: they never render.
 */
import * as React from "react";
const Nothing = React.forwardRef<unknown, Record<string, unknown>>(function Nothing() {
  return null;
});
export const VioCart = Nothing;
export const VioCheckout = Nothing;
export const VioProductDetail = Nothing;
