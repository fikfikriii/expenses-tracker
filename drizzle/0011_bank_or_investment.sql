-- Accounts are now only "bank" (cash, e-wallet, savings, cards included) or investment/deposit.
UPDATE "accounts" SET "type" = 'bank' WHERE "type" NOT IN ('bank', 'investment', 'deposit');
