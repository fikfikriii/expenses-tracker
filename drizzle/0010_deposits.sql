ALTER TYPE "public"."account_type" ADD VALUE 'deposit' BEFORE 'other';--> statement-breakpoint
ALTER TABLE "accounts" ADD COLUMN "interest_rate" double precision;--> statement-breakpoint
ALTER TABLE "accounts" ADD COLUMN "maturity_on" date;