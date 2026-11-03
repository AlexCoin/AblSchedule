import { teamMenu } from "../lib/team-menu";
import { test } from "node:test";
import assert from "node:assert/strict";
import catalog from "../catalog/abl-teams.json";
import { seed } from "../lib/domain";
import { importTeamCatalog, selectableTeams } from "../lib/team-catalog";
import { syncBundledCatalog, bundledCatalog } from "../lib/bundled-catalog";
test("uploaded page contains 32 official teams, eight in each requested division", () => {
  assert.equal(catalog.length, 32);
  for (const division of ["Pale", "Slow", "Rook", "Last"])
    assert.equal(catalog.filter((t) => t.division === division).length, 8);
  assert.equal(new Set(catalog.map((t) => t.sourceTeamKey)).size, 32);
  assert.equal(new Set(catalog.map((t) => t.localLogo)).size, 32);
  for (const t of catalog)
    assert.equal(new URL(t.logo).origin, "https://fs.mtgame.ru");
  for (const name of ["Hungry Dogs", "Beavers"])
    assert.equal(catalog.filter((t) => t.name === name).length, 2);
});
test("catalog revision is idempotent and preserves rounds, captain IDs and later user edits", (t) => {
  const prior = process.env.DEMO_MODE;
  process.env.DEMO_MODE = "false";
  t.after(() => {
    if (prior === undefined) delete process.env.DEMO_MODE;
    else process.env.DEMO_MODE = prior;
  });
  const s = seed();
  s.teams.find((t) => t.name === "Normal Team")!.telegramId = "123";
  const rounds = JSON.stringify(s.rounds);
  syncBundledCatalog(s);
  assert.equal(selectableTeams(s.teams).length, 32);
  assert.equal(
    s.teams.find((t) => t.name === "Normal Team")!.telegramId,
    "123",
  );
  assert.equal(JSON.stringify(s.rounds), rounds);
  const length = s.teams.length;
  const team = s.teams.find(
    (t) => t.sourceTeamKey === catalog[0].sourceTeamKey,
  )!;
  team.name = "Название организатора";
  syncBundledCatalog(s);
  assert.equal(team.name, "Название организатора");
  assert.equal(s.teams.length, length);
  importTeamCatalog(s, bundledCatalog());
  assert.equal(s.teams.length, length);
  assert.equal(team.name, catalog[0].name);
});
test("ambiguous legacy names are not assigned to an arbitrary division", () => {
  const s = seed();
  const legacy = s.teams.find((t) => t.name === "Hungry Dogs")!;
  legacy.telegramId = "555";
  importTeamCatalog(s, bundledCatalog());
  assert.equal(legacy.division, undefined);
  assert.equal(legacy.telegramId, "555");
  const official = selectableTeams(s.teams).filter(
    (t) => t.name === "Hungry Dogs",
  );
  assert.equal(official.length, 2);
  assert(official.every((t) => t.id !== legacy.id && t.telegramId === ""));
});

test("bot exposes the imported 32 teams under four divisions in league order", () => {
  const s = seed();
  importTeamCatalog(s, bundledCatalog());
  const menu = teamMenu(s, "123");
  assert.deepEqual(
    menu.reply_markup.inline_keyboard.slice(0, 4).map((r) => r[0].text),
    ["Pale · 8", "Slow · 8", "Rook · 8", "Last · 8"],
  );
  for (let i = 0; i < 4; i++)
    assert.equal(
      teamMenu(s, "123", String(i)).reply_markup.inline_keyboard.length,
      9,
    );
});
