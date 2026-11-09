import { registerTelegramIdentity } from "../../../../lib/telegram-identity";
import { teamCallback } from "../../../../lib/team-callback";
import { teamMenu } from "../../../../lib/team-menu";
import { transaction } from "../../../../lib/db";
import { timingSafeEqual } from "node:crypto";
import { loginQuery } from "../../../../lib/db";
import { telegramRequest, publicAppUrl } from "../../../../lib/telegram-bot";
export async function POST(req: Request) {
  const expected = Buffer.from(process.env.TELEGRAM_WEBHOOK_SECRET || "");
  const received = Buffer.from(
    req.headers.get("x-telegram-bot-api-secret-token") || "",
  );
  if (
    !expected.length ||
    received.length !== expected.length ||
    !timingSafeEqual(received, expected)
  )
    return new Response("Forbidden", { status: 403 });
  if (!process.env.TELEGRAM_BOT_TOKEN)
    return new Response("Bot not configured", { status: 503 });
  let body;
  try {
    body = await req.json();
  } catch {
    return new Response("Invalid update", { status: 400 });
  }
  if (body.callback_query) {
    try {
      await teamCallback(body.callback_query);
      return Response.json({ ok: true });
    } catch {
      return new Response("Telegram temporarily unavailable", { status: 503 });
    }
  }
  const m = body.message;
  if (
    m?.chat?.type !== "private" ||
    !Number.isSafeInteger(m.from?.id) ||
    m.from.id <= 0 ||
    m.from.is_bot
  )
    return Response.json({ ok: true });
  await registerTelegramIdentity(String(m.from.id), m.from.username);
  const command = /^\/(start|schedule|help|teams)(?:@\w+)?(?:\s+.*)?$/.exec(
    m.text || "",
  );
  if (!command) return Response.json({ ok: true });
  if (command[1] === "teams") {
    const menu = await transaction((s) => teamMenu(s, String(m.from.id)));
    try {
      await telegramRequest("sendMessage", { chat_id: m.chat.id, ...menu });
      return Response.json({ ok: true });
    } catch {
      return new Response("Telegram temporarily unavailable", { status: 503 });
    }
  }
  const login = /^\/start(?:@\w+)? ([a-f0-9]{48})$/.exec(m.text || "");
  if (login)
    await loginQuery(
      "UPDATE login SET user_id=? WHERE token=? AND expires>? AND user_id IS NULL",
      [String(m.from.id), login[1], Date.now()],
    );
  let url: string;
  try {
    url = publicAppUrl();
  } catch {
    return new Response("APP_URL not configured", { status: 503 });
  }
  const text = login
    ? `Если вы открыли вход из браузера, вернитесь в него для завершения. Ваш Telegram ID: ${m.from.id}. Выберите свои команды командой /teams.`
    : `ABL • Расписание турнира\nОткройте приложение кнопкой ниже: вход через ваш аккаунт Telegram выполнится автоматически.\nВаш Telegram ID: ${m.from.id}. Выберите свои команды командой /teams. Можно добавить несколько команд.`;
  try {
    await telegramRequest("sendMessage", {
      chat_id: m.chat.id,
      text,
      reply_markup: {
        inline_keyboard: [
          [{ text: "🏀 Открыть расписание", web_app: { url } }],
          [{ text: "Выбрать команды", callback_data: "teams:home:0" }],
        ],
      },
    });
  } catch {
    return new Response("Telegram temporarily unavailable", { status: 503 });
  }
  return Response.json({ ok: true });
}
