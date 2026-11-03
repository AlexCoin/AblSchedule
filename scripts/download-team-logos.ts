import catalog from "../catalog/abl-teams.json";
import { downloadLogoAssets } from "../lib/team-logo-assets";
async function main() {
  const result = await downloadLogoAssets(catalog, {
    force: process.argv.includes("--force"),
  });
  for (const name of result.failures)
    console.warn(
      `Логотип ${name}: обновление не удалось; используется существующий файл или официальная ссылка.`,
    );
  console.log(
    `Логотипы: загружено ${result.downloaded}, в кэше ${result.cached}, не обновлено ${result.failures.length}.`,
  );
}
main().catch((e) => {
  console.error((e as Error).message);
  process.exitCode = 1;
});
