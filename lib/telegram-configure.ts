import { telegramRequest, publicAppUrl } from "./telegram-bot";
export async function configureTelegram() {
  if (process.env.DEMO_MODE === "true")
    throw Error(
      "Для публичного Telegram-приложения сначала установите DEMO_MODE=false",
    );
  const url = publicAppUrl();
  if (!process.env.SESSION_SECRET || process.env.SESSION_SECRET.length < 32)
    throw Error(
      "Задайте SESSION_SECRET: случайная строка не менее 32 символов",
    );
  const secret = process.env.TELEGRAM_WEBHOOK_SECRET || "";
  if (!/^[A-Za-z0-9_-]{32,256}$/.test(secret))
    throw Error(
      "Задайте TELEGRAM_WEBHOOK_SECRET: 32–256 случайных символов A-Z, a-z, 0-9, _ или -",
    );
  if (!/^\d+(,\d+)*$/.test(process.env.ADMIN_TELEGRAM_IDS || ""))
    throw Error(
      "Задайте ADMIN_TELEGRAM_IDS — числовые ID организаторов через запятую без пробелов",
    );
  const me = await telegramRequest("getMe");
  const username = (process.env.TELEGRAM_BOT_USERNAME || "").replace(/^@/, "");
  if (
    !me.is_bot ||
    !username ||
    me.username?.toLowerCase() !== username.toLowerCase()
  )
    throw Error(
      "TELEGRAM_BOT_USERNAME не соответствует токену. Проверьте настройки.",
    );
  await telegramRequest("setWebhook", {
    url: url + "/api/telegram/webhook",
    secret_token: secret,
    allowed_updates: ["message"],
    drop_pending_updates: false,
  });
  await telegramRequest("setChatMenuButton", {
    menu_button: { type: "web_app", text: "Расписание", web_app: { url } },
  });
  await telegramRequest("setMyCommands", {
    commands: [
      { command: "start", description: "Открыть приложение ABL" },
      { command: "schedule", description: "Расписание и согласование игр" },
      { command: "help", description: "Как войти и привязать команду" },
    ],
  });
  const webhook = await telegramRequest("getWebhookInfo");
  if (webhook.url !== url + "/api/telegram/webhook")
    throw Error("Telegram не подтвердил адрес webhook");
  console.log(
    `Настройки сохранены для @${me.username}. Откройте бота, нажмите /start, затем «Открыть расписание».`,
  );
  console.log(
    "Кнопка меню «Расписание» тоже открывает Mini App. Вход и уведомления проверьте реальным аккаунтом.",
  );
  if (
    webhook.last_error_date &&
    webhook.last_error_date > Math.floor(Date.now() / 1000) - 300
  )
    console.log(
      "Telegram недавно сообщал об ошибке доставки webhook. Проверьте доступность HTTPS и работу сервера.",
    );
}
