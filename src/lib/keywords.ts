// Keyword fallback used when AI is off or fails. Category names must match the seed data.

export const EXPENSE_KEYWORDS: Record<string, string[]> = {
  "Makan & Minum": [
    "makan", "minum", "kopi", "coffee", "bubur", "nasi", "sarapan", "lunch", "dinner",
    "jajan", "snack", "cemilan", "gofood", "grabfood", "shopeefood", "bakso", "mie", "mi",
    "ayam", "teh", "boba", "martabak", "sate", "soto", "warteg", "padang", "roti", "gorengan",
    "es", "jus", "pizza", "burger", "seblak", "galon", "aqua",
  ],
  Transport: [
    "bensin", "pertalite", "pertamax", "solar", "parkir", "tol", "gojek", "goride", "grab",
    "grabbike", "grabcar", "ojol", "ojek", "maxim", "krl", "mrt", "lrt", "busway",
    "transjakarta", "kereta", "taksi", "taxi", "bus", "travel", "tiket pesawat", "servis motor",
    "service motor", "ganti oli", "etoll", "e-toll",
  ],
  "Tempat Tinggal": ["kost", "kos", "kosan", "sewa", "kontrakan", "apartemen", "ipl"],
  Tagihan: [
    "listrik", "pln", "token", "pdam", "internet", "wifi", "indihome", "pulsa", "kuota",
    "paket data", "bpjs", "langganan", "netflix", "spotify", "youtube premium", "icloud",
    "asuransi", "cicilan", "tagihan",
  ],
  Belanja: [
    "belanja", "shopee", "tokopedia", "tokped", "lazada", "baju", "celana", "sepatu", "sabun",
    "sampo", "shampoo", "odol", "indomaret", "alfamart", "supermarket", "superindo",
    "groceries", "sayur", "skincare",
  ],
  Hiburan: ["nonton", "bioskop", "cgv", "xxi", "game", "steam", "karaoke", "liburan", "konser", "hotel"],
  Kesehatan: ["obat", "dokter", "apotek", "klinik", "rumah sakit", "vitamin", "gym", "fitness"],
  Pendidikan: ["buku", "kursus", "kuliah", "sekolah", "course", "udemy", "spp", "seminar"],
  Sosial: ["kado", "hadiah", "sumbangan", "donasi", "zakat", "sedekah", "kondangan", "traktir"],
};

export const INCOME_KEYWORDS: Record<string, string[]> = {
  Gaji: ["gaji", "gajian", "salary", "payroll"],
  Bonus: ["bonus", "thr", "insentif"],
  Freelance: ["freelance", "project", "proyek", "fee", "honor", "komisi"],
};

/** Words that suggest money coming in. */
export const INCOME_HINTS = [
  "gaji", "gajian", "salary", "bonus", "thr", "freelance", "honor", "komisi", "dapet",
  "dapat", "terima", "diterima", "nerima", "cashback", "refund", "jual", "jualan", "hasil",
  "masuk", "dikasih", "angpao", "dibayar", "bayaran", "pemasukan", "income", "bunga",
  "dividen",
];

export const DEFAULT_EXPENSE_CATEGORY = "Lainnya";
export const DEFAULT_INCOME_CATEGORY = "Pemasukan Lain";

function hasWord(text: string, word: string): boolean {
  const escaped = word.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return new RegExp(`(^|[^a-z0-9])${escaped}($|[^a-z0-9])`, "i").test(text);
}

export function looksLikeIncome(text: string): boolean {
  return INCOME_HINTS.some((w) => hasWord(text, w));
}

export function guessCategory(text: string, kind: "expense" | "income"): string {
  const table = kind === "expense" ? EXPENSE_KEYWORDS : INCOME_KEYWORDS;
  for (const [name, words] of Object.entries(table)) {
    if (words.some((w) => hasWord(text, w))) return name;
  }
  return kind === "expense" ? DEFAULT_EXPENSE_CATEGORY : DEFAULT_INCOME_CATEGORY;
}

export { hasWord };
