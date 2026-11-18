import React, { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import {
  KONDOMERIET_DETAIL_EVENT,
  KONDOMERIET_NAME,
  isSoldOut,
  type KondomerietDetailRequest,
} from "./kondomeriet-helpers";
import { buyWithHurtigkasse, trackOptionSelect } from "./kondomeriet-track";
import {
  OptionSelector,
  PriceRow,
  VippsWordmarkButton,
  injectKondomerietStyles,
  plainText,
} from "./kondomeriet-ui";

/**
 * The Kondomeriet product detail — the drawer "Se produktinfo" opens. It is
 * laid out like the SDK's `<vio-product-detail>` (a bottom sheet on phones, a
 * side panel on wider screens: gallery, brand, name, the option pills, price,
 * the buy button, the description) but it is ours, because the SDK's detail
 * sells through Vio's cart: here the buy button is "Kjøp med Vipps", the
 * shop's own Hurtigkasse for the option chosen. It listens to its own event
 * (`kondomeriet:open-detail`), never `vio:product-click`, so a Vio Config on
 * the same page never opens its detail or cart for these cards.
 *
 * One per page: `KondomerietDetailHost` is rendered by the Kondomeriet Config
 * and by every Kondomeriet card, and only the first one mounted shows the
 * drawer (claimed on globalThis — Vev may bundle blocks apart).
 */

const STYLE_ID = "kondomeriet-detail-styles";
const DETAIL_CSS = `
.knd-detail-root { position: fixed; inset: 0; z-index: 2147483100; font-family: var(--vio-font-sans, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif); color: var(--vio-color-text, #0a0a0a); }
.knd-detail-backdrop { position: absolute; inset: 0; background: rgba(0, 0, 0, 0.45); animation: knd-fade 0.18s ease; }
.knd-detail-sheet {
  position: absolute; top: 0; right: 0; bottom: 0; width: min(460px, 100vw); box-sizing: border-box;
  background: var(--vio-color-surface, #fff); display: flex; flex-direction: column; box-shadow: -8px 0 32px rgba(0,0,0,0.18);
  animation: knd-slide-in 0.22s cubic-bezier(0.2, 0.8, 0.2, 1);
}
.knd-detail-top { display: flex; align-items: center; justify-content: space-between; padding: 12px 16px; border-bottom: 1px solid var(--vio-color-border, #eee); }
.knd-detail-top-title { font-size: 12px; letter-spacing: 0.1em; text-transform: uppercase; color: var(--vio-color-text-secondary, #666); font-weight: 600; }
.knd-detail-close { width: 36px; height: 36px; border: none; background: transparent; font-size: 26px; line-height: 1; cursor: pointer; color: inherit; border-radius: 50%; }
.knd-detail-close:hover { background: rgba(0,0,0,0.06); }
.knd-detail-scroll { flex: 1; overflow-y: auto; -webkit-overflow-scrolling: touch; overscroll-behavior: contain; }
.knd-detail-gallery { position: relative; display: flex; overflow-x: auto; scroll-snap-type: x mandatory; scrollbar-width: none; background: var(--vio-color-surface-muted, #f2f2f2); }
.knd-detail-gallery::-webkit-scrollbar { display: none; }
.knd-detail-gallery img { flex: 0 0 100%; width: 100%; aspect-ratio: 1 / 1; object-fit: contain; scroll-snap-align: start; display: block; }
.knd-detail-badge { position: absolute; top: 12px; left: 12px; z-index: 2; background: var(--vnc-accent, #0a0a0a); color: #fff; font-size: 13px; font-weight: 700; padding: 6px 9px; border-radius: var(--vio-card-badge-radius, 4px); }
.knd-detail-dots { display: flex; justify-content: center; gap: 6px; padding: 10px 0 0; }
.knd-detail-dots span { width: 6px; height: 6px; border-radius: 50%; background: #d4d4d4; }
.knd-detail-dots span.on { background: var(--vio-color-text, #0a0a0a); }
.knd-detail-body { padding: 16px 20px 28px; }
.knd-detail-brand { font-size: 12px; letter-spacing: 0.1em; text-transform: uppercase; color: var(--vio-color-text-secondary, #666); font-weight: 500; margin-bottom: 6px; }
.knd-detail-name { font-family: var(--vio-font-serif, Georgia, serif); font-size: 24px; font-weight: 400; line-height: 1.2; margin: 0 0 14px; }
.knd-detail-body .knd-option-title { font-size: 13px; color: var(--vio-color-text-secondary, #666); margin: 0 0 8px; }
.knd-detail-body .knd-option-title b { color: var(--vio-color-text, #0a0a0a); font-weight: 600; }
.knd-detail-body .knd-options { display: flex; flex-wrap: wrap; gap: 8px; margin: 0 0 16px; }
.knd-detail-body .knd-pill { font-size: 13px; padding: 8px 14px; }
.knd-detail-body .knd-select { width: 100%; margin: 0 0 16px; padding: 10px; font-size: 14px; border: 1px solid var(--vio-color-border, #d4d4d4); border-radius: var(--vio-card-bar-radius, 6px); background: var(--vio-color-surface, #fff); font-family: inherit; }
.knd-detail-price { font-size: 22px; font-weight: 700; margin: 0 0 16px; }
.knd-detail-vipps {
  width: 100%; padding: 16px; border: none; border-radius: var(--vio-card-bar-radius, 6px); cursor: pointer;
  display: flex; align-items: center; justify-content: center; gap: 8px;
  background: #ff5b24; color: #fff; font-family: inherit; font-size: 14px; font-weight: 700; letter-spacing: 0.04em; transition: background 0.15s;
}
.knd-detail-vipps:hover { background: #ec4f1c; }
.knd-detail-vipps:disabled { opacity: 0.5; cursor: not-allowed; }
.knd-detail-vipps .vnc-vipps-badge { font-size: 20px; font-weight: 800; letter-spacing: -0.02em; }
.knd-detail-note { font-size: 12px; color: var(--vio-color-text-secondary, #666); line-height: 1.45; margin: 10px 0 0; text-align: center; }
.knd-detail-desc-title { font-size: 12px; letter-spacing: 0.1em; text-transform: uppercase; font-weight: 600; margin: 26px 0 8px; color: var(--vio-color-text-secondary, #666); }
.knd-detail-desc p { font-size: 15px; line-height: 1.55; margin: 0 0 10px; color: var(--vio-color-text, #222); }
@keyframes knd-fade { from { opacity: 0; } to { opacity: 1; } }
@keyframes knd-slide-in { from { transform: translateX(24px); opacity: 0; } to { transform: none; opacity: 1; } }
@keyframes knd-slide-up { from { transform: translateY(40px); opacity: 0; } to { transform: none; opacity: 1; } }
@media (max-width: 640px) {
  .knd-detail-sheet { top: auto; left: 0; width: 100vw; max-height: 92vh; border-radius: 16px 16px 0 0; animation: knd-slide-up 0.24s cubic-bezier(0.2, 0.8, 0.2, 1); box-shadow: 0 -8px 32px rgba(0,0,0,0.18); }
}
`;

function injectDetailStyles(): void {
  injectKondomerietStyles();
  if (typeof document === "undefined" || document.getElementById(STYLE_ID)) return;
  const el = document.createElement("style");
  el.id = STYLE_ID;
  el.textContent = DETAIL_CSS;
  document.head.appendChild(el);
}

/** Every image of a product, primary first, no duplicates. */
function imagesOf(p: any): string[] {
  const list: any[] = Array.isArray(p?.images) ? [...p.images] : [];
  list.sort((a, b) => Number(a?.order ?? 0) - Number(b?.order ?? 0));
  const out: string[] = [];
  for (const i of list) if (typeof i?.url === "string" && i.url && !out.includes(i.url)) out.push(i.url);
  return out;
}

export function KondomerietDetail({ request, onClose }: { request: KondomerietDetailRequest; onClose: () => void }) {
  const { group, attribution, sponsorId } = request;
  const [index, setIndex] = useState(request.index);
  const [photo, setPhoto] = useState(0);
  const galleryRef = useRef<HTMLDivElement | null>(null);
  const closeRef = useRef<HTMLButtonElement | null>(null);

  useEffect(() => {
    injectDetailStyles();
    // The page behind stays put; focus goes to the drawer and back on close.
    const opener = document.activeElement as HTMLElement | null;
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    closeRef.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = prevOverflow;
      document.removeEventListener("keydown", onKey);
      opener?.focus?.();
    };
  }, [onClose]);

  const option = group.options[Math.min(Math.max(0, index), group.options.length - 1)];
  const p = option.product;
  const images = imagesOf(p);
  const soldOut = isSoldOut(p);
  const canBuy = !!option.slug && !soldOut;
  const paragraphs = plainText(p?.description).split("\n").filter(Boolean);
  const vippsLabel = request.vippsLabel || "Kjøp med";
  const accentStyle = request.accentColor ? ({ ["--vnc-accent" as any]: request.accentColor } as React.CSSProperties) : undefined;

  // Another option: its own photos, from the first.
  useEffect(() => {
    setPhoto(0);
    if (galleryRef.current) galleryRef.current.scrollLeft = 0;
  }, [option.productId]);

  const select = (i: number) => {
    if (i === index) return;
    setIndex(i);
    request.onSelect?.(i);
    trackOptionSelect(group.options[i], attribution, sponsorId, "detail");
  };

  const buy = () => {
    if (!canBuy) return;
    buyWithHurtigkasse(option, {
      attribution,
      sponsorId,
      where: "detail",
      label: `${vippsLabel} Vipps`,
      target: request.target,
    });
  };

  return (
    <div className="knd-detail-root" role="dialog" aria-modal="true" aria-label={`${group.title} – produktinfo`} style={accentStyle}>
      <div className="knd-detail-backdrop" onClick={onClose} />
      <div className="knd-detail-sheet">
        <div className="knd-detail-top">
          <span className="knd-detail-top-title">Produktinfo</span>
          <button ref={closeRef} type="button" className="knd-detail-close" aria-label="Lukk" onClick={onClose}>
            ×
          </button>
        </div>
        <div className="knd-detail-scroll">
          <div
            className="knd-detail-gallery"
            ref={galleryRef}
            onScroll={(e) => {
              const el = e.currentTarget;
              const i = el.clientWidth ? Math.round(el.scrollLeft / el.clientWidth) : 0;
              if (i !== photo) setPhoto(i);
            }}
          >
            {request.badge ? <span className="knd-detail-badge">{request.badge}</span> : null}
            {images.length ? (
              images.map((src, i) => <img key={src} src={src} alt={i === 0 ? `${group.title} ${option.label}` : ""} />)
            ) : (
              <div style={{ width: "100%", aspectRatio: "1 / 1" }} />
            )}
          </div>
          {images.length > 1 ? (
            <div className="knd-detail-dots" aria-hidden="true">
              {images.map((src, i) => (
                <span key={src} className={i === photo ? "on" : ""} />
              ))}
            </div>
          ) : null}
          <div className="knd-detail-body">
            {group.brand ? <div className="knd-detail-brand">{group.brand}</div> : null}
            <h2 className="knd-detail-name">{group.title}</h2>
            <OptionSelector
              group={group}
              index={index}
              onSelect={select}
              style="pills"
              title={request.optionTitle || "Variant"}
            />
            <PriceRow product={p} className="knd-detail-price" />
            <VippsWordmarkButton
              className="knd-detail-vipps"
              label={vippsLabel}
              soldOut={soldOut}
              disabled={!canBuy}
              onClick={buy}
            />
            <p className="knd-detail-note">
              {option.slug
                ? `Du betaler med Vipps Hurtigkasse hos ${KONDOMERIET_NAME}.`
                : `Dette produktet kan ikke kjøpes direkte her.`}
            </p>
            {paragraphs.length ? (
              <>
                <div className="knd-detail-desc-title">Beskrivelse</div>
                <div className="knd-detail-desc">
                  {paragraphs.map((t, i) => (
                    <p key={i}>{t}</p>
                  ))}
                </div>
              </>
            ) : null}
          </div>
        </div>
      </div>
    </div>
  );
}

type HostState = { owner: string | null };

function hostState(): HostState {
  const g = globalThis as { __KND_DETAIL_HOST__?: HostState };
  if (!g.__KND_DETAIL_HOST__) g.__KND_DETAIL_HOST__ = { owner: null };
  return g.__KND_DETAIL_HOST__;
}

const RELEASED_EVENT = "kondomeriet:detail-host-released";

/** Mounts the drawer once per page (see the note at the top). Renders nothing until opened. */
export function KondomerietDetailHost() {
  const idRef = useRef("knd-detail-" + Math.random().toString(36).slice(2));
  const [isOwner, setIsOwner] = useState(false);
  const [request, setRequest] = useState<KondomerietDetailRequest | null>(null);
  // Each opening is a fresh drawer (its own option, photo and focus).
  const [openCount, setOpenCount] = useState(0);

  useEffect(() => {
    const state = hostState();
    const claim = () => {
      if (!state.owner) state.owner = idRef.current;
      setIsOwner(state.owner === idRef.current);
    };
    claim();
    document.addEventListener(RELEASED_EVENT, claim);
    return () => {
      document.removeEventListener(RELEASED_EVENT, claim);
      if (state.owner === idRef.current) {
        state.owner = null;
        document.dispatchEvent(new CustomEvent(RELEASED_EVENT));
      }
    };
  }, []);

  useEffect(() => {
    if (!isOwner) return;
    const onOpen = (e: Event) => {
      const detail = (e as CustomEvent<KondomerietDetailRequest>).detail;
      if (!detail?.group?.options?.length) return;
      setRequest({ ...detail });
      setOpenCount((n) => n + 1);
    };
    document.addEventListener(KONDOMERIET_DETAIL_EVENT, onOpen);
    return () => document.removeEventListener(KONDOMERIET_DETAIL_EVENT, onOpen);
  }, [isOwner]);

  const close = React.useCallback(() => setRequest(null), []);

  if (!isOwner || !request || typeof document === "undefined") return null;
  return createPortal(<KondomerietDetail key={openCount} request={request} onClose={close} />, document.body);
}
