-- Starter accounts and categories. Rename or add more later from the dashboard.
INSERT INTO "accounts" ("name", "type", "aliases", "is_default") VALUES
  ('Cash', 'cash', ARRAY['tunai', 'cash', 'dompet'], true),
  ('BCA', 'bank', ARRAY['bca', 'mbca', 'klikbca'], false),
  ('GoPay', 'ewallet', ARRAY['gopay', 'gojek pay'], false)
ON CONFLICT ("name") DO NOTHING;
--> statement-breakpoint
INSERT INTO "categories" ("name", "kind", "icon") VALUES
  ('Makan & Minum', 'expense', '🍜'),
  ('Transport', 'expense', '🛵'),
  ('Tempat Tinggal', 'expense', '🏠'),
  ('Tagihan', 'expense', '🧾'),
  ('Belanja', 'expense', '🛍️'),
  ('Hiburan', 'expense', '🎮'),
  ('Kesehatan', 'expense', '💊'),
  ('Pendidikan', 'expense', '📚'),
  ('Sosial', 'expense', '🎁'),
  ('Lainnya', 'expense', '📦'),
  ('Gaji', 'income', '💼'),
  ('Bonus', 'income', '🎉'),
  ('Freelance', 'income', '💻'),
  ('Pemasukan Lain', 'income', '💰')
ON CONFLICT ("name", "kind") DO NOTHING;
