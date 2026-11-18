import React, { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { ensureVippsButton } from "../../vio-sdk";
import { getProductPriceAmount } from "./vio-helpers";
import {
  KONDOMERIET_DETAIL_EVENT,
  KONDOMERIET_NAME,
  compareAtAmount,
  isSoldOut,
  type KondomerietDetailRequest,
} from "./kondomeriet-helpers";
import { buyWithHurtigkasse, trackOptionSelect } from "./kondomeriet-track";
import { cardBadge, classRef, detailPrice, plainText } from "./kondomeriet-ui";

/**
 * The Kondomeriet product detail — the drawer «Se produktinfo» opens — drawn
 * with the SDK's own product detail stylesheet: the drawer lives in a shadow
 * root that carries the styles of `<vio-product-detail>` (the detail Vio
 * Config mounts), and its markup uses the same
 * classes (`.backdrop`, `.modal`, `.topbar`, `.gallery-main`, `.headline`,
 * `.price` / `.compare-at`, `.option-pill`, `.buy-vipps`, `.seller-note`,
 * `.description-preview`…). So it looks — and follows the theme tokens and
 * `--vio-detail-*` variables — exactly like the standard detail: side panel
 * on desktop, bottom sheet on phones.
 *
 * Not the SDK element itself: that one sells through Vio's cart. Here the buy
 * button is «Kjøp med Vipps», the shop's own Hurtigkasse for the option
 * chosen, with the Hurtigkasse note under it. It opens on its own event
 * (`kondomeriet:open-detail`), never `vio:product-click`, so a Vio Config on
 * the same page never opens its detail or cart for these cards.
 *
 * One per page: `KondomerietDetailHost` is rendered by the Kondomeriet Config
 * and by every Kondomeriet card; only the first one mounted shows the drawer
 * (claimed on globalThis — Vev may bundle blocks apart).
 */

/**
 * The SDK detail's stylesheet as text (lit CSSResults, possibly nested), read
 * from the `<vio-product-detail>` element class the SDK bundle defines on load
 * (the package's `VioProductDetail` export is its React wrapper).
 */
function sdkDetailCss(): string {
  const out: string[] = [];
  const walk = (s: any) => {
    if (!s) return;
    if (Array.isArray(s)) s.forEach(walk);
    else if (typeof s.cssText === "string") out.push(s.cssText);
    else if (typeof s === "string") out.push(s);
  };
  try {
    const elementClass: any = typeof customElements !== "undefined" ? customElements.get("vio-product-detail") : null;
    walk(elementClass?.styles);
  } catch {
    /* an older bundle: the extra rules below still draw a usable drawer */
  }
  return out.join("\n");
}

/** What the SDK detail has no rule for: the badge on the photo (the Vio card's badge). */
const EXTRA_CSS = `
.gallery-main .knd-badge {
  position: absolute; top: 10px; left: 10px; z-index: 3;
  background: var(--vnc-accent, #0a0a0a); color: #fff;
  font-size: 12px; font-weight: 700; line-height: 1; padding: 5px 8px; border-radius: var(--vio-card-badge-radius, 4px);
}
.buy-vipps-official[aria-disabled="true"] { pointer-events: none; opacity: 0.5; }
`;

const CLOSE_MS = 320;

/** Every image of a product, in order, no duplicates. */
function imagesOf(p: any): string[] {
  const list: any[] = Array.isArray(p?.images) ? [...p.images] : [];
  list.sort((a, b) => Number(a?.order ?? 0) - Number(b?.order ?? 0));
  const out: string[] = [];
  for (const i of list) if (typeof i?.url === "string" && i.url && !out.includes(i.url)) out.push(i.url);
  return out;
}

export function KondomerietDetail({
  request,
  host,
  onClose,
}: {
  request: KondomerietDetailRequest;
  /** The shadow host: `open` on it runs the SDK stylesheet's slide-in / slide-out. */
  host: HTMLElement;
  onClose: () => void;
}) {
  const { group, attribution, sponsorId } = request;
  const [index, setIndex] = useState(request.index);
  const [photo, setPhoto] = useState(0);
  const [vippsOfficial, setVippsOfficial] = useState(false);
  const [descOpen, setDescOpen] = useState(false);
  const [descClipped, setDescClipped] = useState(false);
  const descRef = useRef<HTMLDivElement | null>(null);
  const closeRef = useRef<HTMLButtonElement | null>(null);
  const closing = useRef(false);

  const close = useCallback(() => {
    if (closing.current) return;
    closing.current = true;
    host.removeAttribute("open");
    setTimeout(onClose, CLOSE_MS);
  }, [host, onClose]);

  useEffect(() => {
    // The closed position is laid out first (a forced reflow), then `open`:
    // the SDK stylesheet's slide-in runs. Not on an animation frame — a
    // background tab may never run one, leaving the drawer shut.
    void (host.shadowRoot?.querySelector(".modal") as HTMLElement | null)?.offsetWidth;
    host.setAttribute("open", "");
    const opener = document.activeElement as HTMLElement | null;
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    closeRef.current?.focus({ preventScroll: true });
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") close();
    };
    document.addEventListener("keydown", onKey);
    let cancelled = false;
    ensureVippsButton().then((ok: boolean) => {
      if (!cancelled) setVippsOfficial(ok);
    });
    return () => {
      cancelled = true;
      host.removeAttribute("open");
      document.body.style.overflow = prevOverflow;
      document.removeEventListener("keydown", onKey);
      opener?.focus?.({ preventScroll: true });
    };
  }, [host, close]);

  const option = group.options[Math.min(Math.max(0, index), group.options.length - 1)];
  const p = option.product;
  const images = imagesOf(p);
  const activeImage = images[Math.min(photo, Math.max(0, images.length - 1))];
  const soldOut = isSoldOut(p);
  const canBuy = !!option.slug && !soldOut;
  const amount = getProductPriceAmount(p);
  const was = compareAtAmount(p);
  const description = plainText(p?.description);
  const vippsLabel = request.vippsLabel || "Kjøp med";
  // The card's badge rule, for the option on screen: the group's text in its
  // dates, else this option's own sale %.
  const badge = cardBadge(group.group, p);

  // Another option: its own photos, from the first; the description folds again.
  useEffect(() => {
    setPhoto(0);
    setDescOpen(false);
  }, [option.productId]);
  // «Les mer» only when the preview hides part of the text (as the SDK measures it).
  useEffect(() => {
    const el = descRef.current;
    if (!el || descOpen) return;
    setDescClipped(el.scrollHeight > el.clientHeight + 1);
  }, [option.productId, descOpen, description]);

  const select = (i: number) => {
    if (i === index) return;
    setIndex(i);
    request.onSelect?.(i);
    trackOptionSelect(group.options[i], attribution, sponsorId, "detail");
  };

  const buy = () => {
    if (!canBuy) return;
    buyWithHurtigkasse(option, { attribution, sponsorId, where: "detail", label: `${vippsLabel} Vipps`, target: request.target });
  };

  const optionsBlock =
    group.options.length > 1 ? (
      <div className="buy-options">
        <div className="option-group">
          <div className="option-label">
            <span>
              {request.optionTitle?.trim() || "Variant"}: <span className="option-chosen">{option.label}</span>
            </span>
          </div>
          <div className="option-values">
            {group.options.map((o, i) => {
              const out = isSoldOut(o.product);
              return (
                <button
                  key={o.productId}
                  type="button"
                  className={`option-pill${out ? " unavailable" : ""}`}
                  aria-pressed={i === index}
                  disabled={out && i !== index}
                  title={out ? "Utsolgt" : ""}
                  onClick={() => select(i)}
                >
                  {o.label}
                </button>
              );
            })}
          </div>
        </div>
      </div>
    ) : null;

  const vippsEl = !canBuy ? (
    <button type="button" className="buy-vipps" disabled>
      {soldOut ? <span>Utsolgt</span> : (
        <>
          <span>{vippsLabel}</span>
          <span className="vipps-badge">vipps</span>
        </>
      )}
    </button>
  ) : vippsOfficial ? (
    React.createElement("vipps-mobilepay-button", {
      ref: classRef("buy-vipps-official"),
      brand: "vipps",
      language: "no",
      verb: "buy",
      variant: "primary",
      rounded: "true",
      stretched: "true",
      role: "button",
      "aria-label": `${vippsLabel} Vipps`,
      onClick: buy,
    } as any)
  ) : (
    <button type="button" className="buy-vipps" onClick={buy} aria-label={`${vippsLabel} Vipps`}>
      <span>{vippsLabel}</span>
      <span className="vipps-badge">vipps</span>
    </button>
  );

  return (
    <>
      <div className="backdrop" onClick={close} />
      <div className="modal" role="dialog" aria-modal="true" aria-label="Produkt" tabIndex={-1}>
        <div className="handle" onClick={close} aria-hidden="true" />
        <div className="topbar">
          <div className="topbar-sponsor">
            <span className="topbar-name">{KONDOMERIET_NAME}</span>
          </div>
          <button ref={closeRef} type="button" className="close" aria-label="Lukk" onClick={close}>
            ×
          </button>
        </div>

        <div className="body">
          <div className="gallery">
            <div className="gallery-main">
              {badge ? <span className="knd-badge">{badge}</span> : null}
              {activeImage ? <img src={activeImage} alt={`${group.title} ${option.label}`} /> : null}
            </div>
            {images.length > 1 ? (
              <div className="thumbs">
                <div className="gallery-thumbs">
                  {images.map((src, i) => (
                    <button
                      key={src}
                      type="button"
                      className={`gallery-thumb${i === photo ? " active" : ""}`}
                      aria-label={`Bilde ${i + 1}`}
                      aria-current={i === photo ? "true" : "false"}
                      onClick={() => setPhoto(i)}
                    >
                      <img src={src} alt="" loading="lazy" />
                    </button>
                  ))}
                </div>
              </div>
            ) : null}
          </div>

          <div className="info">
            {group.brand ? <div className="brand">{group.brand}</div> : null}
            <div className="headline">
              <div className="title-row">
                <h2 className="name">{group.title}</h2>
                {soldOut ? <div className="stock out-of-stock">Utsolgt</div> : null}
              </div>
              {amount != null ? (
                <div className="price-row">
                  <span className="price">{detailPrice(amount, p)}</span>
                  {was != null ? <span className="compare-at">{detailPrice(was, p)}</span> : null}
                </div>
              ) : null}
            </div>
            <div className="purchase">
              <div className="buy">
                {optionsBlock}
                {vippsEl}
                <p className="vipps-note">
                  {option.slug
                    ? `Du betaler med Vipps Hurtigkasse hos ${KONDOMERIET_NAME}.`
                    : "Dette produktet kan ikke kjøpes direkte her."}
                </p>
                <p className="seller-note">
                  Du handler direkte hos <strong>{KONDOMERIET_NAME}</strong>.
                </p>
              </div>
              {description ? (
                <div className={`description-block description-preview preview${descOpen ? " open" : ""}${descClipped ? " clipped" : ""}`}>
                  <button
                    className="desc-head"
                    type="button"
                    aria-expanded={descOpen || !descClipped}
                    onClick={() => descClipped && setDescOpen((o) => !o)}
                  >
                    Beskrivelse
                  </button>
                  <div
                    ref={descRef}
                    className={`description${descOpen ? "" : " collapsed"}`}
                    onClick={() => descClipped && !descOpen && setDescOpen(true)}
                  >
                    {description}
                  </div>
                  {descClipped ? (
                    <button className="desc-more" type="button" onClick={() => setDescOpen((o) => !o)}>
                      {descOpen ? "Vis mindre" : "Les mer"}
                    </button>
                  ) : null}
                </div>
              ) : null}
            </div>
          </div>
        </div>
      </div>
    </>
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
  const [shadow, setShadow] = useState<{ host: HTMLElement; mount: HTMLElement } | null>(null);

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

  // The shadow root that carries the SDK detail's stylesheet.
  useEffect(() => {
    if (!isOwner || typeof document === "undefined") return;
    const host = document.createElement("div");
    host.className = "knd-product-detail";
    document.body.appendChild(host);
    const root = host.attachShadow({ mode: "open" });
    const style = document.createElement("style");
    style.textContent = `${sdkDetailCss()}\n${EXTRA_CSS}`;
    root.appendChild(style);
    const mount = document.createElement("div");
    mount.style.display = "contents";
    root.appendChild(mount);
    setShadow({ host, mount });
    return () => {
      setShadow(null);
      host.remove();
    };
  }, [isOwner]);

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

  // The card's accent colour, for the badge.
  useEffect(() => {
    if (!shadow) return;
    if (request?.accentColor) shadow.host.style.setProperty("--vnc-accent", request.accentColor);
    else shadow.host.style.removeProperty("--vnc-accent");
  }, [shadow, request]);

  const close = useCallback(() => setRequest(null), []);

  if (!isOwner || !request || !shadow) return null;
  return createPortal(
    <KondomerietDetail key={openCount} request={request} host={shadow.host} onClose={close} />,
    shadow.mount
  );
}
