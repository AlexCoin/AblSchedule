import { cookies } from "next/headers";
import { createHmac, timingSafeEqual } from "node:crypto";
import { Actor } from "./domain";
function secret() {
  const s = process.env.SESSION_SECRET;
  if (!s || s.length < 32)
    throw Error("Задайте SESSION_SECRET длиной не менее 32 символов");
  return s;
}
export function sign(id: string) {
  const body = Buffer.from(
    JSON.stringify({ id, exp: Date.now() + 7 * 86400000 }),
  ).toString("base64url");
  return body + "." + createHmac("sha256", secret()).update(body).digest("hex");
}
export async function actor(): Promise<Actor | null> {
  const v = (await cookies()).get("abl_session")?.value;
  if (!v) return null;
  try {
    const [body, mac] = v.split(".");
    const expected = createHmac("sha256", secret()).update(body).digest("hex");
    if (
      mac?.length !== expected.length ||
      !timingSafeEqual(Buffer.from(mac), Buffer.from(expected))
    )
      return null;
    const data = JSON.parse(Buffer.from(body, "base64url").toString());
    if (data.exp < Date.now()) return null;
    return {
      id: data.id,
      admin:
        (process.env.ADMIN_TELEGRAM_IDS || "").split(",").includes(data.id) ||
        (process.env.DEMO_MODE === "true" && data.id === "demo-admin"),
    };
  } catch {
    return null;
  }
}
export async function setSession(id: string) {
  (await cookies()).set("abl_session", sign(id), {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 604800,
  });
}
