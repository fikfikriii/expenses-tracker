"use client";

import Link, { useLinkStatus } from "next/link";
import { usePathname } from "next/navigation";

const LINKS = [
  { href: "/", label: "Overview" },
  { href: "/transactions", label: "Transaksi" },
  { href: "/budgets", label: "Budget" },
  { href: "/recurring", label: "Rutin" },
  { href: "/analytics", label: "Analitik" },
  { href: "/balances", label: "Saldo" },
  { href: "/accounts", label: "Akun" },
  { href: "/categories", label: "Kategori" },
];

function Pending() {
  const { pending } = useLinkStatus();
  return (
    <span
      aria-hidden
      className={`ml-1.5 inline-block size-3 animate-spin rounded-full border-2 border-current border-t-transparent align-[-1px] ${
        pending ? "" : "hidden"
      }`}
    />
  );
}

export function Nav() {
  const path = usePathname();
  return (
    <nav className="flex gap-1 overflow-x-auto text-sm">
      {LINKS.map((l) => {
        const active = l.href === "/" ? path === "/" : path.startsWith(l.href);
        return (
          <Link
            key={l.href}
            href={l.href}
            className={`whitespace-nowrap rounded-lg px-3 py-1.5 ${
              active ? "bg-neutral-900 text-white dark:bg-neutral-100 dark:text-neutral-900" : "text-muted hover:text-foreground"
            }`}
          >
            {l.label}
            <Pending />
          </Link>
        );
      })}
    </nav>
  );
}
