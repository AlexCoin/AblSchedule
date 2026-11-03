import { configureTelegram } from "../lib/telegram-configure";
configureTelegram().catch((e) => {
  console.error((e as Error).message);
  process.exitCode = 1;
});
