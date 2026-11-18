import React, { useEffect, useRef, useState } from "react";
import { useEditorState } from "@vev/react";
import { ensureVippsButton, primaryImageUrl, vippsButtonAttributes } from "../../vio-sdk";
import { COMPONENT_TEMPLATE_ID, getProductPriceAmount, vioAttribution, type VioAttribution } from "./vio-helpers";
import { CUT_BY_FRAME_NOTICE, EditorNotices, useCutByFrame } from "./editor-fit";
import {
  KONDOMERIET_NAME,
  compareAtAmount,
  directBadgeFrom,
  perksFrom,
  initialOptionIndex,
  isSoldOut,
  openKondomerietDetail,
  useMinuteClock,
  type HurtigkasseTarget,
  type ResolvedGroup,
} from "./kondomeriet-helpers";
import { buyWithHurtigkasse, trackOpenInfo, trackOptionSelect } from "./kondomeriet-track";
import { KondomerietDetailHost } from "./kondomeriet-detail";
import { OptionSelector, cardBadge, cardPrice, classRef, injectKondomerietStyles, plainText } from "./kondomeriet-ui";

/**
 * The Kondomeriet card: ONE card for a product group — several Vio products
 * (one per colour / model / size) behind a selector. It is drawn exactly like
 * the Vio Product Card (`ProductCardView` in card-view.tsx): the same markup,
 * classes, layouts (standard / image only / info over image / horizontal),
 * badge, «Annonse», price, Vipps button (Vipps' own web component when it
 * loads, the orange bar otherwise) and bar / pill button, so the editable CSS
 * and the accent colour act the same. What differs: the option selector, the
 * Vipps button posts kondomeriet.no's Hurtigkasse (never Vio's cart), and the
 * card's button opens the product info.
 */

export type KondomerietCardConfig = {
  layout?: string; // standard | image-only | overlay | horizontal (the Vio card's)
  accentColor?: string;
  showBrand?: boolean;
  showName?: boolean;
  showPrice?: boolean;
  showRetailer?: boolean;
  showDescription?: boolean;
  descriptionText?: string;
  annonse?: boolean;
  annonseText?: string;
  /** "Farge", "Modell", "Størrelse" — before the chosen option; empty: just the option. */
  optionTitle?: string;
  selectorStyle?: string; // pills | thumbs | dropdown
  vippsLabel?: string;
  infoButton?: boolean;
  /** The Vio card's button styles for the product-info button: bar | text (pill on the image). */
  infoButtonStyle?: string;
  infoLabel?: string;
  hurtigkasseTarget?: HurtigkasseTarget;
  /** «Kjøp direkte fra artikkelen» in the product info (and on the card with directBadgeOnCard); '' = off. */
  directBadge?: string;
  directBadgeOnCard?: boolean;
  /** The shop's promises in the product info, one per line; '' = none. */
  perks?: string;
  /** The product info's stock line when in stock. */
  stockText?: string;
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
    infoButtonStyle = "bar",
    infoLabel = "Se produktinfo",
    hurtigkasseTarget = "_blank",
    directBadgeOnCard = false,
  } = config;
  const directBadge = directBadgeFrom(config.directBadge);

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

  const localRef = useRef<HTMLDivElement | null>(null);
  const setRoot = (el: HTMLDivElement | null) => {
    localRef.current = el;
    if (typeof rootRef === "function") rootRef(el);
    else if (rootRef) (rootRef as React.MutableRefObject<HTMLDivElement | null>).current = el;
  };
  // Vipps' own button wraps below 220px; its compact form keeps one line (as the Vio card).
  const [narrow, setNarrow] = useState(false);
  useEffect(() => {
    const el = localRef.current;
    if (!el || typeof ResizeObserver === "undefined") return;
    const ro = new ResizeObserver(() => setNarrow(el.getBoundingClientRect().width < 220));
    ro.observe(el);
    return () => ro.disconnect();
  }, [groupKey, loading]);
  const [vippsOfficial, setVippsOfficial] = useState(false);
  useEffect(() => {
    let cancelled = false;
    ensureVippsButton().then((ok: boolean) => {
      if (!cancelled) setVippsOfficial(ok);
    });
    return () => {
      cancelled = true;
    };
  }, []);
  const cutByFrame = useCutByFrame(localRef, standalone, group);

  const rootClass = `vio-native-card knd-card l-${layout}${standalone ? " vnc-standalone" : ""}`;
  const accentStyle = accentColor ? ({ ["--vnc-accent" as any]: accentColor } as React.CSSProperties) : undefined;
  const isImageOnly = layout === "image-only";
  const isOverlay = layout === "overlay";
  const showMeta = !isImageOnly && !isOverlay;

  if (loading) {
    return (
      <div className={rootClass} style={accentStyle} aria-busy="true">
        <div className="vnc-image">
          <div className="vnc-skel" style={{ position: "absolute", inset: 0 }} />
        </div>
        {showMeta ? (
          <div className="vnc-meta">
            <div className="vnc-skel" style={{ height: 10, width: "40%", marginBottom: 8 }} />
            <div className="vnc-skel" style={{ height: 16, width: "85%", marginBottom: 10 }} />
            <div className="vnc-skel" style={{ height: 16, width: "30%" }} />
          </div>
        ) : null}
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
  const amount = getProductPriceAmount(p);
  const price = cardPrice(amount, p);
  const was = compareAtAmount(p);
  const badge = cardBadge(group.group, p, now);
  const brand = group.brand;
  const name = group.title;
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
      badge: cardBadge(group.group, p),
      accentColor,
      directBadge,
      perks: perksFrom(config.perks),
      stockText: config.stockText,
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

  const onInfoButton = (e: React.MouseEvent) => {
    e.stopPropagation();
    openInfo();
  };

  // The Vio card's Vipps button: Vipps' own when it loads, the orange bar otherwise.
  // Sold out / no Hurtigkasse: the bar, disabled.
  const vippsEl = !canBuy ? (
    <button
      type="button"
      className="vnc-btn-vipps"
      disabled
      onClick={(e) => e.stopPropagation()}
      title={soldOut ? undefined : "Mangler Hurtigkasse-lenke for dette produktet"}
    >
      {soldOut ? <span>Utsolgt</span> : (
        <>
          {narrow ? null : <span>{vippsLabel}</span>}
          <span className="vnc-vipps-badge">vipps</span>
        </>
      )}
    </button>
  ) : vippsOfficial ? (
    React.createElement("vipps-mobilepay-button", {
      ...vippsButtonAttributes("buy", { compact: narrow }),
      ref: classRef("vnc-btn-vipps-official"),
      role: "button",
      "aria-label": `${vippsLabel} Vipps`,
      onClick: buy,
    } as any)
  ) : (
    <button type="button" className="vnc-btn-vipps" onClick={buy} aria-label={`${vippsLabel} Vipps`}>
      {narrow ? null : <span>{vippsLabel}</span>}
      <span className="vnc-vipps-badge">vipps</span>
    </button>
  );

  const selector = (
    <OptionSelector group={group} index={safeIndex} onSelect={select} style={selectorStyle} title={optionTitle} />
  );
  const priceEl =
    showPrice && price ? (
      <div className="vnc-price">
        {price}
        {was != null ? <span className="knd-was">{cardPrice(was, p)}</span> : null}
      </div>
    ) : null;

  // The Vio card's meta: brand, name, description, (selector), price, Vipps, retailer.
  const metaBlock = (inBody: boolean) => (
    <>
      {inBody && directBadgeOnCard && directBadge ? <span className="knd-direct-badge">{directBadge}</span> : null}
      {showBrand && (brand || inBody) ? <div className="vnc-brand">{brand || " "}</div> : null}
      {showName && name ? <div className="vnc-name">{name}</div> : null}
      {inBody && description ? <p className="vnc-description">{description}</p> : null}
      {inBody ? selector : null}
      {priceEl}
      {inBody ? vippsEl : null}
      {showRetailer ? <div className="vnc-retailer">{KONDOMERIET_NAME}</div> : null}
    </>
  );

  return (
    <div ref={setRoot} className={rootClass} style={accentStyle}>
      <EditorNotices notices={cutByFrame ? [CUT_BY_FRAME_NOTICE] : []} />
      <div
        className="vnc-image"
        role="button"
        tabIndex={0}
        aria-label={`${brand} ${name} ${price} – ${infoLabel}`}
        onClick={openInfo}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            openInfo();
          }
        }}
      >
        {img ? <img src={img} alt={`${name} ${group.options.length > 1 ? option.label : ""}`.trim()} loading="lazy" /> : null}
        {badge ? <span className="vnc-badge">{badge}</span> : null}
        {annonse ? <span className="vnc-annonse">{annonseText}</span> : null}
        {infoButton && infoButtonStyle === "text" ? (
          <button type="button" className="vnc-btn-text vnc-btn-pill" onClick={onInfoButton}>
            {infoLabel}
          </button>
        ) : null}
        {isOverlay ? <div className="vnc-overlay-meta">{metaBlock(false)}</div> : null}
      </div>

      <div className="vnc-body">
        {showMeta ? (
          <div className="vnc-meta">{metaBlock(true)}</div>
        ) : (
          <>
            {group.options.length > 1 ? <div style={{ marginTop: 12 }}>{selector}</div> : null}
            {vippsEl}
          </>
        )}
        {editor && !option.slug ? (
          <div className="vnc-retailer" style={{ color: "#b42318", textTransform: "none", letterSpacing: 0, marginTop: 6 }}>
            Editor: «{option.label}» has no kondomeriet.no URL — set its Hurtigkasse slug in the group's Details.
          </div>
        ) : null}
        {infoButton && infoButtonStyle !== "text" ? (
          <button type="button" className="vnc-btn-text vnc-btn-bar" onClick={onInfoButton}>
            {infoLabel}
          </button>
        ) : null}
      </div>
      {/* The drawer, mounted once per page by whichever block gets there first. */}
      {!editor ? <KondomerietDetailHost /> : null}
    </div>
  );
}
