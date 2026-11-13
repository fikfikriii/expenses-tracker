CREATE TABLE "recurring" (
	"id" serial PRIMARY KEY NOT NULL,
	"type" "transaction_type" NOT NULL,
	"amount" bigint NOT NULL,
	"account_id" integer NOT NULL,
	"category_id" integer,
	"note" text DEFAULT '' NOT NULL,
	"day_of_month" integer NOT NULL,
	"active" boolean DEFAULT true NOT NULL,
	"last_run_month" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "recurring" ADD CONSTRAINT "recurring_account_id_accounts_id_fk" FOREIGN KEY ("account_id") REFERENCES "public"."accounts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "recurring" ADD CONSTRAINT "recurring_category_id_categories_id_fk" FOREIGN KEY ("category_id") REFERENCES "public"."categories"("id") ON DELETE set null ON UPDATE no action;