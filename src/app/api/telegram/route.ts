import { timingSafeEqual } from "node:crypto";
import { webhookCallback } from "grammy";
import { createBot } from "@/bot/bot";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 30;

let handler: ((req: Request) => Promise<Response>) | undefined;

function getHandler(secretToken: string) {
  if (!handler) {
    const token = process.env.TELEGRAM_BOT_TOKEN;
    if (!token) throw new Error("TELEGRAM_BOT_TOKEN is not set");
    handler = webhookCallback(createBot(token), "std/http", {
      secretToken,
      timeoutMilliseconds: 25_000,
    });
  }
  return handler;
}

function sameSecret(a: string, b: string): boolean {
  const x = Buffer.from(a);
  const y = Buffer.from(b);
  return x.length === y.length && timingSafeEqual(x, y);
}

export async function POST(req: Request) {
  const secret = process.env.TELEGRAM_WEBHOOK_SECRET;
  if (!secret) throw new Error("TELEGRAM_WEBHOOK_SECRET is not set");
  // Check the secret before grammY starts, so random requests never reach the bot.
  const header = req.headers.get("x-telegram-bot-api-secret-token") ?? "";
  if (!sameSecret(header, secret)) return new Response("unauthorized", { status: 401 });
  return getHandler(secret)(req);
}
