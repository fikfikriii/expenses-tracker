CREATE TABLE "users" (
	"id" serial PRIMARY KEY NOT NULL,
	"telegram_id" bigint,
	"username" text,
	"name" text DEFAULT '' NOT NULL,
	"password_hash" text,
	"failed_logins" integer DEFAULT 0 NOT NULL,
	"locked_until" timestamp with time zone,
	"session_version" integer DEFAULT 0 NOT NULL,
	"seeded" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "users_telegram_id_unique" UNIQUE("telegram_id"),
	CONSTRAINT "users_username_unique" UNIQUE("username")
);
--> statement-breakpoint
ALTER TABLE "accounts" DROP CONSTRAINT "accounts_name_unique";--> statement-breakpoint
ALTER TABLE "categories" DROP CONSTRAINT "categories_name_kind";--> statement-breakpoint
DROP INDEX "transactions_occurred_on_idx";--> statement-breakpoint
-- Existing rows predate multi-user. They all go to one user: the owner's Telegram account.
-- (If this ran with another ID the owner could still claim the rows: ensureUser() adopts a user
-- with no Telegram ID for the first ID in ALLOWED_TELEGRAM_USER_IDS.)
INSERT INTO "users" ("telegram_id", "name", "seeded")
SELECT 934392222, 'Owner', true WHERE EXISTS (SELECT 1 FROM "accounts") OR EXISTS (SELECT 1 FROM "categories");--> statement-breakpoint
ALTER TABLE "accounts" ADD COLUMN "user_id" integer;--> statement-breakpoint
UPDATE "accounts" SET "user_id" = (SELECT min("id") FROM "users");--> statement-breakpoint
ALTER TABLE "accounts" ALTER COLUMN "user_id" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "balance_snapshots" ADD COLUMN "user_id" integer;--> statement-breakpoint
UPDATE "balance_snapshots" SET "user_id" = (SELECT min("id") FROM "users");--> statement-breakpoint
ALTER TABLE "balance_snapshots" ALTER COLUMN "user_id" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "budgets" ADD COLUMN "user_id" integer;--> statement-breakpoint
UPDATE "budgets" SET "user_id" = (SELECT min("id") FROM "users");--> statement-breakpoint
ALTER TABLE "budgets" ALTER COLUMN "user_id" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "categories" ADD COLUMN "user_id" integer;--> statement-breakpoint
UPDATE "categories" SET "user_id" = (SELECT min("id") FROM "users");--> statement-breakpoint
ALTER TABLE "categories" ALTER COLUMN "user_id" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "recurring" ADD COLUMN "user_id" integer;--> statement-breakpoint
UPDATE "recurring" SET "user_id" = (SELECT min("id") FROM "users");--> statement-breakpoint
ALTER TABLE "recurring" ALTER COLUMN "user_id" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "transactions" ADD COLUMN "user_id" integer;--> statement-breakpoint
UPDATE "transactions" SET "user_id" = (SELECT min("id") FROM "users");--> statement-breakpoint
ALTER TABLE "transactions" ALTER COLUMN "user_id" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "accounts" ADD CONSTRAINT "accounts_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "balance_snapshots" ADD CONSTRAINT "balance_snapshots_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "budgets" ADD CONSTRAINT "budgets_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "categories" ADD CONSTRAINT "categories_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "recurring" ADD CONSTRAINT "recurring_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "transactions" ADD CONSTRAINT "transactions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "transactions_user_occurred_on_idx" ON "transactions" USING btree ("user_id","occurred_on");--> statement-breakpoint
ALTER TABLE "accounts" ADD CONSTRAINT "accounts_user_name" UNIQUE("user_id","name");--> statement-breakpoint
ALTER TABLE "categories" ADD CONSTRAINT "categories_user_name_kind" UNIQUE("user_id","name","kind");