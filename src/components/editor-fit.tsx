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
 * Measured against the nearest `vev` element around the block — the frame —
 * and only in the editor: a published page never shows this.
 */
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
    const frame = el.parentElement?.closest("vev") as HTMLElement | null;
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

const STYLE_ID = "vio-cut-notice-styles";
const CSS = `
.vio-cut-notice {
  position: absolute; top: 6px; left: 6px; right: 6px; z-index: 30;
  background: #fff4ce; color: #5c4400; border: 1px solid #f0c64d; border-radius: 6px;
  font: 600 11px/1.35 -apple-system, BlinkMacSystemFont, sans-serif; padding: 6px 8px;
  pointer-events: none;
}`;

export function CutByFrameNotice() {
  useEffect(() => {
    if (typeof document === "undefined" || document.getElementById(STYLE_ID)) return;
    const el = document.createElement("style");
    el.id = STYLE_ID;
    el.textContent = CSS;
    document.head.appendChild(el);
  }, []);
  return (
    <div className="vio-cut-notice" role="note">
      The frame's height is fixed: this block is cut when published. Set its height to Auto.
    </div>
  );
}
