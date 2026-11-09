import { spawnSync } from "node:child_process";
import { mkdtempSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { test } from "node:test";
import assert from "node:assert/strict";
import { seed, apply } from "../lib/domain";
import {
  parseAdminLogins,
  bindAdminIdentity,
  hasStoredAdminAccess,
} from "../lib/admin-access";
import { syncRoundThree } from "../lib/round-three";
import { importTeamCatalog } from "../lib/team-catalog";
import { bundledCatalog } from "../lib/bundled-catalog";

test("only organizers can edit access; comma-separated handles normalize and IDs work", () => {
  const s = seed();
  assert.throws(
    () =>
      apply(
        s,
        { id: "123", admin: false },
        { type: "adminAccess", logins: "@captain_one" },
      ),
    /организатора/,
  );
  apply(
    s,
    { id: "1", admin: true },
    {
      type: "adminAccess",
      logins: " @Captain_One, captain_two, 123, @captain_one, ",
    },
  );
  assert.deepEqual(s.adminLogins, ["@captain_one", "@captain_two", "123"]);
  assert(hasStoredAdminAccess(s, "123"));
  for (const invalid of [
    null,
    "a@b.com",
    "@bad!name",
    "https://t.me/captain",
    "0",
    "99999999999999999",
  ])
    assert.throws(() => parseAdminLogins(invalid));
});
test("verified identity binds handle to ID, retains it on rename and revokes immediately", () => {
  const s = seed();
  const admin = { id: "1", admin: true };
  apply(s, admin, {
    type: "adminAccess",
    logins: "@captain_one, @captain_two",
  });
  assert(!hasStoredAdminAccess(s, "222"));
  bindAdminIdentity(s, "222", "Captain_One");
  assert(hasStoredAdminAccess(s, "222"));
  bindAdminIdentity(s, "333", "captain_one");
  assert(!hasStoredAdminAccess(s, "333"));
  bindAdminIdentity(s, "222", "renamed_user");
  assert(hasStoredAdminAccess(s, "222"));
  apply(s, admin, { type: "adminAccess", logins: "@captain_two" });
  assert(!hasStoredAdminAccess(s, "222"));
  assert.deepEqual(s.adminBindings, {});
});
test("round three matches all four screenshots; 16 empty slots on November 14–15 and recoverable reset", () => {
  const s = seed();
  importTeamCatalog(s, bundledCatalog());
  const old = structuredClone(s.rounds);
  old[0].matches[0].offers.push({ team: "1", slot: "old-slot", by: "555" });
  s.rounds = structuredClone(old);
  s.adminLogins = ["555"];
  const t = s.teams.find((t) => t.name === "Normal Team")!;
  t.telegramId = "555";
  syncRoundThree(s);
  assert.deepEqual(s.scheduleBackup!.rounds, old);
  assert.equal(t.telegramId, "555");
  assert.deepEqual(s.adminLogins, ["555"]);
  assert.equal(s.rounds.length, 1);
  const r = s.rounds[0];
  assert.equal(r.name, "3 тур");
  assert.equal(r.opens, "2026-11-09T12:00");
  assert.equal(r.deadline, "2026-11-10T18:00");
  assert.deepEqual(
    [...new Set(r.slots.map((s) => s.date))],
    ["2026-11-14", "2026-11-15"],
  );
  assert.equal(r.slots.length, 16);
  assert.equal(r.slots[0].time, "10:00");
  assert.equal(r.slots[7].time, "18:10");
  assert(!r.published);
  assert(r.matches.every((m) => !m.slot && !m.offers.length));
  assert.equal(new Set(r.matches.flatMap((m) => [m.a, m.b])).size, 32);
  const names = r.matches.map((m) => {
    const a = s.teams.find((t) => t.id === m.a)!;
    const b = s.teams.find((t) => t.id === m.b)!;
    assert.equal(a.division, b.division);
    assert(a.logo && b.logo);
    return [a.division, a.name, b.name];
  });
  assert.deepEqual(names, [
    ["Pale", "Союз Баскет", "Коммунарка"],
    ["Pale", "БК Трактор", "Petrovsky Hawks"],
    ["Pale", "Восход Фортуна", "Aviator"],
    ["Pale", "Big Ballers Team", "Ягуары"],
    ["Slow", "Normal Team", "Max Basket"],
    ["Slow", "ДИТ", "Вымпел"],
    ["Slow", "ABL School", "Hungry Dogs"],
    ["Slow", "Beavers", "Ruina Chill"],
    ["Rook", "Гусары", "Stankolit"],
    ["Rook", "ATB", "Ruina Media"],
    ["Rook", "Melbourne United", "Ruina W"],
    ["Rook", "We'Kings", "Hungry Dogs"],
    ["Last", "Гусарские Гоблины", "Team Rise"],
    ["Last", "ATB LAST", "ProgressBasket"],
    ["Last", "Luckers", "G-Town"],
    ["Last", "BBC", "Beavers"],
  ]);
  r.matches[0].slot = r.slots[0].id;
  r.matches[1].offers.push({ team: r.matches[1].a, slot: r.slots[1].id });
  r.name = "3 тур — изменён";
  const after = JSON.stringify(s);
  syncRoundThree(s);
  assert.equal(JSON.stringify(s), after);
});
test("missing screenshot team aborts reset without modifying existing schedule", () => {
  const s = seed();
  const old = JSON.stringify(s);
  assert.throws(() => syncRoundThree(s), /Не найдена команда/);
  assert.equal(JSON.stringify(s), old);
});

test("database migration commits a backup and survives a fresh server process without resetting offers", () => {
  const dir = mkdtempSync(join(tmpdir(), "abl-launch-"));
  const env = {
    ...process.env,
    DATABASE_URL: "",
    DATABASE_PATH: join(dir, "state.sqlite"),
    DEMO_MODE: "false",
  };
  const run = (code: string) => {
    const result = spawnSync(
      process.execPath,
      ["--import", "tsx", "-e", code],
      { env, encoding: "utf8", timeout: 15000 },
    );
    assert.equal(result.status, 0, result.stderr || result.stdout);
  };
  try {
    run(`
      const assert = require("node:assert/strict");
      const { DatabaseSync } = require("node:sqlite");
      const { seed } = require("./lib/domain");
      const db = new DatabaseSync(process.env.DATABASE_PATH);
      db.exec("CREATE TABLE app (id INTEGER PRIMARY KEY, value TEXT NOT NULL)");
      const old = seed(); old.rounds[0].name = "Старое расписание";
      old.rounds[0].matches[0].offers.push({team:"1",slot:"old-slot"});
      db.prepare("INSERT INTO app VALUES (1,?)").run(JSON.stringify(old)); db.close();
      require("./lib/db").transaction(s => {
        assert.equal(s.rounds.length, 1); assert.equal(s.rounds[0].name, "3 тур");
        assert.deepEqual(s.scheduleBackup.rounds, old.rounds);
        const r = s.rounds[0]; r.matches[0].offers.push({team:r.matches[0].a,slot:r.slots[0].id});
      }).catch(e => { console.error(e); process.exitCode=1; });
    `);
    run(`
      const assert = require("node:assert/strict");
      require("./lib/db").transaction(s => {
        assert.equal(s.rounds.length, 1); assert.equal(s.rounds[0].name, "3 тур");
        assert.equal(s.rounds[0].matches[0].offers.length, 1);
        assert.equal(s.scheduleBackup.rounds[0].name, "Старое расписание");
        assert.equal(s.scheduleBackup.rounds[0].matches[0].offers[0].slot, "old-slot");
      }).catch(e => { console.error(e); process.exitCode=1; });
    `);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});
