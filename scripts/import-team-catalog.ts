import { readFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";
import { importTeamCatalog, type CatalogTeam } from "../lib/team-catalog";
import { transaction } from "../lib/db";
async function main() {
  const path = process.argv[2];
  if (!path)
    throw Error(
      "Укажите путь к проверенному JSON-каталогу с локальными логотипами",
    );
  const rows = JSON.parse(readFileSync(path, "utf8")) as CatalogTeam[];
  if (!Array.isArray(rows)) throw Error("Ожидается массив команд");
  for (const row of rows)
    if (
      typeof row.logo !== "string" ||
      !/^\/team-logos\/[a-zA-Z0-9_-]+\.png$/.test(row.logo) ||
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
