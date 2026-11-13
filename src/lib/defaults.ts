// Starter data every new user gets. Mirrors drizzle/0001_seed.sql.
export const DEFAULT_ACCOUNTS = [
  { name: "Cash", type: "cash", aliases: ["tunai", "cash", "dompet"], isDefault: true },
  { name: "BCA", type: "bank", aliases: ["bca", "mbca", "klikbca"], isDefault: false },
  { name: "GoPay", type: "ewallet", aliases: ["gopay", "gojek pay"], isDefault: false },
] as const;

export const DEFAULT_CATEGORIES = [
  { name: "Makan & Minum", kind: "expense", icon: "🍜" },
  { name: "Transport", kind: "expense", icon: "🛵" },
  { name: "Tempat Tinggal", kind: "expense", icon: "🏠" },
  { name: "Tagihan", kind: "expense", icon: "🧾" },
  { name: "Belanja", kind: "expense", icon: "🛍️" },
  { name: "Hiburan", kind: "expense", icon: "🎮" },
  { name: "Kesehatan", kind: "expense", icon: "💊" },
  { name: "Pendidikan", kind: "expense", icon: "📚" },
  { name: "Sosial", kind: "expense", icon: "🎁" },
  { name: "Lainnya", kind: "expense", icon: "📦" },
  { name: "Gaji", kind: "income", icon: "💼" },
  { name: "Bonus", kind: "income", icon: "🎉" },
  { name: "Freelance", kind: "income", icon: "💻" },
  { name: "Pemasukan Lain", kind: "income", icon: "💰" },
] as const;
