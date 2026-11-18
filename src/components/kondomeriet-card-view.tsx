import React, { useEffect, useRef, useState } from "react";
import { useEditorState } from "@vev/react";
import { primaryImageUrl } from "../../vio-sdk";
import { COMPONENT_TEMPLATE_ID, vioAttribution, type VioAttribution } from "./vio-helpers";
import {
  KONDOMERIET_NAME,
  activeDiscount,
  initialOptionIndex,
  isSoldOut,
  openKondomerietDetail,
  useMinuteClock,
  type HurtigkasseTarget,
  type ResolvedGroup,
} from "./kondomeriet-helpers";
import { buyWithHurtigkasse, trackOpenInfo, trackOptionSelect } from "./kondomeriet-track";
import { KondomerietDetailHost } from "./kondomeriet-detail";
import { OptionSelector, PriceRow, VippsWordmarkButton, injectKondomerietStyles, plainText } from "./kondomeriet-ui";

/**
 * The Kondomeriet card: ONE card for a product group — several Vio products
 * (one per colour / model / size) behind a selector, each with its own photo,
 * price, stock and Hurtigkasse slug. It wears the Vio card's look (the same
 * `.vio-native-card` styles and editable CSS, injected by card-view.tsx) plus
 * a few `knd-` rules: the selector, the struck-through old price and the two
 * buttons — "Kjøp med Vipps" (the shop's Hurtigkasse, never Vio's cart) and
 * "Se produktinfo" (the Kondomeriet detail drawer).
 */

export type KondomerietCardConfig = {
  layout?: string; // standard | horizontal
  accentColor?: string;
  showBrand?: boolean;
  showName?: boolean;
  showPrice?: boolean;
  showRetailer?: boolean;
  showDescription?: boolean;
  descriptionText?: string;
  annonse?: boolean;
  annonseText?: string;
  /** "Farge", "Modell", "Størrelse" — the selector's heading; empty: none. */
  optionTitle?: string;
  selectorStyle?: string; // pills | thumbs | dropdown
  vippsLabel?: string;
  infoButton?: boolean;
  infoLabel?: string;
  hurtigkasseTarget?: HurtigkasseTarget;
};

type CardViewProps = {
  group: ResolvedGroup | null;
  loading?: boolean;
  /** Ids were picked but none came back from the channel. */
  unavailable?: boolean;
  config?: KondomerietCardConfig;
  sponsorId: number | null;
  slot?: string;
  componentTemplateId?: string;
  standalone?: boolean;
  rootRef?: React.Ref<HTMLDivElement>;
};

export function KondomerietCardView({
  group,
  loading,
  unavailable,
  config = {},
  sponsorId,
  slot,
  componentTemplateId = COMPONENT_TEMPLATE_ID.card,
  standalone = false,
  rootRef,
}: CardViewProps) {
  const { disabled: editor } = useEditorState();
  const {
    layout = "standard",
    accentColor,
    showBrand = true,
    showName = true,
    showPrice = true,
    showRetailer = false,
    showDescription = false,
    descriptionText = "",
    annonse = false,
    annonseText = "Annonse",
    optionTitle = "",
    selectorStyle = "pills",
    vippsLabel = "Kjøp med",
    infoButton = true,
    infoLabel = "Se produktinfo",
    hurtigkasseTarget = "_blank",
  } = config;

  useEffect(() => {
    injectKondomerietStyles();
  }, []);

  // The option on screen: the first in stock when the group (re)loads.
  const groupKey = group?.key ?? "";
  const [index, setIndex] = useState(() => (group ? initialOptionIndex(group.options) : 0));
  useEffect(() => {
    setIndex(group ? initialOptionIndex(group.options) : 0);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [groupKey]);

  const hasDates = !!(group?.group.discountStart || group?.group.discountEnd);
  const now = useMinuteClock(hasDates);
  const badge = group ? activeDiscount(group.group, now) : null;

  const localRef = useRef<HTMLDivElement | null>(null);
  const setRoot = (el: HTMLDivElement | null) => {
    localRef.current = el;
    if (typeof rootRef === "function") rootRef(el);
    else if (rootRef) (rootRef as React.MutableRefObject<HTMLDivElement | null>).current = el;
  };

  const layoutClass = layout === "horizontal" ? "horizontal" : "standard";
  const rootClass = `vio-native-card knd-card l-${layoutClass}${standalone ? " vnc-standalone" : ""}`;
  const accentStyle = accentColor ? ({ ["--vnc-accent" as any]: accentColor } as React.CSSProperties) : undefined;

  if (loading) {
    return (
      <div className={rootClass} style={accentStyle} aria-busy="true">
        <div className="vnc-image">
          <div className="vnc-skel" style={{ position: "absolute", inset: 0 }} />
        </div>
        <div className="vnc-meta">
          <div className="vnc-skel" style={{ height: 10, width: "40%", marginBottom: 8 }} />
          <div className="vnc-skel" style={{ height: 16, width: "85%", marginBottom: 10 }} />
          <div className="vnc-skel" style={{ height: 16, width: "30%" }} />
        </div>
      </div>
    );
  }

  if (!group) {
    return (
      <div className={rootClass} style={accentStyle}>
        <div className="vnc-image vnc-unavailable" role="img" aria-label="Kunne ikke laste produkt">
          <span>{unavailable ? "Utilgjengelig" : "Velg produkter"}</span>
        </div>
      </div>
    );
  }

  const safeIndex = Math.min(Math.max(0, index), group.options.length - 1);
  const option = group.options[safeIndex];
  const p = option.product;
  const img = primaryImageUrl(p) ?? "";
  const soldOut = isSoldOut(p);
  const canBuy = !!option.slug && !soldOut;
  const ownDescription = descriptionText.trim();
  const description = ownDescription || (showDescription ? plainText(p?.description).replace(/\n+/g, " ") : "");
  const attribution = (): VioAttribution => vioAttribution(slot, sponsorId, componentTemplateId);

  const select = (i: number) => {
    if (i === safeIndex) return;
    setIndex(i);
    trackOptionSelect(group.options[i], attribution(), sponsorId, "card");
  };

  const openInfo = () => {
    const attr = attribution();
    trackOpenInfo(option, attr, sponsorId, infoLabel);
    openKondomerietDetail({
      group,
      index: safeIndex,
      optionTitle,
      vippsLabel,
      target: hurtigkasseTarget,
      badge,
      accentColor,
      attribution: attr,
      sponsorId,
      onSelect: (i) => setIndex(i),
    });
  };

  const buy = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!canBuy) return;
    buyWithHurtigkasse(option, {
      attribution: attribution(),
      sponsorId,
      where: "card",
      label: `${vippsLabel} Vipps`,
      target: hurtigkasseTarget,
      editor,
    });
  };

  return (
    <div ref={setRoot} className={rootClass} style={accentStyle}>
      <div
        className="vnc-image"
        role="button"
        tabIndex={0}
        aria-label={`${group.title} ${option.label} – ${infoLabel}`}
        onClick={openInfo}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            openInfo();
          }
        }}
      >
        {img ? <img src={img} alt={`${group.title} ${group.options.length > 1 ? option.label : ""}`.trim()} loading="lazy" /> : null}
        {badge ? <span className="vnc-badge">{badge}</span> : null}
        {annonse ? <span className="vnc-annonse">{annonseText}</span> : null}
      </div>

      <div className="vnc-body">
        <div className="vnc-meta">
          {showBrand ? <div className="vnc-brand">{group.brand || " "}</div> : null}
          {showName && group.title ? <div className="vnc-name">{group.title}</div> : null}
          {description ? <p className="vnc-description">{description}</p> : null}
          <OptionSelector group={group} index={safeIndex} onSelect={select} style={selectorStyle} title={optionTitle} />
          {showPrice ? <PriceRow product={p} /> : null}
          {showRetailer ? <div className="vnc-retailer">{KONDOMERIET_NAME}</div> : null}
        </div>
        <VippsWordmarkButton
          label={vippsLabel}
          soldOut={soldOut}
          disabled={!canBuy}
          title={option.slug ? undefined : "Mangler Hurtigkasse-lenke for dette produktet"}
          onClick={buy}
        />
        {editor && !option.slug ? (
          <div className="knd-editor-note">
            Editor: «{option.label}» has no kondomeriet.no URL — set its Hurtigkasse slug in the group's Details.
          </div>
        ) : null}
        {infoButton ? (
          <button
            type="button"
            className="knd-btn-info"
            onClick={(e) => {
              e.stopPropagation();
              openInfo();
            }}
          >
            {infoLabel}
          </button>
        ) : null}
      </div>
      {/* The drawer, mounted once per page by whichever block gets there first. */}
      {!editor ? <KondomerietDetailHost /> : null}
    </div>
  );
}
