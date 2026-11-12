CREATE TYPE "public"."currency" AS ENUM('IDR', 'USD');--> statement-breakpoint
CREATE TABLE "fx_rates" (
	"rate_on" date PRIMARY KEY NOT NULL,
	"usd_idr" double precision NOT NULL,
	"source" text DEFAULT 'auto' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "accounts" ADD COLUMN "currency" "currency" DEFAULT 'IDR' NOT NULL;--> statement-breakpoint
ALTER TABLE "transactions" ADD COLUMN "to_amount" bigint;