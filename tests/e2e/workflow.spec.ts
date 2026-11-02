import { test, expect } from "@playwright/test";
test("captains negotiate, organizer resolves conflicts and publishes; mobile fits", async ({
  browser,
}) => {
  const context = await browser.newContext();
  const page = await context.newPage();
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto("/");
  const anonymous = await page.request.post("/api/action", {
    headers: { origin: "http://localhost:3100" },
    data: { type: "publish", round: "1" },
  });
  expect(anonymous.status()).toBe(401);
  const forged = await page.request.post("/api/auth/demo", {
    headers: { origin: "https://evil.example" },
    data: { role: "admin" },
  });
  expect(forged.status()).toBe(403);
  const webhook = await page.request.post("/api/telegram/webhook", {
    data: { message: {} },
  });
  expect(webhook.status()).toBe(403);
  await expect(page.getByText("Скоро на паркете")).toBeVisible();
  await page.getByRole("button", { name: "Организатор", exact: true }).click();
  await page.getByRole("button", { name: "Управление турниром" }).click();
  const settings = page
    .locator("form")
    .filter({ has: page.getByRole("button", { name: "Сохранить сроки" }) });
  await settings.locator("[name=opens]").fill("2026-01-01T00:00");
  await settings.locator("[name=deadline]").fill("2027-01-01T00:00");
  await settings.getByRole("button").click();
  await expect(page.getByRole("status")).toContainText("Изменения сохранены");
  const occupied = await page.request.post("/api/action", {
    headers: { origin: "http://localhost:3100" },
    data: { type: "assign", round: "1", match: "2", slot: "2026-11-07T10:00" },
  });
  expect(occupied.ok()).toBeTruthy();
  await page.getByRole("button", { name: "Капитан A", exact: true }).click();
  await expect(page.getByRole("button", { name: "Мой матч" })).toHaveCount(0);
  const forbiddenMatch = await page.request.post("/api/action", {
    headers: { origin: "http://localhost:3100" },
    data: { type: "offer", round: "1", match: "2", slot: "2026-11-07T10:00" },
  });
  expect(forbiddenMatch.status()).toBe(400);

  await expect(page.locator('[data-slot="2026-11-07T10:00"]')).toContainText(
    "Слот уже занят",
  );
  await expect(
    page.locator('[data-slot="2026-11-07T10:00"] button'),
  ).toBeEnabled();
  await page
    .getByRole("button", { name: "Выбрать этот слот", exact: true })
    .first()
    .click();
  await expect(
    page.getByText("Ваше предложение · ждём соперника"),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Выбрать этот слот", exact: true })
    .first()
    .click();
  await expect(page.getByText("Ваше предложение · ждём соперника")).toHaveCount(
    2,
  );
  await page.setViewportSize({ width: 390, height: 844 });
  await expect
    .poll(() =>
      page.evaluate(() => document.documentElement.scrollWidth <= innerWidth),
    )
    .toBe(true);
  await page.screenshot({ path: "data/captain-mobile.png", fullPage: true });
  await page.getByRole("button", { name: "Капитан Б", exact: true }).click();
  await expect(
    page.getByText("Соперник предлагает — ждёт вашего подтверждения"),
  ).toHaveCount(2);
  await page
    .getByRole("button", { name: "Подтвердить этот слот", exact: true })
    .first()
    .click();
  await expect(
    page.getByRole("button", { name: "Подтвердить этот слот", exact: true }),
  ).toHaveCount(0);
  await expect(page.getByText("Согласовано:", { exact: false })).toBeVisible();
  await page.getByRole("button", { name: "Организатор", exact: true }).click();
  await page.getByRole("button", { name: "Управление турниром" }).click();
  let selectors = page.locator(".admin-match select");
  const first = await selectors.nth(0).inputValue();
  await selectors.nth(1).selectOption(first);
  await expect(
    page.getByText("Конфликт — выберите другое время одной из пар"),
  ).toHaveCount(2);
  await page.getByRole("button", { name: "Опубликовать весь тур" }).click();
  await expect(page.locator(".error[role=alert]")).toContainText(
    "разрешите конфликты",
  );
  const state = await (await page.request.get("/api/state")).json();
  const r = state.rounds[0];
  for (let i = 0; i < r.matches.length; i++) {
    const res = await page.request.post("/api/action", {
      headers: { origin: "http://localhost:3100" },
      data: {
        type: "assign",
        round: r.id,
        match: r.matches[i].id,
        slot: r.slots[i].id,
      },
    });
    expect(res.ok()).toBeTruthy();
  }
  await page.reload();
  await page.getByRole("button", { name: "Управление турниром" }).click();
  await page.getByRole("button", { name: "Опубликовать весь тур" }).click();
  await expect(
    page.getByRole("button", { name: "Тур опубликован" }),
  ).toBeDisabled();
  await page.getByRole("button", { name: "Выйти", exact: true }).click();
  await page.getByRole("button", { name: "Расписание", exact: true }).click();
  await expect(page.locator(".card")).toHaveCount(16);
  await expect(page.locator(".match")).toHaveCount(16);
  await page.screenshot({ path: "data/desktop.png", fullPage: true });
  await page.setViewportSize({ width: 390, height: 844 });
  await expect
    .poll(() =>
      page.evaluate(() => document.documentElement.scrollWidth <= innerWidth),
    )
    .toBe(true);
  await page.screenshot({ path: "data/mobile.png", fullPage: true });
  await page.getByRole("button", { name: "Организатор", exact: true }).click();
  await page.getByRole("button", { name: "Управление турниром" }).click();
  const create = page.locator("section.panel").filter({
    has: page.getByRole("heading", { name: "Создать тур", exact: true }),
  });
  await create.locator("[name=name]").fill("2 тур");
  await create.locator("[name=saturday]").fill("2026-11-14");
  await expect(create.locator("[name=opens]")).toHaveValue("2026-11-09T12:00");
  await expect(create.locator("[name=deadline]")).toHaveValue(
    "2026-11-10T18:00",
  );
  await create
    .locator("input[type=file]")
    .setInputFiles("public/pairs-template.xlsx");
  await expect(page.getByRole("status")).toContainText("Excel прочитан");
  await create
    .getByRole("button", { name: "Создать тур", exact: true })
    .click();
  await expect(page.getByRole("status")).toContainText("Изменения сохранены");
  const stateAfter = await (await page.request.get("/api/state")).json();
  expect(stateAfter.rounds).toHaveLength(2);
  expect(stateAfter.rounds[1].matches).toHaveLength(16);
  expect(errors).toEqual([]);
  await context.close();
});
