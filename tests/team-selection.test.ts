import { importTeamCatalog, selectableTeams } from "../lib/team-catalog";
import { test } from "node:test";
import assert from "node:assert/strict";
import { seed, apply } from "../lib/domain";
import { teamMenu } from "../lib/team-menu";
const actor = { id: "123", admin: false };
const now = Date.parse("2026-11-02T13:00:00+03:00");
test("captain claims multiple free teams without replacing existing captains", () => {
  const s = seed();
  apply(s, actor, { type: "claimTeam", team: "1" });
  apply(s, actor, { type: "claimTeam", team: "3" });
  apply(s, actor, { type: "claimTeam", team: "1" });
  assert.deepEqual(
    s.teams.filter((t) => t.telegramId === "123").map((t) => t.id),
    ["1", "3"],
  );
  assert.throws(
    () =>
      apply(s, { id: "999", admin: false }, { type: "claimTeam", team: "1" }),
    /другим капитаном/,
  );
  assert.throws(() =>
    apply(s, { id: "999", admin: false }, { type: "leaveTeam", team: "1" }),
  );
  apply(s, actor, { type: "leaveTeam", team: "1" });
  assert.equal(s.teams[2].telegramId, "123");
});
test("selected team determines permissions for multiple matches", () => {
  const s = seed();
  s.teams[0].telegramId = "123";
  s.teams[2].telegramId = "123";
  const slot = s.rounds[0].slots[0].id;
  apply(
    s,
    actor,
    { type: "offer", round: "1", match: "1", team: "1", slot },
    now,
  );
  apply(
    s,
    actor,
    { type: "offer", round: "1", match: "2", team: "3", slot },
    now,
  );
  assert.throws(() =>
    apply(
      s,
      actor,
      { type: "offer", round: "1", match: "2", team: "1", slot },
      now,
    ),
  );
  assert.equal(s.rounds[0].matches[1].offers[0].team, "3");
});
test("one captain cannot confirm their own proposal as the opponent", () => {
  const s = seed();
  s.teams[0].telegramId = "123";
  s.teams[1].telegramId = "123";
  const slot = s.rounds[0].slots[0].id;
  assert.throws(
    () => apply(s, actor, { type: "offer", round: "1", match: "1", slot }, now),
    /Выберите команду/,
  );
  apply(
    s,
    actor,
    { type: "offer", round: "1", match: "1", team: "1", slot },
    now,
  );
  assert.throws(
    () =>
      apply(
        s,
        actor,
        { type: "accept", round: "1", match: "1", team: "2", slot },
        now,
      ),
    /Своё предложение/,
  );
  assert.equal(s.rounds[0].matches[0].slot, null);
});
test("Telegram selector groups divisions and shows multiple selected teams with pagination", () => {
  const s = seed();
  s.teams.forEach((t, i) => (t.division = i < 16 ? "Pale" : "Slow"));
  s.teams[0].telegramId = "123";
  s.teams[16].telegramId = "123";
  const root = teamMenu(s, "123");
  assert.equal(root.reply_markup.inline_keyboard.length, 3);
  assert.match(root.text, /Школа ABL/);
  const page = teamMenu(s, "123", "0", 0);
  assert.equal(
    page.reply_markup.inline_keyboard[0][0].callback_data,
    "leave_confirm:1",
  );
  assert(
    page.reply_markup.inline_keyboard.some((row) =>
      row.some((b) => b.callback_data === "teams:0:1"),
    ),
  );
  assert.equal(
    teamMenu(s, "123", "mine").reply_markup.inline_keyboard.length,
    3,
  );
  assert.throws(() => teamMenu(s, "123", "999"));
});

test("catalog keeps existing captain and match IDs, imports all four divisions idempotently", () => {
  const s = seed();
  s.teams[0].telegramId = "123";
  const rows = ["Pale", "Slow", "Rook", "Last"].map((division, i) => ({
    name: i === 0 ? s.teams[0].name : "Команда " + division,
    division,
    logo: "/team-logos/" + division.toLowerCase() + ".png",
    sourceUrl: "https://ablforpeople.com/divisions",
  }));
  const first = importTeamCatalog(s, rows);
  assert.deepEqual(first, { added: 3, updated: 1 });
  assert.equal(s.teams[0].telegramId, "123");
  assert.equal(s.rounds[0].matches[0].a, "1");
  const length = s.teams.length;
  importTeamCatalog(s, rows);
  assert.equal(s.teams.length, length);
  assert.equal(selectableTeams(s.teams).length, 4);
  assert.throws(() => importTeamCatalog(s, rows.slice(0, 3)));
  assert.throws(() => importTeamCatalog(s, [...rows, rows[0]]));
});
