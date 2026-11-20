import {
  ensureVioInit,
  persistApiKey,
  persistEnvironment,
  scopedStorageKey,
  setRuntimeApiKey,
  setRuntimeEnvironment,
  type VioEnvironment,
} from "./vio-helpers";

/**
 * Which Kondomeriet Config owns the page, for the OTHER window of the Vev
 * editor. The canvas (an iframe) knows it: the first Config mounted owns the
 * page (kondomeriet-config.tsx). The properties panel is another window with
 * its own SDK and its own runtime key and environment, shared with the canvas
 * only through localStorage. So the canvas writes, in the editor only:
 *
 * - each Config's role by its model key (`knd.configRoles.v1`), so the panel
 *   of a duplicate knows it is one (Vev gives a prop editor its block's model
 *   key in `context.key`) and touches nothing global;
 * - the owner's connection — key and environment (`knd.configOwner.v1`) — so
 *   the panel's catalog picker connects with it, whatever another Config's
 *   panel left in that window (Alan, #491: a deleted duplicate in Staging left
 *   the panel's SDK on api-staging, where the page's key gives 401).
 */

const ROLES_KEY = "knd.configRoles.v1";
/** Per page (vio-helpers' pageScope): a page without its own Kondomeriet Config must not use another page's (#491, 20/11). */
const OWNER_KEY = "knd.configOwner.v1";
const ownerKey = () => scopedStorageKey(OWNER_KEY);

/** What the panel says when the page has no Kondomeriet Config of its own. */
export const NO_KONDOMERIET_CONFIG = "This page has no Kondomeriet Config — add one (Environment: Production, the publisher's key) to list and show Kondomeriet products.";

export type ConfigOwner = { model: string; apiKey: string; environment: VioEnvironment; at: number };

function read<T>(key: string): T | null {
  try {
    return JSON.parse(localStorage.getItem(key) || "null") as T | null;
  } catch {
    return null;
  }
}

function write(key: string, value: unknown): void {
  try {
    if (value == null) localStorage.removeItem(key);
    else localStorage.setItem(key, JSON.stringify(value));
  } catch {
    /* no storage: the panel keeps today's behaviour */
  }
}

/** Canvas: this Config's role (owner or duplicate); null removes it (unmounted). */
export function writeConfigRole(model: string, owner: boolean | null): void {
  if (!model) return;
  const roles = read<Record<string, { owner: boolean; at: number }>>(ROLES_KEY) ?? {};
  if (owner == null) delete roles[model];
  else roles[model] = { owner, at: Date.now() };
  write(ROLES_KEY, roles);
}

/** Panel: the Config whose properties these are is a duplicate (known only when the canvas said so). */
export function isDuplicateConfig(model: string | undefined): boolean {
  if (!model) return false;
  return read<Record<string, { owner: boolean }>>(ROLES_KEY)?.[model]?.owner === false;
}

export function readConfigOwner(): ConfigOwner | null {
  const o = read<ConfigOwner>(ownerKey());
  return o && typeof o.apiKey === "string" && o.apiKey && o.environment ? o : null;
}

/**
 * The owner imposes its key and environment on this window — even when they
 * did not change (a duplicate's panel may have changed them meanwhile) — and
 * records them for the other window.
 */
export function imposeOwnerConnection(model: string, apiKey: string, environment: VioEnvironment): void {
  if (!apiKey) return;
  write(ownerKey(), { model, apiKey, environment, at: Date.now() } satisfies ConfigOwner);
  persistApiKey(apiKey);
  persistEnvironment(environment, apiKey);
  setRuntimeApiKey(apiKey);
  setRuntimeEnvironment(environment);
  ensureVioInit(apiKey, environment);
}

/**
 * Before reading the catalog (the picker, in the panel window): the SDK of
 * this window on the owner's key and environment — re-initialised when it is
 * on another (ensureVioInit re-inits only on a change). No Kondomeriet Config
 * recorded for THIS page: an error that says so — never another page's
 * connection, nor a Vio Config's key on the same page (its channel is not
 * Kondomeriet's).
 */
export function ensureOwnerConnection(): void {
  const o = readConfigOwner();
  if (!o) throw new Error(NO_KONDOMERIET_CONFIG);
  setRuntimeApiKey(o.apiKey);
  setRuntimeEnvironment(o.environment);
  ensureVioInit(o.apiKey, o.environment);
}
