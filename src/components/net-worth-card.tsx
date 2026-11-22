"use client";

import { useState } from "react";

export const HIDE_COOKIE = "et_hide_balance";

/** "Rp1.234.567" -> "Rp ******": same look as the mask in banking apps. */
const mask = (n = 6) => `Rp ${"*".repeat(n)}`;

function Eye({ off }: { off: boolean }) {
  return (
    <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7S2 12 2 12Z" />
      <circle cx="12" cy="12" r="3" />
      {off && <path d="M4 4l16 16" />}
    </svg>
  );
}

/**
 * Total net worth with a show/hide button. The choice is kept in a cookie, so the server renders
 * the page already hidden (no flash of numbers) and it sticks across pages and visits.
 */
export function NetWorthCard({ total, cash, investment, initialHidden }: {
  total: string;
  cash: string;
  /** Null when there are no investment accounts. */
  investment: string | null;
  initialHidden: boolean;
}) {
  const [hidden, setHidden] = useState(initialHidden);

  function toggle() {
    const next = !hidden;
    setHidden(next);
    try {
      document.cookie = `${HIDE_COOKIE}=${next ? "1" : "0"}; path=/; max-age=31536000; samesite=lax`;
    } catch {
      // Cookies blocked: it still works, it just won't be remembered.
    }
  }

  return (
    <section className="rounded-xl bg-neutral-900 p-5 text-white dark:bg-neutral-100 dark:text-neutral-900">
      <div className="flex items-center gap-2 text-sm opacity-80">
        Total kekayaan
        <button
          type="button"
          onClick={toggle}
          aria-pressed={hidden}
          aria-label={hidden ? "Tampilkan saldo" : "Sembunyikan saldo"}
          title={hidden ? "Tampilkan saldo" : "Sembunyikan saldo"}
          className="rounded p-1 hover:bg-white/15 dark:hover:bg-black/10"
        >
          <Eye off={hidden} />
        </button>
      </div>
      <div className="mt-1 text-3xl font-semibold tabular-nums">{hidden ? mask(8) : total}</div>
      <div className="mt-4 grid grid-cols-2 gap-4 border-t border-white/20 pt-4 dark:border-black/15">
        <div>
          <div className="text-xs opacity-70">Kas & bank</div>
          <div className="mt-0.5 font-medium tabular-nums">{hidden ? mask(4) : cash}</div>
        </div>
        {investment !== null && (
          <div>
            <div className="text-xs opacity-70">Investasi</div>
            <div className="mt-0.5 font-medium tabular-nums">{hidden ? mask(4) : investment}</div>
          </div>
        )}
      </div>
    </section>
  );
}
