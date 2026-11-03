import { createHash } from "node:crypto";
import type { State, Team } from "./domain";
export type CatalogTeam = {
  name: string;
  division: string;
  logo: string;
  sourceUrl: string;
  sourceTeamKey?: string;
};
const divisions = new Set(["Pale", "Slow", "Rook", "Last"]);
const normalize = (value: string) =>
  value
    .trim()
    .normalize("NFKC")
    .toLocaleLowerCase("ru-RU")
    .replace(/\s+/g, " ");
/** Merge by name + division; preserve captain assignments and historical match IDs. */
export function importTeamCatalog(state: State, rows: CatalogTeam[]) {
  if (!Array.isArray(rows) || !rows.length) throw Error("Каталог команд пуст");
  const keys = new Set<string>();
  const sourceKeys = new Set<string>();
  for (const row of rows) {
    if (
      typeof row.name !== "string" ||
      !row.name.trim() ||
      !divisions.has(row.division) ||
      row.sourceUrl !== "https://ablforpeople.com/divisions"
    )
      throw Error(
        "Нужны команды дивизионов Pale, Slow, Rook и Last с источником ablforpeople.com/divisions",
      );
    const local = /^\/team-logos\/[a-zA-Z0-9_-]+\.png$/.test(row.logo);
    let remote = false;
    try {
      const url = new URL(row.logo);
      remote =
        url.origin === "https://fs.mtgame.ru" &&
        !url.username &&
        !url.password &&
        !url.search &&
        !url.hash &&
        /\.png$/i.test(url.pathname);
    } catch {}
    if (!local && !remote)
      throw Error("Логотип: локальный PNG или официальный PNG с fs.mtgame.ru");
    if (
      row.sourceTeamKey !== undefined &&
      (!/^(Pale|Slow|Rook|Last):\d+$/.test(row.sourceTeamKey) ||
        !row.sourceTeamKey.startsWith(row.division + ":") ||
        sourceKeys.has(row.sourceTeamKey))
    )
      throw Error("Некорректный идентификатор команды источника");
    if (row.sourceTeamKey) sourceKeys.add(row.sourceTeamKey);
    const key = row.division + ":" + normalize(row.name);
    if (keys.has(key)) throw Error("Команда повторяется в каталоге");
    keys.add(key);
  }
  if (new Set(rows.map((row) => row.division)).size !== 4)
    throw Error("Каталог должен содержать все четыре дивизиона");
  let added = 0,
    updated = 0;
  for (const row of rows) {
    const sourceMatch = row.sourceTeamKey
      ? state.teams.find((t) => t.sourceTeamKey === row.sourceTeamKey)
      : undefined;
    const exact = state.teams.find(
      (t) =>
        normalize(t.name) === normalize(row.name) &&
        t.division === row.division,
    );
    const legacy = state.teams.filter(
      (t) => normalize(t.name) === normalize(row.name) && !t.division,
    );
    const team =
      sourceMatch ||
      exact ||
      (legacy.length === 1 &&
      rows.filter((r) => normalize(r.name) === normalize(row.name)).length === 1
        ? legacy[0]
        : undefined);
    if (team) {
      Object.assign(team, {
        name: row.name.trim(),
        division: row.division,
        logo: row.logo,
        sourceUrl: row.sourceUrl,
        ...(row.sourceTeamKey ? { sourceTeamKey: row.sourceTeamKey } : {}),
      });
      updated++;
    } else {
      const id =
        "abl-" +
        createHash("sha256")
          .update(row.division + ":" + normalize(row.name))
          .digest("hex")
          .slice(0, 16);
      if (state.teams.some((t) => t.id === id))
        throw Error("Неоднозначный идентификатор команды");
      state.teams.push({
        id,
        name: row.name.trim(),
        division: row.division,
        logo: row.logo,
        sourceUrl: row.sourceUrl,
        telegramId: "",
        ...(row.sourceTeamKey ? { sourceTeamKey: row.sourceTeamKey } : {}),
      });
      added++;
    }
  }
  return { added, updated };
}
export function selectableTeams(teams: Team[]) {
  const catalog = teams.filter(
    (t) => t.sourceUrl === "https://ablforpeople.com/divisions",
  );
  return catalog.length ? catalog : teams;
}
