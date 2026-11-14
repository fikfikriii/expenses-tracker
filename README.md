# Expenses Tracker

Bot Telegram buat nyatet pengeluaran dan pemasukan pakai bahasa biasa, plus dashboard web.
Jalan di Vercel (gratis) dengan database Neon Postgres (gratis).

```
15000 makan bubur            -> Pengeluaran Rp15.000, Makan & Minum, hari ini, Cash
kemarin 25rb bensin          -> Pengeluaran Rp25.000, Transport, kemarin
5 November 2026, 15000 bubur -> tanggal 5 Nov 2026
50rb bensin pake bca         -> dicatat dari akun BCA
gajian 8jt / +500rb freelance -> Pemasukan
transfer 1jt bca ke gopay    -> Transfer antar akun (opsional, nggak dihitung pengeluaran)
saldo bca 5,2jt mandiri 3jt  -> Catat saldo asli akhir bulan
```

Command: `/hari_ini`, `/bulan_ini`, `/saldo`, `/hapus` (hapus transaksi terakhir), `/bantuan`.
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
   - `ALLOWED_TELEGRAM_USER_IDS`: ID Telegram yang boleh pakai bot (dari @userinfobot), pisah koma. ID pertama = owner. `*` = semua orang boleh
   - `AI_API_KEY`: dari Google AI Studio
   - `SESSION_SECRET`: string acak minimal 16 karakter buat nandatanganin cookie login (misal hasil `openssl rand -hex 32`). Pengganti `DASHBOARD_PASSWORD`, yang udah nggak dipakai
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
Chat bot lu: `/start`. Bot minta lu bikin password dashboard (balas pesan itu). Terus coba `15000 makan bubur`.

## Multi-user

- Siapa pun yang ID Telegram-nya ada di `ALLOWED_TELEGRAM_USER_IDS` bisa pakai bot dan dashboard. Tambah orang = tambah ID di env Vercel, terus redeploy. Isi `*` kalau mau dibuka buat semua orang (hati-hati, panggilan AI pakai API key lu).
- Tiap user punya akun, kategori, transaksi, budget, saldo, dan transaksi rutin sendiri, terpisah dari user lain. User baru otomatis dapat akun (Cash, BCA, GoPay) dan kategori standar waktu pertama chat. Laporan mingguan/bulanan dan pengingat akhir bulan dikirim ke chat masing-masing.
- Orang yang belum terdaftar dibales ID Telegram-nya, jadi bisa dikirim ke lu buat minta akses.
- Kurs USD dipakai bareng semua user, jadi cuma **owner** (ID pertama di env) yang bisa ngubah kurs manual.
- Ngehapus ID dari env nutup akses bot dan dashboard; datanya tetap ada di database.

### Upgrade dari versi satu-user
Migrasi `0006_multi_user` (jalan otomatis waktu deploy) memindahin semua data lama ke satu user: akun Telegram owner (ID-nya ditulis di file migrasinya). Pastiin ID itu juga ada di `ALLOWED_TELEGRAM_USER_IDS`. Setelah deploy, kirim `/start` dari akun owner, bikin password dashboard, lalu login. Backup Neon dulu kalau mau aman.

## Dashboard

Buka domain Vercel lu, login pakai **username Telegram** (tanpa `@`) dan **password yang lu bikin di bot**.

- Bikin atau ganti password: kirim `/password` ke bot, terus ketik passwordnya (boleh di-reply boleh nggak; berlaku 5 menit). Pesan passwordnya otomatis dihapus dari chat dan nggak pernah dicatat sebagai transaksi. Semua sesi login lama langsung keluar.
- Lu wajib punya username Telegram (Settings, Username). Kalau username diganti, login pakai username yang baru.
- 5 kali salah password mengunci login 15 menit.

- **Overview**: pemasukan, pengeluaran, selisih, dan total saldo per bulan; pengeluaran per kategori; saldo tiap akun; transaksi terakhir.
- **Transaksi**: filter (tanggal, tipe, kategori, akun, catatan), tambah manual, klik buat edit atau hapus.
- **Akun**: tambah akun tanpa batas (tunai, bank, e-wallet, tabungan, kartu kredit), saldo awal, alias buat bot, akun default, arsip.
- **Kategori**: tambah, ganti nama/ikon, arsip. Kategori baru langsung dipakai AI.

- **Budget**: batas pengeluaran per bulan untuk tiap kategori. Progress muncul di Overview, dan bot ngasih peringatan pas udah 80% dan 100%.
- **Rutin**: transaksi yang berulang tiap bulan (kost, langganan, cicilan, gaji), dicatat otomatis di tanggalnya.
- **Analitik**: pemasukan vs pengeluaran per bulan, pengeluaran per kategori per bulan, dan per akun (3, 6, atau 12 bulan).
- **Saldo**: catat saldo asli tiap akun (akhir bulan), lihat selisih tak tercatat dan riwayat cek saldo.

### Saldo dan selisih tak tercatat

Saldo akun = **cek saldo terakhir** + transaksi yang dicatat sesudahnya (kalau belum pernah cek: saldo awal + semua transaksi). Jadi transfer antar akun nggak wajib dicatat: tiap cek saldo, angkanya balik ke angka asli.

Tiap cek saldo dibandingin sama perkiraan (cek sebelumnya + transaksi tercatat). Karena transfer antar akun saling nutup, total selisihnya = **bunga/cashback/pemasukan yang lupa dicatat** (plus) atau **pengeluaran yang lupa dicatat** (minus). Selisih ini nggak masuk grafik pengeluaran.

### Cron harian dan laporan otomatis

Satu Vercel Cron (`vercel.json`, jam 19.00 WIB tiap hari) ngejalanin `/api/cron/daily`:

- ambil kurs USD hari ini,
- nyatet transaksi rutin yang jatuh tempo, terus bot ngabarin,
- Minggu malam: **laporan mingguan** (total, 3 kategori terbesar, perbandingan sama minggu lalu, status budget),
- tanggal 1: **laporan bulanan** bulan sebelumnya,
- tanggal terakhir bulan: pengingat update saldo.

Buat ngetes manual (pakai `CRON_SECRET` kalau diisi): `GET /api/cron/daily?force=weekly`, `force=monthly`, atau `force=month-end`.

### Akun USD

Akun bisa pakai mata uang **USD** (pilih di halaman Akun). Saldo dan transaksinya disimpan dalam dolar.

- Cek saldo: `saldo ibkr $1,250.50` (atau isi dolar di halaman Saldo).
- Transfer rupiah ke akun USD: tulis dua-duanya, `tf 16,3jt bca ke ibkr $1000`, jadi kurs yang lu dapet (termasuk spread/fee) kecatat. Kalau dolarnya nggak ditulis, diestimasi pakai kurs hari itu.
- Total kekayaan, laporan, dan budget dihitung dalam rupiah pakai kurs harian USD→IDR yang diambil otomatis (kurs referensi ECB via frankfurter.dev, cadangan open.er-api.com). Kurs bisa diisi manual di halaman Saldo; kurs manual nggak ditimpa.
- Modal investasi USD = total rupiah yang disetor, jadi untung/rugi dalam rupiah udah termasuk efek kurs.

### Investasi

Bikin akun dengan tipe **Investasi** (reksadana, saham, emas, crypto). Nilainya di-update lewat cek saldo, naik-turunnya nggak dihitung sebagai pemasukan/pengeluaran atau selisih tak tercatat. Kalau setoran dicatat sebagai transfer (`topup reksadana 1jt dari bca`), dashboard nampilin modal dan untung/ruginya. Setoran ke investasi sebaiknya dicatat, soalnya kalau nggak, akun asalnya bakal kelihatan "pengeluaran lupa dicatat".

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
src/middleware.ts              cek cookie login dashboard
src/lib/users.ts               akses (allowlist), user, password, login
src/lib/auth.ts                cookie sesi bertanda tangan
src/lib/password.ts            hash password (scrypt)
src/bot/bot.ts                 handler chat, command, dan tombol
src/lib/parse.ts               baca nominal dan tanggal
src/lib/interpret.ts           gabungin parser, akun, AI/kata kunci jadi satu transaksi
src/lib/ai.ts                  panggilan AI (OpenAI-compatible, default Gemini)
src/lib/ledger.ts              query database
src/db/schema.ts               skema: users, accounts, categories, transactions, budgets, dll
drizzle/                       file migrasi SQL
```
