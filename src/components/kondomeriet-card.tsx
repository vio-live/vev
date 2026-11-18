import React, { useEffect, useRef } from "react";
import { registerVevComponent } from "@vev/react";
import { KondomerietCardView } from "./kondomeriet-card-view";
import { simpleConfigRequest } from "./kondomeriet-perf";
import {
  GROUP_PROP,
  KONDOMERIET_CARD_IMAGE_PROPS,
  KONDOMERIET_CARD_PROPS,
  KONDOMERIET_EDITABLE_CSS,
  imageUrlOf,
  pickKondomerietConfig,
} from "./kondomeriet-props";
import { SLOT_PROPS } from "./slot-props";
import { useKondomerietGroups } from "./kondomeriet-data";
import { SNAPSHOT_MISSING_NOTICE, groupsMissingSnapshot, parseGroups, type GroupsValue } from "./kondomeriet-helpers";
import { COMPONENT_TEMPLATE_ID, useActiveSponsorId, useVioSlot, useVioSlotId, vioAttribution } from "./vio-helpers";
import { observeVioImpression, productToItem } from "./analytics";

/**
 * Kondomeriet Product Card — one card for a product GROUP: several Vio
 * products (one per colour / model / size, as the feed creates them) behind
 * a selector. "Kjøp med Vipps" posts kondomeriet.no's Vipps Hurtigkasse for
 * the option chosen; "Se produktinfo" opens the Kondomeriet detail drawer.
 * Never Vio's cart or checkout. A single product is a group of one.
 */

type Props = {
  group?: GroupsValue;
  slot?: string;
  slotName?: string;
  hostRef?: { current: HTMLElement | null } | null;
  [key: string]: any;
};

export default function KondomerietProductCard(props: Props) {
  simpleConfigRequest();
  const { group, slot, slotName, hostRef } = props;
  const groupsKey = group?.data ?? "";
  const groups = parseGroups(group).slice(0, 1);
  const slotId = useVioSlotId({ slot, kind: "card" });
  // The page's active sponsor (Vio / Kondomeriet Config), or the campaign's
  // assigned to this card's slot — the same rule as the Vio card.
  const sponsorId = useActiveSponsorId(undefined, slotId);
  const campaignId = sponsorId != null ? vioAttribution(slotId, sponsorId).campaignId ?? null : null;
  const { products, resolved, ids, live } = useKondomerietGroups({
    groups,
    groupsKey,
    sponsorId,
    campaignId,
    slot: slotId,
    componentTemplateId: COMPONENT_TEMPLATE_ID.card,
    listName: "Kondomeriet Card",
  });
  const card = resolved[0] ?? null;
  useVioSlot({ slot, slotName, kind: "card", title: card?.title, ready: products != null, hostRef });

  // Real impression (≥50 % visible ≥1 s), with every product the card offers.
  const rootRef = useRef<HTMLDivElement | null>(null);
  useEffect(() => {
    // Counted on live data only: a card painted from its snapshot before the
    // sponsor is known would otherwise count twice (once without a sponsor).
    if (!card || !products || !live) return;
    return observeVioImpression(
      rootRef.current,
      {
        sponsorId: sponsorId ?? undefined,
        componentTemplateId: COMPONENT_TEMPLATE_ID.card,
        ...vioAttribution(slotId, sponsorId, COMPONENT_TEMPLATE_ID.card),
      },
      `knd-card:${sponsorId}:${slotId}:${ids.join("-")}`,
      card.options.map((o) => productToItem(o.product))
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [card?.key, products, live, sponsorId, slotId]);

  return (
    <KondomerietCardView
      group={card}
      loading={ids.length > 0 && products == null}
      unavailable={ids.length > 0 && products != null && !card}
      config={pickKondomerietConfig(props)}
      sponsorId={sponsorId}
      slot={slotId}
      componentTemplateId={COMPONENT_TEMPLATE_ID.card}
      standalone
      priority
      rootRef={rootRef}
      imageOverride={imageUrlOf(props.image)}
      pending={groups[0] ? { options: groups[0].ids.length, buyOnCard: groups[0].buyOnCard, offerEnd: groups[0].offerEnd } : undefined}
      editorNotices={groupsMissingSnapshot(groups) ? [SNAPSHOT_MISSING_NOTICE] : []}
    />
  );
}

registerVevComponent(KondomerietProductCard, {
  name: "Kondomeriet Product Card",
  size: { height: "auto", width: 300 },
  editableCSS: KONDOMERIET_EDITABLE_CSS,
  props: [GROUP_PROP, ...KONDOMERIET_CARD_IMAGE_PROPS, ...SLOT_PROPS, ...KONDOMERIET_CARD_PROPS],
});
