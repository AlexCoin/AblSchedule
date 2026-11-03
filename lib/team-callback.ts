import { transaction } from "./db";
import { apply } from "./domain";
import { teamMenu } from "./team-menu";
import { telegramRequest } from "./telegram-bot";
export async function teamCallback(query: any) {
  if (
    !query ||
    !Number.isSafeInteger(query.from?.id) ||
    query.from.id <= 0 ||
    query.message?.chat?.type !== "private" ||
    !query.id ||
    typeof query.data !== "string"
  )
    return;
  const userId = String(query.from.id);
  let alert = "";
  let view: any;
  try {
    view = await transaction((state) => {
      const [command, id, page] = query.data.split(":");
      if (command === "teams")
        return teamMenu(
          state,
          userId,
          id === "home" ? undefined : id,
          Number(page || 0),
        );
      const team = state.teams.find((t) => t.id === id);
      if (!team) throw Error("Команда не найдена. Обновите список /teams");
      if (command === "leave_confirm") {
        if (team.telegramId !== userId)
          throw Error("Эта команда не закреплена за вами");
        return {
          text: `Отвязать команду «${team.name}»? Другие ваши команды сохранятся.`,
          reply_markup: {
            inline_keyboard: [
              [{ text: "Да, отвязать", callback_data: "leave:" + team.id }],
              [{ text: "Отмена", callback_data: "teams:mine:0" }],
            ],
          },
        };
      }
      if (!["claim", "leave"].includes(command))
        throw Error("Неизвестная команда");
      apply(
        state,
        { id: userId, admin: false },
        { type: command === "claim" ? "claimTeam" : "leaveTeam", team: id },
      );
      alert =
        command === "claim"
          ? `Добавлена команда: ${team.name}`
          : `Команда отвязана: ${team.name}`;
      return teamMenu(state, userId, "mine", 0);
    });
  } catch (e) {
    alert = (e as Error).message;
  }
  await telegramRequest("answerCallbackQuery", {
    callback_query_id: query.id,
    text: alert.slice(0, 180) || undefined,
    show_alert: !view,
  });
  if (view)
    try {
      await telegramRequest("editMessageText", {
        chat_id: query.message.chat.id,
        message_id: query.message.message_id,
        ...view,
      });
    } catch {
      /* Repeated Telegram delivery can return message-not-modified; state changes are idempotent. */
    }
}
