import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile, rename } from "node:fs/promises";
import { resolve, basename } from "node:path";
type Asset = {
  name: string;
  division: string;
  logo: string;
  localLogo: string;
  imageSha256?: string;
};
const signature = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
export function validLogoPng(data: Buffer) {
  return (
    data.length >= 33 &&
    data.subarray(0, 8).equals(signature) &&
    data.toString("ascii", 12, 16) === "IHDR" &&
    data.readUInt32BE(16) > 0 &&
    data.readUInt32BE(16) <= 4096 &&
    data.readUInt32BE(20) > 0 &&
    data.readUInt32BE(20) <= 4096
  );
}
export async function downloadLogoAssets(
  rows: Asset[],
  options: { directory?: string; force?: boolean; fetcher?: typeof fetch } = {},
) {
  const directory = options.directory || "public/team-logos";
  await mkdir(directory, { recursive: true });
  const fetcher = options.fetcher || fetch;
  const result = { downloaded: 0, cached: 0, failures: [] as string[] };
  const paths = new Set<string>();
  for (const row of rows) {
    if (
      !/^\/team-logos\/[a-z0-9]+\.png$/.test(row.localLogo) ||
      paths.has(row.localLogo)
    )
      throw Error("Некорректный или повторяющийся путь логотипа");
    paths.add(row.localLogo);
  }
  const checked = (data: Buffer, row: Asset) =>
    validLogoPng(data) &&
    (!row.imageSha256 ||
      createHash("sha256").update(data).digest("hex") === row.imageSha256);
  const pending = [...rows];
  await Promise.all(
    Array.from({ length: 4 }, async () => {
      for (;;) {
        const row = pending.shift();
        if (!row) return;
        const path = resolve(directory, basename(row.localLogo));
        try {
          if (!options.force && checked(await readFile(path), row)) {
            result.cached++;
            continue;
          }
        } catch {}
        try {
          const url = new URL(row.logo);
          if (
            url.origin !== "https://fs.mtgame.ru" ||
            url.username ||
            url.password
          )
            throw Error();
          const response = await fetcher(url, {
            signal: AbortSignal.timeout(15000),
            redirect: "error",
          });
          if (
            !response.ok ||
            Number(response.headers.get("content-length")) > 4 * 1024 * 1024 ||
            !response.body
          )
            throw Error();
          const reader = response.body.getReader();
          const chunks: Buffer[] = [];
          let size = 0;
          for (;;) {
            const chunk = await reader.read();
            if (chunk.done) break;
            size += chunk.value.length;
            if (size > 4 * 1024 * 1024) {
              await reader.cancel();
              throw Error();
            }
            chunks.push(Buffer.from(chunk.value));
          }
          const data = Buffer.concat(chunks);
          if (!checked(data, row)) throw Error();
          await writeFile(path + ".tmp", data);
          await rename(path + ".tmp", path);
          result.downloaded++;
        } catch {
          result.failures.push(row.division + " / " + row.name);
        }
      }
    }),
  );
  return result;
}
