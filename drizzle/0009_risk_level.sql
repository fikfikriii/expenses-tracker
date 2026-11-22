CREATE TYPE "public"."risk_level" AS ENUM('low', 'medium', 'high');--> statement-breakpoint
ALTER TABLE "accounts" ADD COLUMN "risk" "risk_level";