import type { Match } from "./domain";

export function negotiationStatus(match: Match) {
  const a = [
    ...new Set(
      match.offers.filter((o) => o.team === match.a).map((o) => o.slot),
    ),
  ].sort();
  const b = [
    ...new Set(
      match.offers.filter((o) => o.team === match.b).map((o) => o.slot),
    ),
  ].sort();
  const common = a.filter((slot) => b.includes(slot));
  const status:
    "agreed" | "empty" | "one-sided" | "no-common" | "confirmation" = match.slot
    ? "agreed"
    : !a.length && !b.length
      ? "empty"
      : !a.length || !b.length
        ? "one-sided"
        : !common.length
          ? "no-common"
          : "confirmation";
  return { status, a, b, common };
}
