"use client";
import { useEffect, useState } from "react";
import type { PreliminaryBooking } from "../lib/preliminary";
import type { Round, Match, Team } from "../lib/domain";
import { defaultWindow } from "../lib/domain";
type ViewTeam = Team & { mine: boolean };
type Data = {
  user: { id: string; admin: boolean } | null;
  demo: boolean;
  teams: ViewTeam[];
  rounds: (Round & { preliminary: PreliminaryBooking[] })[];
};
const shortDate = (s: string) =>
  new Date(s + "T12:00:00+03:00").toLocaleDateString("ru-RU", {
    day: "2-digit",
    month: "long",
    timeZone: "Europe/Moscow",
  });
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
  const [adminView, setAdminView] = useState("current");
  const [newSaturday, setNewSaturday] = useState("");
  const [newStart, setNewStart] = useState("10:00");
  const [newPerDay, setNewPerDay] = useState(8);
  const [newName, setNewName] = useState("");
  const [newOpens, setNewOpens] = useState("");
  const [newDeadline, setNewDeadline] = useState("");
  async function refresh() {
    try {
      const res = await fetch("/api/state");
      if (!res.ok) throw Error("Не удалось загрузить расписание");
      const next: Data = await res.json();
      setData(next);
      return next;
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
      const next = await refresh();
      if ((input as { type?: string }).type === "round" && next) {
        setRoundId(next.rounds.at(-1)!.id);
        setDay("all");
        setAdminView("current");
        setPairs("");
        setNewName("");
        setNewSaturday("");
        setNewOpens("");
        setNewDeadline("");
      }
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
        body: JSON.stringify({ role, round: roundId || undefined }),
      });
      const j = await res.json();
      if (!res.ok) throw Error(j.error || "Ошибка входа");
      if (j.url) setLogin(j.url);
      else {
        if (j.round) setRoundId(j.round);
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
        {tab === "schedule" && (
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
        )}
        {data.demo && (
          <div className="demo">
            <b>Демонстрационный режим</b>
            <span>
              1-я пара: A и Б · 2-я пара: C и D · Можно согласовать один слот
            </span>
            {[
              ["captain", "Капитан A"],
              ["opponent", "Капитан Б"],
              ["captain_c", "Капитан C"],
              ["captain_d", "Капитан D"],
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
              {tab === "schedule"
                ? "Календарь игр"
                : adminView === "new"
                  ? "Новый тур"
                  : adminView === "teams"
                    ? "Команды и капитаны"
                    : "Управление туром"}
            </h2>
            <span className="muted">Профсоюзная · Все время по Москве</span>
          </div>
          {data.rounds.length > 0 &&
            (tab !== "admin" || adminView === "current") && (
              <label className="round-picker">
                Выбранный тур
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
              </label>
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
            {(tab !== "admin" || adminView === "current") && (
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
            )}
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
                {data.user && (
                  <div className="calendar-legend">
                    <span>
                      <i className="legend-tentative" />
                      Предварительная заявка
                    </span>
                    <span>
                      <i className="legend-confirmed" />
                      Согласовано
                    </span>
                    <span>
                      <i className="legend-conflict" />
                      Конфликт
                    </span>
                    <small>
                      Предварительная заявка не блокирует выбор слота.
                    </small>
                  </div>
                )}
                <div className="cards">
                  {r.slots
                    .filter((s) => day === "all" || day === s.date)
                    .map((s) => {
                      const matches = count(s.id);
                      const pending = (r.preliminary || []).filter(
                        (p) => p.slot === s.id,
                      );
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
                            (pending.length && !matches.length
                              ? "tentative-card "
                              : "") +
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
                            <span>ПРОФА</span>
                          </div>
                          <div className="card-date">
                            {shortDate(s.date)}, {s.time}
                          </div>
                          {matches.length ? (
                            matches.map((m) => (
                              <div className="match" key={m.id}>
                                <Badge id={m.a} />
                                <span className="vs">VS</span>
                                <Badge id={m.b} />
                              </div>
                            ))
                          ) : pending.length ? (
                            <div className="pending-preview">
                              {pending.map((p) => {
                                const m = r.matches.find(
                                  (m) => m.id === p.matchId,
                                )!;
                                return (
                                  <div className="match" key={p.matchId}>
                                    <Badge id={m.a} />
                                    <span className="vs">VS</span>
                                    <Badge id={m.b} />
                                  </div>
                                );
                              })}
                            </div>
                          ) : (
                            <div className="free">
                              <span>— : —</span>
                              <p>Свободный слот</p>
                            </div>
                          )}
                          {pending.length > 0 && (
                            <div className="preliminary-bookings">
                              <strong>
                                ◷{" "}
                                {pending.length > 1
                                  ? "Предварительные заявки"
                                  : "Предварительная заявка"}
                              </strong>
                              {pending.map((p) => {
                                const m = r.matches.find(
                                  (m) => m.id === p.matchId,
                                )!;
                                return (
                                  <div key={p.matchId}>
                                    {matches.length > 0 && (
                                      <span className="pending-pair">
                                        <Pair m={m} />
                                      </span>
                                    )}
                                    <small>
                                      {p.proposedBy.length > 1
                                        ? "Предложили"
                                        : "Предложила"}
                                      :{" "}
                                      {p.proposedBy
                                        .map((id) => team(id)?.name)
                                        .join(", ")}
                                      . Ждём подтверждения соперника.
                                    </small>
                                  </div>
                                );
                              })}
                            </div>
                          )}
                          <div className="card-bottom">
                            <span>{r.name}</span>
                            <span className="card-location">
                              <svg viewBox="0 0 24 24" aria-hidden="true">
                                <path d="M12 2a7 7 0 0 0-7 7c0 5 7 13 7 13s7-8 7-13a7 7 0 0 0-7-7Zm0 10a3 3 0 1 1 0-6 3 3 0 0 1 0 6Z" />
                              </svg>
                              Профа
                            </span>
                          </div>
                          <div
                            className={
                              "card-status " +
                              (matches.length > 1 ? "danger" : "")
                            }
                          >
                            {matches.length > 1
                              ? "● Конфликт"
                              : matches.length
                                ? "● " +
                                  (r.published ? "В расписании" : "Согласовано")
                                : pending.length
                                  ? "◷ Ожидает подтверждения"
                                  : "○ Доступен"}
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
                                        Слот уже занят — решение за
                                        организатором.
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
                <div className="admin-switch" aria-label="Разделы организатора">
                  {[
                    ["current", "Выбранный тур"],
                    ["new", "＋ Новый тур"],
                    ["teams", "Команды и капитаны"],
                  ].map(([id, label]) => (
                    <button
                      key={id}
                      className={adminView === id ? "selected" : ""}
                      onClick={() => {
                        setAdminView(id);
                        setError("");
                        setNotice("");
                      }}
                    >
                      {label}
                    </button>
                  ))}
                </div>
                {adminView === "current" && (
                  <div className="round-workspace" key={r.id}>
                    <div className="scope-heading">
                      <div>
                        <small>ВЫБРАННЫЙ ТУР</small>
                        <h3>{r.name}</h3>
                        <p>{formatDate(r.saturday)} · Профсоюзная</p>
                      </div>
                      <span className="pill">
                        {r.published ? "Опубликован" : "Черновик"}
                      </span>
                    </div>
                    <div className="round-metrics">
                      <span>
                        <b>{r.matches.length}</b> матчей
                      </span>
                      <span>
                        <b>{r.slots.length}</b> слотов
                      </span>
                      <span>
                        <b>
                          {
                            r.matches.filter(
                              (m) => m.slot && count(m.slot).length > 1,
                            ).length
                          }
                        </b>{" "}
                        матчей с конфликтом
                      </span>
                    </div>
                    <section className="panel">
                      <h3>Сроки и публикация · {r.name}</h3>
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
                      <h3>Матчи · {r.name}</h3>
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
                                      new FormData(e.currentTarget).get(
                                        "pairs",
                                      ),
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
                                    (m) =>
                                      team(m.a)?.name + ";" + team(m.b)?.name,
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
                    <details className="panel round-slots">
                      <summary>
                        Слоты выбранного тура · {r.slots.length}
                        <span>Настроить время</span>
                      </summary>
                      <p className="muted">
                        Изменения применяются только к «{r.name}». Используемые
                        слоты удалить нельзя.
                      </p>
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
                    </details>
                  </div>
                )}
                {adminView === "new" && (
                  <div className="new-workspace">
                    {" "}
                    <section className="panel">
                      <h3>Создать тур и слоты</h3>
                      <p className="muted">
                        Отдельный новый тур. Существующие игры и слоты не
                        изменятся. После создания откроется новый тур.
                      </p>
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
                              start: newStart,
                              perDay: newPerDay,
                            });
                          } catch (e) {
                            setError((e as Error).message);
                          }
                        }}
                      >
                        <label>
                          Название
                          <input
                            name="name"
                            placeholder="2 тур"
                            value={newName}
                            onChange={(e) => setNewName(e.target.value)}
                            required
                          />
                        </label>
                        <label>
                          Суббота
                          <input
                            name="saturday"
                            value={newSaturday}
                            type="date"
                            required
                            onChange={(e) => {
                              setNewSaturday(e.target.value);
                              if (!e.target.value) return;
                              const w = defaultWindow(e.target.value);
                              setNewOpens(w.opens);
                              setNewDeadline(w.deadline);
                            }}
                          />
                        </label>
                        <label>
                          Открытие, МСК
                          <input
                            name="opens"
                            type="datetime-local"
                            value={newOpens}
                            onChange={(e) => setNewOpens(e.target.value)}
                            required
                          />
                        </label>
                        <label>
                          Дедлайн, МСК
                          <input
                            name="deadline"
                            type="datetime-local"
                            value={newDeadline}
                            onChange={(e) => setNewDeadline(e.target.value)}
                            required
                          />
                        </label>
                        <fieldset className="wide creation-slots">
                          <legend>Слоты нового тура · 70 минут</legend>
                          <div className="slot-config">
                            <label>
                              Первая игра, МСК
                              <input
                                name="start"
                                type="time"
                                required
                                value={newStart}
                                onChange={(e) => setNewStart(e.target.value)}
                              />
                            </label>
                            <label>
                              Слотов в каждый день
                              <input
                                name="perDay"
                                type="number"
                                min={8}
                                max={20}
                                required
                                value={newPerDay}
                                onChange={(e) =>
                                  setNewPerDay(Number(e.target.value))
                                }
                              />
                            </label>
                          </div>
                          <p className="muted">
                            Суббота и воскресенье · {newPerDay * 2} слотов всего
                          </p>
                          <div className="slot-preview">
                            {Array.from(
                              {
                                length: Math.min(
                                  20,
                                  Math.max(0, newPerDay || 0),
                                ),
                              },
                              (_, i) => {
                                const n =
                                  Number(newStart.slice(0, 2)) * 60 +
                                  Number(newStart.slice(3)) +
                                  i * 70;
                                return (
                                  <span key={i}>
                                    {n < 1440
                                      ? String(Math.floor(n / 60)).padStart(
                                          2,
                                          "0",
                                        ) +
                                        ":" +
                                        String(n % 60).padStart(2, "0")
                                      : "После полуночи"}
                                  </span>
                                );
                              },
                            )}
                          </div>
                          {newSaturday && (
                            <small>
                              Даты: {shortDate(newSaturday)} и{" "}
                              {shortDate(
                                new Date(
                                  Date.parse(newSaturday + "T12:00:00Z") +
                                    86400000,
                                )
                                  .toISOString()
                                  .slice(0, 10),
                              )}
                            </small>
                          )}
                        </fieldset>
                        <label className="wide">
                          Импорт Excel (.xlsx): «Команда 1», «Команда 2»
                          <a href="/pairs-template.xlsx" download>
                            Скачать шаблон Excel ↓
                          </a>
                          <input
                            type="file"
                            accept=".xlsx"
                            onChange={(e) =>
                              e.target.files?.[0] &&
                              importExcel(e.target.files[0])
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
                  </div>
                )}
                {adminView === "teams" && (
                  <div className="teams-workspace">
                    <p className="muted">
                      Общий справочник для всех туров. Привязки капитанов
                      сохраняются между турами.
                    </p>{" "}
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
