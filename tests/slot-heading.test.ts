import { test } from "node:test";
import assert from "node:assert/strict";
import { seed } from "../lib/domain";
import { slotHeading } from "../lib/slot-heading";
test("heading shows availability, pending status, or first confirmed division even with competing interest", () => {
  const s = seed();
  s.teams[0].division = "Pale";
  s.teams[2].division = "Slow";
  const [a, b] = s.rounds[0].matches;
  a.agreementOrder = 2;
  b.agreementOrder = 1;
  assert.equal(slotHeading([], s.teams, false), "Доступен");
  assert.equal(slotHeading([], s.teams, true), "Ожидает подтверждения");
  assert.equal(slotHeading([a], s.teams, true), "Pale");
  assert.equal(slotHeading([a, b], s.teams, false), "Slow");
  delete a.agreementOrder;
  delete b.agreementOrder;
  assert.equal(slotHeading([a, b], s.teams, false), "Pale");
});
