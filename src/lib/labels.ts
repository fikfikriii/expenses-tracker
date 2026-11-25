export const ACCOUNT_TYPES = [
  { value: "bank", label: "Bank" },
  { value: "investment", label: "Investasi" },
  { value: "deposit", label: "Deposito" },
];

export const accountTypeLabel = (t: string) => ACCOUNT_TYPES.find((x) => x.value === t)?.label ?? t;
