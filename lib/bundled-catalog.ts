import { createHash } from "node:crypto";
import { readFileSync, statSync } from "node:fs";
import { validLogoPng } from "./team-logo-assets";
import { resolve } from "node:path";
import catalog from "../catalog/abl-teams.json";
import { importTeamCatalog, type CatalogTeam } from "./team-catalog";
import type { State } from "./domain";
const imageChecks = new Map<
  string,
  { mtime: number; size: number; valid: boolean }
>();
function localLogoAvailable(row: (typeof catalog)[number]) {
  const path = resolve("public", "." + row.localLogo);
  try {
    const stat = statSync(path);
    const previous = imageChecks.get(path);
    if (previous?.mtime === stat.mtimeMs && previous.size === stat.size)
      return previous.valid;
    const data = readFileSync(path);
    const valid =
      validLogoPng(data) &&
      createHash("sha256").update(data).digest("hex") === row.imageSha256;
    imageChecks.set(path, { mtime: stat.mtimeMs, size: stat.size, valid });
    return valid;
  } catch {
    return false;
  }
}
export function bundledCatalog(): CatalogTeam[] {
  return catalog.map((row) => ({
    ...row,
    logo: localLogoAvailable(row) ? row.localLogo : row.logo,
  }));
}
/** Apply each bundled revision once. User edits and old matches survive subsequent requests. */
export function syncBundledCatalog(state: State) {
  if (process.env.DEMO_MODE === "true") return;
  const rows = bundledCatalog();
  const revision = createHash("sha256")
    .update(JSON.stringify(rows))
    .digest("hex");
  if (state.catalogRevision === revision) return;
  importTeamCatalog(state, rows);
  state.catalogRevision = revision;
}
