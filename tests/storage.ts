import assert from "node:assert/strict";
import { transaction, loginQuery } from "../lib/db";
async function main() {
  await transaction((s) => {
    s.teams[0].name = "0";
  });
  await Promise.all(
    Array.from({ length: 12 }, () =>
      transaction((s) => {
        s.teams[0].name = String(Number(s.teams[0].name) + 1);
      }),
    ),
  );
  assert.equal(await transaction((s) => s.teams[0].name), "12");
  await assert.rejects(
    transaction((s) => {
      s.teams[0].name = "broken";
      throw Error("rollback");
    }),
  );
  assert.equal(await transaction((s) => s.teams[0].name), "12");
  const token = crypto.randomUUID();
  await loginQuery(
    "INSERT INTO login(token,user_id,expires) VALUES (?,NULL,?)",
    [token, Date.now() + 10000],
  );
  await loginQuery("UPDATE login SET user_id=? WHERE token=?", ["1234", token]);
  const rows = (await loginQuery("SELECT user_id FROM login WHERE token=?", [
    token,
  ])) as any[];
  assert.equal(rows[0].user_id, "1234");
  await loginQuery("DELETE FROM login WHERE token=?", [token]);
  console.log(
    "Storage: 12 concurrent transactions, rollback and login token persistence passed",
  );
}
main().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
