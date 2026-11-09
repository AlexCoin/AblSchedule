import { transaction } from "./db";
import { bindAdminIdentity } from "./admin-access";
/** Call only with identity authenticated by Telegram's signature or webhook secret. */
export async function registerTelegramIdentity(id: string, username: unknown) {
  await transaction((s) => bindAdminIdentity(s, id, username));
}
