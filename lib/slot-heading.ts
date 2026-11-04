import type { Match, Team } from "./domain";
export function slotHeading(
  matches: Match[],
  teams: Team[],
  pendingCount: number,
) {
  if (!matches.length)
    return pendingCount ? "Ожидает подтверждения" : "Доступен";
  const first = [...matches].sort(
    (a, b) => (a.agreementOrder ?? 0) - (b.agreementOrder ?? 0),
  )[0];
  return teams.find((t) => t.id === first.a)?.division || "Согласовано";
}
