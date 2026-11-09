import catalog from "../catalog/abl-teams.json";
import { makeRound, defaultWindow, type State } from "./domain";
import { validateDivisionPairs } from "./division-pairs";
export const ROUND_THREE_REVISION = "profa-2026-11-14-round-3-v1";
export const ROUND_THREE_PAIRS = [
  ["Pale", "Союз Баскет", "Коммунарка"],
  ["Pale", "БК Трактор", "Petrovsky Hawks"],
  ["Pale", "Восход Фортуна", "Aviator"],
  ["Pale", "Big Ballers Team", "Ягуары"],
  ["Slow", "Normal Team", "Max Basket"],
  ["Slow", "ДИТ", "Вымпел"],
  ["Slow", "ABL School", "Hungry Dogs"],
  ["Slow", "Beavers", "Ruina Chill"],
  ["Rook", "Гусары", "Stankolit"],
  ["Rook", "ATB", "Ruina Media"],
  ["Rook", "Melbourne United", "Ruina W"],
  ["Rook", "We'Kings", "Hungry Dogs"],
  ["Last", "Гусарские Гоблины", "Team Rise"],
  ["Last", "ATB LAST", "ProgressBasket"],
  ["Last", "Luckers", "G-Town"],
  ["Last", "BBC", "Beavers"],
] as const;
/** One-time, atomic schedule replacement explicitly requested for the tournament launch. */
export function syncRoundThree(s: State) {
  if (s.roundThreeRevision === ROUND_THREE_REVISION) return;
  const pairs = ROUND_THREE_PAIRS.map(([division, ...names]) =>
    names.map((name) => {
      const source = catalog.find(
        (t) => t.division === division && t.name === name,
      );
      const team =
        source && s.teams.find((t) => t.sourceTeamKey === source.sourceTeamKey);
      if (!team)
        throw Error(`Не найдена команда 3-го тура: ${division} / ${name}`);
      return team.id;
    }),
  );
  validateDivisionPairs(s.teams, pairs);
  const saturday = "2026-11-14";
  const window = defaultWindow(saturday);
  const round = makeRound(
    "3",
    "3 тур",
    saturday,
    window.opens,
    window.deadline,
    pairs,
  );
  s.scheduleBackup = {
    savedAt: new Date().toISOString(),
    rounds: structuredClone(s.rounds),
  };
  s.rounds = [round];
  s.roundThreeRevision = ROUND_THREE_REVISION;
}
