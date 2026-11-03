import { configuredAppUrl } from "./app-url";
export async function telegramRequest(method: string, payload: object = {}) {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  if (!token) throw Error("Не задан TELEGRAM_BOT_TOKEN");
  try {
    const response = await fetch(
      `https://api.telegram.org/bot${token}/${method}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
        signal: AbortSignal.timeout(10000),
      },
    );
    const data = await response.json();
    if (!response.ok || !data.ok) throw Error("Telegram отклонил запрос");
    return data.result;
  } catch {
    throw Error(
      `Не удалось выполнить Telegram ${method}. Проверьте токен, сеть и параметры бота.`,
    );
  }
}
export function publicAppUrl() {
  try {
    const url = new URL(configuredAppUrl() || "");
    if (
      url.protocol !== "https:" ||
      ["localhost", "127.0.0.1", "0.0.0.0", "[::1]"].includes(url.hostname) ||
      url.username ||
      url.password ||
      url.pathname !== "/" ||
      url.search ||
      url.hash
    )
      throw Error();
    return url.origin;
  } catch {
    throw Error(
      "APP_URL должен быть публичным HTTPS-адресом приложения без пути, например https://schedule.example.ru",
    );
  }
}
