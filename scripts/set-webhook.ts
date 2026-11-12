// Points the Telegram bot at the deployed app.
// Usage: npm run webhook:set -- https://your-app.vercel.app
import "dotenv/config";

const baseUrl = process.argv[2] ?? process.env.APP_URL;
const token = process.env.TELEGRAM_BOT_TOKEN;
const secret = process.env.TELEGRAM_WEBHOOK_SECRET;

if (!baseUrl || !token || !secret) {
  console.error("Need the app URL plus TELEGRAM_BOT_TOKEN and TELEGRAM_WEBHOOK_SECRET in .env");
  process.exit(1);
}

const res = await fetch(`https://api.telegram.org/bot${token}/setWebhook`, {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({
    url: `${baseUrl.replace(/\/$/, "")}/api/telegram`,
    secret_token: secret,
    allowed_updates: ["message", "callback_query"],
    drop_pending_updates: true,
  }),
});
console.log(await res.json());

const info = await fetch(`https://api.telegram.org/bot${token}/getWebhookInfo`);
console.log(await info.json());
