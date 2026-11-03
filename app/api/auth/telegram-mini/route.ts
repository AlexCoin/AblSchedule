import { sameOrigin } from "../../../../lib/http";
import { setSession } from "../../../../lib/auth";
import { verifyTelegramInitData } from "../../../../lib/telegram-init-data";
export async function POST(req: Request) {
  if (!sameOrigin(req))
    return Response.json({ error: "Недопустимый источник" }, { status: 403 });
  if (!process.env.TELEGRAM_BOT_TOKEN || !process.env.SESSION_SECRET)
    return Response.json(
      {
        error:
          "Организатору нужно подключить Telegram-бота в настройках приложения",
      },
      { status: 503 },
    );
  let id: string;
  try {
    const body = await req.json();
    id = verifyTelegramInitData(body.initData, process.env.TELEGRAM_BOT_TOKEN);
  } catch (e) {
    return Response.json(
      {
        error:
          e instanceof Error ? e.message : "Не удалось войти через Telegram",
      },
      { status: 401 },
    );
  }
  await setSession(id, true);
  return Response.json({ ok: true });
}
