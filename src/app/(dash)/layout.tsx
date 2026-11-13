import { Nav } from "@/components/nav";
import { requireUser } from "@/lib/session";
import { logout } from "../login/actions";

export const dynamic = "force-dynamic";

export default async function DashLayout({ children }: { children: React.ReactNode }) {
  const user = await requireUser();
  const who = user.username ? `@${user.username}` : user.name;
  return (
    <div className="mx-auto flex min-h-screen max-w-5xl flex-col gap-6 px-4 py-6">
      <header className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center justify-between gap-4">
          <span className="font-semibold">
            💸 Expenses Tracker <span className="ml-2 text-xs font-normal text-muted">{who}</span>
          </span>
          <form action={logout} className="sm:hidden">
            <button className="text-sm text-muted hover:text-foreground">Keluar</button>
          </form>
        </div>
        <div className="flex items-center gap-4">
          <Nav />
          <form action={logout} className="hidden sm:block">
            <button className="text-sm text-muted hover:text-foreground">Keluar</button>
          </form>
        </div>
      </header>
      <main className="flex flex-col gap-6">{children}</main>
    </div>
  );
}
