import React, { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { loadCatalog, SPONSOR_ID, type CatalogProduct } from "./vio-helpers";

/**
 * Modal product picker — a richer replacement for the inline list. Opens a
 * full-screen catalog with big thumbnails + search, for a better preview when
 * choosing products. Two editors share it:
 *   - ProductSelect      → single product   (value: { productId, sponsorId })
 *   - ProductMultiSelect  → many products    (value: Array<{ productId, sponsorId }>)
 * Both are used as a prop `component` in registerVevComponent.
 */

type Item = { productId: number; sponsorId: number };

function priceLabel(p: CatalogProduct): string {
  if (!p.price?.amount) return "";
  return `${p.price.amount} ${p.price.currency_code ?? ""}`.trim();
}

// ---- Catalog modal (shared) -------------------------------------------------

function CatalogModal({
  open,
  multi,
  selectedIds,
  onToggle,
  onClose,
}: {
  open: boolean;
  multi: boolean;
  selectedIds: Set<number>;
  onToggle: (id: number) => void;
  onClose: () => void;
}) {
  const [products, setProducts] = useState<CatalogProduct[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState("");

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    setLoading(true);
    setError(null);
    loadCatalog()
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
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return products;
    return products.filter((p) =>
      `${p.brand ?? ""} ${p.title ?? ""} ${p.id}`.toLowerCase().includes(q)
    );
  }, [products, query]);

  if (!open || typeof document === "undefined") return null;

  return createPortal(
    <div
      onClick={onClose}
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 2147483600,
        background: "rgba(0,0,0,0.45)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: 24,
        fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          width: "min(880px, 100%)",
          maxHeight: "86vh",
          background: "#fff",
          color: "#0a0a0a",
          borderRadius: 12,
          boxShadow: "0 20px 60px rgba(0,0,0,0.35)",
          display: "flex",
          flexDirection: "column",
          overflow: "hidden",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 12, padding: "16px 18px", borderBottom: "1px solid #eee" }}>
          <strong style={{ fontSize: 15 }}>{multi ? "Select products" : "Select a product"}</strong>
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search brand, name or id…"
            style={{
              flex: 1,
              padding: "8px 12px",
              fontSize: 13,
              border: "1px solid #ddd",
              borderRadius: 8,
              outline: "none",
              background: "#fafafa",
            }}
          />
          <span style={{ fontSize: 12, opacity: 0.6, whiteSpace: "nowrap" }}>{selectedIds.size} selected</span>
          <button
            type="button"
            onClick={onClose}
            style={{
              padding: "8px 14px",
              fontSize: 13,
              fontWeight: 600,
              color: "#fff",
              background: "#0a0a0a",
              border: "none",
              borderRadius: 8,
              cursor: "pointer",
            }}
          >
            {multi ? "Done" : "Close"}
          </button>
        </div>

        <div style={{ overflowY: "auto", padding: 18 }}>
          {loading ? (
            <div style={{ padding: 40, textAlign: "center", opacity: 0.6 }}>Loading products…</div>
          ) : error ? (
            <div style={{ padding: 40, textAlign: "center", color: "#e5484d" }}>{error}</div>
          ) : filtered.length === 0 ? (
            <div style={{ padding: 40, textAlign: "center", opacity: 0.6 }}>No products found</div>
          ) : (
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fill, minmax(150px, 1fr))",
                gap: 14,
              }}
            >
              {filtered.map((p) => {
                const id = Number(p.id);
                const selected = selectedIds.has(id);
                return (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => onToggle(id)}
                    style={{
                      textAlign: "left",
                      padding: 8,
                      borderRadius: 10,
                      cursor: "pointer",
                      background: selected ? "rgba(10,10,10,0.05)" : "#fff",
                      border: selected ? "2px solid #0a0a0a" : "1px solid #e5e5e5",
                      position: "relative",
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
                            background: "#0a0a0a",
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
                    <div style={{ fontSize: 12, opacity: 0.55, textTransform: "uppercase", letterSpacing: "0.05em" }}>
                      {p.brand}
                    </div>
                    <div
                      style={{
                        fontSize: 13,
                        fontWeight: 500,
                        lineHeight: 1.25,
                        display: "-webkit-box",
                        WebkitLineClamp: 2,
                        WebkitBoxOrient: "vertical",
                        overflow: "hidden",
                      }}
                    >
                      {p.title}
                    </div>
                    <div style={{ fontSize: 12, opacity: 0.7, marginTop: 2 }}>{priceLabel(p)}</div>
                  </button>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>,
    document.body
  );
}

// ---- Trigger button (inline, in the properties panel) -----------------------

function triggerStyle(): React.CSSProperties {
  return {
    width: "100%",
    padding: "10px 12px",
    fontSize: 13,
    fontWeight: 600,
    color: "#fff",
    background: "#0a0a0a",
    border: "none",
    borderRadius: 8,
    cursor: "pointer",
  };
}

// ---- Single-select editor ---------------------------------------------------

export default function ProductSelect({
  value,
  onChange,
}: {
  value?: Item;
  onChange: (v: Item) => void;
}) {
  const [open, setOpen] = useState(false);
  const [catalog, setCatalog] = useState<CatalogProduct[]>([]);
  useEffect(() => {
    loadCatalog().then(setCatalog).catch(() => {});
  }, []);

  const current = value?.productId != null ? catalog.find((c) => Number(c.id) === Number(value!.productId)) : undefined;
  const selectedIds = new Set<number>(value?.productId != null ? [Number(value.productId)] : []);

  return (
    <div>
      {current ? (
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 8 }}>
          <img
            src={current.images?.[0]?.url}
            alt=""
            style={{ width: 40, height: 40, objectFit: "cover", borderRadius: 6, background: "#f2f2f2" }}
          />
          <div style={{ minWidth: 0 }}>
            <div style={{ fontSize: 13, fontWeight: 500, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
              {current.title}
            </div>
            <div style={{ fontSize: 12, opacity: 0.6 }}>{priceLabel(current)} · #{current.id}</div>
          </div>
        </div>
      ) : null}
      <button type="button" style={triggerStyle()} onClick={() => setOpen(true)}>
        {current ? "Change product" : "Select a product"}
      </button>
      <CatalogModal
        open={open}
        multi={false}
        selectedIds={selectedIds}
        onToggle={(id) => {
          onChange({ productId: id, sponsorId: SPONSOR_ID });
          setOpen(false);
        }}
        onClose={() => setOpen(false)}
      />
    </div>
  );
}

// ---- Multi-select editor ----------------------------------------------------

// The value is an OBJECT `{ items: Item[] }` (not a bare array): Vev's array-typed
// props don't play well with a custom `component`, but object props do.
export function ProductMultiSelect({
  value,
  onChange,
}: {
  value?: { items?: Item[] };
  onChange: (v: { items: Item[] }) => void;
}) {
  const [open, setOpen] = useState(false);
  const [catalog, setCatalog] = useState<CatalogProduct[]>([]);
  useEffect(() => {
    loadCatalog().then(setCatalog).catch(() => {});
  }, []);

  const items = Array.isArray(value?.items) ? value!.items! : [];
  const selectedIds = new Set<number>(items.map((i) => Number(i.productId)));

  const toggle = (id: number) => {
    if (selectedIds.has(id)) {
      onChange({ items: items.filter((i) => Number(i.productId) !== id) });
    } else {
      onChange({ items: [...items, { productId: id, sponsorId: SPONSOR_ID }] });
    }
  };

  const selectedProducts = items
    .map((i) => catalog.find((c) => Number(c.id) === Number(i.productId)))
    .filter(Boolean) as CatalogProduct[];

  return (
    <div>
      {selectedProducts.length > 0 ? (
        <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 8 }}>
          {selectedProducts.map((p) => (
            <img
              key={p.id}
              src={p.images?.[0]?.url}
              alt=""
              title={p.title}
              style={{ width: 36, height: 36, objectFit: "cover", borderRadius: 5, background: "#f2f2f2" }}
            />
          ))}
        </div>
      ) : null}
      <button type="button" style={triggerStyle()} onClick={() => setOpen(true)}>
        {items.length > 0 ? `Edit products (${items.length})` : "Select products"}
      </button>
      <CatalogModal
        open={open}
        multi
        selectedIds={selectedIds}
        onToggle={toggle}
        onClose={() => setOpen(false)}
      />
    </div>
  );
}
