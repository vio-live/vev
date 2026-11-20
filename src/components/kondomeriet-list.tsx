import React, { useEffect, useLayoutEffect, useRef, useState } from "react";
import { KondomerietCardView } from "./kondomeriet-card-view";
import { simpleConfigRequest } from "./kondomeriet-perf";
import { cardImagesByIndex, pickKondomerietConfig } from "./kondomeriet-props";
import { useKondomerietGroups } from "./kondomeriet-data";
import { SNAPSHOT_MISSING_NOTICE, groupsMissingSnapshot, parseGroups, type GroupsValue } from "./kondomeriet-helpers";
import { NO_KONDOMERIET_CONFIG } from "./kondomeriet-owner";
import { EditorNotices } from "./editor-fit";
import { COMPONENT_TEMPLATE_ID, useActiveSponsorId, useVioSlot, vioAttribution } from "./vio-helpers";
import { observeVioImpression, productToItem } from "./analytics";

/**
 * The Kondomeriet carousel and grid: one card per product group, laid out
 * like the Vio carousel / grid (same head, same snapping track, same arrows,
 * same 2-column collapse on phones) with their own `knd-list` styles, so the
 * Vio blocks' styles are left alone. Products are fetched once for the whole
 * block; the impression is the block's, with every product it offers.
 */

const STYLE_ID = "kondomeriet-list-styles";
const LIST_CSS = `
.knd-list { position: relative; width: 100%; font-family: var(--vio-font-sans, -apple-system, sans-serif); color: var(--vio-color-text, #0a0a0a); }
.knd-list-head { display: flex; align-items: baseline; justify-content: space-between; gap: 12px; margin-bottom: 16px; }
.knd-list-titles { min-width: 0; }
.knd-list-kicker { font-size: 12px; text-transform: uppercase; letter-spacing: 0.12em; color: var(--vio-color-accent, #c14a3b); font-weight: 600; margin-bottom: 6px; }
.knd-list-heading { font-family: var(--vio-font-serif, 'Tinos', Georgia, serif); font-size: 26px; font-weight: 400; margin: 0; }
.knd-list-disclaimer { font-size: 11px; text-transform: uppercase; letter-spacing: 0.1em; color: #999; white-space: nowrap; }
.knd-list-viewport { position: relative; }
.knd-list-track { display: flex; overflow-x: auto; scroll-snap-type: x mandatory; scroll-behavior: smooth; -ms-overflow-style: none; scrollbar-width: none; padding-bottom: 2px; }
.knd-list-track::-webkit-scrollbar { display: none; }
.knd-list-item { flex: 0 0 auto; scroll-snap-align: start; min-width: 0; }
.knd-list-arrow {
  position: absolute; top: 35%; transform: translateY(-50%); z-index: 4; width: 40px; height: 40px; border-radius: 50%; border: none; cursor: pointer;
  background: #fff; color: #0a0a0a; box-shadow: 0 2px 12px rgba(0,0,0,0.18); display: flex; align-items: center; justify-content: center;
  transition: transform 0.14s ease, opacity 0.14s ease;
}
.knd-list-arrow:hover { transform: translateY(-50%) scale(1.08); }
.knd-list-arrow:disabled { opacity: 0; pointer-events: none; }
.knd-list-arrow.prev { left: -8px; }
.knd-list-arrow.next { right: -8px; }
.knd-list-grid { display: grid; }
.knd-list, .knd-list-grid, .knd-list-track { box-sizing: border-box; max-width: 100%; }
.knd-list-grid > * { min-width: 0; }
@media (max-width: 480px) { .knd-list-heading { font-size: 22px; } .knd-list-disclaimer { white-space: normal; text-align: right; } }
.knd-list-empty { border: 1px dashed #ccc; border-radius: 10px; padding: 40px; text-align: center; color: #999; font-size: 14px; }
`;

function injectListStyles() {
  if (typeof document === "undefined" || document.getElementById(STYLE_ID)) return;
  const el = document.createElement("style");
  el.id = STYLE_ID;
  el.textContent = LIST_CSS;
  document.head.appendChild(el);
}

export type KondomerietListProps = {
  groups?: GroupsValue;
  kicker?: string;
  heading?: string;
  disclaimer?: string;
  visible?: number;
  columns?: number;
  gap?: number;
  arrows?: boolean;
  slot?: string;
  slotName?: string;
  hostRef?: { current: HTMLElement | null } | null;
  [key: string]: any;
};

const Arrow = ({ dir }: { dir: "prev" | "next" }) => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
    <polyline points={dir === "prev" ? "15 18 9 12 15 6" : "9 18 15 12 9 6"} />
  </svg>
);

/** Cards whose image loads eagerly with high priority; the rest load lazily. */
const PRIORITY_CARDS = 4;

export function KondomerietList({ kind, props }: { kind: "carousel" | "grid"; props: KondomerietListProps }) {
  simpleConfigRequest();
  const { kicker, heading, disclaimer = "annonselenker", visible = 4, columns = 3, arrows = true, slot: slotProp, slotName } = props;
  const gap = Number(props.gap ?? (kind === "carousel" ? 16 : 20)) || 0;
  const groupsKey = props.groups?.data ?? "";
  // Every group, empty ones too, so a card's number is its number in the panel
  // (`cardImages`); the empty ones simply resolve to no card.
  const groups = parseGroups(props.groups);
  const filled = groups.filter((g) => g.ids.length > 0);
  const images = cardImagesByIndex(props.cardImages);
  const template = kind === "carousel" ? COMPONENT_TEMPLATE_ID.carousel : COMPONENT_TEMPLATE_ID.grid;
  const listName = heading || kicker || (kind === "carousel" ? "Kondomeriet Carousel" : "Kondomeriet Grid");

  const slot = useVioSlot({ slot: slotProp, slotName, kind, title: heading || kicker, hostRef: props.hostRef });
  const sponsorId = useActiveSponsorId(undefined, slot);
  const campaignId = sponsorId != null ? vioAttribution(slot, sponsorId).campaignId ?? null : null;
  const { products, resolved, ids, live, configMissing } = useKondomerietGroups({
    groups,
    groupsKey,
    sponsorId,
    campaignId,
    slot,
    componentTemplateId: template,
    listName,
  });

  // While rendering, not in an effect (see kondomeriet-card-view.tsx): no unstyled first paint.
  injectListStyles();

  const rootRef = useRef<HTMLDivElement | null>(null);
  // The block's own width, not the window's: Vev sizes a frame per breakpoint,
  // and a block in a column is narrower than the phone. Columns and cards per
  // view follow it, so the cards never get narrower than a readable minimum.
  const [rootEl, setRootEl] = useState<HTMLDivElement | null>(null);
  const setRoot = (el: HTMLDivElement | null) => {
    rootRef.current = el;
    setRootEl(el);
  };
  const [width, setWidth] = useState(0);
  // Measured before the browser paints (layout effect): measured after, the
  // grid painted with the editor's columns and then reflowed to the block's
  // width — measured CLS 0.58 on a phone (3 columns → 2).
  useLayoutEffect(() => {
    if (!rootEl) return;
    const measure = () => setWidth(Math.round(rootEl.getBoundingClientRect().width));
    measure();
    if (typeof ResizeObserver === "undefined") {
      window.addEventListener("resize", measure);
      return () => window.removeEventListener("resize", measure);
    }
    const ro = new ResizeObserver(measure);
    ro.observe(rootEl);
    return () => ro.disconnect();
  }, [rootEl]);
  useEffect(() => {
    // On live data only (see kondomeriet-card.tsx).
    if (!products || products.length === 0 || !live) return;
    return observeVioImpression(
      rootRef.current,
      { sponsorId: sponsorId ?? undefined, componentTemplateId: template, locationId: listName, ...vioAttribution(slot, sponsorId, template) },
      `knd-${kind}:${sponsorId}:${slot || listName}`,
      products.map((p) => productToItem(p))
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [products, live, sponsorId, slot, listName]);

  // Carousel: arrows only while the track overflows; card-by-card steps with
  // the snap paused while a programmatic scroll runs (iPhone Safari blanks a
  // smooth scroll on a mandatory-snap track — see vio-carousel.tsx).
  const trackRef = useRef<HTMLDivElement | null>(null);
  const [overflows, setOverflows] = useState(false);
  const [canPrev, setCanPrev] = useState(false);
  const [canNext, setCanNext] = useState(true);
  const updateEnds = () => {
    const el = trackRef.current;
    if (!el) return;
    setOverflows(el.scrollWidth > el.clientWidth + 1);
    setCanPrev(el.scrollLeft > 1);
    setCanNext(el.scrollLeft + el.clientWidth < el.scrollWidth - 1);
  };
  useEffect(() => {
    const el = trackRef.current;
    if (!el) return;
    updateEnds();
    el.addEventListener("scroll", updateEnds, { passive: true });
    window.addEventListener("resize", updateEnds);
    const ro = typeof ResizeObserver !== "undefined" ? new ResizeObserver(updateEnds) : null;
    ro?.observe(el);
    return () => {
      el.removeEventListener("scroll", updateEnds);
      window.removeEventListener("resize", updateEnds);
      ro?.disconnect();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [resolved.length, products]);
  const scrollBy = (dir: number) => {
    const el = trackRef.current;
    const items = el ? (Array.from(el.children) as HTMLElement[]) : [];
    if (!el || items.length === 0) return;
    const origin = items[0].offsetLeft;
    const cardWidth = items[0].offsetWidth || el.clientWidth;
    const perStep = Math.max(1, Math.floor((el.clientWidth + gap) / (cardWidth + gap)));
    const current = Math.max(0, items.findIndex((it) => it.offsetLeft - origin >= el.scrollLeft - 1));
    const target = Math.min(items.length - 1, Math.max(0, current + dir * perStep));
    const left = Math.min(items[target].offsetLeft - origin, el.scrollWidth - el.clientWidth);
    el.style.scrollSnapType = "none";
    const restore = () => {
      el.style.scrollSnapType = "";
      el.removeEventListener("scrollend", restore);
      updateEnds();
    };
    el.addEventListener("scrollend", restore);
    window.setTimeout(restore, 700);
    el.scrollTo({ left, behavior: "smooth" });
  };

  if (ids.length === 0) {
    return (
      <div ref={setRoot} className="knd-list">
        <div className="knd-list-empty">Add cards (product groups) in the panel to build the {kind}.</div>
      </div>
    );
  }

  const cardConfig = pickKondomerietConfig(props);
  // In the editor: picked products without a snapshot (see SNAPSHOT_MISSING_NOTICE).
  const notices = [...(configMissing ? [NO_KONDOMERIET_CONFIG] : []), ...(groupsMissingSnapshot(filled) ? [SNAPSHOT_MISSING_NOTICE] : [])];
  const loading = products == null;
  // While loading: one skeleton per group, in the layout the cards will take.
  const cells: React.ReactNode[] = loading
    ? filled.map((g, i) => (
        <KondomerietCardView
          key={`skel-${i}`}
          group={null}
          loading
          config={cardConfig}
          sponsorId={sponsorId}
          pending={{ options: g.ids.length, buyOnCard: g.buyOnCard, offerEnd: g.offerEnd }}
        />
      ))
    : resolved.map((g, i) => {
        // The card's number in the panel (resolveGroup keys it `<index>:<ids>`).
        const img = images.get(parseInt(g.key, 10));
        return (
        <KondomerietCardView
          key={g.key}
          group={g}
          imageOverride={img?.url}
          config={img?.only ? { ...cardConfig, infoImageOnly: true } : cardConfig}
          sponsorId={sponsorId}
          slot={slot}
          componentTemplateId={template}
          // The first cards (two rows on a phone, the first row on a desktop) load their image first.
          priority={i < PRIORITY_CARDS}
        />
        );
      });

  // Narrow blocks tighten the gap, then drop columns / cards per view.
  const effGap = width > 0 && width < 480 ? Math.min(gap, 12) : gap;
  const fit = (min: number, max: number) =>
    width > 0 ? Math.max(1, Math.min(max, Math.floor((width + effGap) / (min + effGap)))) : max;

  const head =
    kicker || heading || (kind === "carousel" && disclaimer) ? (
      <div className="knd-list-head">
        <div className="knd-list-titles">
          {kicker ? <div className="knd-list-kicker">{kicker}</div> : null}
          {heading ? <h3 className="knd-list-heading">{heading}</h3> : null}
        </div>
        {kind === "carousel" && disclaimer ? <div className="knd-list-disclaimer">{disclaimer}</div> : null}
      </div>
    ) : null;

  if (!loading && resolved.length === 0) {
    return (
      <div ref={setRoot} className="knd-list">
        <EditorNotices notices={notices} />
        {head}
        <div className="knd-list-empty">None of these products are available on this channel.</div>
      </div>
    );
  }

  if (kind === "grid") {
    // Never narrower than 130px a card: a 320px phone keeps two columns, a column of 250px one.
    const cols = fit(130, Math.max(1, Number(columns) || 3));
    return (
      <div ref={setRoot} className="knd-list">
        <EditorNotices notices={notices} />
        {head}
        <div className="knd-list-grid" style={{ gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))`, gap: effGap }}>
          {cells}
        </div>
      </div>
    );
  }

  // Cards of at least 150px; on a narrow block the next card peeks in, so it reads as swipeable.
  const perView = fit(150, Math.max(1, Number(visible) || 4));
  const peek = width > 0 && width < 640 && cells.length > perView ? 0.18 : 0;
  const itemWidth = `calc((100% - ${effGap * (perView - (peek ? 0 : 1))}px) / ${perView + peek})`;
  return (
    <div ref={setRoot} className="knd-list">
      <EditorNotices notices={notices} />
      {head}
      <div className="knd-list-viewport">
        {arrows && overflows ? (
          <button className="knd-list-arrow prev" aria-label="Forrige" disabled={!canPrev} onClick={() => scrollBy(-1)}>
            <Arrow dir="prev" />
          </button>
        ) : null}
        <div className="knd-list-track" ref={trackRef} style={{ gap: effGap }}>
          {cells.map((cell, i) => (
            <div key={i} className="knd-list-item" style={{ width: itemWidth }}>
              {cell}
            </div>
          ))}
        </div>
        {arrows && overflows ? (
          <button className="knd-list-arrow next" aria-label="Neste" disabled={!canNext} onClick={() => scrollBy(1)}>
            <Arrow dir="next" />
          </button>
        ) : null}
      </div>
    </div>
  );
}
