import { test } from "node:test";
import assert from "node:assert/strict";
import { createHmac } from "node:crypto";
import { verifyTelegramInitData } from "../lib/telegram-init-data";
const token = "test-only-bot-token";
const now = 1800000000000;
function signed(fields: Record<string, string>, key = token) {
  const params = new URLSearchParams(fields);
  const check = Object.keys(fields)
    .sort()
    .map((k) => k + "=" + fields[k])
    .join("\n");
  const secret = createHmac("sha256", "WebAppData").update(key).digest();
  params.set("hash", createHmac("sha256", secret).update(check).digest("hex"));
  return params.toString();
}
const fields = {
  user: JSON.stringify({
    id: 123456789,
    first_name: "Капитан А",
    username: "test_captain",
  }),
  auth_date: String(now / 1000),
  query_id: "test-query",
};
test("Mini App validates signed Telegram identity including decoded Unicode fields", () => {
  assert.equal(verifyTelegramInitData(signed(fields), token, now), "123456789");
});
test("Mini App rejects user impersonation and another bot signature", () => {
  const params = new URLSearchParams(signed(fields));
  params.set("user", JSON.stringify({ id: 999999999 }));
  assert.throws(() => verifyTelegramInitData(params.toString(), token, now));
  assert.throws(() =>
    verifyTelegramInitData(signed(fields, "other-bot"), token, now),
  );
});
test("Mini App rejects expired and future launch data", () => {
  assert.throws(() =>
    verifyTelegramInitData(
      signed({ ...fields, auth_date: String(now / 1000 - 3601) }),
      token,
      now,
    ),
  );
  assert.throws(() =>
    verifyTelegramInitData(
      signed({ ...fields, auth_date: String(now / 1000 + 31) }),
      token,
      now,
    ),
  );
  assert.throws(() =>
    verifyTelegramInitData(
      signed({ ...fields, auth_date: "invalid" }),
      token,
      now,
    ),
  );
});
test("Mini App rejects missing signature, duplicate keys, invalid identities and oversized data", () => {
  assert.throws(() => verifyTelegramInitData("", token, now));
  assert.throws(() =>
    verifyTelegramInitData(new URLSearchParams(fields).toString(), token, now),
  );
  assert.throws(() =>
    verifyTelegramInitData(signed(fields) + "&user=forged", token, now),
  );
  for (const user of [
    null,
    { id: -1 },
    { id: "123" },
    { id: 1.2 },
    { id: 9007199254740992 },
  ])
    assert.throws(() =>
      verifyTelegramInitData(
        signed({ ...fields, user: JSON.stringify(user) }),
        token,
        now,
      ),
    );
  assert.throws(() => verifyTelegramInitData("x".repeat(16385), token, now));
});
