import { useEffect, useMemo, useState } from "react";
import { productToItem, trackViewItemList } from "./analytics";
import { vioAttribution } from "./vio-helpers";
import {
  allGroupIds,
  fetchKondomerietProducts,
  resolveGroup,
  type KondomerietGroup,
  type ResolvedGroup,
} from "./kondomeriet-helpers";

/**
 * The products of a block's groups, fetched once on the block's channel and
 * resolved into cards. `products` is null while loading (and while there is
 * no sponsor yet); a sponsor or campaign change empties it first, so the
 * events never pair one sponsor with another's products. `view_item_list`
 * goes once per load with every product the block shows.
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
}): { products: any[] | null; resolved: ResolvedGroup[]; ids: number[] } {
  const ids = useMemo(() => allGroupIds(groups), [groupsKey]); // eslint-disable-line react-hooks/exhaustive-deps
  const idsKey = ids.join(",");
  const [products, setProducts] = useState<any[] | null>(null);

  useEffect(() => {
    if (ids.length === 0) {
      setProducts([]);
      return;
    }
    setProducts(null);
    if (sponsorId == null) return;
    let cancelled = false;
    fetchKondomerietProducts(ids, sponsorId, campaignId).then((list) => {
      if (cancelled) return;
      setProducts(list);
      trackViewItemList(
        list.map((p) => productToItem(p)),
        listName,
        vioAttribution(slot, sponsorId, componentTemplateId)
      );
    });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [idsKey, sponsorId, campaignId]);

  const resolved = useMemo(() => {
    if (!products) return [];
    const byId = new Map<number, any>(products.map((p) => [Number(p.id), p]));
    return groups.map((g, i) => resolveGroup(g, byId, i)).filter(Boolean) as ResolvedGroup[];
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [products, groupsKey]);

  return { products, resolved, ids };
}
