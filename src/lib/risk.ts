// Risk class of an investment account: low, medium or high. Set by the user per account.

export type Risk = "low" | "medium" | "high";

export const RISKS: { value: Risk; label: string; icon: string }[] = [
  { value: "low", label: "Rendah", icon: "🟢" },
  { value: "medium", label: "Sedang", icon: "🟡" },
  { value: "high", label: "Tinggi", icon: "🔴" },
];

export const isRisk = (v: unknown): v is Risk => v === "low" || v === "medium" || v === "high";

export const riskLabel = (r: Risk | null | undefined) => {
  const x = RISKS.find((k) => k.value === r);
  return x ? `${x.icon} ${x.label}` : "Belum diklasifikasi";
};

/** Typical risk by kind of asset. Only used to suggest a value in the account form; the user decides. */
export const ASSET_PRESETS: { label: string; risk: Risk }[] = [
  { label: "Deposito", risk: "low" },
  { label: "SBN (ORI, SR, sukuk ritel)", risk: "low" },
  { label: "Reksadana pasar uang", risk: "low" },
  { label: "Reksadana pendapatan tetap / campuran", risk: "medium" },
  { label: "Obligasi korporasi", risk: "medium" },
  { label: "Emas", risk: "medium" },
  { label: "ETF indeks luas (S&P 500, IHSG)", risk: "medium" },
  { label: "Saham individual", risk: "high" },
  { label: "Reksadana saham", risk: "high" },
  { label: "ETF sektoral / tematik", risk: "high" },
  { label: "Kripto", risk: "high" },
  { label: "P2P lending", risk: "high" },
];
