# Expenses Tracker

Bot Telegram buat nyatet pengeluaran dan pemasukan pakai bahasa biasa, plus dashboard web.
Jalan di Vercel (gratis) dengan database Neon Postgres (gratis).

```
15000 makan bubur            -> Pengeluaran Rp15.000, Makan & Minum, hari ini, Cash
kemarin 25rb bensin          -> Pengeluaran Rp25.000, Transport, kemarin
5 November 2026, 15000 bubur -> tanggal 5 Nov 2026
50rb bensin pake bca         -> dicatat dari akun BCA
gajian 8jt / +500rb freelance -> Pemasukan
transfer 1jt bca ke gopay    -> Transfer antar akun (nggak dihitung pengeluaran)
```

Command: `/hari_ini`, `/bulan_ini`, `/hapus` (hapus transaksi terakhir), `/bantuan`.
Tiap catatan ada tombol **Ganti kategori** dan **Batal**.

## Cara kerja

1. Nominal dan tanggal dibaca pakai aturan (regex) di `src/lib/parse.ts`. Format yang kebaca: `15000`, `15.000`, `15rb`, `15k`, `1,5jt`, `Rp 15.000`, `5 Nov`, `5 November 2026`, `05/11/2026`, `kemarin`, `3 hari lalu`, dst.
2. Kategori dan pemasukan/pengeluaran ditentukan AI (Gemini, free tier). Tanpa API key, bot pakai pencocokan kata kunci di `src/lib/keywords.ts`.
3. Akun dipilih dari nama atau alias akun yang disebut di chat. Kalau nggak ada, pakai akun default.
4. Update yang dikirim ulang Telegram dicatat di tabel `telegram_updates`, jadi nggak ada catatan dobel.

## Setup (sekali aja)

### 1. Database Neon
1. Buka https://console.neon.tech, bikin project `expenses-tracker`, region **AWS Asia Pacific (Singapore)**.
2. Klik **Connect**, pilih connection string yang **pooled**, terus copy. Ini `DATABASE_URL`.

Tabel dan data awal (akun Cash, BCA, GoPay, plus kategori) dibikin otomatis waktu deploy ke Vercel (`vercel-build` jalanin `drizzle-kit migrate`).

### 2. API key AI (opsional tapi disarankan)
Bikin key gratis di https://aistudio.google.com/apikey. Ini `AI_API_KEY`.

### 3. Deploy ke Vercel
1. Buka https://vercel.com/new, import repo ini, nama project `expenses-tracker`.
2. Di **Environment Variables**, isi semua yang ada di `.env.example`:
   - `DATABASE_URL`: dari Neon
   - `TELEGRAM_BOT_TOKEN`: dari @BotFather
   - `TELEGRAM_WEBHOOK_SECRET`: string acak panjang, **cuma huruf, angka, `_` atau `-`** (misal hasil `openssl rand -hex 32` atau password generator tanpa simbol)
   - `ALLOWED_TELEGRAM_USER_IDS`: ID Telegram lu dari @userinfobot
   - `AI_API_KEY`: dari Google AI Studio
   - `DASHBOARD_PASSWORD`: password buat login dashboard
3. Klik **Deploy**.

### 4. Sambungin bot ke Vercel (webhook)
Buka URL ini di browser (ganti bagian `<...>`):

```
https://api.telegram.org/bot<TELEGRAM_BOT_TOKEN>/setWebhook?url=https://<domain-vercel-lu>/api/telegram&secret_token=<TELEGRAM_WEBHOOK_SECRET>&allowed_updates=["message","callback_query"]
```

Pakai **domain production** dari tab Overview Vercel (yang nggak ada kode acaknya). URL per-deployment dikunci login Vercel (error `401`), dan cuma berlaku buat satu deploy. Pastiin juga cuma ada satu `/` sebelum `api` (kalau `//` hasilnya error `308`).

Kalau berhasil, muncul `{"ok":true,"result":true,"description":"Webhook was set"}`.
Cek status kapan aja di `https://api.telegram.org/bot<TOKEN>/getWebhookInfo`.

Alternatif dari terminal: isi `.env`, lalu `npm run webhook:set -- https://<domain-vercel-lu>`.

### 5. Coba
Chat bot lu: `15000 makan bubur`.

## Dashboard

Buka domain Vercel lu, login pakai `DASHBOARD_PASSWORD`.

- **Overview**: pemasukan, pengeluaran, selisih, dan total saldo per bulan; pengeluaran per kategori; saldo tiap akun; transaksi terakhir.
- **Transaksi**: filter (tanggal, tipe, kategori, akun, catatan), tambah manual, klik buat edit atau hapus.
- **Akun**: tambah akun tanpa batas (tunai, bank, e-wallet, tabungan, kartu kredit), saldo awal, alias buat bot, akun default, arsip.
- **Kategori**: tambah, ganti nama/ikon, arsip. Kategori baru langsung dipakai AI.

Saldo akun = saldo awal + pemasukan − pengeluaran ± transfer.

## Development

```bash
npm install
cp .env.example .env   # isi nilainya
npm run db:migrate     # bikin tabel di database
npm test               # unit test parser, kategori, dan bot
npm run dev
```

Ubah skema di `src/db/schema.ts`, lalu `npm run db:generate` buat bikin file migrasi baru di `drizzle/`.

## Struktur

```
src/app/api/telegram/route.ts  webhook Telegram
src/app/(dash)/                halaman dashboard + server actions
src/middleware.ts              login dashboard
src/bot/bot.ts                 handler chat, command, dan tombol
src/lib/parse.ts               baca nominal dan tanggal
src/lib/interpret.ts           gabungin parser, akun, AI/kata kunci jadi satu transaksi
src/lib/ai.ts                  panggilan AI (OpenAI-compatible, default Gemini)
src/lib/ledger.ts              query database
src/db/schema.ts               skema: accounts, categories, transactions, budgets
drizzle/                       file migrasi SQL
```
