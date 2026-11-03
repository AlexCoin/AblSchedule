import { sameOrigin } from "../../../../lib/http";
import { cookies } from "next/headers";
export async function POST(req: Request) {
  if (!sameOrigin(req)) return new Response("Forbidden", { status: 403 });
  let miniApp = false;
  try {
    miniApp = (await req.json()).miniApp === true;
  } catch {}
  if (miniApp)
    (await cookies()).set("abl_session", "", {
      httpOnly: true,
      path: "/",
      sameSite: "none",
      secure: true,
      partitioned: true,
      maxAge: 0,
    });
  else (await cookies()).delete("abl_session");
  return Response.json({ ok: true });
}
