import { useEffect, useMemo, useRef, useState } from "react";
import { productToItem, trackViewItemList } from "./analytics";
import { vioAttribution } from "./vio-helpers";
import {
  allGroupIds,
  fetchKondomerietProducts,
  marketKey,
  productFromSnap,
  registerWantedProducts,
  useFastChannel,
  resolveGroup,
  type KondomerietGroup,
  type ResolvedGroup,
} from "./kondomeriet-helpers";
import { inAppBrowser, readCachedProducts } from "./kondomeriet-perf";

/**
 * The products of a block's groups, resolved into cards — painted at once,
 * refreshed in the background:
 *
 * 1. First paint, with no request: the browser cache (a product read in the
 *    last 5 minutes — coming back to the article), else the snapshot the
 *    editor stored in the block's props (`group.snap`). Only when neither
 *    covers every product does the block wait (`products` null → skeletons).
 * 2. Then the API on the block's channel (one request for the whole page,
 *    `fetchKondomerietProducts`), whose answer replaces the first paint in
 *    place: a changed price or stock updates the same card, nothing moves.
 *
 * `view_item_list` goes once per live load, with every product the block
 * shows; a sponsor or campaign change refetches.
 */
export function useKondomerietGroups({
  groups,
  groupsKey,
  sponsorId,
  campaignId,
  slot,
  componentTemplateId,
  listName,
}: {
  groups: KondomerietGroup[];
  /** Changes when the stored groups change (the raw JSON). */
  groupsKey: string;
  sponsorId: number | null;
  campaignId: number | null;
  slot: string;
  componentTemplateId: string;
  listName?: string;
}): { products: any[] | null; resolved: ResolvedGroup[]; ids: number[]; live: boolean } {
  const ids = useMemo(() => allGroupIds(groups), [groupsKey]); // eslint-disable-line react-hooks/exhaustive-deps
  const idsKey = ids.join(",");
  // The page's Config asks for every block's products in one request.
  useMemo(() => registerWantedProducts(ids), [idsKey]); // eslint-disable-line react-hooks/exhaustive-deps

  // First paint: cache, else snapshot — per product, in the block's order.
  const initial = useMemo(() => {
    if (ids.length === 0) return [];
    const cached = readCachedProducts(ids, marketKey()).products;
    const snaps = new Map<number, any>();
    for (const g of groups) for (const [k, s] of Object.entries(g.snap ?? {})) snaps.set(Number(k), s);
    const list: any[] = [];
    for (const id of ids) {
      const p = cached.get(id) ?? (snaps.has(id) ? productFromSnap(id, snaps.get(id)) : null);
      if (!p) return null; // a product with neither: wait for the API
      list.push(p);
    }
    return list;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [groupsKey]);

  // Before the bootstrap names the sponsor, the channel the Config resolved
  // in the editor (`fastStart`): the request leaves in parallel with the bootstrap.
  const fast = useFastChannel();
  const sid = sponsorId ?? fast?.sponsorId ?? null;
  const cid = sponsorId != null ? campaignId : fast?.campaignId ?? null;

  const [live, setLive] = useState<any[] | null>(null);
  const liveKey = useRef("");
  useEffect(() => {
    if (ids.length === 0 || sid == null) return;
    const key = `${idsKey}|${sid}|${cid ?? ""}`;
    if (liveKey.current !== key) setLive(null);
    liveKey.current = key;
    let cancelled = false;
    fetchKondomerietProducts(ids, sid, cid).then((list) => {
      if (!cancelled && list.length) setLive(list);
    });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [idsKey, sid, cid]);

  // `view_item_list` once per live load, when the sponsor is known (its
  // campaign comes from the bootstrap): the event's attribution is complete.
  const tracked = useRef<any[] | null>(null);
  useEffect(() => {
    if (!live || sponsorId == null || tracked.current === live) return;
    tracked.current = live;
    trackViewItemList(
      live.map((p) => productToItem(p)),
      listName,
      // The in-app browser mark rides along (props on the Vio collector), to measure that traffic.
      { ...vioAttribution(slot, sponsorId, componentTemplateId), in_app_browser: inAppBrowser() ?? "no" } as any
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [live, sponsorId]);

  // Live products where the API has them (keeping the first paint's rating
  // line: the card shape has no description); the first paint until it answers.
  const products = useMemo(() => {
    if (live) {
      const byId = new Map(live.map((p) => [Number(p.id), p]));
      const first = new Map((initial ?? []).map((p: any) => [Number(p.id), p]));
      return ids
        .map((id) => {
          const p = byId.get(id);
          if (!p) return null;
          return p.description == null && first.get(id)?.description ? { ...p, description: first.get(id).description } : p;
        })
        .filter(Boolean);
    }
    return ids.length === 0 ? [] : initial;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [live, initial, idsKey]);

  const resolved = useMemo(() => {
    if (!products) return [];
    const byId = new Map<number, any>(products.map((p) => [Number(p.id), p]));
    return groups.map((g, i) => resolveGroup(g, byId, i)).filter(Boolean) as ResolvedGroup[];
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [products, groupsKey]);

  // `live` for the impressions: real data, and a sponsor to attribute it to.
  return { products, resolved, ids, live: !!live && sponsorId != null };
}
