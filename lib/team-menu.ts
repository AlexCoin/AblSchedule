import { selectableTeams } from "./team-catalog";
import type { State } from "./domain";
type Button = { text: string; callback_data: string };
export function teamMenu(
  state: State,
  userId: string,
  group?: string,
  page = 0,
) {
  const eligible = selectableTeams(state.teams);
  const divisions = [
    ...new Set(eligible.map((t) => t.division || "Другие")),
  ].sort((a, b) => a.localeCompare(b, "ru"));
  const mine = state.teams.filter((t) => t.telegramId === userId);
  const summary = mine.length
    ? "Ваши команды: " +
      mine
        .slice(0, 6)
        .map((t) => t.name)
        .join(", ") +
      (mine.length > 6 ? ` и ещё ${mine.length - 6}` : "")
    : "Команды пока не выбраны.";
  const rows: Button[][] = [];
  if (group === undefined) {
    divisions.forEach((name, i) =>
      rows.push([
        {
          text: `${name} · ${eligible.filter((t) => (t.division || "Другие") === name).length}`,
          callback_data: `teams:${i}:0`,
        },
      ]),
    );
    rows.push([
      { text: `Мои команды (${mine.length})`, callback_data: "teams:mine:0" },
    ]);
    return {
      text: `Выберите дивизион, затем команду. Можно добавить несколько команд.\n${summary}`,
      reply_markup: { inline_keyboard: rows },
    };
  }
  const index = Number(group);
  if (
    group !== "mine" &&
    (!Number.isInteger(index) || index < 0 || index >= divisions.length)
  )
    throw Error("Обновите список команд командой /teams");
  const list =
    group === "mine"
      ? mine
      : eligible.filter((t) => (t.division || "Другие") === divisions[index]);
  const pages = Math.max(1, Math.ceil(list.length / 8));
  page = Math.max(0, Math.min(Number.isInteger(page) ? page : 0, pages - 1));
  for (const t of list.slice(page * 8, page * 8 + 8)) {
    const prefix = t.telegramId === userId ? "✅ " : t.telegramId ? "🔒 " : "";
    rows.push([
      {
        text: (prefix + t.name).slice(0, 60),
        callback_data:
          (t.telegramId === userId ? "leave_confirm:" : "claim:") + t.id,
      },
    ]);
  }
  const pagination: Button[] = [];
  if (page > 0)
    pagination.push({ text: "←", callback_data: `teams:${group}:${page - 1}` });
  if (page + 1 < pages)
    pagination.push({ text: "→", callback_data: `teams:${group}:${page + 1}` });
  if (pagination.length) rows.push(pagination);
  rows.push([{ text: "← Дивизионы", callback_data: "teams:home:0" }]);
  return {
    text: `${group === "mine" ? "Мои команды" : divisions[index]} · ${page + 1}/${pages}\n${summary}\n✅ — ваша команда; 🔒 — уже выбрана другим капитаном.`,
    reply_markup: { inline_keyboard: rows },
  };
}
