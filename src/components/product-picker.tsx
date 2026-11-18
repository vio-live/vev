import React, { useEffect, useMemo, useState } from "react";
import { SilkeModal, SilkeButton, SilkeBox, SilkeText, SilkeLoader } from "@vev/silke";
import {
  loadCatalog,
  loadCatalogResult,
  getProductPriceAmount,
  type CatalogProduct,
  type Item,
} from "./vio-helpers";

/**
 * Modal product picker — lists the commerce catalog (the products tied to the
 * sponsor's commerce apiKey) so the editor picks products visually. Uses Vev's
 * native SilkeModal (a raw createPortal to document.body crashes the editor).
 *   - ProductSelect      → single product  (value: { productId, sponsorId })
 *   - ProductMultiSelect → many products    (value: { ids: "1,2,3" })
 */

/** Parse the comma-separated product-id string used by carousel/grid. */
export function parseIds(ids?: string): number[] {
  return (ids ?? "")
    .split(",")
    .map((s) => Number(s.trim()))
    .filter((n) => Number.isFinite(n) && n > 0);
}

function money(amount: number, p: CatalogProduct): string {
  const n = Math.round(amount * 100) / 100;
  return `${Number.isInteger(n) ? n : n.toFixed(2)} ${p.price?.currency_code ?? ""}`.trim();
}

/** The price before the sale, when the shop sends a real one above today's (never derived from a %). */
function wasAmount(p: CatalogProduct): number | null {
  const now = getProductPriceAmount(p);
  const was = Number((p as any)?.price?.compare_at_incl_taxes ?? (p as any)?.price?.compare_at ?? NaN);
  return now != null && Number.isFinite(was) && was > now ? was : null;
}

/** Extra facts a block's picker knows about a product (Kondomeriet: the Black Week sheet's discount). */
export type PickerFacts = { discount?: string | null };

/** Sale price, the struck price before it, and the discount: computed from the real «before» price, else the block's. */
function PriceLine({ p, facts, size }: { p: CatalogProduct; facts?: PickerFacts; size: number }) {
  const now = getProductPriceAmount(p);
  if (now == null) return null;
  const was = wasAmount(p);
  const pct = was != null ? `−${Math.round((1 - now / was) * 100)} %` : facts?.discount ? `−${facts.discount.replace(/^[-−]/, "")}` : null;
  return (
    <span style={{ display: "inline-flex", alignItems: "baseline", gap: 6, flexWrap: "wrap", fontSize: size }}>
      <span style={{ fontWeight: 600, color: was != null ? "#ff6b6b" : undefined }}>{money(now, p)}</span>
      {was != null ? <span style={{ opacity: 0.55, textDecoration: "line-through", fontSize: size - 1 }}>{money(was, p)}</span> : null}
      {pct ? (
        <span
          title={was != null ? "From the shop's previous price" : "From the campaign sheet (no previous price from the shop yet)"}
          style={{ fontSize: size - 2, fontWeight: 700, padding: "1px 5px", borderRadius: 4, background: was != null ? "#c62828" : "#5a3a00", color: "#fff" }}
        >
          {pct}
        </span>
      ) : null}
    </span>
  );
}

const VIEW_KEY = "vio.picker.view";
function readView(): "grid" | "list" {
  try {
    // List by default (Angelo): the grid of big cards only when the editor chose it.
    return localStorage.getItem(VIEW_KEY) === "grid" ? "grid" : "list";
  } catch {
    return "list";
  }
}

export function CatalogModal({
  multi,
  selectedIds,
  onToggle,
  onClose,
  load = loadCatalog,
  title,
  describe,
  errorHint,
}: {
  multi: boolean;
  selectedIds: Set<number>;
  onToggle: (id: number) => void;
  onClose: () => void;
  /** Where the list comes from. Default: the shared, cached `loadCatalog` (every Vio block's picker). */
  load?: () => Promise<CatalogProduct[]>;
  /** The modal's title. Default: «Select products» / «Select a product» (every Vio block's picker). */
  title?: string;
  /** What the block knows about a product beyond the catalog (shown next to its price). */
  describe?: (p: CatalogProduct) => PickerFacts | undefined;
  /** Shown under a loading error: what the editor should check. */
  errorHint?: string;
}) {
  const [products, setProducts] = useState<CatalogProduct[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [view, setView] = useState<"grid" | "list">(readView);
  const pickView = (v: "grid" | "list") => {
    setView(v);
    try {
      localStorage.setItem(VIEW_KEY, v);
    } catch {}
  };

  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    // The SDK refuses a bootstrap for 5 s after a failed one («backing off»):
    // one quiet retry after that, so the real answer (or a working list) shows.
    const run = () => load();
    run()
      .catch((e: any) =>
        /backing off/i.test(String(e?.message ?? "")) ? new Promise<CatalogProduct[]>((r) => setTimeout(r, 5200)).then(run) : Promise.reject(e)
      )
      .then((list) => {
        if (!cancelled) {
          setProducts(list);
          setLoading(false);
        }
      })
      .catch((e: any) => {
        if (!cancelled) {
          setError(e?.message ?? "Could not load the catalog");
          setLoading(false);
        }
      });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [attempt]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return products;
    return products.filter((p) =>
      `${p.brand ?? ""} ${p.title ?? ""} ${p.id}`.toLowerCase().includes(q)
    );
  }, [products, query]);

  return (
    <SilkeModal
      title={title ?? (multi ? "Select products" : "Select a product")}
      size="large"
      onClose={onClose}
    >
      <SilkeBox column gap="m" style={{ minWidth: 640 }}>
        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search brand, name or id…"
          style={{
            width: "100%",
            padding: "9px 12px",
            fontSize: 13,
            // Explicit colours: the editor's dark theme left the text white
            // on the browser's white input (Alan, #491).
            color: "#fff",
            caretColor: "#fff",
            background: "#2b2b2b",
            border: "1px solid #4a4a4a",
            borderRadius: 8,
            outline: "none",
            boxSizing: "border-box",
          }}
        />
          <div role="group" aria-label="View" style={{ display: "flex", border: "1px solid #4a4a4a", borderRadius: 8, overflow: "hidden", flex: "0 0 auto" }}>
            {(["grid", "list"] as const).map((v) => (
              <button
                key={v}
                type="button"
                onClick={() => pickView(v)}
                aria-pressed={view === v}
                style={{
                  padding: "8px 12px",
                  fontSize: 12,
                  border: "none",
                  cursor: "pointer",
                  color: "#fff",
                  background: view === v ? "#0a63f4" : "#2b2b2b",
                }}
              >
                {v === "grid" ? "Grid" : "List"}
              </button>
            ))}
          </div>
        </div>

        {loading ? (
          <SilkeBox style={{ padding: 40, justifyContent: "center" }}>
            <SilkeLoader />
          </SilkeBox>
        ) : error ? (
          <SilkeBox column gap="s" style={{ padding: 20 }}>
            <SilkeText style={{ color: "#e5484d" }}>{error.replace(/^\[Vio\]\s*/, "Could not load the catalog: ")}</SilkeText>
            {errorHint ? <SilkeText style={{ opacity: 0.75 }}>{errorHint}</SilkeText> : null}
            <SilkeBox>
              <SilkeButton label="Try again" size="s" kind="secondary" onClick={() => setAttempt((n) => n + 1)} />
            </SilkeBox>
          </SilkeBox>
        ) : filtered.length === 0 ? (
          <SilkeText style={{ opacity: 0.6, padding: 20 }}>No products found</SilkeText>
        ) : view === "list" ? (
          <div style={{ maxHeight: "56vh", overflowY: "auto", display: "flex", flexDirection: "column", gap: 4 }}>
            {filtered.map((p) => {
              const id = Number(p.id);
              const selected = selectedIds.has(id);
              return (
                <div
                  key={p.id}
                  onClick={() => onToggle(id)}
                  style={{
                    cursor: "pointer",
                    display: "grid",
                    gridTemplateColumns: "22px 44px minmax(0, 1fr) auto",
                    alignItems: "center",
                    gap: 10,
                    padding: "6px 10px",
                    borderRadius: 8,
                    border: selected ? "1px solid #0a63f4" : "1px solid transparent",
                    background: selected ? "rgba(10,99,244,0.12)" : "rgba(255,255,255,0.03)",
                  }}
                >
                  <span
                    style={{
                      width: 18,
                      height: 18,
                      borderRadius: 4,
                      border: selected ? "none" : "1px solid #777",
                      background: selected ? "#0a63f4" : "transparent",
                      color: "#fff",
                      fontSize: 12,
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                    }}
                  >
                    {selected ? "✓" : ""}
                  </span>
                  <div style={{ width: 44, height: 44, borderRadius: 6, overflow: "hidden", background: "#f2f2f2" }}>
                    {p.images?.[0]?.url ? (
                      <img src={p.images[0].url} alt="" loading="lazy" style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }} />
                    ) : null}
                  </div>
                  <div style={{ minWidth: 0 }}>
                    <div style={{ fontSize: 13, fontWeight: 500, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{p.title}</div>
                    <div style={{ fontSize: 11, opacity: 0.55, textTransform: "uppercase" }}>
                      {p.brand} · #{p.id}
                    </div>
                  </div>
                  <PriceLine p={p} facts={describe?.(p)} size={13} />
                </div>
              );
            })}
          </div>
        ) : (
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fill, minmax(150px, 1fr))",
              gap: 12,
              maxHeight: "56vh",
              overflowY: "auto",
            }}
          >
            {filtered.map((p) => {
              const id = Number(p.id);
              const selected = selectedIds.has(id);
              return (
                <div
                  key={p.id}
                  onClick={() => onToggle(id)}
                  style={{
                    cursor: "pointer",
                    padding: 8,
                    borderRadius: 10,
                    border: selected ? "2px solid #0a63f4" : "1px solid #e5e5e5",
                    background: selected ? "rgba(10,99,244,0.06)" : "transparent",
                  }}
                >
                  <div
                    style={{
                      position: "relative",
                      aspectRatio: "1 / 1",
                      borderRadius: 6,
                      overflow: "hidden",
                      background: "#f2f2f2",
                      marginBottom: 8,
                    }}
                  >
                    {p.images?.[0]?.url ? (
                      <img
                        src={p.images[0].url}
                        alt=""
                        style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }}
                      />
                    ) : null}
                    {selected ? (
                      <span
                        style={{
                          position: "absolute",
                          top: 6,
                          right: 6,
                          width: 22,
                          height: 22,
                          borderRadius: "50%",
                          background: "#0a63f4",
                          color: "#fff",
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          fontSize: 13,
                        }}
                      >
                        ✓
                      </span>
                    ) : null}
                  </div>
                  <div style={{ fontSize: 12, opacity: 0.55, textTransform: "uppercase" }}>{p.brand}</div>
                  <div
                    style={{
                      fontSize: 13,
                      fontWeight: 500,
                      lineHeight: 1.25,
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                      whiteSpace: "nowrap",
                    }}
                  >
                    {p.title}
                  </div>
                  <div style={{ marginTop: 2 }}>
                    <PriceLine p={p} facts={describe?.(p)} size={12} />
                  </div>
                </div>
              );
            })}
          </div>
        )}

        <SilkeBox gap="s" style={{ justifyContent: "flex-end" }}>
          <SilkeText style={{ opacity: 0.6, alignSelf: "center" }}>
            {selectedIds.size} selected
          </SilkeText>
          <SilkeButton label={multi ? "Done" : "Close"} kind="primary" onClick={onClose} />
        </SilkeBox>
      </SilkeBox>
    </SilkeModal>
  );
}

// ---- Single-select editor ---------------------------------------------------

export default function ProductSelect({
  value,
  onChange,
}: {
  value?: Item;
  onChange: (v: Item | null) => void;
}) {
  const [open, setOpen] = useState(false);
  const [catalog, setCatalog] = useState<CatalogProduct[]>([]);
  // The sponsor the catalog was listed under — the active one of the
  // connected key — is the one a picked product keeps.
  const [catalogSponsorId, setCatalogSponsorId] = useState<number | null>(null);
  const [catalogLoaded, setCatalogLoaded] = useState(false);
  useEffect(() => {
    loadCatalogResult()
      .then((result) => {
        setCatalog(result.products);
        setCatalogSponsorId(result.sponsorId);
        setCatalogLoaded(true);
      })
      .catch(() => {});
  }, [open]);

  const current =
    value?.productId != null ? catalog.find((c) => Number(c.id) === Number(value!.productId)) : undefined;
  const selectedIds = new Set<number>(value?.productId != null ? [Number(value.productId)] : []);

  return (
    <SilkeBox column gap="s">
      {current ? (
        <SilkeText overflow>{current.title}</SilkeText>
      ) : value?.productId != null && catalogLoaded ? (
        // Picked under another key or sponsor: the block shows it as
        // unavailable until a product of this catalog is picked.
        <SilkeText style={{ opacity: 0.6 }}>{`Product #${value.productId} is not in this sponsor's catalog`}</SilkeText>
      ) : (
        <SilkeText style={{ opacity: 0.6 }}>No product selected</SilkeText>
      )}
      <SilkeBox gap="xs">
        <SilkeButton
          label={current ? "Change product" : "Select a product"}
          size="s"
          kind="secondary"
          onClick={() => setOpen(true)}
        />
        {value ? <SilkeButton icon="undo" size="s" kind="ghost" onClick={() => onChange(null)} /> : null}
      </SilkeBox>
      {open ? (
        <CatalogModal
          multi={false}
          selectedIds={selectedIds}
          onToggle={(id) => {
            if (catalogSponsorId == null) return; // the catalog has not answered: nothing to pick from
            onChange({ productId: id, sponsorId: catalogSponsorId });
            setOpen(false);
          }}
          onClose={() => setOpen(false)}
        />
      ) : null}
    </SilkeBox>
  );
}

// ---- Multi-select editor ----------------------------------------------------

// Value is an OBJECT with a comma-separated id string `{ ids: "1,2,3" }`. A plain
// string field always serialises cleanly (Vev array props crash with a custom
// component; nested arrays are flaky). No sponsor is stored: the carousel and
// the grid use the page's active sponsor.
export function ProductMultiSelect({
  value,
  onChange,
}: {
  value?: { ids?: string };
  onChange: (v: { ids: string }) => void;
}) {
  const [open, setOpen] = useState(false);

  const ids = parseIds(value?.ids);
  const selectedIds = new Set<number>(ids);

  const toggle = (id: number) => {
    const next = selectedIds.has(id) ? ids.filter((x) => x !== id) : [...ids, id];
    onChange({ ids: next.join(",") });
  };

  return (
    <SilkeBox column gap="s">
      <SilkeText style={{ opacity: 0.6 }}>
        {ids.length > 0 ? `${ids.length} product${ids.length === 1 ? "" : "s"} selected` : "No products selected"}
      </SilkeText>
      <SilkeButton
        label={ids.length > 0 ? "Edit products" : "Select products"}
        size="s"
        kind="secondary"
        onClick={() => setOpen(true)}
      />
      {open ? (
        <CatalogModal
          multi
          selectedIds={selectedIds}
          onToggle={toggle}
          onClose={() => setOpen(false)}
        />
      ) : null}
    </SilkeBox>
  );
}
