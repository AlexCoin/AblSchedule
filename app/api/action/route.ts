import { configuredAppUrl } from "../../../lib/app-url";
import { sameOrigin } from "../../../lib/http";
import { actor } from "../../../lib/auth";
import { transaction } from "../../../lib/db";
import { apply } from "../../../lib/domain";
export async function POST(req: Request) {
  if (!sameOrigin(req))
    return Response.json({ error: "Недопустимый источник" }, { status: 403 });
  const user = await actor();
  if (!user)
    return Response.json({ error: "Войдите через Telegram" }, { status: 401 });
  try {
    const input = await req.json();
    const notification = await transaction((s) => {
      apply(s, user, input);
      const r = s.rounds.find((r) => r.id === input.round),
        m = r?.matches.find((m) => m.id === input.match);
      const conflict =
        !!m?.slot && r!.matches.filter((x) => x.slot === m.slot).length > 1;
      const affected = m
        ? r!.matches.filter(
            (x) => x.id === m.id || (m.slot && x.slot === m.slot),
          )
        : [];
      const ids =
        input.type === "publish"
          ? s.teams.map((t) => t.id)
          : affected.flatMap((m) => [m.a, m.b]);
      const recipients = s.teams
        .filter(
          (t) => ids.includes(t.id) && t.telegramId && t.telegramId !== user.id,
        )
        .map((t) => t.telegramId);
      if (conflict)
        recipients.push(
          ...(process.env.ADMIN_TELEGRAM_IDS || "").split(",").filter(Boolean),
        );
      const labels: Record<string, string> = {
        offer: "Новое предложение времени",
        accept: "Время согласовано командами",
        reopen: "Открыто пересогласование",
        assign: "Организатор назначил время",
        publish: "Расписание тура опубликовано",
      };
      const pair = m
        ? s.teams.find((t) => t.id === m.a)?.name +
          " — " +
          s.teams.find((t) => t.id === m.b)?.name
        : "";
      return {
        recipients: [...new Set(recipients)],
        text: `ABL • ${r?.name || ""}\n${labels[input.type] || "Расписание обновлено"}\n${pair}\n${input.slot ? input.slot.replace("T", " ") + " МСК" : ""}${conflict ? "\nКонфликт: несколько пар согласовали один слот. Решение за организатором." : ""}`,
      };
    });
    const results =
      process.env.TELEGRAM_BOT_TOKEN && process.env.DEMO_MODE !== "true"
        ? await Promise.all(
            notification.recipients.map(async (id) => {
              try {
                const response = await fetch(
                  `https://api.telegram.org/bot${process.env.TELEGRAM_BOT_TOKEN}/sendMessage`,
                  {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                      chat_id: id,
                      text: notification.text,
                      ...(configuredAppUrl()
                        ? {
                            reply_markup: {
                              inline_keyboard: [
                                [
                                  {
                                    text: "Открыть расписание",
                                    web_app: { url: configuredAppUrl() },
                                  },
                                ],
                              ],
                            },
                          }
                        : {}),
                    }),
                    signal: AbortSignal.timeout(5000),
                  },
                );
                return response.ok;
              } catch {
                return false;
              }
            }),
          )
        : [];
    return Response.json({
      ok: true,
      warning: results.some((ok) => !ok)
        ? "Изменения сохранены, но не все Telegram-уведомления доставлены."
        : undefined,
    });
  } catch (e) {
    return Response.json(
      { error: e instanceof Error ? e.message : "Ошибка действия" },
      { status: 400 },
    );
  }
}
