import { z } from "zod";

// Any OpenAI-compatible chat API works. Defaults to Google Gemini, which has a free tier.
const BASE_URL =
  process.env.AI_BASE_URL ?? "https://generativelanguage.googleapis.com/v1beta/openai";
const MODEL = process.env.AI_MODEL ?? "gemini-2.5-flash-lite";

export function aiEnabled(): boolean {
  return Boolean(process.env.AI_API_KEY);
}

const ResultSchema = z.object({
  type: z.enum(["expense", "income"]),
  category: z.string(),
  note: z.string(),
});

export type AiResult = z.infer<typeof ResultSchema>;

export async function classifyWithAi(input: {
  text: string;
  amount: number;
  signHint: "+" | "-" | null;
  expenseCategories: string[];
  incomeCategories: string[];
}): Promise<AiResult | null> {
  if (!aiEnabled()) return null;

  const system = [
    "Kamu mengklasifikasi catatan keuangan pribadi berbahasa Indonesia (sering informal/singkatan).",
    "Balas HANYA JSON: {\"type\": \"expense\"|\"income\", \"category\": string, \"note\": string}.",
    `Kategori pengeluaran: ${input.expenseCategories.join(", ")}.`,
    `Kategori pemasukan: ${input.incomeCategories.join(", ")}.`,
    "category WAJIB persis salah satu nama dari daftar yang sesuai dengan type.",
    "Kalau ragu, type=expense. Kalau tidak ada yang cocok, pakai \"Lainnya\" (expense) atau \"Pemasukan Lain\" (income).",
    "note: deskripsi singkat yang rapi, huruf kapital di awal, tanpa nominal, tanpa tanggal, tanpa nama akun/bank. Contoh: \"makan bubur\" -> \"Makan bubur\".",
  ].join("\n");

  const user = JSON.stringify({
    pesan: input.text,
    nominal: input.amount,
    tanda: input.signHint,
  });

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 8000);
  try {
    const res = await fetch(`${BASE_URL}/chat/completions`, {
      method: "POST",
      signal: controller.signal,
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${process.env.AI_API_KEY}`,
      },
      body: JSON.stringify({
        model: MODEL,
        temperature: 0,
        response_format: { type: "json_object" },
        messages: [
          { role: "system", content: system },
          { role: "user", content: user },
        ],
      }),
    });
    if (!res.ok) {
      console.error("AI request failed", res.status, await res.text().catch(() => ""));
      return null;
    }
    const data = (await res.json()) as { choices?: { message?: { content?: string } }[] };
    const content = data.choices?.[0]?.message?.content ?? "";
    const json = content.replace(/^```(?:json)?\s*|\s*```$/g, "");
    const parsed = ResultSchema.safeParse(JSON.parse(json));
    return parsed.success ? parsed.data : null;
  } catch (err) {
    console.error("AI request error", err);
    return null;
  } finally {
    clearTimeout(timer);
  }
}
