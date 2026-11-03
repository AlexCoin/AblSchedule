import type { Team } from "./domain";
export const DIVISIONS = ["Pale", "Slow", "Rook", "Last"];
export function pairingTeams(teams: Team[]) {
  const official = teams.filter(
    (t) => t.sourceUrl === "https://ablforpeople.com/divisions",
  );
  return official.length ? official : teams;
}
export function defaultDivisionPairs(teams: Team[]): string[][] {
  const selected = pairingTeams(teams);
  const pairs: string[][] = [];
  for (const division of DIVISIONS) {
    const group = selected
      .filter((t) => t.division === division)
      .sort(
        (a, b) =>
          a.name.localeCompare(b.name, "ru") || a.id.localeCompare(b.id),
      );
    if (group.length % 2)
      throw Error(`В дивизионе ${division} нечётное количество команд`);
    for (let i = 0; i < group.length; i += 2)
      pairs.push([group[i].id, group[i + 1].id]);
  }
  if (pairs.length !== 16)
    throw Error("Для тура нужны 32 команды четырёх дивизионов");
  return pairs;
}
export function validateDivisionPairs(teams: Team[], pairs: string[][]) {
  if (
    !Array.isArray(pairs) ||
    pairs.length !== 16 ||
    pairs.some((p) => !Array.isArray(p) || p.length !== 2)
  )
    throw Error("В туре должно быть 16 пар");
  const eligible = pairingTeams(teams);
  const ids = pairs.flat();
  if (
    new Set(ids).size !== 32 ||
    ids.some((id) => !eligible.some((t) => t.id === id))
  )
    throw Error("Каждая из 32 команд должна участвовать ровно один раз");
  for (const [a, b] of pairs) {
    const first = eligible.find((t) => t.id === a)!,
      second = eligible.find((t) => t.id === b)!;
    if (!first.division || first.division !== second.division)
      throw Error(
        `Пара «${first.name} — ${second.name}»: соперники должны быть из одного дивизиона`,
      );
  }
}
/** Swap team positions, so selecting an already assigned team never duplicates it. */
export function swapPairTeam(
  teams: Team[],
  pairs: string[][],
  row: number,
  side: number,
  id: string,
) {
  const next = pairs.map((p) => [...p]);
  const team = teams.find((t) => t.id === id);
  const old = next[row]?.[side];
  const other = next[row]?.[1 - side];
  if (
    !team ||
    !old ||
    !other ||
    id === other ||
    team.division !== teams.find((t) => t.id === other)?.division
  )
    return pairs;
  for (let i = 0; i < next.length; i++)
    for (let j = 0; j < 2; j++)
      if (i !== row && next[i][j] === id) next[i][j] = old;
  next[row][side] = id;
  return next;
}
