import { createHash } from "node:crypto";
import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { validLogoPng, downloadLogoAssets } from "../lib/team-logo-assets";
const png = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/Z5sAAAAASUVORK5CYII=",
  "base64",
);
const row = {
  name: "Тест",
  division: "Pale",
  logo: "https://fs.mtgame.ru/test.png",
  localLogo: "/team-logos/test123.png",
};
test("logo downloader saves verified PNG atomically and reuses valid cache", async (t) => {
  const directory = await mkdtemp(join(tmpdir(), "abl-logo-"));
  t.after(() => rm(directory, { recursive: true, force: true }));
  let calls = 0;
  const fetcher = (async () => {
    calls++;
    return new Response(png);
  }) as typeof fetch;
  const first = await downloadLogoAssets([row], { directory, fetcher });
  assert.deepEqual(first, { downloaded: 1, cached: 0, failures: [] });
  assert.deepEqual(await readFile(join(directory, "test123.png")), png);
  const second = await downloadLogoAssets([row], { directory, fetcher });
  assert.equal(second.cached, 1);
  assert.equal(calls, 1);
});
test("unavailable or invalid images retain original link without creating fake files", async (t) => {
  const directory = await mkdtemp(join(tmpdir(), "abl-logo-"));
  t.after(() => rm(directory, { recursive: true, force: true }));
  const fetcher = (async () =>
    new Response("<html>denied</html>", { status: 403 })) as typeof fetch;
  const result = await downloadLogoAssets([row], { directory, fetcher });
  assert.equal(result.downloaded, 0);
  assert.deepEqual(result.failures, ["Pale / Тест"]);
  await assert.rejects(readFile(join(directory, "test123.png")));
  assert.equal(validLogoPng(Buffer.from("<svg></svg>")), false);
  assert.equal(validLogoPng(png), true);
  await assert.rejects(
    downloadLogoAssets([{ ...row, localLogo: "/team-logos/../../evil.png" }], {
      directory,
      fetcher,
    }),
  );
});

test("a changed remote image cannot overwrite the uploaded archive checksum", async (t) => {
  const directory = await mkdtemp(join(tmpdir(), "abl-logo-check-"));
  t.after(() => rm(directory, { recursive: true, force: true }));
  const entry = {
    ...row,
    imageSha256: createHash("sha256").update(png).digest("hex"),
  };
  await downloadLogoAssets([entry], {
    directory,
    fetcher: (async () => new Response(png)) as typeof fetch,
  });
  const changed = Buffer.concat([png, Buffer.from("changed")]);
  const result = await downloadLogoAssets([entry], {
    directory,
    force: true,
    fetcher: (async () => new Response(changed)) as typeof fetch,
  });
  assert.equal(result.downloaded, 0);
  assert.equal(result.failures.length, 1);
  assert.deepEqual(await readFile(join(directory, "test123.png")), png);
});
