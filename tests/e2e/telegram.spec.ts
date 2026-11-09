import { test, expect } from "@playwright/test";
import { createHmac } from "node:crypto";
function initData(id = 123456789, username?: string) {
  const params = new URLSearchParams({
    user: JSON.stringify({ id, username, first_name: "Организатор" }),
    auth_date: String(Math.floor(Date.now() / 1000)),
    query_id: "test-mini-launch",
  });
  const data = [...params.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([k, v]) => k + "=" + v)
    .join("\n");
  const key = createHmac("sha256", "WebAppData")
    .update("test-only-not-a-real-bot-token")
    .digest();
  params.set("hash", createHmac("sha256", key).update(data).digest("hex"));
  return params.toString();
}
test("Mini App enters with verified identity, expands and logs out", async ({
  page,
}) => {
  const data = initData();
  await page.addInitScript((init) => {
    window.Telegram = {
      WebApp: {
        initData: init,
        ready: () => {
          document.documentElement.dataset.tgReady = "yes";
        },
        expand: () => {
          document.documentElement.dataset.tgExpanded = "yes";
        },
      },
    };
  }, data);
  await page.goto("/#tgWebAppPlatform=tdesktop");
  await expect(page.locator(".auth")).toContainText("Организатор");
  const state = await (await page.request.get("/api/state")).json();
  expect(state.user).toEqual({ id: "123456789", admin: true });
  await expect(page.locator("html")).toHaveAttribute("data-tg-ready", "yes");
  await expect(page.locator("html")).toHaveAttribute("data-tg-expanded", "yes");
  const cookies = await page.context().cookies();
  const session = cookies.find((c) => c.name === "abl_session");
  expect(session?.httpOnly).toBeTruthy();
  expect(session?.secure).toBeTruthy();
  expect(session?.sameSite).toBe("None");
  await page.getByRole("button", { name: "Выйти", exact: true }).click();
  await expect(page.locator(".auth")).toContainText("Войти в Telegram");
  const loggedOut = await (await page.request.get("/api/state")).json();
  expect(loggedOut.user).toBeNull();
});
test("Mini App rejects forged Telegram user instead of using client identity", async ({
  page,
}) => {
  const params = new URLSearchParams(initData());
  params.set("user", JSON.stringify({ id: 999999999 }));
  await page.addInitScript((init) => {
    window.Telegram = {
      WebApp: { initData: init, ready: () => {}, expand: () => {} },
    };
  }, params.toString());
  await page.goto("/#tgWebAppPlatform=android");
  await expect(
    page.getByText("Недействительная подпись Telegram", { exact: true }),
  ).toBeVisible();
  const state = await (await page.request.get("/api/state")).json();
  expect(state.user).toBeNull();
});

test("admin UI grants multiple verified Telegram users access and revokes it for an existing session", async ({
  page,
  browser,
}) => {
  await page.addInitScript((init) => {
    window.Telegram = {
      WebApp: { initData: init, ready: () => {}, expand: () => {} },
    };
  }, initData());
  await page.goto("/#tgWebAppPlatform=tdesktop");
  await expect(page.locator(".auth")).toContainText("Организатор");
  await page
    .getByRole("button", { name: "Управление турниром", exact: true })
    .click();
  await page.getByRole("button", { name: "Организаторы", exact: true }).click();
  const logins = page.getByRole("textbox", {
    name: "Telegram-логины организаторов",
    exact: true,
  });
  await logins.fill("@Assistant_One, @assistant_two, 333333333");
  await page.getByRole("button", { name: "Сохранить организаторов" }).click();
  await expect(
    page.getByText("@assistant_one — ожидает входа через Telegram", {
      exact: true,
    }),
  ).toBeVisible();
  const context = await browser.newContext();
  const other = await context.newPage();
  const forged = new URLSearchParams(initData(222222222));
  forged.set(
    "user",
    JSON.stringify({ id: 222222222, username: "assistant_one" }),
  );
  const denied = await other.request.post("/api/auth/telegram-mini", {
    data: { initData: forged.toString() },
    headers: { Origin: "http://localhost:3100" },
  });
  expect(denied.status()).toBe(401);
  await other.addInitScript(
    (init) => {
      window.Telegram = {
        WebApp: { initData: init, ready: () => {}, expand: () => {} },
      };
    },
    initData(222222222, "assistant_one"),
  );
  await other.goto("/#tgWebAppPlatform=tdesktop");
  await expect(other.locator(".auth")).toContainText("Организатор");
  const state = await (await other.request.get("/api/state")).json();
  expect(state.user).toEqual({ id: "222222222", admin: true });
  expect(state.adminBindings["@assistant_one"]).toBe("222222222");
  await logins.fill("@assistant_two, 333333333");
  await page.getByRole("button", { name: "Сохранить организаторов" }).click();
  await expect(
    page.getByText("@assistant_one — доступ настроен", { exact: true }),
  ).toHaveCount(0);
  await expect
    .poll(
      async () =>
        (await (await other.request.get("/api/state")).json()).user.admin,
    )
    .toBe(false);
  const revoked = await other.request.post("/api/action", {
    data: { type: "adminAccess", logins: "222222222" },
    headers: { Origin: "http://localhost:3100" },
  });
  expect(revoked.status()).toBe(400);
  const privateState = await (await other.request.get("/api/state")).json();
  expect(privateState.adminLogins).toBeUndefined();
  expect(privateState.adminBindings).toBeUndefined();
  expect(privateState.scheduleBackup).toBeUndefined();
  await logins.fill("");
  await page.getByRole("button", { name: "Сохранить организаторов" }).click();
  await expect
    .poll(
      async () =>
        (await (await page.request.get("/api/state")).json()).adminLogins,
    )
    .toEqual([]);
  await context.close();
});
