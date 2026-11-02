import { sameOrigin } from "../../../../lib/http";
import { cookies } from "next/headers";
export async function POST(req: Request) {
  if (!sameOrigin(req)) return new Response("Forbidden", { status: 403 });
  (await cookies()).delete("abl_session");
  return Response.json({ ok: true });
}
