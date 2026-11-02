import { sameOrigin } from "../../../../lib/http";
import { setSession } from "../../../../lib/auth";
import { transaction } from "../../../../lib/db";
export async function POST(req: Request) {
  if (process.env.DEMO_MODE !== "true")
    return new Response("Not found", { status: 404 });
  if (!sameOrigin(req)) return new Response("Forbidden", { status: 403 });
  const { role, round } = await req.json();
  const ids: Record<string, string> = {
    admin: "demo-admin",
    captain: "demo-1",
    opponent: "demo-2",
    captain_c: "demo-3",
    captain_d: "demo-4",
  };
  if (!ids[role]) return new Response("Invalid role", { status: 400 });
  const selectedRound = await transaction((s) => {
    const selected =
      (round ? s.rounds.find((r) => r.id === round) : undefined) ??
      s.rounds.filter((r) => !r.published).at(-1) ??
      s.rounds.at(-1);
    if (!selected || selected.matches.length < 2)
      throw Error("Для деморежима нужны две пары команд");
    const teamIds = selected.matches.slice(0, 2).flatMap((m) => [m.a, m.b]);
    const demoIds = ["demo-1", "demo-2", "demo-3", "demo-4"];
    s.teams.forEach((t) => {
      if (demoIds.includes(t.telegramId)) t.telegramId = "";
    });
    teamIds.forEach((id, i) => {
      const team = s.teams.find((t) => t.id === id);
      if (team) team.telegramId = demoIds[i];
    });
    return selected.id;
  });
  await setSession(ids[role]);
  return Response.json({ ok: true, round: selectedRound });
}
