export const ACCOUNT_TYPES = [
  { value: "cash", label: "Tunai" },
  { value: "bank", label: "Bank" },
  { value: "ewallet", label: "E-wallet" },
  { value: "savings", label: "Tabungan" },
  { value: "credit_card", label: "Kartu kredit" },
  { value: "investment", label: "Investasi" },
  { value: "other", label: "Lainnya" },
];

export const accountTypeLabel = (t: string) => ACCOUNT_TYPES.find((x) => x.value === t)?.label ?? t;
