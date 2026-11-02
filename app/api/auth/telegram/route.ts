import { sameOrigin } from "../../../../lib/http";
import { randomBytes } from "node:crypto";
import { loginQuery } from "../../../../lib/db";
import { setSession } from "../../../../lib/auth";
import { cookies } from "next/headers";
export async function POST(req: Request) {
  if (!sameOrigin(req)) return new Response("Forbidden", { status: 403 });
  if (
    !process.env.TELEGRAM_BOT_USERNAME ||
    !process.env.TELEGRAM_BOT_TOKEN ||
    !process.env.SESSION_SECRET
  )
    return Response.json(
      { error: "Telegram-бот ещё не подключён организатором" },
      { status: 503 },
    );
  const token = randomBytes(24).toString("hex");
  await loginQuery("DELETE FROM login WHERE expires < ?", [Date.now()]);
  await loginQuery(
    "INSERT INTO login(token,user_id,expires) VALUES (?,NULL,?)",
    [token, Date.now() + 300000],
  );
  (await cookies()).set("abl_login", token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 300,
  });
  return Response.json({
    url: `https://t.me/${process.env.TELEGRAM_BOT_USERNAME}?start=${token}`,
  });
}
export async function GET() {
  const token = (await cookies()).get("abl_login")?.value;
  if (!token) return Response.json({ pending: true });
  const rows = (await loginQuery(
    "SELECT user_id FROM login WHERE token=? AND expires>?",
    [token, Date.now()],
  )) as any[];
  if (!rows[0]?.user_id) return Response.json({ pending: true });
  await setSession(rows[0].user_id);
  await loginQuery("DELETE FROM login WHERE token=?", [token]);
  (await cookies()).delete("abl_login");
  return Response.json({ ok: true });
}
