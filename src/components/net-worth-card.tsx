"use client";

import { useState } from "react";

/** "Rp1.234.567" -> "Rp ******": same look as the mask in banking apps. */
const mask = (n = 6) => `Rp ${"*".repeat(n)}`;

function Eye({ off }: { off: boolean }) {
  return (
    <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7S2 12 2 12Z" />
      <circle cx="12" cy="12" r="3" />
      {off && <path d="M4 4l16 16" />}
    </svg>
  );
}

/**
 * Total net worth as a regular stat card with a show/hide button. It always starts hidden when the
 * page is opened (the server renders it masked, so numbers never flash); the button only reveals it
 * for the current visit.
 */
export function NetWorthCard({ total, cash, investment }: {
  total: string;
  cash: string;
  /** Null when there are no investment accounts. */
  investment: string | null;
}) {
  const [hidden, setHidden] = useState(true);
  const toggle = () => setHidden((h) => !h);

  return (
    <div className="card">
      <div className="flex items-center gap-1 text-xs text-muted">
        Total kekayaan
        <button
          type="button"
          onClick={toggle}
          aria-pressed={hidden}
          aria-label={hidden ? "Tampilkan saldo" : "Sembunyikan saldo"}
          title={hidden ? "Tampilkan saldo" : "Sembunyikan saldo"}
          className="rounded p-0.5 hover:bg-black/10 dark:hover:bg-white/15"
        >
          <Eye off={hidden} />
        </button>
      </div>
      <div className="mt-1 text-lg font-semibold tabular-nums">{hidden ? mask(8) : total}</div>
      {investment !== null && (
        <div className="mt-0.5 text-[11px] text-muted">
          {hidden ? `Kas ${mask(4)} · Investasi ${mask(4)}` : `Kas ${cash} · Investasi ${investment}`}
        </div>
      )}
    </div>
  );
}
