import React, { useEffect, useRef, useState } from "react";
import { getActiveLocale } from "./vio-helpers";

/**
 * Analytics inspector — a floating, live view of the commerce funnel events as
 * they fire. Off by default; the Vio Config block turns it on (analyticsDebug).
 * It's a demo asset: drop it in front of a publisher and every card view, add to
 * cart, checkout and purchase shows up in real time — the ROI story, visible.
 *
 * Pure listener: it subscribes to the `vio:analytics` DOM event that trackEvent()
 * dispatches. It never tracks anything itself.
 */

type LogEntry = {
  name: string;
  ts: number;
  value?: number;
  currency?: string;
  count?: number;
};

const EVENT_COLORS: Record<string, string> = {
  view_item_list: "#6b7280",
  select_item: "#6b7280",
  view_item: "#2563eb",
  add_to_cart: "#16a34a",
  view_cart: "#0891b2",
  begin_checkout: "#d97706",
  purchase: "#c14a3b",
};

function fmt(ts: number): string {
  const d = new Date(ts);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
}

export default function AnalyticsInspector() {
  const [log, setLog] = useState<LogEntry[]>([]);
  const [open, setOpen] = useState(true);
  const [flash, setFlash] = useState(false);
  const flashTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const onEvent = (e: Event) => {
      const d = (e as CustomEvent).detail ?? {};
      const p = d.params ?? {};
      const entry: LogEntry = {
        name: d.name,
        ts: d.ts ?? Date.now(),
        value: typeof p.value === "number" ? p.value : undefined,
        currency: p.currency,
        count: Array.isArray(p.items) ? p.items.length : undefined,
      };
      setLog((prev) => [entry, ...prev].slice(0, 12));
      setFlash(true);
      if (flashTimer.current) clearTimeout(flashTimer.current);
      flashTimer.current = setTimeout(() => setFlash(false), 450);
    };
    document.addEventListener("vio:analytics", onEvent);
    return () => {
      document.removeEventListener("vio:analytics", onEvent);
      if (flashTimer.current) clearTimeout(flashTimer.current);
    };
  }, []);

  const wrap: React.CSSProperties = {
    position: "fixed",
    bottom: 24,
    left: 24,
    zIndex: 2147483000,
    width: 300,
    fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
    background: "rgba(10,10,10,0.94)",
    color: "#fff",
    borderRadius: 12,
    boxShadow: "0 8px 30px rgba(0,0,0,0.4)",
    overflow: "hidden",
    backdropFilter: "blur(6px)",
  };

  const header: React.CSSProperties = {
    display: "flex",
    alignItems: "center",
    gap: 8,
    padding: "10px 12px",
    cursor: "pointer",
    borderBottom: open ? "1px solid rgba(255,255,255,0.1)" : "none",
    userSelect: "none",
  };

  return (
    <div style={wrap}>
      <div style={header} onClick={() => setOpen((o) => !o)}>
        <span
          style={{
            width: 8,
            height: 8,
            borderRadius: "50%",
            background: "#16a34a",
            boxShadow: flash ? "0 0 0 5px rgba(22,163,74,0.4)" : "0 0 0 0 rgba(22,163,74,0)",
            transition: "box-shadow 0.4s ease",
            flexShrink: 0,
          }}
        />
        <strong style={{ fontSize: 12, letterSpacing: "0.02em" }}>Vio Analytics</strong>
        <span style={{ fontSize: 11, opacity: 0.5, marginLeft: "auto" }}>
          {log.length ? `${log.length} events` : "waiting…"} · {open ? "▾" : "▸"}
        </span>
      </div>

      {open ? (
        <div style={{ maxHeight: 260, overflowY: "auto" }}>
          {log.length === 0 ? (
            <div style={{ padding: 14, fontSize: 12, opacity: 0.5 }}>
              Interact with the article — events show up here.
            </div>
          ) : (
            log.map((e, i) => (
              <div
                key={`${e.ts}-${i}`}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 8,
                  padding: "8px 12px",
                  borderBottom: "1px solid rgba(255,255,255,0.05)",
                  fontSize: 12,
                }}
              >
                <span
                  style={{
                    width: 7,
                    height: 7,
                    borderRadius: "50%",
                    background: EVENT_COLORS[e.name] ?? "#9ca3af",
                    flexShrink: 0,
                  }}
                />
                <span style={{ fontFamily: "ui-monospace, Menlo, monospace", fontWeight: 600 }}>
                  {e.name}
                </span>
                <span style={{ marginLeft: "auto", opacity: 0.75, textAlign: "right" }}>
                  {e.value != null ? (
                    <span>
                      {e.value.toLocaleString(getActiveLocale())} {e.currency ?? ""}
                    </span>
                  ) : e.count != null ? (
                    <span>{e.count} items</span>
                  ) : null}
                  <span style={{ opacity: 0.5, marginLeft: 8, fontSize: 10 }}>{fmt(e.ts)}</span>
                </span>
              </div>
            ))
          )}
        </div>
      ) : null}
    </div>
  );
}
