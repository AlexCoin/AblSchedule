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
  const firstTeam = page.getByRole("combobox", {
    name: "Матч 1: команда",
    exact: true,
  });
  const secondTeam = page.getByRole("combobox", {
    name: "Матч 2: команда",
    exact: true,
  });
  const firstId = await firstTeam.inputValue(),
    secondId = await secondTeam.inputValue();
  await expect(firstTeam.locator("option")).toHaveCount(8);
  await firstTeam.selectOption(secondId);
  await expect(secondTeam).toHaveValue(firstId);
  await expect(page.locator(".admin-match select").first()).toBeDisabled();
  await page
    .getByRole("button", { name: "Сохранить пары", exact: true })
    .click();
  await expect(
    page.getByRole("button", { name: "Сохранить пары", exact: true }),
  ).toBeDisabled();
  const currentPairState = await (await page.request.get("/api/state")).json();
  const invalidPairs = currentPairState.rounds[0].matches.map((m: any) => [
    m.a,
    m.b,
  ]);
  [invalidPairs[0][1], invalidPairs[4][1]] = [
    invalidPairs[4][1],
    invalidPairs[0][1],
  ];
  const invalidPairResponse = await page.request.post("/api/action", {
    headers: { origin: "http://localhost:3100" },
    data: { type: "pairs", round: "1", pairs: invalidPairs },
  });
  expect(invalidPairResponse.status()).toBe(400);
  expect((await invalidPairResponse.json()).error).toContain(
    "одного дивизиона",
  );
  await firstTeam.selectOption(firstId);
  await page
    .getByRole("button", { name: "Сохранить пары", exact: true })
    .click();
  await expect(
    page.getByRole("button", { name: "Сохранить пары", exact: true }),
  ).toBeDisabled();

  await page.getByRole("button", { name: "Капитан C", exact: true }).click();
  await expect(page.locator(".my-match")).toContainText("АИТ");
  await page
    .locator('[data-slot="2026-11-07T10:00"]')
    .getByRole("button", { name: "Выбрать этот слот", exact: true })
    .click();
  await page.getByRole("button", { name: "Капитан A", exact: true }).click();
  const tentative = page.locator('[data-slot="2026-11-07T10:00"]');
  await expect(tentative).toHaveClass(/tentative-card/);
  await expect(tentative.locator(".card-top")).toHaveText(
    "Ожидает подтверждения",
  );
  await expect(
    page.locator('[data-slot="2026-11-07T11:10"] .card-top'),
  ).toHaveText("Доступен");
  await expect(tentative.locator(".division-tag")).toHaveCount(0);
  await page.getByRole("button", { name: "Капитан C", exact: true }).click();
  await tentative
    .getByRole("button", { name: "Убрать выбор слота", exact: true })
    .click();
  await expect(tentative.locator(".preliminary-bookings")).toHaveCount(0);
  await tentative
    .getByRole("button", { name: "Выбрать этот слот", exact: true })
    .click();
  await page.getByRole("button", { name: "Организатор", exact: true }).click();
  await page.getByRole("button", { name: "Управление турниром" }).click();
  const pendingSlot = page.locator(".admin-match select").nth(1);
  await expect(pendingSlot).toHaveValue("__pending__");
  await expect(page.locator(".admin-pending")).toContainText("АИТ");
  await pendingSlot.selectOption("");
  await expect(page.locator(".admin-pending")).toHaveCount(0);
  await page.getByRole("button", { name: "Капитан C", exact: true }).click();
  await tentative
    .getByRole("button", { name: "Выбрать этот слот", exact: true })
    .click();
  await page.getByRole("button", { name: "Капитан A", exact: true }).click();

  await expect(tentative).toContainText("Предварительная заявка");
  await expect(tentative).toContainText("АИТ");
  await expect(
    tentative.getByRole("button", { name: "Выбрать этот слот", exact: true }),
  ).toBeEnabled();
  const visible = await (await page.request.get("/api/state")).json();
  expect(
    visible.rounds[0].matches.find((m: any) => m.id === "2").offers,
  ).toEqual([]);
  expect(visible.rounds[0].preliminary).toContainEqual({
    matchId: "2",
    slot: "2026-11-07T10:00",
    proposedBy: ["3"],
  });
  await page.setViewportSize({ width: 390, height: 844 });
  await expect
    .poll(() =>
      page.evaluate(() => document.documentElement.scrollWidth <= innerWidth),
    )
    .toBe(true);
  await page.screenshot({
    path: "data/preliminary-mobile.png",
    fullPage: true,
  });
  await page.getByRole("button", { name: "Капитан D", exact: true }).click();
  await expect(page.locator(".my-match")).toContainText("АТВ Last");
  await page
    .locator('[data-slot="2026-11-07T10:00"]')
    .getByRole("button", { name: "Подтвердить этот слот", exact: true })
    .click();
  await expect(page.getByText("Согласовано:", { exact: false })).toBeVisible();
  await expect(
    page.locator('[data-slot="2026-11-07T10:00"] .card-top'),
  ).toHaveText("Pale");

  await expect(
    page.locator('[data-slot="2026-11-07T10:00"] .preliminary-bookings'),
  ).toHaveCount(0);

  await page.getByRole("button", { name: "Капитан A", exact: true }).click();
  await expect(page.getByRole("button", { name: "Мой матч" })).toHaveCount(0);
  const forbiddenMatch = await page.request.post("/api/action", {
    headers: { origin: "http://localhost:3100" },
    data: { type: "offer", round: "1", match: "2", slot: "2026-11-07T10:00" },
  });
  expect(forbiddenMatch.status()).toBe(400);
  const claim = await page.request.post("/api/action", {
    headers: { origin: "http://localhost:3100" },
    data: { type: "claimTeam", team: "5" },
  });
  expect(claim.ok()).toBeTruthy();
  await page.reload();
  await expect(
    page
      .getByRole("combobox", { name: "Моя команда", exact: true })
      .locator("option"),
  ).toHaveCount(2);
  await page
    .getByRole("combobox", { name: "Моя команда", exact: true })
    .selectOption("5");
  await expect(page.locator(".my-match")).toContainText("Гусарские гоблины");
  await page
    .locator('[data-slot="2026-11-07T10:00"]')
    .getByRole("button", { name: "Выбрать этот слот", exact: true })
    .click();
  const multi = await (await page.request.get("/api/state")).json();
  await expect(
    page.locator('[data-slot="2026-11-07T10:00"] .card-top'),
  ).toHaveText("Pale");

  expect(
    multi.rounds[0].matches.find((m: any) => m.id === "3").offers,
  ).toContainEqual({ team: "5", slot: "2026-11-07T10:00" });
  expect(
    multi.rounds[0].matches.find((m: any) => m.id === "3").offers[0],
  ).not.toHaveProperty("by");
  await page
    .getByRole("combobox", { name: "Моя команда", exact: true })
    .selectOption("1");
  await expect(page.locator(".my-match")).toContainText("Школа ABL");

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
  await expect(
    page.locator('[data-slot="2026-11-07T10:00"] .card-top'),
  ).toHaveText("Pale");
  await page.getByRole("button", { name: "Организатор", exact: true }).click();
  await page.getByRole("button", { name: "Управление турниром" }).click();
  let selectors = page.locator(".admin-match select");
  expect(await selectors.nth(0).inputValue()).toBe("2026-11-07T10:00");
  expect(await selectors.nth(1).inputValue()).toBe("2026-11-07T10:00");
  await expect(
    page.getByText("Конфликт — выберите другое время одной из пар"),
  ).toHaveCount(2);
  await page.getByRole("button", { name: "Опубликовать весь тур" }).click();
  await expect(page.locator(".error[role=alert]")).toContainText(
    "разрешите конфликты",
  );
  await selectors.nth(1).selectOption("2026-11-07T11:10");
  await expect(
    page.getByText("Конфликт — выберите другое время одной из пар"),
  ).toHaveCount(0);
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
  await page.setViewportSize({ width: 1280, height: 900 });
  const geometry = await page.locator(".card").first().boundingBox();
  expect(geometry!.height).toBeLessThan(240);
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
  await expect(page.locator(".round-workspace .scope-heading")).toContainText(
    "1 тур",
  );
  await expect(
    page.getByRole("heading", { name: "Создать тур и слоты", exact: true }),
  ).toHaveCount(0);
  await page.getByRole("button", { name: "＋ Новый тур", exact: true }).click();
  await expect(page.locator(".round-workspace")).toHaveCount(0);
  const create = page.locator("section.panel").filter({
    has: page.getByRole("heading", {
      name: "Создать тур и слоты",
      exact: true,
    }),
  });
  await expect(create.locator(".pair-division")).toHaveCount(4);
  await expect(
    create
      .getByRole("combobox", { name: "Матч 1: команда", exact: true })
      .locator("option"),
  ).toHaveCount(8);
  await create.locator("[name=name]").fill("2 тур");
  await create.locator("[name=saturday]").fill("2026-11-14");
  await expect(create.locator("[name=opens]")).toHaveValue("2026-11-09T12:00");
  await expect(create.locator("[name=deadline]")).toHaveValue(
    "2026-11-10T18:00",
  );
  await create.locator("[name=start]").fill("09:00");
  await create.locator("[name=perDay]").fill("10");
  await expect(create.locator(".slot-preview span")).toHaveCount(10);
  await page
    .getByRole("button", { name: "Выбранный тур", exact: true })
    .click();
  await expect(page.locator(".scope-heading")).toContainText("1 тур");
  await page.getByRole("button", { name: "＋ Новый тур", exact: true }).click();
  await expect(create.locator("[name=opens]")).toHaveValue("2026-11-09T12:00");
  await expect(create.locator("[name=name]")).toHaveValue("2 тур");
  await expect(create.locator("[name=start]")).toHaveValue("09:00");

  await page.screenshot({ path: "data/admin-new-mobile.png", fullPage: true });
  const template = await page.request.get("/api/pairs-template");
  expect(template.ok()).toBeTruthy();
  await create.locator("input[type=file]").setInputFiles({
    name: "abl-pairs-template.xlsx",
    mimeType:
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    buffer: await template.body(),
  });
  await expect(page.getByRole("status")).toContainText("Excel прочитан");
  await create
    .getByRole("button", { name: "Создать тур", exact: true })
    .click();
  await expect(page.getByRole("status")).toContainText("Изменения сохранены");
  const stateAfter = await (await page.request.get("/api/state")).json();
  expect(stateAfter.rounds).toHaveLength(2);
  expect(stateAfter.rounds[1].matches).toHaveLength(16);
  expect(stateAfter.rounds[0].slots).toHaveLength(16);
  expect(stateAfter.rounds[1].slots).toHaveLength(20);
  expect(stateAfter.rounds[1].slots[0].time).toBe("09:00");
  await expect(page.locator(".scope-heading")).toContainText("2 тур");
  await expect(
    page.getByRole("combobox", { name: "Тур", exact: true }),
  ).toHaveValue(stateAfter.rounds[1].id);
  await page
    .getByRole("combobox", { name: "Тур", exact: true })
    .selectOption("1");
  await expect(page.locator(".scope-heading")).toContainText("1 тур");
  await expect(page.locator(".round-metrics")).toContainText("16 слотов");
  await page.screenshot({
    path: "data/admin-current-mobile.png",
    fullPage: true,
  });
  expect(errors).toEqual([]);
  await context.close();
});
