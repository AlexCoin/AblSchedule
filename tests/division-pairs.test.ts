import { pairsWorkbook } from "../lib/pairs-workbook";
import { readSheet } from "read-excel-file/node";
import { test } from "node:test";
import assert from "node:assert/strict";
import { seed, apply } from "../lib/domain";
import { importTeamCatalog } from "../lib/team-catalog";
import { bundledCatalog } from "../lib/bundled-catalog";
import {
  defaultDivisionPairs,
  validateDivisionPairs,
  swapPairTeam,
} from "../lib/division-pairs";
import { syncDivisionPairings } from "../lib/pairing-migration";
const admin = { id: "organizer", admin: true };
function setup() {
  const s = seed();
  importTeamCatalog(s, bundledCatalog());
  return s;
}
test("default pairs use all 32 official teams once, four games in each division", () => {
  const s = setup(),
    pairs = defaultDivisionPairs(s.teams);
  validateDivisionPairs(s.teams, pairs);
  assert.equal(new Set(pairs.flat()).size, 32);
  for (const d of ["Pale", "Slow", "Rook", "Last"])
    assert.equal(
      pairs.filter((p) => s.teams.find((t) => t.id === p[0])!.division === d)
        .length,
      4,
    );
});
test("selecting another used team swaps positions without duplicates or cross-division games", () => {
  const s = setup(),
    pairs = defaultDivisionPairs(s.teams);
  const changed = swapPairTeam(s.teams, pairs, 0, 0, pairs[1][0]);
  assert.equal(changed[0][0], pairs[1][0]);
  assert.equal(changed[1][0], pairs[0][0]);
  validateDivisionPairs(s.teams, changed);
  assert.deepEqual(swapPairTeam(s.teams, pairs, 0, 0, pairs[4][0]), pairs);
  assert.deepEqual(swapPairTeam(s.teams, pairs, 0, 0, pairs[0][1]), pairs);
});
test("server rejects cross-division pair replacements and new tours", () => {
  const s = setup();
  syncDivisionPairings(s);
  const pairs = defaultDivisionPairs(s.teams);
  const bad = pairs.map((p) => [...p]);
  [bad[0][1], bad[4][1]] = [bad[4][1], bad[0][1]];
  assert.throws(
    () => apply(s, admin, { type: "pairs", round: s.rounds[0].id, pairs: bad }),
    /одного дивизиона/,
  );
  assert.throws(
    () =>
      apply(s, admin, {
        type: "round",
        name: "2 тур",
        saturday: "2026-11-14",
        opens: "2026-11-09T12:00",
        deadline: "2026-11-10T18:00",
        pairs: bad,
      }),
    /одного дивизиона/,
  );
});
test("reload only replaces untouched drafts and remains idempotent", () => {
  const s = setup();
  const id = s.rounds[0].id,
    slots = JSON.stringify(s.rounds[0].slots);
  syncDivisionPairings(s);
  validateDivisionPairs(
    s.teams,
    s.rounds[0].matches.map((m) => [m.a, m.b]),
  );
  assert.equal(s.rounds[0].id, id);
  assert.equal(JSON.stringify(s.rounds[0].slots), slots);
  const snapshot = JSON.stringify(s);
  syncDivisionPairings(s);
  assert.equal(JSON.stringify(s), snapshot);
});
test("published and negotiating rounds survive reload; separate fresh draft created", () => {
  const s = setup();
  s.rounds[0].published = true;
  const active = structuredClone(s.rounds[0]);
  active.id = "active";
  active.name = "2 тур";
  active.published = false;
  active.matches[0].offers = [
    { team: active.matches[0].a, slot: active.slots[0].id },
  ];
  s.rounds.push(active);
  const before = s.rounds.map((r) => JSON.stringify(r));
  syncDivisionPairings(s);
  assert.equal(s.rounds.length, 3);
  assert.equal(JSON.stringify(s.rounds[0]), before[0]);
  assert.equal(JSON.stringify(s.rounds[1]), before[1]);
  validateDivisionPairs(
    s.teams,
    s.rounds[2].matches.map((m) => [m.a, m.b]),
  );
});
test("stale admin draft cannot overwrite pairs changed by another organizer", () => {
  const s = setup();
  syncDivisionPairings(s);
  const round = s.rounds[0],
    pairs = round.matches.map((m) => [m.a, m.b]);
  const baseline = JSON.stringify(pairs);
  const changed = swapPairTeam(s.teams, pairs, 0, 0, pairs[1][0]);
  apply(s, admin, {
    type: "pairs",
    round: round.id,
    pairs: changed,
    expectedPairs: baseline,
  });
  assert.throws(
    () =>
      apply(s, admin, {
        type: "pairs",
        round: round.id,
        pairs,
        expectedPairs: baseline,
      }),
    /уже изменены/,
  );
});

test("Excel template includes all 32 official teams paired only within their division", async () => {
  const s = setup();
  const rows = await readSheet(Buffer.from(pairsWorkbook(s.teams)));
  assert.equal(rows.length, 17);
  assert.deepEqual(rows[0], ["Команда 1", "Команда 2"]);
  const entries = rows.slice(1);
  for (const row of entries)
    assert.equal(
      String(row[0]).split(" / ")[0],
      String(row[1]).split(" / ")[0],
    );
  assert.equal(new Set(entries.flat()).size, 32);
});
