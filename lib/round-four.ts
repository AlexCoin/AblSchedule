import catalog from "../catalog/abl-teams.json";
import { makeRound, defaultWindow, type State } from "./domain";
import { validateDivisionPairs } from "./division-pairs";

export const ROUND_FOUR_REVISION = "profa-2026-11-21-round-4-v1";
export const ROUND_FOUR_PAIRS = [
  ["Pale", "Big Ballers Team", "Восход Фортуна"],
  ["Pale", "Aviator", "БК Трактор"],
  ["Pale", "Petrovsky Hawks", "Союз Баскет"],
  ["Pale", "Ягуары", "Коммунарка"],
  ["Slow", "Beavers", "ABL School"],
  ["Slow", "Hungry Dogs", "ДИТ"],
  ["Slow", "Вымпел", "Normal Team"],
  ["Slow", "Ruina Chill", "Max Basket"],
  ["Rook", "We'Kings", "Melbourne United"],
  ["Rook", "Ruina W", "ATB"],
  ["Rook", "Ruina Media", "Гусары"],
  ["Rook", "Hungry Dogs", "Stankolit"],
  ["Last", "BBC", "Luckers"],
  ["Last", "G-Town", "ATB LAST"],
  ["Last", "ProgressBasket", "Гусарские Гоблины"],
  ["Last", "Beavers", "Team Rise"],
] as const;

/** Import once, retaining previous rounds and later captain/organizer changes. */
export function syncRoundFour(s: State) {
  if (s.roundFourRevision === ROUND_FOUR_REVISION) return;
  const pairs = ROUND_FOUR_PAIRS.map(([division, ...names]) =>
    names.map((name) => {
      const source = catalog.find(
        (t) => t.division === division && t.name === name,
      );
      const team =
        source && s.teams.find((t) => t.sourceTeamKey === source.sourceTeamKey);
      if (!team)
        throw Error(`Не найдена команда 4-го тура: ${division} / ${name}`);
      return team.id;
    }),
  );
  validateDivisionPairs(s.teams, pairs);
  const saturday = "2026-11-21";
  const existing = s.rounds.find(
    (r) => r.saturday === saturday && /^4\s+тур(?:\s|$)/i.test(r.name),
  );
  const signature = (rows: string[][]) =>
    JSON.stringify(rows.map((pair) => [...pair].sort().join(":")).sort());
  let round = existing;
  if (
    !existing ||
    signature(existing.matches.map((m) => [m.a, m.b])) !== signature(pairs)
  ) {
    const window = defaultWindow(saturday);
    round = makeRound(
      existing?.id || crypto.randomUUID(),
      "4 тур",
      saturday,
      window.opens,
      window.deadline,
      pairs,
    );
    if (existing) {
      s.roundFourBackup = {
        savedAt: new Date().toISOString(),
        round: structuredClone(existing),
      };
      s.rounds[s.rounds.indexOf(existing)] = round;
    } else s.rounds.push(round);
  }
  s.currentRoundId = round!.id;
  s.roundFourRevision = ROUND_FOUR_REVISION;
}
