export type Team = {
  id: string;
  name: string;
  telegramId: string;
  logo: string;
};
export type Match = {
  id: string;
  a: string;
  b: string;
  offers: { team: string; slot: string }[];
  slot: string | null;
};
export type Round = {
  id: string;
  name: string;
  saturday: string;
  opens: string;
  deadline: string;
  published: boolean;
  slots: { id: string; date: string; time: string }[];
  matches: Match[];
};
export type State = { teams: Team[]; rounds: Round[] };
export type Actor = { id: string; admin: boolean };
export function seed(): State {
  const names = [
    "Школа ABL",
    "Петровские ястребы",
    "АИТ",
    "АТВ Last",
    "Гусарские гоблины",
    "Rise",
    "Flash",
    "Вымпел Нова",
    "Трактор",
    "Союз Basket",
    "Hussars",
    "Normal Team",
    "Avator Team",
    "Восход",
    "АТВ 2",
    "Золотой мяч",
    "Коммуна",
    "RW",
    "Ритм",
    "Progress",
    "БС",
    "Бобры",
    "Hungry Dogs",
    "КМ",
    "Max Basket",
    "Драконы",
    "Шторм",
    "Melbourne",
    "Львы",
    "Stankult",
    "Олимп",
    "Спарта",
  ];
  const teams = names.map((name, i) => ({
    id: String(i + 1),
    name,
    telegramId: "",
    logo: "",
  }));
  return {
    teams,
    rounds: [
      makeRound(
        "1",
        "1 тур",
        "2026-11-07",
        "2026-11-02T12:00",
        "2026-11-03T18:00",
        teams
          .filter((_, i) => i % 2 === 0)
          .map((t, i) => [t.id, teams[i * 2 + 1].id]),
      ),
    ],
  };
}
export function makeRound(
  id: string,
  name: string,
  saturday: string,
  opens: string,
  deadline: string,
  pairs: string[][],
): Round {
  if (
    !name.trim() ||
    !/^\d{4}-\d{2}-\d{2}$/.test(saturday) ||
    new Date(saturday + "T00:00:00Z").getUTCDay() !== 6
  )
    throw Error("Укажите название и дату субботы");
  if (
    !Number.isFinite(Date.parse(opens + "+03:00")) ||
    !Number.isFinite(Date.parse(deadline + "+03:00")) ||
    Date.parse(opens + "+03:00") >= Date.parse(deadline + "+03:00")
  )
    throw Error("Проверьте окно согласования");
  const sunday = new Date(Date.parse(saturday + "T12:00:00Z") + 86400000)
    .toISOString()
    .slice(0, 10);
  const slots = [saturday, sunday].flatMap((date) =>
    Array.from({ length: 8 }, (_, i) => {
      const n = 600 + i * 70;
      const time =
        String(Math.floor(n / 60)).padStart(2, "0") +
        ":" +
        String(n % 60).padStart(2, "0");
      return { id: date + "T" + time, date, time };
    }),
  );
  return {
    id,
    name,
    saturday,
    opens,
    deadline,
    published: false,
    slots,
    matches: pairs.map(([a, b], i) => ({
      id: String(i + 1),
      a,
      b,
      offers: [],
      slot: null,
    })),
  };
}
export function conflicts(r: Round, slot: string) {
  return r.matches.filter((m) => m.slot === slot);
}
function validatePairs(s: State, pairs: string[][]) {
  if (
    !Array.isArray(pairs) ||
    pairs.length !== 16 ||
    pairs.some((p) => !Array.isArray(p) || p.length !== 2)
  )
    throw Error("В туре должно быть 16 пар");
  const ids = pairs.flat();
  if (
    ids.length !== 32 ||
    new Set(ids).size !== 32 ||
    ids.some((id) => !s.teams.some((t) => t.id === id))
  )
    throw Error("Каждая из 32 команд должна участвовать ровно один раз");
}
export function defaultWindow(saturday: string) {
  const date = new Date(saturday + "T12:00:00Z");
  return {
    opens:
      new Date(date.getTime() - 5 * 86400000).toISOString().slice(0, 10) +
      "T12:00",
    deadline:
      new Date(date.getTime() - 4 * 86400000).toISOString().slice(0, 10) +
      "T18:00",
  };
}
export function apply(s: State, actor: Actor, input: any, now = Date.now()) {
  const admin = () => {
    if (!actor.admin) throw Error("Требуются права организатора");
  };
  if (input.type === "team") {
    admin();
    const t = s.teams.find((t) => t.id === input.id);
    if (!t) throw Error("Команда не найдена");
    if (typeof input.name !== "string" || !input.name.trim())
      throw Error("Укажите название");
    if (input.telegramId && !/^\d+$/.test(input.telegramId))
      throw Error("Telegram ID должен быть числом");
    if (
      input.telegramId &&
      s.teams.some((x) => x.id !== t.id && x.telegramId === input.telegramId)
    )
      throw Error("Пользователь уже назначен другой команде");
    if (input.logo && !/^https:\/\//.test(input.logo))
      throw Error("Логотип: укажите HTTPS URL");

    if (
      s.teams.some(
        (x) =>
          x.id !== t.id &&
          x.name.toLowerCase() === String(input.name).trim().toLowerCase(),
      )
    )
      throw Error("Название команды уже используется");
    Object.assign(t, {
      name: String(input.name).trim(),
      telegramId: String(input.telegramId || ""),
      logo: String(input.logo || ""),
    });
    return;
  }
  if (input.type === "round") {
    admin();
    const pairs = input.pairs as string[][];
    if (
      !Array.isArray(pairs) ||
      pairs.length !== 16 ||
      pairs.some((p) => !Array.isArray(p) || p.length !== 2)
    )
      throw Error("В туре должно быть 16 пар");
    const ids = pairs.flat();
    if (
      ids.length !== 32 ||
      new Set(ids).size !== 32 ||
      ids.some((id) => !s.teams.some((t) => t.id === id))
    )
      throw Error("Каждая из 32 команд должна участвовать ровно один раз");
    s.rounds.push(
      makeRound(
        crypto.randomUUID(),
        input.name,
        input.saturday,
        input.opens,
        input.deadline,
        pairs,
      ),
    );
    return;
  }
  const r = s.rounds.find((r) => r.id === input.round);
  if (!r) throw Error("Тур не найден");
  if (input.type === "pairs") {
    admin();
    if (r.published || r.matches.some((m) => m.slot || m.offers.length))
      throw Error("Пары можно менять до начала переговоров");
    validatePairs(s, input.pairs);
    r.matches = input.pairs.map(([a, b]: string[], i: number) => ({
      id: String(i + 1),
      a,
      b,
      offers: [],
      slot: null,
    }));
    return;
  }
  if (input.type === "settings") {
    admin();
    if (
      !input.opens ||
      !input.deadline ||
      !Number.isFinite(Date.parse(input.deadline + "+03:00")) ||
      !Number.isFinite(Date.parse(input.opens + "+03:00")) ||
      Date.parse(input.opens + "+03:00") >=
        Date.parse(input.deadline + "+03:00")
    )
      throw Error("Проверьте даты");
    r.opens = input.opens;
    r.deadline = input.deadline;
    return;
  }
  if (input.type === "slot") {
    admin();
    if (
      !/^\d{4}-\d{2}-\d{2}$/.test(input.date) ||
      !/^([01]\d|2[0-3]):[0-5]\d$/.test(input.time)
    )
      throw Error("Проверьте дату и время");
    const id = input.date + "T" + input.time;
    if (r.slots.some((s) => s.id === id)) throw Error("Слот уже существует");
    const minute = (time: string) =>
      Number(time.slice(0, 2)) * 60 + Number(time.slice(3));
    if (
      r.slots.some(
        (s) =>
          s.date === input.date &&
          Math.abs(minute(s.time) - minute(input.time)) < 70,
      )
    )
      throw Error("Слоты по 70 минут не должны пересекаться");
    r.slots.push({ id, date: input.date, time: input.time });
    r.slots.sort((a, b) => a.id.localeCompare(b.id));
    return;
  }
  if (input.type === "deleteSlot") {
    admin();
    if (
      r.matches.some(
        (m) =>
          m.slot === input.slot || m.offers.some((o) => o.slot === input.slot),
      )
    )
      throw Error("Слот используется в согласовании");
    r.slots = r.slots.filter((s) => s.id !== input.slot);
    return;
  }
  if (input.type === "publish") {
    admin();
    if (r.matches.some((m) => !m.slot || conflicts(r, m.slot).length > 1))
      throw Error("Назначьте время всем матчам и разрешите конфликты");
    r.published = true;
    return;
  }
  const m = r.matches.find((m) => m.id === input.match);
  if (!m) throw Error("Матч не найден");
  if (input.type === "assign") {
    admin();
    if (input.slot && !r.slots.some((s) => s.id === input.slot))
      throw Error("Слот не найден");
    if (
      r.published &&
      input.slot &&
      r.matches.some((x) => x.id !== m.id && x.slot === input.slot)
    )
      throw Error("Этот слот уже занят");
    if (r.published && !input.slot)
      throw Error("Опубликованный матч должен иметь время");
    m.slot = input.slot || null;
    m.offers = [];
    return;
  }
  const t = s.teams.find((t) => t.telegramId === actor.id);
  if (!t || ![m.a, m.b].includes(t.id))
    throw Error("Это не матч вашей команды");
  if (
    r.published ||
    now < Date.parse(r.opens + "+03:00") ||
    now >= Date.parse(r.deadline + "+03:00")
  )
    throw Error("Окно согласования закрыто");
  if (input.type === "reopen") {
    m.slot = null;
    m.offers = [];
    return;
  }
  if (m.slot) throw Error("Сначала откройте пересогласование");
  if (!r.slots.some((s) => s.id === input.slot)) throw Error("Слот не найден");
  if (input.type === "offer") {
    if (!m.offers.some((o) => o.team === t.id && o.slot === input.slot))
      m.offers.push({ team: t.id, slot: input.slot });
    return;
  }
  if (input.type === "accept") {
    if (!m.offers.some((o) => o.team !== t.id && o.slot === input.slot))
      throw Error("Подтверждать можно только предложение соперника");
    m.slot = input.slot;
    m.offers = [];
    return;
  }
  throw Error("Неизвестное действие");
}
