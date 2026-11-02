import { timingSafeEqual } from "node:crypto";
import { loginQuery } from "../../../../lib/db";
export async function POST(req: Request) {
  const expected = process.env.TELEGRAM_WEBHOOK_SECRET;
  const value = req.headers.get("x-telegram-bot-api-secret-token") || "";
  if (
    !expected ||
    value.length !== expected.length ||
    !timingSafeEqual(Buffer.from(value), Buffer.from(expected))
  )
    return new Response("Forbidden", { status: 403 });
  const body = await req.json();
  const m = body.message;
  const match = /^\/start(?:@\w+)? ([a-f0-9]{48})$/.exec(m?.text || "");
  if (match && m.chat?.type === "private" && m.from?.id) {
    await loginQuery(
      "UPDATE login SET user_id=? WHERE token=? AND expires>? AND user_id IS NULL",
      [String(m.from.id), match[1], Date.now()],
    );
    await fetch(
      `https://api.telegram.org/bot${process.env.TELEGRAM_BOT_TOKEN}/sendMessage`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          chat_id: m.chat.id,
          text: `Ваш Telegram ID: ${m.from.id}. Если вы открыли вход из приложения, вернитесь в браузер. Организатор назначает команду по этому ID.`,
        }),
        signal: AbortSignal.timeout(5000),
      },
    );
  }
  return Response.json({ ok: true });
}
