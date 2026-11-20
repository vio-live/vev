import React, { useState } from "react";

/**
 * Moving a page from the Kondomeriet blocks of the shared Vio package to the
 * Kondomeriet package (no Vio SDK): the same props in both, so the old block
 * copies all of its settings and the new one pastes them.
 *
 * - Old block (shared package): «Copy settings for the Kondomeriet package» —
 *   its props as JSON on the clipboard (`kondomeriet-settings/1`).
 * - New block (this package): «Paste settings from the old block» — kept in
 *   its own prop (`pastedSettings`; a field can only write its own prop). The
 *   block then takes each pasted value for every prop still at its default;
 *   whatever is changed on the new block wins. The products editor shows the
 *   pasted cards until they are edited, then saves them as its own.
 *
 * This file is the same in both packages (src/components and
 * kondomeriet/src/components).
 */

export const SETTINGS_FORMAT = "kondomeriet-settings/1";
export type BlockKind = "config" | "card" | "grid" | "carousel";
type Pasted = { format: string; kind: BlockKind; at: number; props: Record<string, unknown> };

/** Never copied: this machinery's own props and what Vev hands a block at runtime. */
const SKIP = new Set(["copySettings", "pastedSettings", "hostRef", "children", "editMode"]);

const box: React.CSSProperties = { display: "flex", flexDirection: "column", gap: 6, width: "100%", fontSize: 12, lineHeight: 1.4 };
const button: React.CSSProperties = {
  padding: "6px 10px",
  borderRadius: 6,
  border: "1px solid rgba(127,127,127,0.4)",
  background: "transparent",
  color: "inherit",
  cursor: "pointer",
  font: "inherit",
};

function settingsOf(kind: BlockKind, props: Record<string, unknown> | undefined): string {
  const clean: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(props ?? {})) if (!SKIP.has(k) && v !== undefined) clean[k] = v;
  return JSON.stringify({ format: SETTINGS_FORMAT, kind, at: Date.now(), props: clean } satisfies Pasted);
}

/** Old block's panel: copies its settings (Vev hands a prop editor the block's props in `context.value`). */
export function makeCopySettingsField(kind: BlockKind) {
  return function KondomerietCopySettingsField({ context }: { context?: { value?: Record<string, unknown> } }) {
    const [state, setState] = useState<"idle" | "copied" | "manual">("idle");
    const text = settingsOf(kind, context?.value);
    const copy = async () => {
      try {
        await navigator.clipboard.writeText(text);
        setState("copied");
      } catch {
        setState("manual");
      }
    };
    return React.createElement(
      "div",
      { style: box },
      React.createElement("button", { type: "button", style: button, onClick: copy }, "Copy settings for the Kondomeriet package"),
      state === "copied"
        ? React.createElement("div", { style: { opacity: 0.8 } }, "Copied. In the new block: «Paste settings from the old block».")
        : null,
      state === "manual"
        ? React.createElement("textarea", { readOnly: true, value: text, rows: 4, style: { width: "100%", fontSize: 11 }, onFocus: (e: any) => e.target.select() })
        : null
    );
  };
}

export function copySettingsProp(kind: BlockKind): any {
  return { name: "copySettings", title: "Move to the Kondomeriet package", type: "string", component: makeCopySettingsField(kind) };
}

export function readPasted(value: unknown): Pasted | null {
  try {
    const raw = typeof value === "string" ? value : (value as { data?: string } | null)?.data;
    const p = raw ? JSON.parse(raw) : null;
    return p && p.format === SETTINGS_FORMAT && p.props && typeof p.props === "object" ? p : null;
  } catch {
    return null;
  }
}

/** New block's panel: paste (clipboard, or the text when the clipboard cannot be read), then clear. */
export function makePasteSettingsField(kind: BlockKind) {
  return function KondomerietPasteSettingsField({
    value,
    onChange,
    context,
  }: {
    value?: { data?: string };
    onChange: (v: { data: string } | undefined) => void;
    context?: { value?: Record<string, unknown> };
  }) {
    const pasted = readPasted(value);
    // Clearing while the pasted cards are the block's only products would empty it:
    // the products editor saves them as the block's own first (it does on opening).
    const productsProp = kind === "card" ? "group" : kind === "config" ? null : "groups";
    const onlyHere = !!productsProp && !!pasted && hasGroupIds(pasted.props[productsProp]) && !hasGroupIds(context?.value?.[productsProp]);
    const [text, setText] = useState("");
    const [error, setError] = useState("");
    const apply = (raw: string) => {
      const p = readPasted(raw);
      if (!p) return setError("That is not the settings of a Kondomeriet block.");
      if (p.kind !== kind) return setError(`Those are the settings of a ${p.kind} block; this one is a ${kind}.`);
      setError("");
      setText("");
      onChange({ data: raw });
    };
    const fromClipboard = async () => {
      try {
        apply(await navigator.clipboard.readText());
      } catch {
        setError("The clipboard cannot be read here: paste the text below.");
      }
    };
    if (pasted) {
      const n = Object.keys(pasted.props).length;
      return React.createElement(
        "div",
        { style: box },
        React.createElement(
          "div",
          null,
          `${n} settings from the old ${kind} block, pasted ${new Date(pasted.at).toLocaleString()}. Anything you change on this block wins.`
        ),
        onlyHere
          ? React.createElement(
              "div",
              { style: { color: "#b45309" } },
              "The products of this block are still only in the pasted settings. Open «Products» once (it saves them on this block), then you can clear."
            )
          : React.createElement("button", { type: "button", style: button, onClick: () => onChange(undefined) }, "Clear the pasted settings")
      );
    }
    return React.createElement(
      "div",
      { style: box },
      React.createElement("button", { type: "button", style: button, onClick: fromClipboard }, "Paste settings from the old block"),
      React.createElement("textarea", {
        value: text,
        rows: 2,
        placeholder: "…or paste the copied text here",
        style: { width: "100%", fontSize: 11 },
        onChange: (e: any) => setText(e.target.value),
        onBlur: () => text.trim() && apply(text.trim()),
      }),
      error ? React.createElement("div", { style: { color: "#d93025" } }, error) : null
    );
  };
}

export function pasteSettingsProp(kind: BlockKind): any {
  return {
    name: "pastedSettings",
    title: "Settings from the old block",
    type: "object",
    component: makePasteSettingsField(kind),
    fields: [{ name: "data", type: "string" }],
  };
}

/**
 * A products prop (`group` / `groups`) that holds at least one product. An
 * empty one — `[]`, `[{"ids":[]}]`, a string that does not parse — must
 * never hide the pasted cards: that is how a card lost its products (#491,
 * 20/11).
 */
export function hasGroupIds(value: unknown): boolean {
  try {
    const raw = (value as { data?: unknown } | null | undefined)?.data;
    if (typeof raw !== "string" || !raw.trim()) return false;
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) && parsed.some((g) => Array.isArray(g?.ids) && g.ids.some((id: unknown) => Number(id) > 0));
  } catch {
    return false;
  }
}

function same(a: unknown, b: unknown): boolean {
  if (a === b) return true;
  try {
    return JSON.stringify(a) === JSON.stringify(b);
  } catch {
    return false;
  }
}

/**
 * The block's props with the pasted ones for every prop still unset or at its
 * default. `schema`: its registered props without an editor component (those
 * would keep the panel's code in the published bundle); `extra`: the names
 * (and defaults) of the props that have one.
 */
export function withPastedSettings<T extends Record<string, any>>(props: T, schema: any[], extra: Record<string, unknown> = {}): T {
  const pasted = readPasted(props?.pastedSettings);
  if (!pasted) return props;
  const defaults = new Map<string, unknown>(Object.entries(extra));
  for (const p of schema) if (p && typeof p.name === "string") defaults.set(p.name, p.initialValue);
  const out: Record<string, any> = { ...props };
  for (const [k, v] of Object.entries(pasted.props)) {
    if (SKIP.has(k) || !defaults.has(k)) continue;
    const own = props[k];
    const products = k === "groups" || k === "group";
    // Products: the pasted cards until the block has products of its own.
    if (products ? !hasGroupIds(own) && hasGroupIds(v) : own === undefined || own === null || own === "" || same(own, defaults.get(k))) out[k] = v;
  }
  return out as T;
}

/** The products editor: the pasted cards until the block has its own. */
export function pastedGroupsFor(context: { value?: Record<string, unknown> } | undefined, propName: "group" | "groups"): any {
  const pasted = readPasted(context?.value?.pastedSettings);
  const v = pasted?.props?.[propName] as { data?: string } | undefined;
  return v && typeof v.data === "string" && v.data ? v : undefined;
}
