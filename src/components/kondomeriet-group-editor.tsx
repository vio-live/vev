import React, { useEffect, useMemo, useRef, useState } from "react";
import { SilkeBox, SilkeButton, SilkeModal, SilkeText } from "@vev/silke";
import { CatalogModal } from "./product-picker";
import { resolveActiveSponsorId, sponsorForSlot, type CatalogProduct } from "./vio-helpers";
import {
  deriveLabels,
  fetchKondomerietProducts,
  isValidSlug,
  loadFreshCatalog,
  parseCirclewiseLink,
  allGroupIds,
  parseGroups,
  serializeGroups,
  snapshotOf,
  slugFromProductUrl,
  type GroupsValue,
  type KondomerietGroup,
} from "./kondomeriet-helpers";

/**
 * Properties-panel editor of the Kondomeriet blocks' product groups. A group
 * is one card: 1..n products of the live catalog (one per colour / model /
 * size), in the order its selector shows them, with label and Hurtigkasse
 * slug overrides, a card title and a time-boxed discount badge.
 *
 * - `KondomerietGroupEditor`  → one group (the card)
 * - `KondomerietGroupsEditor` → a list of groups (carousel / grid: one card each)
 *
 * Value: `{ data: "<json>" }` (see `KondomerietGroup`). Products are picked with
 * the Vio blocks' own catalog modal; the details (order, labels, slugs,
 * discount) are edited in a second modal — never one modal inside another.
 */

const inputStyle: React.CSSProperties = {
  width: "100%",
  padding: "7px 9px",
  fontSize: 12,
  border: "1px solid #ddd",
  borderRadius: 6,
  outline: "none",
  boxSizing: "border-box",
  background: "#fff",
  color: "#0a0a0a",
};
const labelStyle: React.CSSProperties = { fontSize: 11, opacity: 0.6, marginBottom: 3 };

function useCatalogMap(trigger: unknown): Map<number, CatalogProduct> {
  const [map, setMap] = useState<Map<number, CatalogProduct>>(new Map());
  useEffect(() => {
    let cancelled = false;
    loadFreshCatalog()
      .then((list) => {
        if (!cancelled) setMap(new Map(list.map((p) => [Number(p.id), p])));
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [trigger]);
  return map;
}

function groupSummary(g: KondomerietGroup, catalog: Map<number, CatalogProduct>): string {
  if (g.ids.length === 0) return "No products yet";
  const titles = g.ids.map((id) => catalog.get(id)?.title ?? `#${id}`);
  const title = g.title || deriveLabels(titles).title;
  return `${title} · ${g.ids.length} product${g.ids.length === 1 ? "" : "s"}`;
}

/** The second modal: order, labels, slugs, title and discount of one group. */
function GroupDetailsModal({
  group,
  catalog,
  onSave,
  onClose,
}: {
  group: KondomerietGroup;
  catalog: Map<number, CatalogProduct>;
  onSave: (g: KondomerietGroup) => void;
  onClose: () => void;
}) {
  const [draft, setDraft] = useState<KondomerietGroup>(() => ({
    ...group,
    labels: { ...(group.labels ?? {}) },
    slugs: { ...(group.slugs ?? {}) },
  }));
  // The shop URL of each product (live, with origin_url) — what the slug is read from.
  const [shopSlugs, setShopSlugs] = useState<Record<string, string | null> | null>(null);
  const idsKey = draft.ids.join(",");
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const sponsor = sponsorForSlot(null, await resolveActiveSponsorId());
      const list = await fetchKondomerietProducts(draft.ids, sponsor, null, { full: true });
      if (cancelled) return;
      const out: Record<string, string | null> = {};
      for (const id of draft.ids) {
        const p = list.find((x) => Number(x?.id) === id);
        out[String(id)] = p ? slugFromProductUrl(p.origin_url) : null;
      }
      setShopSlugs(out);
    })().catch(() => setShopSlugs({}));
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [idsKey]);

  const titles = draft.ids.map((id) => catalog.get(id)?.title ?? "");
  const derived = deriveLabels(titles);
  const set = (patch: Partial<KondomerietGroup>) => setDraft((d) => ({ ...d, ...patch }));
  const setIn = (field: "labels" | "slugs", id: number, value: string) =>
    setDraft((d) => ({ ...d, [field]: { ...(d[field] ?? {}), [String(id)]: value } }));
  const move = (i: number, dir: number) => {
    const j = i + dir;
    if (j < 0 || j >= draft.ids.length) return;
    const ids = [...draft.ids];
    [ids[i], ids[j]] = [ids[j], ids[i]];
    set({ ids });
  };
  const remove = (id: number) => set({ ids: draft.ids.filter((x) => x !== id) });
  const save = () => {
    onSave(draft);
    onClose();
  };

  return (
    <SilkeModal title="Card details" size="large" onClose={save}>
      <SilkeBox column gap="m" style={{ minWidth: 680 }}>
        <div>
          <div style={labelStyle}>Card title (empty: the words the products' titles share)</div>
          <input
            style={inputStyle}
            value={draft.title ?? ""}
            placeholder={derived.title || "Title"}
            onChange={(e) => set({ title: e.target.value })}
          />
        </div>

        <div>
          <div style={labelStyle}>
            Options, in selector order. Label: empty = derived from the title. Hurtigkasse slug: empty = read from the
            product's kondomeriet.no URL.
          </div>
          {draft.ids.length === 0 ? (
            <SilkeText style={{ opacity: 0.6 }}>No products — add them with "Products".</SilkeText>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 8, maxHeight: "44vh", overflowY: "auto" }}>
              {draft.ids.map((id, i) => {
                const p = catalog.get(id);
                const shop = shopSlugs?.[String(id)];
                const override = draft.slugs?.[String(id)] ?? "";
                const badOverride = override.trim() !== "" && !isValidSlug(override);
                return (
                  <div
                    key={id}
                    style={{
                      display: "grid",
                      gridTemplateColumns: "44px minmax(0,1.4fr) minmax(0,1fr) minmax(0,1.2fr) auto",
                      gap: 8,
                      alignItems: "center",
                      padding: 6,
                      border: "1px solid #e5e5e5",
                      borderRadius: 8,
                    }}
                  >
                    <div style={{ width: 44, height: 44, borderRadius: 6, overflow: "hidden", background: "#f2f2f2" }}>
                      {p?.images?.[0]?.url ? (
                        <img src={p.images[0].url} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                      ) : null}
                    </div>
                    <div style={{ fontSize: 12, lineHeight: 1.3, overflow: "hidden" }}>
                      <div style={{ fontWeight: 600, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                        {p?.title ?? `Product #${id}`}
                      </div>
                      <div style={{ opacity: 0.55 }}>#{id}</div>
                    </div>
                    <input
                      style={inputStyle}
                      value={draft.labels?.[String(id)] ?? ""}
                      placeholder={derived.labels[i] || "Label"}
                      aria-label="Option label"
                      onChange={(e) => setIn("labels", id, e.target.value)}
                    />
                    <div>
                      <input
                        style={{ ...inputStyle, borderColor: badOverride ? "#e5484d" : "#ddd" }}
                        value={override}
                        placeholder={shopSlugs == null ? "checking…" : shop ?? "no kondomeriet.no URL"}
                        aria-label="Hurtigkasse slug"
                        onChange={(e) => setIn("slugs", id, e.target.value)}
                      />
                      {shopSlugs != null && !shop && !override.trim() ? (
                        <div style={{ fontSize: 10, color: "#e5484d", marginTop: 2 }}>
                          No shop URL: "Kjøp med Vipps" is off until a slug is set.
                        </div>
                      ) : null}
                    </div>
                    <div style={{ display: "flex", gap: 2 }}>
                      <SilkeButton label="↑" size="s" kind="ghost" onClick={() => move(i, -1)} disabled={i === 0} />
                      <SilkeButton
                        label="↓"
                        size="s"
                        kind="ghost"
                        onClick={() => move(i, 1)}
                        disabled={i === draft.ids.length - 1}
                      />
                      <SilkeButton label="✕" size="s" kind="ghost" onClick={() => remove(id)} />
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 10 }}>
          <div>
            <div style={labelStyle}>Discount badge (e.g. −60 %)</div>
            <input style={inputStyle} value={draft.discount ?? ""} placeholder="Off" onChange={(e) => set({ discount: e.target.value })} />
          </div>
          <div>
            <div style={labelStyle}>Shows from (reader's local time)</div>
            <input
              type="datetime-local"
              style={inputStyle}
              value={draft.discountStart ?? ""}
              onChange={(e) => set({ discountStart: e.target.value })}
            />
          </div>
          <div>
            <div style={labelStyle}>Hidden from</div>
            <input
              type="datetime-local"
              style={inputStyle}
              value={draft.discountEnd ?? ""}
              onChange={(e) => set({ discountEnd: e.target.value })}
            />
          </div>
        </div>
        <div>
          <div style={labelStyle}>Tracking link (Circlewise) — optional override for this card; empty: the block's, else the default (Config, ref1 from the sheet)</div>
          <input
            style={{ ...inputStyle, borderColor: parseCirclewiseLink(draft.tracking).error ? "#e5484d" : "#ddd" }}
            value={draft.tracking ?? ""}
            placeholder="https://c.trackmytarget.com/?a=…&i=…&ref1=…"
            onChange={(e) => set({ tracking: e.target.value })}
          />
          {parseCirclewiseLink(draft.tracking).error ? (
            <div style={{ fontSize: 10, color: "#e5484d", marginTop: 2 }}>
              {parseCirclewiseLink(draft.tracking).error} — needs c.trackmytarget.com with a, i and ref1. Until then the default Circlewise link is used.
            </div>
          ) : parseCirclewiseLink(draft.tracking).link ? (
            <div style={{ fontSize: 10, opacity: 0.6, marginTop: 2 }}>
              ref1 = {parseCirclewiseLink(draft.tracking).link!.ref1} · goes through Circlewise to the Hurtigkasse.
            </div>
          ) : null}
        </div>
        <div style={{ maxWidth: 360 }}>
          <div style={labelStyle}>Offer ends (this card) — «Tilbudet gjelder til …» until then</div>
          <input
            type="datetime-local"
            style={inputStyle}
            value={draft.offerEnd ?? ""}
            onChange={(e) => set({ offerEnd: e.target.value })}
          />
        </div>
        <div style={{ maxWidth: 360 }}>
          <div style={labelStyle}>Buy on card (this card)</div>
          <select
            style={inputStyle}
            value={draft.buyOnCard ?? ""}
            onChange={(e) => set({ buyOnCard: (e.target.value || undefined) as KondomerietGroup["buyOnCard"] })}
          >
            <option value="">As the block (default)</option>
            <option value="auto">Auto — Vipps on the card for one product, «Se mer» for options</option>
            <option value="always">Always — selector and Vipps on the card</option>
            <option value="never">Never — only «Se mer»</option>
          </select>
        </div>
        <SilkeText style={{ fontSize: 11, opacity: 0.6 }}>
          A real sale price from the feed (compare-at) always shows as a struck-through old price, with or without a badge.
        </SilkeText>

        <SilkeBox gap="s" style={{ justifyContent: "flex-end" }}>
          <SilkeButton label="Cancel" kind="secondary" onClick={onClose} />
          <SilkeButton label="Done" kind="primary" onClick={save} />
        </SilkeBox>
      </SilkeBox>
    </SilkeModal>
  );
}

function GroupsPanel({ value, onChange, multi }: { value?: GroupsValue; onChange: (v: GroupsValue) => void; multi: boolean }) {
  const stored = parseGroups(value);
  const groups: KondomerietGroup[] = multi ? stored : [stored[0] ?? { ids: [] }];
  const [picking, setPicking] = useState<number | null>(null);
  const [editing, setEditing] = useState<number | null>(null);
  // Titles and photos of the panel: read again each time the picker closes.
  const catalog = useCatalogMap(picking == null);
  const commit = (next: KondomerietGroup[]) => onChange(serializeGroups(next));
  const update = (i: number, g: KondomerietGroup) => commit(groups.map((x, j) => (j === i ? g : x)));
  const move = (i: number, dir: number) => {
    const j = i + dir;
    if (j < 0 || j >= groups.length) return;
    const next = [...groups];
    [next[i], next[j]] = [next[j], next[i]];
    commit(next);
  };
  const pickingGroup = picking != null ? groups[picking] : null;
  const selected = useMemo(() => new Set<number>(pickingGroup?.ids ?? []), [pickingGroup]);

  // The snapshot the published card paints from at once (title, brand,
  // price, compare-at, image, shop URL, stock, rating): taken when products
  // are picked and again when it is a day old, from the live API with the
  // shop URL. Written back only when something changed.
  const snapKey = groups.map((g) => g.ids.join(",")).join("|");
  const [snapState, setSnapState] = useState<"idle" | "working" | "done" | "failed">("idle");
  const snapRun = useRef("");
  useEffect(() => {
    const ids = allGroupIds(groups);
    if (ids.length === 0) return;
    const stale = groups.some((g) =>
      g.ids.some((id) => {
        const s = g.snap?.[String(id)];
        return !s || !s.at || Date.now() - s.at > 24 * 3600 * 1000;
      })
    );
    if (!stale || snapRun.current === snapKey) return;
    snapRun.current = snapKey;
    let cancelled = false;
    setSnapState("working");
    (async () => {
      const sponsor = sponsorForSlot(null, await resolveActiveSponsorId());
      // The full product: the snapshot keeps the rating line of the description.
      const list = await fetchKondomerietProducts(ids, sponsor, null, { full: true });
      if (cancelled) return;
      if (!list.length) {
        setSnapState("failed");
        return;
      }
      const byId = new Map(list.map((p) => [Number(p.id), p]));
      const next = groups.map((g) => {
        const snap: Record<string, any> = {};
        for (const id of g.ids) {
          const p = byId.get(id);
          if (p) snap[String(id)] = snapshotOf(p);
          else if (g.snap?.[String(id)]) snap[String(id)] = g.snap[String(id)];
        }
        return { ...g, snap };
      });
      setSnapState("done");
      commit(next);
    })().catch(() => !cancelled && setSnapState("failed"));
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [snapKey]);
  const snapped = groups.reduce((n, g) => n + g.ids.filter((id) => g.snap?.[String(id)]).length, 0);
  const total = groups.reduce((n, g) => n + g.ids.length, 0);

  return (
    <SilkeBox column gap="s" style={{ width: "100%" }}>
      {multi && groups.length === 0 ? <SilkeText style={{ opacity: 0.6 }}>No cards yet</SilkeText> : null}
      {total > 0 ? (
        <SilkeText style={{ fontSize: 11, opacity: 0.6 }}>
          {snapState === "working"
            ? "Saving a snapshot for instant loading…"
            : `Instant loading: ${snapped}/${total} products saved${snapState === "failed" ? " (could not refresh — connect the Config)" : ""}`}
        </SilkeText>
      ) : null}
      {groups.map((g, i) => (
        <SilkeBox key={i} column gap="xs" style={{ width: "100%", paddingBottom: 6, borderBottom: multi ? "1px solid rgba(127,127,127,0.25)" : undefined }}>
          <SilkeText overflow style={{ opacity: g.ids.length ? 1 : 0.6 }}>
            {multi ? `${i + 1}. ` : ""}
            {groupSummary(g, catalog)}
          </SilkeText>
          <SilkeBox gap="xs" style={{ flexWrap: "wrap" }}>
            <SilkeButton label="Products" size="s" kind="secondary" onClick={() => setPicking(i)} />
            <SilkeButton label="Details" size="s" kind="secondary" onClick={() => setEditing(i)} disabled={g.ids.length === 0} />
            {multi ? (
              <>
                <SilkeButton label="↑" size="s" kind="ghost" onClick={() => move(i, -1)} disabled={i === 0} />
                <SilkeButton label="↓" size="s" kind="ghost" onClick={() => move(i, 1)} disabled={i === groups.length - 1} />
                <SilkeButton label="✕" size="s" kind="ghost" onClick={() => commit(groups.filter((_, j) => j !== i))} />
              </>
            ) : null}
          </SilkeBox>
        </SilkeBox>
      ))}
      {multi ? (
        <SilkeButton
          label="+ Add card"
          size="s"
          kind="primary"
          onClick={() => {
            commit([...groups, { ids: [] }]);
            setPicking(groups.length);
          }}
        />
      ) : null}

      {pickingGroup && picking != null ? (
        <CatalogModal
          multi
          // Fresh on every opening, never the page's cached list (see loadFreshCatalog).
          load={loadFreshCatalog}
          selectedIds={selected}
          onToggle={(id) => {
            const ids = pickingGroup.ids.includes(id) ? pickingGroup.ids.filter((x) => x !== id) : [...pickingGroup.ids, id];
            update(picking, { ...pickingGroup, ids });
          }}
          onClose={() => setPicking(null)}
        />
      ) : null}
      {editing != null && groups[editing] ? (
        <GroupDetailsModal
          group={groups[editing]}
          catalog={catalog}
          onSave={(g) => update(editing, g)}
          onClose={() => setEditing(null)}
        />
      ) : null}
    </SilkeBox>
  );
}

export function KondomerietGroupEditor(props: { value?: GroupsValue; onChange: (v: GroupsValue) => void }) {
  return <GroupsPanel value={props.value} onChange={props.onChange} multi={false} />;
}

export function KondomerietGroupsEditor(props: { value?: GroupsValue; onChange: (v: GroupsValue) => void }) {
  return <GroupsPanel value={props.value} onChange={props.onChange} multi />;
}
