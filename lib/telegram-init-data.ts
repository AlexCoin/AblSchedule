import { createHmac, timingSafeEqual } from "node:crypto";
export function verifyTelegramInitData(
  initData: string,
  botToken: string,
  now = Date.now(),
): string {
  if (
    !botToken ||
    typeof initData !== "string" ||
    !initData ||
    initData.length > 16384
  )
    throw Error("Недействительные данные Telegram");
  const params = new URLSearchParams(initData);
  const seen = new Set<string>();
  for (const key of params.keys()) {
    if (seen.has(key)) throw Error("Повторяющиеся поля Telegram");
    seen.add(key);
  }
  const received = params.get("hash") || "";
  if (!/^[a-f0-9]{64}$/.test(received))
    throw Error("Недействительная подпись Telegram");
  params.delete("hash");
  const check = [...params.entries()]
    .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
    .map(([key, value]) => key + "=" + value)
    .join("\n");
  const key = createHmac("sha256", "WebAppData").update(botToken).digest();
  const expected = createHmac("sha256", key).update(check).digest();
  if (!timingSafeEqual(expected, Buffer.from(received, "hex")))
    throw Error("Недействительная подпись Telegram");
  const date = params.get("auth_date") || "";
  const timestamp = Number(date);
  const seconds = Math.floor(now / 1000);
  if (
    !/^\d+$/.test(date) ||
    !Number.isSafeInteger(timestamp) ||
    timestamp > seconds + 30 ||
    seconds - timestamp > 3600
  )
    throw Error(
      "Данные входа устарели. Закройте приложение и откройте его снова из бота.",
    );
  let user: unknown;
  try {
    user = JSON.parse(params.get("user") || "null");
  } catch {
    throw Error("Не удалось определить пользователя Telegram");
  }
  const id = (user as { id?: unknown } | null)?.id;
  if (typeof id !== "number" || !Number.isSafeInteger(id) || id <= 0)
    throw Error("Не удалось определить пользователя Telegram");
  return String(id);
}
