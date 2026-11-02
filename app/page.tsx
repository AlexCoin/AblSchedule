"use client";
import { useEffect, useState } from "react";
import type { Round, Match, Team } from "../lib/domain";
import { defaultWindow } from "../lib/domain";
type ViewTeam = Team & { mine: boolean };
type Data = {
  user: { id: string; admin: boolean } | null;
  demo: boolean;
  teams: ViewTeam[];
  rounds: Round[];
};
const formatDate = (s: string) =>
  new Date(s + "T12:00:00+03:00").toLocaleDateString("ru-RU", {
    day: "numeric",
    month: "long",
    weekday: "short",
    timeZone: "Europe/Moscow",
  });
export default function Home() {
  const [data, setData] = useState<Data | null>(null),
    [roundId, setRoundId] = useState(""),
    [tab, setTab] = useState("schedule"),
    [day, setDay] = useState("all"),
    [error, setError] = useState(""),
    [notice, setNotice] = useState(""),
    [busy, setBusy] = useState(false),
    [login, setLogin] = useState(""),
    [pairs, setPairs] = useState("");
  async function refresh() {
    try {
      const res = await fetch("/api/state");
      if (!res.ok) throw Error("Не удалось загрузить расписание");
      setData(await res.json());
    } catch (e) {
      setError(String(e));
    }
  }
  useEffect(() => {
    refresh();
    const t = setInterval(refresh, 15000);
    return () => clearInterval(t);
  }, []);
  useEffect(() => {
    if (!login) return;
    const t = setInterval(async () => {
      const res = await fetch("/api/auth/telegram");
      const json = await res.json();
      if (json.ok) {
        setLogin("");
        refresh();
      }
    }, 2000);
    return () => clearInterval(t);
  }, [login]);
  async function action(input: object) {
    setBusy(true);
    setError("");
    setNotice("");
    try {
      const res = await fetch("/api/action", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(input),
      });
      const json = await res.json();
      if (!res.ok) throw Error(json.error);
      setNotice(json.warning || "Изменения сохранены");
      await refresh();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  async function auth(role?: string) {
    setError("");
    try {
      const res = await fetch(role ? "/api/auth/demo" : "/api/auth/telegram", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ role }),
      });
      const j = await res.json();
      if (!res.ok) throw Error(j.error || "Ошибка входа");
      if (j.url) setLogin(j.url);
      else {
        if (role && role !== "admin") setTab("schedule");
        await refresh();
      }
    } catch (e) {
      setError((e as Error).message);
    }
  }
  const teams = data?.teams || [];
  const r = data?.rounds.find((r) => r.id === roundId) || data?.rounds.at(-1);
  const team = (id: string) => teams.find((t) => t.id === id);
  const my = teams.find((t) => t.mine);
  const mine = r?.matches.find((m) => [m.a, m.b].includes(my?.id || ""));
  const count = (slot: string) =>
    r?.matches.filter((m) => m.slot === slot) || [];
  const open =
    !!r &&
    !r.published &&
    Date.now() >= Date.parse(r.opens + "+03:00") &&
    Date.now() < Date.parse(r.deadline + "+03:00");
  function Badge({ id }: { id: string }) {
    const t = team(id);
    return (
      <div className="team">
        <div className={"crest color" + (Number(id) % 6)}>
          {t?.logo ? (
            <img src={t.logo} alt="" />
          ) : (
            <span>{t?.name.slice(0, 2).toUpperCase()}</span>
          )}
        </div>
        <strong>{t?.name}</strong>
      </div>
    );
  }
  function Pair({ m }: { m: Match }) {
    return (
      <span>
        {team(m.a)?.name} — {team(m.b)?.name}
      </span>
    );
  }
  function parsePairs(value: string) {
    return value
      .trim()
      .split("\n")
      .map((line) =>
        line.split(";").map((name) => {
          const t = teams.find(
            (t) => t.name.toLowerCase() === name.trim().toLowerCase(),
          );
          if (!t) throw Error("Неизвестная команда: " + name);
          return t.id;
        }),
      );
  }
  async function importExcel(file: File) {
    try {
      if (file.size > 2 * 1024 * 1024)
        throw Error("Файл должен быть меньше 2 МБ");
      const { readSheet: readXlsxFile } =
        await import("read-excel-file/browser");
      const sheet = await readXlsxFile(file);
      const rows: string[] = [];
      sheet.forEach((row, i) => {
        const a = String(row[0] ?? "").trim(),
          b = String(row[1] ?? "").trim();
        if (i === 0 && a === "Команда 1" && b === "Команда 2") return;
        if (a || b) rows.push(a + ";" + b);
      });
      parsePairs(rows.join("\n"));
      setPairs(rows.join("\n"));
      setNotice("Excel прочитан. Проверьте пары перед созданием тура.");
    } catch (e) {
      setError("Ошибка Excel: " + (e as Error).message);
    }
  }
  if (!data)
    return (
      <main className="loading">
        <h1>
          ABL<span> / РАСПИСАНИЕ</span>
        </h1>
        <p>{error || "Загружаем площадку…"}</p>
        <button onClick={refresh}>Повторить</button>
      </main>
    );
  return (
    <>
      <header>
        <a className="brand" href="/">
          ABL<span>FOR PEOPLE</span>
        </a>
        <div className="header-label">
          БАСКЕТБОЛЬНАЯ ЛИГА<span>Турнир · Профсоюзная</span>
        </div>
        <div className="auth">
          {data.user ? (
            <>
              <span>
                {data.user.admin
                  ? "Организатор"
                  : my?.name || "Команда не назначена"}
              </span>
              <button
                className="ghost"
                onClick={async () => {
                  await fetch("/api/auth/logout", { method: "POST" });
                  setTab("schedule");
                  setNotice("");
                  setError("");
                  refresh();
                }}
              >
                Выйти
              </button>
            </>
          ) : (
            <button onClick={() => auth()}>Войти через Telegram</button>
          )}
        </div>
      </header>
      <main>
        <section className="hero">
          <div>
            <div className="eyebrow">СЕЗОН 2026 / 2027</div>
            <h1>
              ИГРА НАЧИНАЕТСЯ
              <br />
              <span>С ДОГОВОРЁННОСТИ.</span>
            </h1>
            <p>
              Выберите время. Согласуйте с соперником. Встретимся на паркете.
            </p>
          </div>
          <div className="basket" aria-hidden="true">
            <svg viewBox="0 0 200 200">
              <circle cx="100" cy="100" r="91" />
              <path d="M9 100h182M100 9v182M35 35c85 20 110 110 130 130M165 35C80 55 55 145 35 165" />
            </svg>
          </div>
        </section>
        {data.demo && (
          <div className="demo">
            <b>Демонстрационный режим</b>
            <span>Проверяйте сценарий от лица обеих команд</span>
            {[
              ["captain", "Капитан A"],
              ["opponent", "Капитан Б"],
              ["admin", "Организатор"],
            ].map(([role, label]) => (
              <button key={role} onClick={() => auth(role)}>
                {label}
              </button>
            ))}
          </div>
        )}
        {login && (
          <div className="message">
            <a href={login} target="_blank" rel="noreferrer">
              Открыть Telegram и подтвердить вход ↗
            </a>
            <p>
              Нажмите «Запустить» в боте, затем вернитесь сюда. Ссылка действует
              5 минут.
            </p>
            <button onClick={() => setLogin("")}>Отмена</button>
          </div>
        )}
        {error && (
          <div className="error" role="alert">
            {error}
            <button onClick={() => setError("")}>×</button>
          </div>
        )}
        {notice && (
          <div className="message" role="status">
            {notice}
          </div>
        )}
        <nav>
          <button
            className={tab === "schedule" ? "active" : ""}
            onClick={() => setTab("schedule")}
          >
            Расписание
          </button>
          {data.user?.admin && (
            <button
              className={tab === "admin" ? "active" : ""}
              onClick={() => setTab("admin")}
            >
              Управление турниром
            </button>
          )}
        </nav>
        <div className="toolbar">
          <div>
            <h2>
              {tab === "schedule" ? "Календарь игр" : "Пульт организатора"}
            </h2>
            <span className="muted">Профсоюзная · Все время по Москве</span>
          </div>
          {data.rounds.length > 0 && (
            <select
              aria-label="Тур"
              value={r?.id}
              onChange={(e) => {
                setRoundId(e.target.value);
                setDay("all");
              }}
            >
              {data.rounds.map((x) => (
                <option key={x.id} value={x.id}>
                  {x.name}
                  {x.published ? " · опубликован" : " · согласование"}
                </option>
              ))}
            </select>
          )}
        </div>
        {!r ? (
          <section className="empty">
            <h3>Скоро на паркете</h3>
            <p>
              Организатор ещё не опубликовал расписание. Загляните чуть позже.
            </p>
          </section>
        ) : (
          <>
            <div className="round-info">
              <span className={"pill " + (r.published ? "green" : "")}>
                {r.published
                  ? "Опубликовано"
                  : open
                    ? "Идёт согласование"
                    : "Согласование закрыто"}
              </span>
              <span>
                Окно: {r.opens.replace("T", " ")} —{" "}
                {r.deadline.replace("T", " ")} МСК
              </span>
              <span>
                {r.matches.filter((m) => m.slot).length} / {r.matches.length}{" "}
                согласовано
              </span>
            </div>
            {tab === "schedule" && (
              <>
                {data.user && !data.user.admin && !my && (
                  <section className="message">
                    Для согласования организатор должен назначить вам команду.
                    Ваш Telegram ID: <b>{data.user.id}</b>
                  </section>
                )}
                {my && !mine && (
                  <section className="message">
                    В этом туре матч вашей команды не назначен.
                  </section>
                )}
                {my && mine && (
                  <section className="my-match">
                    <Badge id={mine.a} />
                    <span className="vs">VS</span>
                    <Badge id={mine.b} />
                    <div>
                      <small>ВАШ МАТЧ · {r.name}</small>
                      <p>
                        {mine.slot
                          ? `Согласовано: ${mine.slot.replace("T", " ")} МСК`
                          : "Выберите несколько подходящих слотов в карточках ниже. Соперник подтвердит один из них."}
                      </p>
                      {mine.slot && count(mine.slot).length > 1 && (
                        <b className="danger">
                          Конфликт: решение за организатором
                        </b>
                      )}
                      {!mine.slot &&
                        mine.offers.some((o) => o.team !== my.id) && (
                          <p className="incoming-hint">
                            Есть предложения соперника — подтвердите подходящее
                            в карточке.
                          </p>
                        )}
                      {mine.slot && open && (
                        <button
                          disabled={busy}
                          onClick={() =>
                            action({
                              type: "reopen",
                              round: r.id,
                              match: mine.id,
                            })
                          }
                        >
                          Открыть пересогласование
                        </button>
                      )}
                      {!open && (
                        <p className="muted">
                          {r.published
                            ? "Тур опубликован. Для переноса обратитесь к организатору."
                            : "Согласование закрыто. Сроки указаны выше."}
                        </p>
                      )}
                    </div>
                  </section>
                )}

                <div className="filters">
                  {["all", ...new Set(r.slots.map((s) => s.date))].map((d) => (
                    <button
                      className={day === d ? "selected" : ""}
                      key={d}
                      onClick={() => setDay(d)}
                    >
                      {d === "all" ? "Все выходные" : formatDate(d)}
                    </button>
                  ))}
                </div>
                <div className="cards">
                  {r.slots
                    .filter((s) => day === "all" || day === s.date)
                    .map((s) => {
                      const matches = count(s.id);
                      const theirs =
                        !!my &&
                        !!mine?.offers.some(
                          (o) => o.team !== my.id && o.slot === s.id,
                        );
                      const own =
                        !!my &&
                        !!mine?.offers.some(
                          (o) => o.team === my.id && o.slot === s.id,
                        );
                      const agreed = mine?.slot === s.id;
                      return (
                        <article
                          className={
                            "card " +
                            (matches.length > 1 ? "conflict " : "") +
                            (theirs
                              ? "incoming-card "
                              : own
                                ? "selected-card "
                                : "") +
                            (agreed ? "agreed-card" : "")
                          }
                          key={s.id}
                          data-slot={s.id}
                        >
                          <div className="card-top">
                            <span>ПРОФСОЮЗНАЯ</span>
                            <b>{s.time}</b>
                          </div>
                          <div className="card-date">{formatDate(s.date)}</div>
                          {matches.length ? (
                            matches.map((m) => (
                              <div className="match" key={m.id}>
                                <Badge id={m.a} />
                                <span className="vs">VS</span>
                                <Badge id={m.b} />
                              </div>
                            ))
                          ) : (
                            <div className="free">
                              <span>＋</span>
                              <p>Свободный слот</p>
                            </div>
                          )}
                          <div className="card-bottom">
                            <span>{r.name}</span>
                            <span
                              className={matches.length > 1 ? "danger" : ""}
                            >
                              {matches.length > 1
                                ? "● Конфликт"
                                : matches.length
                                  ? "● " +
                                    (r.published
                                      ? "В расписании"
                                      : "Согласовано")
                                  : "○ Доступен"}
                            </span>
                          </div>
                          {my && mine && (
                            <div className="card-actions">
                              {agreed ? (
                                <strong className="agreement-label">
                                  Ваш матч согласован
                                </strong>
                              ) : (
                                <>
                                  {theirs && (
                                    <strong className="incoming-hint">
                                      Соперник предлагает — ждёт вашего
                                      подтверждения
                                    </strong>
                                  )}
                                  {own && (
                                    <span className="proposal-label">
                                      Ваше предложение · ждём соперника
                                    </span>
                                  )}
                                  {!!matches.filter((m) => m.id !== mine.id)
                                    .length &&
                                    !mine.slot && (
                                      <small className="danger">
                                        Слот уже занят. При согласовании вашей
                                        пары конфликт решит организатор.
                                      </small>
                                    )}
                                  {!mine.slot && (
                                    <button
                                      disabled={
                                        busy || !open || (own && !theirs)
                                      }
                                      onClick={() =>
                                        action({
                                          type: theirs ? "accept" : "offer",
                                          round: r.id,
                                          match: mine.id,
                                          slot: s.id,
                                        })
                                      }
                                    >
                                      {theirs
                                        ? "Подтвердить этот слот"
                                        : own
                                          ? "Слот выбран"
                                          : "Выбрать этот слот"}
                                    </button>
                                  )}
                                </>
                              )}
                            </div>
                          )}
                        </article>
                      );
                    })}
                </div>
              </>
            )}
            {tab === "admin" && data.user?.admin && (
              <div className="admin">
                <section className="panel">
                  <h3>Согласование и публикация</h3>
                  <form
                    onSubmit={(e) => {
                      e.preventDefault();
                      const f = new FormData(e.currentTarget);
                      action({
                        type: "settings",
                        round: r.id,
                        opens: f.get("opens"),
                        deadline: f.get("deadline"),
                      });
                    }}
                    key={r.id + r.opens + r.deadline}
                  >
                    <label>
                      Открытие, МСК
                      <input
                        name="opens"
                        type="datetime-local"
                        defaultValue={r.opens}
                        required
                      />
                    </label>
                    <label>
                      Дедлайн, МСК
                      <input
                        name="deadline"
                        type="datetime-local"
                        defaultValue={r.deadline}
                        required
                      />
                    </label>
                    <button disabled={busy}>Сохранить сроки</button>
                  </form>
                  <button
                    className="publish"
                    disabled={busy || r.published}
                    onClick={() => action({ type: "publish", round: r.id })}
                  >
                    {r.published
                      ? "Тур опубликован"
                      : "Опубликовать весь тур ↗"}
                  </button>
                  <p className="muted">
                    Публикация доступна, когда назначены все 16 игр и нет
                    конфликтов.
                  </p>
                </section>
                <section className="panel">
                  <h3>Матчи и конфликты</h3>
                  {!r.published &&
                    !r.matches.some((m) => m.slot || m.offers.length) && (
                      <form
                        onSubmit={(e) => {
                          e.preventDefault();
                          try {
                            action({
                              type: "pairs",
                              round: r.id,
                              pairs: parsePairs(
                                String(
                                  new FormData(e.currentTarget).get("pairs"),
                                ),
                              ),
                            });
                          } catch (e) {
                            setError((e as Error).message);
                          }
                        }}
                      >
                        <label className="wide">
                          Пары текущего тура: Команда 1;Команда 2
                          <textarea
                            name="pairs"
                            rows={5}
                            defaultValue={r.matches
                              .map(
                                (m) => team(m.a)?.name + ";" + team(m.b)?.name,
                              )
                              .join("\n")}
                          />
                        </label>
                        <button disabled={busy}>Сохранить пары</button>
                      </form>
                    )}
                  {r.matches.map((m) => (
                    <div className="admin-match" key={m.id}>
                      <div>
                        <Pair m={m} />
                        {m.slot && count(m.slot).length > 1 && (
                          <small className="danger">
                            Конфликт — выберите другое время одной из пар
                          </small>
                        )}
                      </div>
                      <select
                        aria-label={"Время " + team(m.a)?.name}
                        value={m.slot || ""}
                        disabled={busy}
                        onChange={(e) =>
                          action({
                            type: "assign",
                            round: r.id,
                            match: m.id,
                            slot: e.target.value,
                          })
                        }
                      >
                        <option value="">Не назначено</option>
                        {r.slots.map((s) => (
                          <option key={s.id} value={s.id}>
                            {s.date} {s.time}{" "}
                            {count(s.id).length ? "· занято" : ""}
                          </option>
                        ))}
                      </select>
                    </div>
                  ))}
                </section>
                <section className="panel">
                  <h3>Слоты тура</h3>
                  <div className="slot-chips">
                    {r.slots.map((s) => (
                      <button
                        key={s.id}
                        title="Удалить неиспользуемый слот"
                        disabled={busy}
                        onClick={() =>
                          action({
                            type: "deleteSlot",
                            round: r.id,
                            slot: s.id,
                          })
                        }
                      >
                        {s.date.slice(5)} {s.time} ×
                      </button>
                    ))}
                  </div>
                  <form
                    onSubmit={(e) => {
                      e.preventDefault();
                      const f = new FormData(e.currentTarget);
                      action({
                        type: "slot",
                        round: r.id,
                        date: f.get("date"),
                        time: f.get("time"),
                      });
                    }}
                  >
                    <label>
                      Дата
                      <input
                        type="date"
                        name="date"
                        required
                        defaultValue={r.saturday}
                      />
                    </label>
                    <label>
                      Начало, МСК
                      <input
                        type="time"
                        name="time"
                        required
                        defaultValue="10:00"
                      />
                    </label>
                    <button disabled={busy}>Добавить слот</button>
                  </form>
                </section>
                <section className="panel">
                  <h3>Создать тур</h3>
                  <form
                    className="new-round"
                    onSubmit={(e) => {
                      e.preventDefault();
                      const f = new FormData(e.currentTarget);
                      try {
                        const parsed = pairs
                          .trim()
                          .split("\n")
                          .map((line) =>
                            line.split(";").map((name) => {
                              const t = teams.find(
                                (t) =>
                                  t.name.toLowerCase() ===
                                  name.trim().toLowerCase(),
                              );
                              if (!t)
                                throw Error("Неизвестная команда: " + name);
                              return t.id;
                            }),
                          );
                        action({
                          type: "round",
                          name: f.get("name"),
                          saturday: f.get("saturday"),
                          opens: f.get("opens"),
                          deadline: f.get("deadline"),
                          pairs: parsed,
                        });
                      } catch (e) {
                        setError((e as Error).message);
                      }
                    }}
                  >
                    <label>
                      Название
                      <input name="name" placeholder="2 тур" required />
                    </label>
                    <label>
                      Суббота
                      <input
                        name="saturday"
                        type="date"
                        required
                        onChange={(e) => {
                          if (!e.target.value) return;
                          const f = e.target.form;
                          const w = defaultWindow(e.target.value);
                          if (f) {
                            (
                              f.elements.namedItem("opens") as HTMLInputElement
                            ).value = w.opens;
                            (
                              f.elements.namedItem(
                                "deadline",
                              ) as HTMLInputElement
                            ).value = w.deadline;
                          }
                        }}
                      />
                    </label>
                    <label>
                      Открытие, МСК
                      <input name="opens" type="datetime-local" required />
                    </label>
                    <label>
                      Дедлайн, МСК
                      <input name="deadline" type="datetime-local" required />
                    </label>
                    <label className="wide">
                      Импорт Excel (.xlsx): «Команда 1», «Команда 2»
                      <a href="/pairs-template.xlsx" download>
                        Скачать шаблон Excel ↓
                      </a>
                      <input
                        type="file"
                        accept=".xlsx"
                        onChange={(e) =>
                          e.target.files?.[0] && importExcel(e.target.files[0])
                        }
                      />
                    </label>
                    <label className="wide">
                      16 пар: Команда 1;Команда 2 — каждая на новой строке
                      <textarea
                        value={pairs}
                        onChange={(e) => setPairs(e.target.value)}
                        rows={8}
                        required
                      />
                    </label>
                    <button disabled={busy}>Создать тур</button>
                  </form>
                </section>
                <section className="panel">
                  <h3>Команды и капитаны</h3>
                  <p className="muted">
                    Telegram ID капитан получает при входе через бота. Один
                    пользователь — одна команда.
                  </p>
                  {teams.map((t) => (
                    <form
                      className="team-form"
                      key={t.id}
                      onSubmit={(e) => {
                        e.preventDefault();
                        const f = new FormData(e.currentTarget);
                        action({
                          type: "team",
                          id: t.id,
                          name: f.get("name"),
                          telegramId: f.get("telegramId"),
                          logo: f.get("logo"),
                        });
                      }}
                    >
                      <input
                        name="name"
                        aria-label="Название команды"
                        defaultValue={t.name}
                        required
                      />
                      <input
                        name="telegramId"
                        aria-label={"Telegram ID " + t.name}
                        defaultValue={t.telegramId}
                        placeholder="Telegram ID"
                      />
                      <input
                        name="logo"
                        type="url"
                        aria-label={"Логотип " + t.name}
                        defaultValue={t.logo}
                        placeholder="https://… логотип"
                      />
                      <button disabled={busy}>Сохранить</button>
                    </form>
                  ))}
                </section>
              </div>
            )}
          </>
        )}
        <footer>
          <a className="brand" href="/">
            ABL<span>FOR PEOPLE</span>
          </a>
          <p>Баскетбол объединяет. Договоримся об игре.</p>
          <span>Время — МСК (UTC+3)</span>
        </footer>
      </main>
    </>
  );
}
