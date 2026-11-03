import { readFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";
import { importTeamCatalog, type CatalogTeam } from "../lib/team-catalog";
import { transaction } from "../lib/db";
async function main() {
  const path = process.argv[2] || "catalog/abl-teams.json";
  if (!path)
    throw Error(
      "Укажите путь к проверенному JSON-каталогу с локальными логотипами",
    );
  const input = JSON.parse(readFileSync(path, "utf8"));
  if (!Array.isArray(input)) throw Error("Ожидается массив команд");
  const rows = (input as (CatalogTeam & { localLogo?: string })[]).map(
    (row) => ({
      ...row,
      logo:
        row.localLogo &&
        /^\/team-logos\/[a-zA-Z0-9_-]+\.png$/.test(row.localLogo) &&
        existsSync(resolve("public", "." + row.localLogo))
          ? row.localLogo
          : row.logo,
    }),
  );
  if (!Array.isArray(rows)) throw Error("Ожидается массив команд");
  for (const row of rows)
    if (
      row.logo?.startsWith("/") &&
      !existsSync(resolve("public", "." + row.logo))
    )
      throw Error("Не найден загруженный логотип команды");
  const result = await transaction((state) => importTeamCatalog(state, rows));
  console.log(
    `Каталог импортирован: добавлено ${result.added}, обновлено ${result.updated}. Матчи и привязки капитанов сохранены.`,
  );
}
main().catch((e) => {
  console.error((e as Error).message);
  process.exitCode = 1;
});
