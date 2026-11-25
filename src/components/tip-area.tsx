"use client";

import { useRef, useState } from "react";

type Tip = { x: number; y: number; lines: string[] };

/**
 * Wraps a chart and shows a tooltip for whatever element under the pointer has a `data-tip`
 * attribute (lines separated by "|"). Works on hover (mouse) and tap (touch).
 */
export function TipArea({ children }: { children: React.ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);
  const [tip, setTip] = useState<Tip | null>(null);

  function show(e: React.PointerEvent) {
    const el = (e.target as Element).closest?.("[data-tip]");
    const box = ref.current?.getBoundingClientRect();
    if (!el || !box) return setTip(null);
    setTip({ x: e.clientX - box.left, y: e.clientY - box.top, lines: (el.getAttribute("data-tip") ?? "").split("|") });
  }

  return (
    <div
      ref={ref}
      className="relative"
      onPointerMove={show}
      onPointerDown={show}
      onPointerLeave={() => setTip(null)}
    >
      {children}
      {tip && (
        <div
          className="pointer-events-none absolute z-10 w-max max-w-[16rem] rounded-lg border border-border bg-card px-2.5 py-1.5 text-xs shadow-lg"
          style={{
            left: tip.x,
            top: tip.y,
            transform: `translate(${tip.x > (ref.current?.clientWidth ?? 0) / 2 ? "calc(-100% - 12px)" : "12px"}, -110%)`,
          }}
        >
          {tip.lines.map((l, i) => (
            <div key={i} className={i === 0 ? "font-medium" : "tabular-nums text-muted"}>{l}</div>
          ))}
        </div>
      )}
    </div>
  );
}
