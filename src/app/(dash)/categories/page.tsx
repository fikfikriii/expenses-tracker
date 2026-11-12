import { CategoryForm } from "@/components/entity-forms";
import { listAllCategories } from "@/lib/ledger";

export default async function CategoriesPage() {
  const categories = await listAllCategories();
  const groups = [
    { kind: "expense" as const, title: "Kategori pengeluaran" },
    { kind: "income" as const, title: "Kategori pemasukan" },
  ];
  return (
    <>
      <h1 className="text-xl font-semibold">Kategori</h1>
      <p className="-mt-4 text-sm text-muted">
        Kalau chat nyebut nama kategori atau salah satu kata kuncinya, bot langsung masukin ke kategori itu
        (misal kategori &quot;Kopi&quot; dengan kata kunci &quot;latte, starbucks&quot;). Selain itu, AI yang milih.
        Kategori yang diarsipkan disembunyiin dari bot, tapi transaksi lamanya tetap ada.
      </p>
      <div className="grid gap-6 md:grid-cols-2">
        {groups.map((g) => (
          <section key={g.kind} className="card flex flex-col gap-4">
            <h2 className="font-medium">{g.title}</h2>
            <div className="flex flex-col gap-3">
              {categories
                .filter((c) => c.kind === g.kind)
                .map((c) => (
                  <div key={c.id} className={c.archived ? "opacity-60" : ""}>
                    <CategoryForm category={c} />
                  </div>
                ))}
            </div>
            <div className="border-t border-border pt-4">
              <CategoryForm kind={g.kind} />
            </div>
          </section>
        ))}
      </div>
    </>
  );
}
