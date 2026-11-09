import type { State } from "./domain";

/** Handles are bound only by a verified Telegram identity, never by form input. */
export function parseAdminLogins(value: unknown): string[] {
  if (typeof value !== "string" || value.length > 4000)
    throw Error("Укажите Telegram-логины или ID через запятую");
  const logins = value
    .split(",")
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean)
    .map((s) => {
      if (/^[1-9]\d{0,15}$/.test(s) && Number.isSafeInteger(Number(s)))
        return s;
      const handle = s.replace(/^@/, "");
      if (!/^[a-z][a-z0-9_]{4,31}$/.test(handle))
        throw Error(
          `Некорректный Telegram-логин: ${s}. Используйте @username или числовой ID.`,
        );
      return "@" + handle;
    });
  if (logins.length > 100)
    throw Error("Можно добавить не более 100 организаторов");
  return [...new Set(logins)];
}
export function updateAdminAccess(s: State, value: unknown) {
  const logins = parseAdminLogins(value);
  s.adminLogins = logins;
  s.adminBindings = Object.fromEntries(
    Object.entries(s.adminBindings || {}).filter(([handle]) =>
      logins.includes(handle),
    ),
  );
}
export function bindAdminIdentity(s: State, id: string, username: unknown) {
  if (!/^[1-9]\d*$/.test(id) || typeof username !== "string") return;
  const handle = "@" + username.toLowerCase();
  if (!s.adminLogins?.includes(handle)) return;
  s.adminBindings ??= {};
  // Retain the original verified ID if a username changes owners.
  s.adminBindings[handle] ??= id;
}
export function hasStoredAdminAccess(s: State, id: string) {
  return !!s.adminLogins?.some(
    (login) => login === id || s.adminBindings?.[login] === id,
  );
}

export function storedAdminIds(s: State): string[] {
  return [
    ...new Set(
      (s.adminLogins || [])
        .map((login) =>
          login.startsWith("@") ? s.adminBindings?.[login] : login,
        )
        .filter((id): id is string => !!id),
    ),
  ];
}
