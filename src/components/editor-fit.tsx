import React, { useEffect, useState } from "react";
import { useEditorState } from "@vev/react";

/**
 * In the editor, says when a Vio block does not fit the frame Vev gives it.
 *
 * A Vev element can be given a fixed height, and the published page clips
 * the block at that height. On bohus-demo (2026-10-08) three product cards
 * sat in 223px frames while the cards were 380–440px tall: published, only
 * the photos showed, and on a phone the Vipps button was cut in half. The
 * editor said nothing. The blocks are auto-height by design (the card's CSS
 * says why); a frame that was fixed by hand is what this catches.
 *
 * Width is the other way a frame misfits: Vev positions a frame per
 * breakpoint and a block fills whatever it gets, so a page built on the
 * phone showed one card across a whole desktop column, and a page built on
 * the desktop a 300px card over a phone's text. `useFrameWidth` measures the
 * frame so a block can say so.
 *
 * Measured against the nearest `vev` element around the block — the frame —
 * and only in the editor: a published page never shows these.
 */

/** The Vev element around a block: the frame the editor sizes per breakpoint. */
function frameOf(el: HTMLElement): HTMLElement | null {
  return el.parentElement?.closest("vev") as HTMLElement | null;
}

export function useCutByFrame(
  ref: React.RefObject<HTMLElement | null>,
  enabled = true,
  /** Changes when the block's root is swapped (loading → loaded). */
  watch?: unknown,
): boolean {
  const { disabled } = useEditorState(); // true in the editor
  const [cut, setCut] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!disabled || !enabled || !el || typeof ResizeObserver === "undefined") {
      setCut(false);
      return;
    }
    const frame = frameOf(el);
    if (!frame) return;
    const check = () => {
      const block = el.getBoundingClientRect();
      const box = frame.getBoundingClientRect();
      setCut(block.height > 0 && block.bottom - box.bottom > 2);
    };
    check();
    const ro = new ResizeObserver(check);
    ro.observe(el);
    ro.observe(frame);
    return () => ro.disconnect();
  }, [disabled, enabled, ref, watch]);
  return cut;
}

/**
 * The width of the frame around a block, in px — in the editor only; null on
 * a published page, until measured, or when there is no frame to measure.
 * Follows the editor's resizes and breakpoint switches.
 */
export function useFrameWidth(
  ref: React.RefObject<HTMLElement | null>,
  enabled = true,
  /** Changes when the block's root is swapped (loading → loaded). */
  watch?: unknown,
): number | null {
  const { disabled } = useEditorState(); // true in the editor
  const [width, setWidth] = useState<number | null>(null);
  useEffect(() => {
    const el = ref.current;
    if (!disabled || !enabled || !el || typeof ResizeObserver === "undefined") {
      setWidth(null);
      return;
    }
    const frame = frameOf(el);
    if (!frame) return;
    // Layout width rather than the bounding rect: a transform on the canvas
    // (zoom) scales rects, not layout, and a limit given in px must not move
    // with it.
    const check = () => setWidth(frame.offsetWidth || null);
    check();
    const ro = new ResizeObserver(check);
    ro.observe(frame);
    return () => ro.disconnect();
  }, [disabled, enabled, ref, watch]);
  return width;
}

const STYLE_ID = "vio-editor-notice-styles";
const CSS = `
.vio-editor-notices {
  position: absolute; top: 6px; left: 6px; right: 6px; z-index: 30;
  display: flex; flex-direction: column; gap: 4px; pointer-events: none;
}
.vio-editor-notice {
  background: #fff4ce; color: #5c4400; border: 1px solid #f0c64d; border-radius: 6px;
  font: 600 11px/1.35 -apple-system, BlinkMacSystemFont, sans-serif; padding: 6px 8px;
}`;

export const CUT_BY_FRAME_NOTICE =
  "The frame's height is fixed: this block is cut when published. Set its height to Auto.";

/**
 * Editor-only notices over a block, stacked in its top-left corner (the
 * block's root is positioned). Renders nothing outside the editor, whatever
 * it is given, so a published page never carries one.
 */
export function EditorNotices({ notices }: { notices: string[] }) {
  const { disabled } = useEditorState(); // true in the editor
  useEffect(() => {
    if (!disabled || typeof document === "undefined" || document.getElementById(STYLE_ID)) return;
    const el = document.createElement("style");
    el.id = STYLE_ID;
    el.textContent = CSS;
    document.head.appendChild(el);
  }, [disabled]);
  if (!disabled || notices.length === 0) return null;
  return (
    <div className="vio-editor-notices">
      {notices.map((text) => (
        <div key={text} className="vio-editor-notice" role="note">
          {text}
        </div>
      ))}
    </div>
  );
}

/** The cut notice on its own (carousel, grid). */
export function CutByFrameNotice() {
  return <EditorNotices notices={[CUT_BY_FRAME_NOTICE]} />;
}
