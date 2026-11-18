import React, { useEffect, useRef, useState } from "react";
import { useEditorState } from "@vev/react";
import { primaryImageUrl, vippsButtonAttributes } from "../../vio-sdk";
import { COMPONENT_TEMPLATE_ID, getProductPriceAmount, vioAttribution, type VioAttribution } from "./vio-helpers";
import { CUT_BY_FRAME_NOTICE, EditorNotices, useCutByFrame } from "./editor-fit";
import {
  DEFAULT_VIPPS_NOTE,
  KONDOMERIET_NAME,
  brandIdentityOrCached,
  cardRating,
  circlewiseFor,
  trustLineFor,
  offerEndText,
  resolveBuyOnCard,
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
import { directImage, ensurePreconnect, inAppBrowser, preconnectCirclewise, useVippsButton } from "./kondomeriet-perf";

// The hosts a card needs, as soon as the package loads.
ensurePreconnect();
import { SEE_MORE_CTA, buyWithHurtigkasse, trackOpenInfo, trackOptionSelect } from "./kondomeriet-track";
import { KondomerietDetailHost } from "./kondomeriet-detail";
import { OptionSelector, SellerLogo, badgeFor, cardPrice, classRef, injectKondomerietStyles, plainText } from "./kondomeriet-ui";

const InfoIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round">
    <circle cx="12" cy="12" r="9" />
    <line x1="12" y1="11" x2="12" y2="16.5" />
    <circle cx="12" cy="7.8" r="0.6" fill="currentColor" />
  </svg>
);

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
  /** «Du handler direkte hos <brand>» with the brand's logo (default on). */
  showSeller?: boolean;
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
  /** A short line of the shop's promises; undefined = the brand's promises (short titles), else the default. */
  trustLine?: string;
  showTrustLine?: boolean;
  /** «★ 5/5 (792)» from the rating line of the description. */
  showRating?: boolean;
  /** Under the Vipps button, when the Hurtigkasse opens in a new tab / in the same window. */
  vippsNote?: string;
  vippsNoteSameWindow?: string;
  /** The block's Circlewise tracking link (the sheet's); a card's own (Details) wins. */
  trackingLink?: string;
  /** «Tilbudet gjelder til …»: the block's offer end (`datetime-local`) and its text (`{dato}`). */
  offerEnd?: string;
  offerEndText?: string;
  /** «Kjøp direkte fra artikkelen» in the product info (and on the card with directBadgeOnCard); '' = off. */
  directBadge?: string;
  directBadgeOnCard?: boolean;
  /** The shop's promises in the product info, one per line; '' = none. */
  perks?: string;
  /** The product info's stock line when in stock. */
  stockText?: string;
  /** In the product info, the editor's image alone (true) or first and then the product's (false). */
  infoImageOnly?: boolean;
  /** The Vio card's «Discount badge»: auto (the group's text in its dates, else the sale %) | manual (discountText) | off. */
  discountMode?: string;
  discountText?: string;
  /** The Vio card's «Vipps Express button», here the Hurtigkasse: bar | hidden. */
  vippsButton?: string;
  /** Where the card sells: auto (default) | always | never — see `BuyOnCard`. Replaces `vippsButton`. */
  buyOnCard?: string;
  /** The main CTA of a card that sends to the product info. */
  moreLabel?: string;
  /** The Vio card's «Image click»: info (product info) | vipps (Kjøp med Vipps). */
  imageClickAction?: string;
  /** The editor's own texts: a line under the name, a label on the photo, a footer. */
  subtitle?: string;
  tagText?: string;
  footerText?: string;
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
  /** The editor's picture for this card (Vev image prop), in place of the product's. */
  imageOverride?: string;
  /** One of the first cards on screen: its image loads eagerly, with high priority. */
  priority?: boolean;
  /**
   * While loading: what is known of the group before its products (how many
   * options, its own «buy on card»), so the skeleton takes the card's real
   * height — the same button (Vipps or «Se mer») and lines.
   */
  pending?: { options: number; buyOnCard?: unknown; offerEnd?: string };
  /** Editor-only notices from the block (e.g. a missing snapshot), with the card's own. */
  editorNotices?: string[];
};

/** The card sells itself (Vipps or the disabled bar) rather than sending to the product info: the Auto/Always/Never rule. */
function buysOnCard(group: ResolvedGroup, blockValue: unknown, legacyVippsButton: unknown): boolean {
  const mode = resolveBuyOnCard(group.group.buyOnCard, blockValue, legacyVippsButton);
  return mode === "always" || (mode === "auto" && group.options.length <= 1);
}

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
  imageOverride,
  priority = false,
  pending,
  editorNotices = [],
}: CardViewProps) {
  const { disabled: editor } = useEditorState();
  const {
    layout = "standard",
    accentColor,
    showBrand = true,
    showName = true,
    showPrice = true,
    showRetailer = false,
    showSeller = true,
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
    infoImageOnly = false,
    discountMode = "auto",
    discountText = "",
    vippsButton = "bar",
    moreLabel = "Se mer",
    imageClickAction = "info",
    subtitle = "",
    tagText = "",
    footerText = "",
    showTrustLine = true,
    showRating = true,
    vippsNote = DEFAULT_VIPPS_NOTE,
    vippsNoteSameWindow = "",
  } = config;
  const directBadge = directBadgeFrom(config.directBadge);

  // The styles go in while rendering, not in an effect: a card must never
  // paint before its CSS (the snapshot paints at once).
  injectKondomerietStyles();

  // The option on screen: the first in stock when the group (re)loads.
  const groupKey = group?.key ?? "";
  const [index, setIndex] = useState(() => (group ? initialOptionIndex(group.options) : 0));
  useEffect(() => {
    setIndex(group ? initialOptionIndex(group.options) : 0);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [groupKey]);

  const hasDates = !!(group?.group.discountStart || group?.group.discountEnd || group?.group.offerEnd || config.offerEnd);
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
  // Vipps' own button only when this card has one to show (see useVippsButton).
  const wantsVipps =
    !!group && buysOnCard(group, config.buyOnCard, vippsButton) && group.options.some((o) => !!o.slug && !isSoldOut(o.product));
  const vippsOfficial = useVippsButton(localRef, wantsVipps && !loading);
  const cutByFrame = useCutByFrame(localRef, standalone, group);

  const rootClass = `vio-native-card knd-card l-${layout}${standalone ? " vnc-standalone" : ""}`;
  const accentStyle = accentColor ? ({ ["--vnc-accent" as any]: accentColor } as React.CSSProperties) : undefined;
  const isImageOnly = layout === "image-only";
  const isOverlay = layout === "overlay";
  const showMeta = !isImageOnly && !isOverlay;

  if (loading) {
    // The card's own shape with grey lines in place of the product: the same
    // classes (so the same heights — brand line, two-line name, price, the
    // button at Vipps' height for its width, note, trust and seller lines,
    // the info bar), so the products arriving move nothing (CLS) even when
    // the block has no snapshot.
    const pMode = resolveBuyOnCard(pending?.buyOnCard, config.buyOnCard, vippsButton);
    const pBuy = pMode === "always" || (pMode === "auto" && (pending?.options ?? 1) <= 1);
    const pIdentity = brandIdentityOrCached(sponsorId);
    const pTarget: HurtigkasseTarget = inAppBrowser() ? "_top" : hurtigkasseTarget;
    const pNote = (pTarget === "_blank" ? vippsNote : vippsNoteSameWindow).trim();
    const pTrust = showTrustLine ? trustLineFor(config.trustLine, pIdentity) : "";
    const pSeller = pIdentity?.name?.trim() || KONDOMERIET_NAME;
    const pOffer = offerEndText(pending?.offerEnd || config.offerEnd, config.offerEndText, now);
    const line = (width: string) => <span className="vnc-skel knd-skel-line" style={{ width }} />;
    const pButton = pBuy ? (
      <div className="vnc-btn-vipps knd-skel-block" aria-hidden="true" />
    ) : (
      <div className="vnc-btn-text vnc-btn-bar knd-more knd-skel-block" aria-hidden="true">
        {moreLabel}
      </div>
    );
    const pMeta = (
      <>
        {directBadgeOnCard && directBadge ? <span className="knd-direct-badge">{directBadge}</span> : null}
        {showBrand ? <div className="vnc-brand">{line("40%")}</div> : null}
        {showName ? <div className="vnc-name">{line("85%")}</div> : null}
        {subtitle.trim() ? <div className="knd-subtitle">{subtitle.trim()}</div> : null}
        {descriptionText.trim() ? <p className="vnc-description">{descriptionText.trim()}</p> : null}
        {showPrice ? <div className="vnc-price">{line("35%")}</div> : null}
        {pOffer ? <div className="knd-offer-end">{pOffer}</div> : null}
        {pButton}
        {pBuy && pNote ? <div className="knd-vipps-note">{pNote}</div> : null}
        {pTrust ? <div className="knd-trust">{pTrust}</div> : null}
        {showRetailer ? <div className="vnc-retailer">{KONDOMERIET_NAME}</div> : null}
        {showSeller ? (
          <div className="knd-seller">
            {pIdentity?.logoUrl ? (
              <SellerLogo src={pIdentity.logoUrl} name={pSeller} className="knd-seller-logo" />
            ) : (
              // The brand's logo comes with the bootstrap: its place is kept (on a narrow card it takes its own line).
              <span className="vnc-skel knd-skel-logo" aria-hidden="true" />
            )}
            <span>
              Du handler direkte hos <strong>{pSeller}</strong>
            </span>
          </div>
        ) : null}
      </>
    );
    return (
      // The SAME root element as the card's (no key of its own): Vev's editor
      // follows the block's first element from its mount to size an «H auto»
      // frame, and a root swapped when the products arrive left it measuring a
      // detached node — a 0 px frame (seen on the Kondomeriet package). Only the
      // children are keyed apart, so no node of the skeleton is reused as
      // another element of the card (that counted as a layout shift).
      <div ref={setRoot} className={rootClass} style={accentStyle} aria-busy="true">
        <EditorNotices notices={editorNotices} />
        <div key="skel-image" className="vnc-image">
          <div className="vnc-skel" style={{ position: "absolute", inset: 0 }} />
        </div>
        <div key="skel-body" className="vnc-body">
          {showMeta ? <div className="vnc-meta">{pMeta}</div> : pButton}
          {pBuy && infoButton && infoButtonStyle === "bar" ? (
            <div className="vnc-btn-text vnc-btn-bar knd-skel-block" aria-hidden="true">
              {infoLabel}
            </div>
          ) : null}
          {footerText.trim() ? <div className="knd-footer">{footerText.trim()}</div> : null}
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
  // The CDN's 500 px file directly (no redirects): enough for a card and
  // lighter than the 1024 px one when the shop's original is big; the
  // product info keeps the large one.
  // The editor's own picture as it is.
  const image = imageOverride ? { src: imageOverride, fallback: imageOverride } : directImage(primaryImageUrl(p), "medium");
  const img = image.src;
  const soldOut = isSoldOut(p);
  const canBuy = !!option.slug && !soldOut;
  // Buy here, or send to the product info (Angelo's conversion default).
  const multi = group.options.length > 1;
  const buyHere = buysOnCard(group, config.buyOnCard, vippsButton);
  // A «Se mer» card with options: «Fra <lowest>» when the options cost
  // differently (the Vio card's «Fra» for products with variants), else the price.
  const priced = group.options.filter((o) => getProductPriceAmount(o.product) != null);
  const inStock = priced.filter((o) => !isSoldOut(o.product));
  const amounts = (inStock.length ? inStock : priced).map((o) => getProductPriceAmount(o.product) as number);
  const fromPrice = !buyHere && multi && new Set(amounts).size > 1 ? Math.min(...amounts) : null;
  const amount = fromPrice ?? getProductPriceAmount(p);
  const price = fromPrice != null ? `Fra ${cardPrice(fromPrice, p)}` : cardPrice(amount, p);
  const was = fromPrice != null ? null : compareAtAmount(p);
  const badge = badgeFor(discountMode, discountText, group.group, p, now);
  const brand = group.brand;
  // The seller (the bootstrap's sponsor): its logo and name, as the SDK detail names it.
  const identity = brandIdentityOrCached(sponsorId);
  // In an app's browser the Hurtigkasse opens in the same window (a new tab fails or opens badly there).
  const browser = inAppBrowser();
  const target: HurtigkasseTarget = browser ? "_top" : hurtigkasseTarget;
  const note = (target === "_blank" ? vippsNote : vippsNoteSameWindow).trim();
  const trust = showTrustLine ? trustLineFor(config.trustLine, identity) : "";
  const rating = showRating ? cardRating(p?.description) : null;
  const offer = offerEndText(group.group.offerEnd || config.offerEnd, config.offerEndText, now);
  // Circlewise: the card's own link, else the block's; an invalid one is said in the editor and ignored.
  // Circlewise: the card's own link, else the block's, else (on by default)
  // the Config's a / i with this card's ref1 from the sheet.
  const cw = circlewiseFor(group, group.group.tracking || config.trackingLink, option);
  const sellerName = identity?.name?.trim() || KONDOMERIET_NAME;
  const name = group.title;
  const ownDescription = descriptionText.trim();
  const description = ownDescription || (showDescription ? plainText(p?.description).replace(/\n+/g, " ") : "");
  const attribution = (): VioAttribution => vioAttribution(slot, sponsorId, componentTemplateId);

  const select = (i: number) => {
    if (i === safeIndex) return;
    setIndex(i);
    trackOptionSelect(group.options[i], attribution(), sponsorId, "card");
  };

  const openInfo = (cta: "open" | "see_more" = "open", label = infoLabel) => {
    const attr = attribution();
    trackOpenInfo(option, attr, sponsorId, label, cta);
    openKondomerietDetail({
      group,
      index: safeIndex,
      optionTitle,
      vippsLabel,
      target,
      vippsNote: note,
      offerText: offer,
      tracking: cw.link,
      trackingAuto: cw.source === "auto",
      badge,
      discountMode,
      discountText,
      leadImage: imageOverride || undefined,
      leadImageOnly: !!imageOverride && infoImageOnly,
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
      target,
      inAppBrowser: browser,
      tracking: cw.link,
      editor,
    });
  };

  // The finger is on «Kjøp med Vipps»: re-warm the tracker's connection (its TLS may have expired).
  const warmTracker = () => {
    if (cw.link) preconnectCirclewise(true);
  };

  const onInfoButton = (e: React.MouseEvent) => {
    e.stopPropagation();
    openInfo();
  };
  const onMore = (e: React.MouseEvent) => {
    e.stopPropagation();
    openInfo(SEE_MORE_CTA, moreLabel);
  };
  // «Image click»: the product info (default), or Kjøp med Vipps when the option can be bought.
  const onImage = () => {
    if (imageClickAction === "vipps" && canBuy && buyHere) {
      buyWithHurtigkasse(option, { attribution: attribution(), sponsorId, where: "card", label: "image", target, inAppBrowser: browser, tracking: cw.link, editor });
      return;
    }
    openInfo();
  };

  // The Vio card's Vipps button: Vipps' own when it loads, the orange bar otherwise.
  // Sold out / no Hurtigkasse: the bar, disabled.
  // A «Se mer» card: no Vipps, its main CTA is «Se mer» (the SDK's bar) in Vipps' place.
  const moreEl = (
    <button type="button" className="vnc-btn-text vnc-btn-bar knd-more" onClick={onMore}>
      {moreLabel}
    </button>
  );
  const vippsEl = !buyHere ? moreEl : !canBuy ? (
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
      onPointerDown: warmTracker,
      onTouchStart: warmTracker,
    } as any)
  ) : (
    <button
      type="button"
      className="vnc-btn-vipps"
      onClick={buy}
      onPointerDown={warmTracker}
      onTouchStart={warmTracker}
      aria-label={`${vippsLabel} Vipps`}
    >
      {narrow ? null : <span>{vippsLabel}</span>}
      <span className="vnc-vipps-badge">vipps</span>
    </button>
  );

  const selector = (
    <OptionSelector group={group} index={safeIndex} onSelect={select} style={selectorStyle} title={optionTitle} />
  );
  // The sale price big; with a real compare-at, the old price struck through beside it (the badge says the %).
  const priceEl =
    showPrice && price ? (
      <div className={was != null ? "vnc-price knd-on-sale" : "vnc-price"}>
        <span className="knd-now">{price}</span>
        {was != null ? <span className="knd-was">{cardPrice(was, p)}</span> : null}
      </div>
    ) : null;

  // The Vio card's meta: brand, name, description, (selector), price, Vipps, retailer.
  const metaBlock = (inBody: boolean) => (
    <>
      {inBody && directBadgeOnCard && directBadge ? <span className="knd-direct-badge">{directBadge}</span> : null}
      {showBrand && (brand || inBody) ? <div className="vnc-brand">{brand || " "}</div> : null}
      {showName && name ? <div className="vnc-name">{name}</div> : null}
      {rating ? (
        <div className="knd-rating" aria-label={`Vurdering ${rating.score}${rating.count ? `, ${rating.count} anmeldelser` : ""}`}>
          <span className="knd-rating-stars">★ {rating.score}</span>
          {rating.count ? <span className="knd-rating-count"> ({rating.count})</span> : null}
        </div>
      ) : null}
      {subtitle.trim() ? <div className="knd-subtitle">{subtitle.trim()}</div> : null}
      {inBody && description ? <p className="vnc-description">{description}</p> : null}
      {inBody && buyHere ? selector : null}
      {priceEl}
      {offer ? <div className="knd-offer-end">{offer}</div> : null}
      {inBody ? vippsEl : null}
      {inBody && buyHere && canBuy && note ? <div className="knd-vipps-note">{note}</div> : null}
      {inBody && trust ? <div className="knd-trust">{trust}</div> : null}
      {showRetailer ? <div className="vnc-retailer">{KONDOMERIET_NAME}</div> : null}
      {sellerEl}
    </>
  );

  const editorWarnings = (
    <>
      {editor && cw.error ? (
        <div className="vnc-retailer" style={{ color: "#b42318", textTransform: "none", letterSpacing: 0, marginTop: 6 }}>
          Editor: tracking link ignored — {cw.error}.{" "}
          {cw.link ? `Circlewise uses the default (ref1 ${cw.link.ref1}).` : "«Kjøp med Vipps» goes direct to the Hurtigkasse."}
        </div>
      ) : null}
      {editor && buyHere && !option.slug ? (
        <div className="vnc-retailer" style={{ color: "#b42318", textTransform: "none", letterSpacing: 0, marginTop: 6 }}>
          Editor: «{option.label}» has no kondomeriet.no URL — set its Hurtigkasse slug in the group's Details.
        </div>
      ) : null}
    </>
  );
  const sellerEl = showSeller ? (
    <div className="knd-seller">
      {identity?.logoUrl ? <SellerLogo src={identity.logoUrl} name={sellerName} className="knd-seller-logo" /> : null}
      <span>
        Du handler direkte hos <strong>{sellerName}</strong>
      </span>
    </div>
  ) : null;
  const imageKeys = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      onImage();
    }
  };
  const imgEl = img ? (
    <img
      src={img}
      alt={`${name} ${group.options.length > 1 ? option.label : ""}`.trim()}
      // The box is square (.vnc-image, aspect-ratio 1/1): the size only states the ratio — no layout shift.
      width={500}
      height={500}
      decoding="async"
      loading={priority ? "eager" : "lazy"}
      {...({ fetchpriority: priority ? "high" : "auto" } as any)}
      onError={(e) => {
        const el = e.currentTarget;
        if (image.fallback && el.src !== image.fallback) el.src = image.fallback;
      }}
    />
  ) : null;

  return (
    <div ref={setRoot} className={rootClass} style={accentStyle}>
      <EditorNotices notices={cutByFrame ? [CUT_BY_FRAME_NOTICE, ...editorNotices] : editorNotices} />
      <div
        key="image"
        className="vnc-image"
        role="button"
        tabIndex={0}
        aria-label={`${brand} ${name} ${price} – ${infoLabel}`}
        onClick={onImage}
        onKeyDown={imageKeys}
      >
        {imgEl}
        {badge ? <span className="vnc-badge">{badge}</span> : null}
        {annonse ? <span className="vnc-annonse">{annonseText}</span> : null}
        {tagText.trim() ? <span className="knd-tag">{tagText.trim()}</span> : null}
        {buyHere && infoButton && infoButtonStyle === "icon" ? (
          <button type="button" className="vnc-add knd-info-icon" onClick={onInfoButton} aria-label={infoLabel} title={infoLabel}>
            <InfoIcon />
          </button>
        ) : null}
        {buyHere && infoButton && infoButtonStyle === "text" ? (
          <button type="button" className="vnc-btn-text vnc-btn-pill" onClick={onInfoButton}>
            {infoLabel}
          </button>
        ) : null}
        {isOverlay ? <div className="vnc-overlay-meta">{metaBlock(false)}</div> : null}
      </div>

      <div key="body" className="vnc-body">
        {showMeta ? (
          <div className="vnc-meta">{metaBlock(true)}</div>
        ) : (
          <>
            {buyHere && multi ? <div style={{ marginTop: 12 }}>{selector}</div> : null}
            {vippsEl}
          </>
        )}
        {editorWarnings}
        {buyHere && infoButton && infoButtonStyle === "bar" ? (
          <button type="button" className="vnc-btn-text vnc-btn-bar" onClick={onInfoButton}>
            {infoLabel}
          </button>
        ) : null}
        {footerText.trim() ? <div className="knd-footer">{footerText.trim()}</div> : null}
      </div>
      {/* The drawer, mounted once per page by whichever block gets there first. */}
      {!editor ? <KondomerietDetailHost /> : null}
    </div>
  );
}
