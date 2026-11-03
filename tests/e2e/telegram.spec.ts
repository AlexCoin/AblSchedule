import { test, expect } from "@playwright/test";
import { createHmac } from "node:crypto";
function initData() {
  const params = new URLSearchParams({
    user: JSON.stringify({ id: 123456789, first_name: "Организатор" }),
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
