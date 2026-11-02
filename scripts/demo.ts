import { existsSync } from "node:fs";
import { seed, makeRound } from "../lib/domain";
import { transaction } from "../lib/db";
async function main() {
  if (process.env.DEMO_MODE !== "true" || process.env.DATABASE_URL)
    throw Error(
      "Демоданные разрешены только для локального SQLite при DEMO_MODE=true",
    );
  if (existsSync(process.env.DATABASE_PATH || "data/abl.sqlite")) {
    console.log("База уже существует; данные сохранены без изменений.");
    return;
  }
  await transaction((s) => {
    const initial = seed();
    const r = makeRound(
      "demo-published",
      "Предыдущий тур",
      "2026-10-31",
      "2026-10-26T12:00",
      "2026-10-27T18:00",
      initial.rounds[0].matches.map((m) => [m.a, m.b]),
    );
    r.matches.forEach((m, i) => (m.slot = r.slots[i].id));
    r.published = true;
    s.teams = initial.teams;
    s.rounds = [r, ...initial.rounds];
  });
  console.log(
    "Созданы демонстрационные команды, опубликованный тур и тур для согласования.",
  );
}
main().catch((e) => {
  console.error(e.message);
  process.exitCode = 1;
});
