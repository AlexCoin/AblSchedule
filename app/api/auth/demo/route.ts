import { sameOrigin } from "../../../../lib/http";
import { setSession } from "../../../../lib/auth";
import { transaction } from "../../../../lib/db";
export async function POST(req: Request) {
  if (process.env.DEMO_MODE !== "true")
    return new Response("Not found", { status: 404 });
  if (!sameOrigin(req)) return new Response("Forbidden", { status: 403 });
  const { role } = await req.json();
  const ids: Record<string, string> = {
    admin: "demo-admin",
    captain: "demo-1",
    opponent: "demo-2",
  };
  if (!ids[role]) return new Response("Invalid role", { status: 400 });
  await transaction((s) => {
    s.teams[0].telegramId = "demo-1";
    s.teams[1].telegramId = "demo-2";
  });
  await setSession(ids[role]);
  return Response.json({ ok: true });
}
