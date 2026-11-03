import { preliminaryBookings } from "../../../lib/preliminary";
import { actor } from "../../../lib/auth";
import { transaction } from "../../../lib/db";
export const dynamic = "force-dynamic";
export async function GET() {
  const user = await actor();
  return Response.json(
    await transaction((s) => ({
      user,
      demo: process.env.DEMO_MODE === "true",
      teams: s.teams.map((t) => ({
        ...t,
        telegramId: user?.admin ? t.telegramId : undefined,
        mine: !!user && t.telegramId === user.id,
      })),
      rounds: s.rounds
        .filter((r) => user || r.published)
        .map((r) => ({
          ...r,
          preliminary: user ? preliminaryBookings(r) : [],
          matches: r.matches.map((m) => ({
            ...m,
            offers:
              user?.admin ||
              s.teams.some(
                (t) => t.telegramId === user?.id && [m.a, m.b].includes(t.id),
              )
                ? m.offers
                : [],
          })),
        })),
    })),
    { headers: { "Cache-Control": "no-store" } },
  );
}
