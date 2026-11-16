import { test } from "node:test";
import assert from "node:assert/strict";
import { seed, apply } from "../lib/domain";
import { bundledCatalog } from "../lib/bundled-catalog";
import { importTeamCatalog } from "../lib/team-catalog";
import { syncRoundThree } from "../lib/round-three";
import { syncRoundFour } from "../lib/round-four";
function fixture() {
  const s = seed();
  importTeamCatalog(s, bundledCatalog());
  syncRoundThree(s);
  return s;
}
test("round four contains the 16 screenshot pairs, correct weekend and negotiation window; round three survives", () => {
  const s = fixture();
  s.rounds[0].matches[0].offers.push({
    team: s.rounds[0].matches[0].a,
    slot: s.rounds[0].slots[0].id,
  });
  s.rounds[0].matches[1].slot = s.rounds[0].slots[1].id;
  s.teams[0].telegramId = "123";
  s.adminLogins = ["123"];
  const before = JSON.stringify(s);
  const old = structuredClone(s.rounds[0]);
  syncRoundFour(s);
  assert.equal(s.rounds.length, 2);
  assert.deepEqual(s.rounds[0], old);
  const r = s.rounds[1];
  assert.equal(s.currentRoundId, r.id);
  assert.equal(r.name, "4 тур");
  assert.equal(r.saturday, "2026-11-21");
  assert.equal(r.opens, "2026-11-16T12:00");
  assert.equal(r.deadline, "2026-11-17T18:00");
  assert.equal(r.slots.length, 16);
  assert.deepEqual(
    [...new Set(r.slots.map((s) => s.date))],
    ["2026-11-21", "2026-11-22"],
  );
  assert.deepEqual(
    r.slots.slice(0, 8).map((s) => s.time),
    ["10:00", "11:10", "12:20", "13:30", "14:40", "15:50", "17:00", "18:10"],
  );
  assert(!r.published);
  assert(r.matches.every((m) => m.slot === null && !m.offers.length));
  assert.equal(new Set(r.matches.flatMap((m) => [m.a, m.b])).size, 32);
  const names = r.matches.map((m) => {
    const a = s.teams.find((t) => t.id === m.a)!;
    const b = s.teams.find((t) => t.id === m.b)!;
    assert.equal(a.division, b.division);
    assert(a.logo && b.logo);
    return [a.division, a.name, b.name];
  });
  assert.deepEqual(names, [
    ["Pale", "Big Ballers Team", "Восход Фортуна"],
    ["Pale", "Aviator", "БК Трактор"],
    ["Pale", "Petrovsky Hawks", "Союз Баскет"],
    ["Pale", "Ягуары", "Коммунарка"],
    ["Slow", "Beavers", "ABL School"],
    ["Slow", "Hungry Dogs", "ДИТ"],
    ["Slow", "Вымпел", "Normal Team"],
    ["Slow", "Ruina Chill", "Max Basket"],
    ["Rook", "We'Kings", "Melbourne United"],
    ["Rook", "Ruina W", "ATB"],
    ["Rook", "Ruina Media", "Гусары"],
    ["Rook", "Hungry Dogs", "Stankolit"],
    ["Last", "BBC", "Luckers"],
    ["Last", "G-Town", "ATB LAST"],
    ["Last", "ProgressBasket", "Гусарские Гоблины"],
    ["Last", "Beavers", "Team Rise"],
  ]);
  const parsed = JSON.parse(before);
  assert.deepEqual(s.teams, parsed.teams);
  assert.deepEqual(s.adminLogins, parsed.adminLogins);
  assert.deepEqual(s.scheduleBackup, parsed.scheduleBackup);
  r.matches[0].offers.push({ team: r.matches[0].a, slot: r.slots[0].id });
  r.matches[1].slot = r.slots[1].id;
  r.deadline = "2026-11-18T18:00";
  const after = JSON.stringify(s);
  syncRoundFour(s);
  assert.equal(JSON.stringify(s), after);
});
test("an existing round with matching fixtures retains negotiations and is made current without duplication", () => {
  const s = fixture();
  syncRoundFour(s);
  delete s.roundFourRevision;
  s.currentRoundId = s.rounds[0].id;
  const r = s.rounds[1];
  r.matches[0].offers.push({ team: r.matches[0].a, slot: r.slots[0].id });
  const before = structuredClone(r);
  syncRoundFour(s);
  assert.equal(s.rounds.length, 2);
  assert.deepEqual(s.rounds[1], before);
  assert.equal(s.currentRoundId, r.id);
});
test("replacing different draft fixtures archives only that round and retains round three", () => {
  const s = fixture();
  syncRoundFour(s);
  delete s.roundFourRevision;
  const r = s.rounds[1];
  [r.matches[0].b, r.matches[1].b] = [r.matches[1].b, r.matches[0].b];
  r.matches[0].offers.push({ team: r.matches[0].a, slot: r.slots[0].id });
  const old = structuredClone(r);
  const three = structuredClone(s.rounds[0]);
  syncRoundFour(s);
  assert.deepEqual(s.roundFourBackup!.round, old);
  assert.deepEqual(s.rounds[0], three);
  assert(s.rounds[1].matches.every((m) => !m.slot && !m.offers.length));
});
test("missing catalog team aborts before any schedule mutation", () => {
  const s = seed();
  const old = JSON.stringify(s);
  assert.throws(() => syncRoundFour(s), /Не найдена команда/);
  assert.equal(JSON.stringify(s), old);
});
test("creating a later round makes the new round current", () => {
  const s = fixture();
  syncRoundFour(s);
  apply(
    s,
    { id: "123", admin: true },
    {
      type: "round",
      name: "5 тур",
      saturday: "2026-11-28",
      opens: "2026-11-23T12:00",
      deadline: "2026-11-24T18:00",
      pairs: s.rounds[1].matches.map((m) => [m.a, m.b]),
    },
  );
  assert.equal(s.currentRoundId, s.rounds.at(-1)!.id);
});
