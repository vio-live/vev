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

function priceLabel(p: CatalogProduct): string {
  const amount = getProductPriceAmount(p);
  if (amount == null) return "";
  return `${amount} ${p.price?.currency_code ?? ""}`.trim();
}

export function CatalogModal({
  multi,
  selectedIds,
  onToggle,
  onClose,
  load = loadCatalog,
  title,
}: {
  multi: boolean;
  selectedIds: Set<number>;
  onToggle: (id: number) => void;
  onClose: () => void;
  /** Where the list comes from. Default: the shared, cached `loadCatalog` (every Vio block's picker). */
  load?: () => Promise<CatalogProduct[]>;
  /** The modal's title. Default: «Select products» / «Select a product» (every Vio block's picker). */
  title?: string;
}) {
  const [products, setProducts] = useState<CatalogProduct[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState("");

  useEffect(() => {
    let cancelled = false;
    load()
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
  }, []);

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

        {loading ? (
          <SilkeBox style={{ padding: 40, justifyContent: "center" }}>
            <SilkeLoader />
          </SilkeBox>
        ) : error ? (
          <SilkeText style={{ color: "#e5484d", padding: 20 }}>{error}</SilkeText>
        ) : filtered.length === 0 ? (
          <SilkeText style={{ opacity: 0.6, padding: 20 }}>No products found</SilkeText>
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
                  <div style={{ fontSize: 12, opacity: 0.7, marginTop: 2 }}>{priceLabel(p)}</div>
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
