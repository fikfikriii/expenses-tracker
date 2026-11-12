import { neon } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-http";
import * as schema from "./schema";

function createDb() {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL is not set");
  return drizzle(neon(url), { schema });
}

let _db: ReturnType<typeof createDb> | undefined;

// Created on first use so `next build` works without a database.
export function db() {
  _db ??= createDb();
  return _db;
}

export { schema };
