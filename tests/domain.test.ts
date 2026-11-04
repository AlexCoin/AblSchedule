import { preliminaryBookings } from "../lib/preliminary";
import { test } from "node:test";
import assert from "node:assert/strict";
import { seed, apply } from "../lib/domain";
const now = Date.parse("2026-11-02T13:00:00+03:00");
function setup() {
  const s = seed();
  s.teams.forEach((t, i) => {
    t.telegramId = "tg" + t.id;
    t.division = ["Pale", "Slow", "Rook", "Last"][Math.floor(i / 8)];
  });
  return s;
}
const a = { id: "tg1", admin: false },
  b = { id: "tg2", admin: false },
  admin = { id: "0", admin: true };
test("16 matches, 32 unique teams, 16 weekend slots at 70 minute intervals", () => {
  const s = seed(),
    r = s.rounds[0];
  assert.equal(r.matches.length, 16);
  assert.equal(new Set(r.matches.flatMap((m) => [m.a, m.b])).size, 32);
  assert.equal(r.slots.length, 16);
  assert.equal(r.slots[7].time, "18:10");
});
test("opponent accepts; only that pair proposals cleared", () => {
  const s = setup(),
    r = s.rounds[0],
    slot = r.slots[0].id;
  apply(s, a, { type: "offer", round: "1", match: "1", slot }, now);
  apply(
    s,
    a,
    { type: "offer", round: "1", match: "1", slot: r.slots[1].id },
    now,
  );
  apply(
    s,
    { id: "tg3", admin: false },
    { type: "offer", round: "1", match: "2", slot },
    now,
  );
  assert.throws(() =>
    apply(s, a, { type: "accept", round: "1", match: "1", slot }, now),
  );
  apply(s, b, { type: "accept", round: "1", match: "1", slot }, now);
  assert.equal(r.matches[0].slot, slot);
  assert.equal(r.matches[0].offers.length, 0);
  assert.equal(r.matches[1].offers.length, 1);
});
test("two pairs may agree same slot; conflict blocks publication", () => {
  const s = setup(),
    r = s.rounds[0],
    slot = r.slots[0].id;
  for (let i = 1; i <= 31; i += 2) {
    apply(
      s,
      { id: "tg" + i, admin: false },
      { type: "offer", round: "1", match: String((i + 1) / 2), slot },
      now,
    );
    apply(
      s,
      { id: "tg" + (i + 1), admin: false },
      { type: "accept", round: "1", match: String((i + 1) / 2), slot },
      now,
    );
  }
  assert.equal(r.matches.filter((m) => m.slot === slot).length, 16);
  assert.throws(() => apply(s, admin, { type: "publish", round: "1" }, now));
  r.matches.forEach((m, i) =>
    apply(
      s,
      admin,
      { type: "assign", round: "1", match: m.id, slot: r.slots[i].id },
      now,
    ),
  );
  apply(s, admin, { type: "publish", round: "1" }, now);
  assert.equal(r.published, true);
});
test("deadline exact boundary, opening and permissions", () => {
  const s = setup(),
    input = {
      type: "offer",
      round: "1",
      match: "1",
      slot: s.rounds[0].slots[0].id,
    };
  assert.throws(() =>
    apply(s, a, input, Date.parse("2026-11-02T11:59:59+03:00")),
  );
  assert.throws(() =>
    apply(s, a, input, Date.parse("2026-11-03T18:00:00+03:00")),
  );
  assert.throws(() => apply(s, { id: "tg3", admin: false }, input, now));
  assert.throws(() =>
    apply(s, a, { type: "assign", round: "1", match: "1" }, now),
  );
  apply(s, a, input, now);
});
test("rescheduling before deadline; published schedule locked for captains", () => {
  const s = setup(),
    r = s.rounds[0];
  r.matches[0].slot = r.slots[0].id;
  apply(s, a, { type: "reopen", round: "1", match: "1" }, now);
  assert.equal(r.matches[0].slot, null);
  r.published = true;
  assert.throws(() =>
    apply(s, a, { type: "reopen", round: "1", match: "1" }, now),
  );
});
test("captain may represent multiple teams and imports reject duplicate teams", () => {
  const s = setup();
  s.teams[1].telegramId = "123";
  apply(s, admin, { type: "team", id: "1", name: "A", telegramId: "123" }, now);
  assert.equal(s.teams.filter((t) => t.telegramId === "123").length, 2);
  assert.throws(() =>
    apply(
      s,
      admin,
      {
        type: "round",
        pairs: Array.from({ length: 16 }, () => ["1", "2"]),
        saturday: "2026-11-14",
        name: "2",
        opens: "2026-11-09T12:00",
        deadline: "2026-11-10T18:00",
      },
      now,
    ),
  );
});
test("invalid windows rejected; slots cannot overlap; pairs editable only before negotiation", () => {
  const s = setup();
  assert.throws(() =>
    apply(
      s,
      admin,
      {
        type: "settings",
        round: "1",
        opens: "bad",
        deadline: "2026-11-03T18:00",
      },
      now,
    ),
  );
  assert.throws(() =>
    apply(
      s,
      admin,
      { type: "slot", round: "1", date: "2026-11-07", time: "10:30" },
      now,
    ),
  );
  const pairs = s.rounds[0].matches.map((m) => [m.b, m.a]);
  apply(s, admin, { type: "pairs", round: "1", pairs }, now);
  assert.equal(s.rounds[0].matches[0].a, "2");
  apply(
    s,
    a,
    { type: "offer", round: "1", match: "1", slot: s.rounds[0].slots[0].id },
    now,
  );
  assert.throws(() =>
    apply(s, admin, { type: "pairs", round: "1", pairs }, now),
  );
});

test("new round slot plan is isolated and validated", () => {
  const s = setup();
  const input = {
    type: "round",
    name: "2 тур",
    saturday: "2026-11-14",
    opens: "2026-11-09T12:00",
    deadline: "2026-11-10T18:00",
    pairs: s.rounds[0].matches.map((m) => [m.a, m.b]),
    start: "09:00",
    perDay: 10,
  };
  apply(s, admin, input, now);
  assert.equal(s.rounds[0].slots.length, 16);
  assert.equal(s.rounds[0].slots[0].time, "10:00");
  assert.equal(s.rounds[1].slots.length, 20);
  assert.equal(s.rounds[1].slots[0].time, "09:00");
  assert.throws(() => apply(s, admin, { ...input, start: "23:00" }, now));
  assert.throws(() => apply(s, admin, { ...input, perDay: 7 }, now));
  assert.throws(() => apply(s, admin, { ...input, perDay: 8.5 }, now));
});

test("preliminary interest is visible per pair and slot until agreement", () => {
  const s = setup(),
    r = s.rounds[0],
    slot = r.slots[0].id;
  apply(s, a, { type: "offer", round: "1", match: "1", slot }, now);
  apply(s, a, { type: "offer", round: "1", match: "1", slot }, now);
  apply(
    s,
    a,
    { type: "offer", round: "1", match: "1", slot: r.slots[1].id },
    now,
  );
  apply(
    s,
    { id: "tg3", admin: false },
    { type: "offer", round: "1", match: "2", slot },
    now,
  );
  assert.equal(preliminaryBookings(r).length, 3);
  assert.deepEqual(preliminaryBookings(r)[0], {
    matchId: "1",
    slot,
    proposedBy: ["1"],
  });
  apply(s, b, { type: "accept", round: "1", match: "1", slot }, now);
  assert.deepEqual(preliminaryBookings(r), [
    { matchId: "2", slot, proposedBy: ["3"] },
  ]);
});
test("captain withdraws only own offer for selected slot; opponent and other pairs remain", () => {
  const s = setup(),
    r = s.rounds[0],
    slot = r.slots[0].id;
  apply(s, a, { type: "offer", round: "1", match: "1", slot }, now);
  apply(
    s,
    a,
    { type: "offer", round: "1", match: "1", slot: r.slots[1].id },
    now,
  );
  apply(s, b, { type: "offer", round: "1", match: "1", slot }, now);
  apply(
    s,
    { id: "tg3", admin: false },
    { type: "offer", round: "1", match: "2", slot },
    now,
  );
  apply(s, a, { type: "withdraw", round: "1", match: "1", slot }, now);
  assert.equal(r.matches[0].offers.length, 2);
  assert(r.matches[0].offers.some((o) => o.team === "2" && o.slot === slot));
  assert.equal(r.matches[1].offers.length, 1);
  assert.throws(() =>
    apply(
      s,
      { id: "tg3", admin: false },
      { type: "withdraw", round: "1", match: "1", slot },
      now,
    ),
  );
  apply(s, admin, { type: "assign", round: "1", match: "1", slot: "" }, now);
  assert.equal(r.matches[0].offers.length, 0);
  assert.equal(r.matches[0].slot, null);
  assert.equal(r.matches[1].offers.length, 1);
});
test("agreement order follows confirmation rather than match list and resets on reassignment", () => {
  const s = setup(),
    r = s.rounds[0],
    slot = r.slots[0].id;
  apply(s, admin, { type: "assign", round: "1", match: "2", slot }, now);
  apply(s, admin, { type: "assign", round: "1", match: "1", slot }, now);
  assert(r.matches[1].agreementOrder! < r.matches[0].agreementOrder!);
  const order = r.matches[1].agreementOrder;
  apply(s, admin, { type: "assign", round: "1", match: "2", slot }, now);
  assert.equal(r.matches[1].agreementOrder, order);
  apply(s, admin, { type: "assign", round: "1", match: "2", slot: "" }, now);
  assert.equal(r.matches[1].agreementOrder, undefined);
});
