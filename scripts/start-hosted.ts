import { spawn } from "node:child_process";
if (!process.env.DATABASE_URL)
  throw Error("Для хостинга задайте DATABASE_URL постоянной PostgreSQL-базы");
if (process.env.DEMO_MODE === "true")
  throw Error("Публичный сервер не запускается с DEMO_MODE=true");
const server = spawn(
  process.execPath,
  ["node_modules/next/dist/bin/next", "start", "--hostname", "0.0.0.0"],
  { stdio: "inherit" },
);
server.on("exit", (code) => process.exit(code ?? 1));
for (const signal of ["SIGTERM", "SIGINT"] as const)
  process.on(signal, () => server.kill(signal));
async function setup() {
  for (let attempt = 0; attempt < 30; attempt++) {
    let ready = false;
    try {
      ready = (
        await fetch(`http://127.0.0.1:${process.env.PORT || 3000}/api/health`, {
          signal: AbortSignal.timeout(2000),
        })
      ).ok;
    } catch {}
    if (ready) {
      const child = spawn(
        process.execPath,
        ["--import", "tsx", "scripts/setup-telegram.ts"],
        { stdio: "inherit" },
      );
      child.on("exit", (code) => {
        if (code !== 0)
          console.error(
            "Сервер работает, но настройка Telegram не завершена. Исправьте параметры в Environment и перезапустите сервис.",
          );
      });
      return;
    }
    await new Promise((resolve) => setTimeout(resolve, 1000));
  }
  console.error(
    "Проверка базы не прошла. После исправления DATABASE_URL перезапустите сервис.",
  );
}
setup().catch(() =>
  console.error(
    "Не удалось завершить настройку Telegram. Повторите npm run telegram:setup после проверки переменных.",
  ),
);
