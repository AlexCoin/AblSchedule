import { test } from "node:test";
import assert from "node:assert/strict";
import { POST } from "../app/api/telegram/webhook/route";
import { configureTelegram } from "../lib/telegram-configure";
import { publicAppUrl } from "../lib/telegram-bot";
function environment(t: any) {
  const names = [
    "APP_URL",
    "RENDER_EXTERNAL_URL",
    "TELEGRAM_BOT_TOKEN",
    "TELEGRAM_BOT_USERNAME",
    "TELEGRAM_WEBHOOK_SECRET",
    "SESSION_SECRET",
    "ADMIN_TELEGRAM_IDS",
    "DEMO_MODE",
  ];
  const previous = Object.fromEntries(
    names.map((name) => [name, process.env[name]]),
  );
  Object.assign(process.env, {
    APP_URL: "https://abl.example.test",
    TELEGRAM_BOT_TOKEN: "test-only-not-real-token",
    TELEGRAM_BOT_USERNAME: "abl_schedule_bot",
    TELEGRAM_WEBHOOK_SECRET: "test_webhook_secret_123456789012345",
    SESSION_SECRET: "test_session_secret_123456789012345",
    ADMIN_TELEGRAM_IDS: "123456789",
    DEMO_MODE: "false",
  });
  t.after(() => {
    for (const name of names) {
      if (previous[name] === undefined) delete process.env[name];
      else process.env[name] = previous[name];
    }
  });
}
test("bot /start returns a Telegram web_app button and own ID", async (t) => {
  environment(t);
  const sent: any[] = [];
  t.mock.method(globalThis, "fetch", async (url: string, options: any) => {
    sent.push({ url, payload: JSON.parse(options.body) });
    return Response.json({ ok: true, result: { message_id: 1 } });
  });
  const response = await POST(
    new Request("https://abl.example.test/api/telegram/webhook", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-telegram-bot-api-secret-token": process.env.TELEGRAM_WEBHOOK_SECRET!,
      },
      body: JSON.stringify({
        message: {
          text: "/start",
          chat: { id: 123456789, type: "private" },
          from: { id: 123456789 },
        },
      }),
    }),
  );
  assert.equal(response.status, 200);
  assert.equal(sent.length, 1);
  assert.deepEqual(sent[0].payload.reply_markup.inline_keyboard[0][0].web_app, {
    url: "https://abl.example.test",
  });
  assert.match(sent[0].payload.text, /123456789/);
});
test("bot rejects untrusted webhook without sending messages", async (t) => {
  environment(t);
  let calls = 0;
  t.mock.method(globalThis, "fetch", async () => {
    calls++;
    return Response.json({ ok: true });
  });
  const response = await POST(
    new Request("https://abl.example.test/api/telegram/webhook", {
      method: "POST",
      body: "{}",
    }),
  );
  assert.equal(response.status, 403);
  assert.equal(calls, 0);
});
test("setup verifies bot identity and configures webhook, menu and commands", async (t) => {
  environment(t);
  const calls: any[] = [];
  t.mock.method(globalThis, "fetch", async (url: string, options: any) => {
    const method = url.split("/").at(-1);
    calls.push({ method, payload: JSON.parse(options.body) });
    return Response.json({
      ok: true,
      result:
        method === "getMe"
          ? { is_bot: true, username: "abl_schedule_bot" }
          : method === "getWebhookInfo"
            ? { url: "https://abl.example.test/api/telegram/webhook" }
            : true,
    });
  });
  await configureTelegram();
  assert.deepEqual(
    calls.map((c) => c.method),
    [
      "getMe",
      "setWebhook",
      "setChatMenuButton",
      "setMyCommands",
      "getWebhookInfo",
    ],
  );
  assert.equal(calls[1].payload.drop_pending_updates, false);
  assert.equal(
    calls[2].payload.menu_button.web_app.url,
    "https://abl.example.test",
  );
});
test("setup refuses a different bot before changing settings", async (t) => {
  environment(t);
  let calls = 0;
  t.mock.method(globalThis, "fetch", async () => {
    calls++;
    return Response.json({
      ok: true,
      result: { is_bot: true, username: "another_bot" },
    });
  });
  await assert.rejects(configureTelegram(), /не соответствует/);
  assert.equal(calls, 1);
});
test("hosting derives HTTPS address while localhost cannot be registered", (t) => {
  environment(t);
  delete process.env.APP_URL;
  process.env.RENDER_EXTERNAL_URL = "https://abl-trial.onrender.com";
  assert.equal(publicAppUrl(), "https://abl-trial.onrender.com");
  process.env.APP_URL = "http://localhost:3000";
  assert.throws(publicAppUrl);
});
