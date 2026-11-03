import type { Round } from "./domain";
export type PreliminaryBooking = {
  matchId: string;
  slot: string;
  proposedBy: string[];
};
/** Team-level slot interest; private negotiation history stays in offers. */
export function preliminaryBookings(round: Round): PreliminaryBooking[] {
  return round.matches
    .filter((m) => !m.slot)
    .flatMap((m) =>
      [...new Set(m.offers.map((o) => o.slot))].map((slot) => ({
        matchId: m.id,
        slot,
        proposedBy: [
          ...new Set(
            m.offers.filter((o) => o.slot === slot).map((o) => o.team),
          ),
        ],
      })),
    );
}
