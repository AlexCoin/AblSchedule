import { test } from "node:test";
import assert from "node:assert/strict";
import type { Match } from "../lib/domain";
import { negotiationStatus } from "../lib/negotiation-status";
const base: Match = { id: "1", a: "a", b: "b", slot: null, offers: [] };
test("no offers and one-sided offers are distinguished from different preferences", () => {
  assert.equal(negotiationStatus(base).status, "empty");
  for (const team of ["a", "b"]) {
    const result = negotiationStatus({
      ...base,
      offers: [{ team, slot: "s1" }],
    });
    assert.equal(result.status, "one-sided");
    assert.deepEqual(result.common, []);
  }
});
test("all preferences are compared; a shared alternative requires confirmation", () => {
  const m = {
    ...base,
    offers: [
      { team: "a", slot: "s1" },
      { team: "a", slot: "s2" },
      { team: "b", slot: "s3" },
    ],
  };
  assert.equal(negotiationStatus(m).status, "no-common");
  m.offers.push({ team: "b", slot: "s2" }, { team: "b", slot: "s2" });
  const result = negotiationStatus(m);
  assert.equal(result.status, "confirmation");
  assert.deepEqual(result.common, ["s2"]);
  assert.deepEqual(result.b, ["s2", "s3"]);
});
test("assigned or agreed matches remain agreed, even if another pair occupies their slot", () => {
  assert.equal(negotiationStatus({ ...base, slot: "s1" }).status, "agreed");
  assert.equal(
    negotiationStatus({
      ...base,
      slot: "s1",
      offers: [{ team: "a", slot: "s2" }],
    }).status,
    "agreed",
  );
});
