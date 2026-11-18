import React from "react";

/**
 * Kondomeriet product descriptions. Two shapes arrive:
 *
 * - **Clean HTML written by Vio** from the product page on kondomeriet.no,
 *   marked `<!-- vio:keep-description -->` (the feed sync leaves it alone):
 *   `<p>★ 5/5 · 792 anmeldelser hos Kondomeriet</p><p><strong>Tagline</strong></p>
 *   <h3>Produktinformasjon</h3><h4>…</h4><p>…</p><ul><li>…</li></ul>
 *   <h3>Spesifikasjoner</h3>…<h3>Inkludert i esken</h3>…`
 * - **The feed's broken text** («h2…/h2p…», the tags without `< >`): shown as
 *   plain text, as before.
 *
 * The HTML is never injected: it is parsed (DOMParser, inert), reduced to a
 * whitelist — h3, h4, p, ul, ol, li, strong, em, br — with no attributes,
 * links unwrapped to their text, comments and anything executable dropped,
 * and rebuilt as React elements.
 */

const ALLOWED = new Set(["h3", "h4", "p", "ul", "ol", "li", "strong", "em", "br"]);
/** Dropped with their content: never text the reader should see. */
const DROPPED = new Set([
  "script", "style", "iframe", "object", "embed", "noscript", "template", "svg", "math", "img", "picture",
  "video", "audio", "source", "track", "canvas", "form", "input", "button", "select", "textarea", "link", "meta",
  "head", "title",
]);
/** Equivalents kept under their whitelisted name. */
const RENAMED: Record<string, string> = { b: "strong", i: "em" };

export type RichNode = string | { tag: string; children: RichNode[] };

export type RichDescription = {
  /** «★ 5/5 · 792 anmeldelser hos Kondomeriet» — the first paragraph when it starts with ★. */
  rating: string | null;
  /** What comes before the first section title. */
  intro: RichNode[];
  /** One per `<h3>`: its title and what follows until the next. */
  sections: { title: string; body: RichNode[] }[];
};

const RICH_MARKER = /<!--\s*vio:keep-description\s*-->/i;
const RICH_TAG = /<\s*\/?\s*(h3|h4|p|ul|ol|li|strong|em|br)\b[^>]*>/i;

/** Is this Vio's clean HTML (and not the feed's tag-less text)? */
export function isRichDescription(raw: unknown): raw is string {
  return typeof raw === "string" && (RICH_MARKER.test(raw) || RICH_TAG.test(raw));
}

function sanitize(node: Node): RichNode[] {
  if (node.nodeType === 3) return [node.textContent ?? ""];
  if (node.nodeType !== 1) return []; // comments (the marker), processing instructions…
  const el = node as Element;
  const tag = el.tagName.toLowerCase();
  if (DROPPED.has(tag)) return [];
  const children = Array.from(el.childNodes).flatMap(sanitize);
  const name = RENAMED[tag] ?? tag;
  if (ALLOWED.has(name)) return [{ tag: name, children: name === "br" ? [] : children }];
  // Anything else (a, span, div, h1/h2, table…): its text stays, the tag goes.
  return children;
}

export function textOf(nodes: RichNode[]): string {
  return nodes.map((n) => (typeof n === "string" ? n : textOf(n.children))).join("");
}

function isBlank(n: RichNode): boolean {
  return typeof n === "string" ? n.trim() === "" : n.tag !== "br" && textOf(n.children).trim() === "" && n.children.every(isBlank);
}

/** Vio's clean HTML as sections, or null (not HTML, or no DOM to parse it with). */
export function parseRichDescription(raw: unknown): RichDescription | null {
  if (!isRichDescription(raw) || typeof DOMParser === "undefined") return null;
  let body: HTMLElement | null = null;
  try {
    body = new DOMParser().parseFromString(`<!doctype html><body>${raw}</body>`, "text/html").body;
  } catch {
    return null;
  }
  if (!body) return null;
  const top = Array.from(body.childNodes).flatMap(sanitize).filter((n) => !isBlank(n));
  let rating: string | null = null;
  const first = top[0];
  if (first && typeof first !== "string" && first.tag === "p" && textOf(first.children).trim().startsWith("★")) {
    rating = textOf(first.children).trim();
    top.shift();
  }
  const intro: RichNode[] = [];
  const sections: RichDescription["sections"] = [];
  for (const n of top) {
    if (typeof n !== "string" && n.tag === "h3") {
      sections.push({ title: textOf(n.children).trim(), body: [] });
    } else if (sections.length) {
      sections[sections.length - 1].body.push(n);
    } else {
      intro.push(n);
    }
  }
  return { rating, intro, sections: sections.filter((s) => s.title || s.body.length) };
}

/** Rebuild sanitized nodes as React elements (text is text: React escapes it). */
export function renderRich(nodes: RichNode[], keyPrefix = "r"): React.ReactNode[] {
  return nodes.map((n, i) => {
    const key = `${keyPrefix}-${i}`;
    if (typeof n === "string") return n;
    if (n.tag === "br") return React.createElement("br", { key });
    return React.createElement(n.tag, { key }, ...renderRich(n.children, key));
  });
}

/** A plain-text description's first line, when it is the rating («★ …»). */
export function splitPlainRating(text: string): { rating: string | null; rest: string } {
  const lines = text.split("\n");
  const first = (lines[0] ?? "").trim();
  if (first.startsWith("★")) return { rating: first, rest: lines.slice(1).join("\n").trim() };
  return { rating: null, rest: text };
}
