import { createHash } from "node:crypto";
import { existsSync } from "node:fs";
import { resolve } from "node:path";
import catalog from "../catalog/abl-teams.json";
import { importTeamCatalog, type CatalogTeam } from "./team-catalog";
import type { State } from "./domain";
export function bundledCatalog(): CatalogTeam[] {
  return catalog.map((row) => ({
    ...row,
    logo: existsSync(resolve("public", "." + row.localLogo))
      ? row.localLogo
      : row.logo,
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
