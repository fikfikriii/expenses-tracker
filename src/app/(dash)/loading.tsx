export default function Loading() {
  return (
    <div role="status" aria-live="polite" className="flex flex-col gap-4">
      <span className="sr-only">Memuat…</span>
      <div className="h-6 w-40 animate-pulse rounded-lg bg-black/10 dark:bg-white/10" />
      <div className="grid gap-4 sm:grid-cols-3">
        {[0, 1, 2].map((i) => (
          <div key={i} className="card h-24 animate-pulse" />
        ))}
      </div>
      <div className="card h-64 animate-pulse" />
    </div>
  );
}
