import { test, expect } from "@playwright/test";
import { seed, makeRound, defaultWindow } from "../../lib/domain";

test("current round and organizer report distinguish negotiations and filter out shared slots", async ({
  page,
}) => {
  const state = seed();
  state.teams.forEach((t, i) => {
    t.division = ["Pale", "Slow", "Rook", "Last"][Math.floor(i / 8)];
  });
  const pairs = state.rounds[0].matches.map((m) => [m.a, m.b]);
  const make = (id: string, name: string, date: string) => {
    const w = defaultWindow(date);
    return makeRound(id, name, date, w.opens, w.deadline, pairs);
  };
  const fourth = make("four", "4 тур", "2026-11-21");
  const slots = fourth.slots.map((s) => s.id);
  fourth.matches[1].offers = [{ team: fourth.matches[1].a, slot: slots[0] }];
  fourth.matches[2].offers = [
    { team: fourth.matches[2].a, slot: slots[0] },
    { team: fourth.matches[2].b, slot: slots[1] },
  ];
  fourth.matches[3].offers = [
    { team: fourth.matches[3].a, slot: slots[0] },
    { team: fourth.matches[3].a, slot: slots[1] },
    { team: fourth.matches[3].b, slot: slots[1] },
  ];
  fourth.matches.slice(4).forEach((m, i) => {
    m.slot = slots[i === 1 ? 4 : i + 4];
  });
  state.rounds = [
    make("three", "3 тур", "2026-11-14"),
    fourth,
    make("future", "5 тур", "2026-11-28"),
  ];
  await page.route("**/api/state", (route) =>
    route.fulfill({
      json: {
        user: { id: "test-admin", admin: true },
        demo: false,
        currentRoundId: "four",
        teams: state.teams.map((t) => ({ ...t, mine: false })),
        rounds: state.rounds.map((r) => ({ ...r, preliminary: [] })),
      },
    }),
  );
  await page.goto("/");
  await expect(
    page.getByRole("combobox", { name: "Тур", exact: true }),
  ).toHaveValue("four");
  await page
    .getByRole("button", { name: "Управление турниром", exact: true })
    .click();
  const report = page.getByRole("region", {
    name: "Несогласованные матчи",
    exact: true,
  });
  await expect(report.getByRole("heading")).toHaveText(
    "Не договорились · 4 тур",
  );
  await expect(report.locator(".negotiation-row")).toHaveCount(4);
  for (const status of ["empty", "one-sided", "no-common", "confirmation"])
    await expect(report.locator(`[data-negotiation="${status}"]`)).toHaveCount(
      1,
    );
  await expect(report.locator('[data-negotiation="no-common"]')).toContainText(
    "21.11 · 10:00",
  );
  await expect(report.locator('[data-negotiation="no-common"]')).toContainText(
    "21.11 · 11:10",
  );
  await expect(
    report.locator('[data-negotiation="confirmation"]'),
  ).toContainText("Общие варианты: 21.11 · 11:10");
  await report
    .getByRole("checkbox", { name: "Только без общих слотов" })
    .check();
  await expect(report.locator(".negotiation-row")).toHaveCount(3);
  await expect(report.locator('[data-negotiation="confirmation"]')).toHaveCount(
    0,
  );
  await page.screenshot({
    path: "data/admin-round4-report.png",
    fullPage: true,
  });
  await page.setViewportSize({ width: 390, height: 844 });
  await expect
    .poll(() =>
      page.evaluate(() => document.documentElement.scrollWidth <= innerWidth),
    )
    .toBe(true);
  await page.screenshot({
    path: "data/admin-round4-mobile.png",
    fullPage: true,
  });
  await page
    .getByRole("combobox", { name: "Тур", exact: true })
    .selectOption("three");
  await expect(report.getByRole("heading")).toHaveText(
    "Не договорились · 3 тур",
  );
  await expect(report.locator(".negotiation-row")).toHaveCount(16);
  await page
    .getByRole("combobox", { name: "Тур", exact: true })
    .selectOption("four");
  await expect(report.locator(".negotiation-row")).toHaveCount(4);
});
