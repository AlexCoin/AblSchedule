import { makeRound, defaultWindow, type State } from "./domain";
import { defaultDivisionPairs, validateDivisionPairs } from "./division-pairs";
const REVISION = "official-division-pairs-v1";
export function syncDivisionPairings(state: State) {
  if (state.pairingRevision === REVISION) return;
  const official = state.teams.filter(
    (t) => t.sourceUrl === "https://ablforpeople.com/divisions",
  );
  if (official.length !== 32) return;
  const generated = defaultDivisionPairs(official);
  let ready = false;
  for (const round of state.rounds) {
    if (round.published) continue;
    try {
      validateDivisionPairs(
        official,
        round.matches.map((m) => [m.a, m.b]),
      );
      ready = true;
      continue;
    } catch {}
    if (round.matches.some((m) => m.slot || m.offers.length)) continue;
    round.matches = generated.map(([a, b], i) => ({
      id: String(i + 1),
      a,
      b,
      offers: [],
      slot: null,
    }));
    ready = true;
  }
  if (!ready) {
    const latest = state.rounds.at(-1);
    let saturday = latest?.saturday;
    const today = new Date().toLocaleDateString("en-CA", {
      timeZone: "Europe/Moscow",
    });
    if (!saturday || saturday < today) {
      const date = new Date(today + "T12:00:00Z");
      date.setUTCDate(date.getUTCDate() + ((6 - date.getUTCDay() + 7) % 7));
      saturday = date.toISOString().slice(0, 10);
    }
    const number =
      Math.max(
        0,
        ...state.rounds.map((r) =>
          Number(/^(\d+)\s+тур/.exec(r.name)?.[1] || 0),
        ),
      ) + 1;
    const window = defaultWindow(saturday);
    state.rounds.push(
      makeRound(
        crypto.randomUUID(),
        `${number} тур`,
        saturday,
        window.opens,
        window.deadline,
        generated,
      ),
    );
  }
  state.pairingRevision = REVISION;
}
