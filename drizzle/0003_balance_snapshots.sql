ALTER TYPE "public"."account_type" ADD VALUE 'investment' BEFORE 'other';--> statement-breakpoint
CREATE TABLE "balance_snapshots" (
	"id" serial PRIMARY KEY NOT NULL,
	"account_id" integer NOT NULL,
	"taken_on" date NOT NULL,
	"balance" bigint NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "balance_snapshots_account_day" UNIQUE("account_id","taken_on")
);
--> statement-breakpoint
ALTER TABLE "balance_snapshots" ADD CONSTRAINT "balance_snapshots_account_id_accounts_id_fk" FOREIGN KEY ("account_id") REFERENCES "public"."accounts"("id") ON DELETE cascade ON UPDATE no action;