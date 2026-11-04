"use client";
import { useEffect, useState, useRef } from "react";
import { slotHeading } from "../lib/slot-heading";
import MatchPairEditor from "../components/MatchPairEditor";
import {
  defaultDivisionPairs,
  validateDivisionPairs,
} from "../lib/division-pairs";
import { telegramWebApp } from "../lib/telegram-client";
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
    [login, setLogin] = useState("");
  const [newPairIds, setNewPairIds] = useState<string[][] | null>(null);
  const [matchDraft, setMatchDraft] = useState<{
    roundId: string;
    baseline: string;
    pairs: string[][];
  } | null>(null);
  const [activeTeamId, setActiveTeamId] = useState("");
  const [showLegacyTeams, setShowLegacyTeams] = useState(false);
  const [telegramMode, setTelegramMode] = useState(false);
  const [telegramLoading, setTelegramLoading] = useState(false);
  const refreshEnabled = useRef(false);
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
  async function initializeTelegram() {
    setError("");
    setTelegramLoading(true);
    refreshEnabled.current = false;
    try {
      const app = await telegramWebApp();
      if (app) {
        setTelegramMode(true);
        const response = await fetch("/api/auth/telegram-mini", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ initData: app.initData }),
        });
        const json = await response.json();
        if (!response.ok)
          throw Error(json.error || "Не удалось войти через Telegram");
      }
      await refresh();
      refreshEnabled.current = true;
    } catch (e) {
      setData(null);
      setError((e as Error).message);
    } finally {
      setTelegramLoading(false);
    }
  }
  useEffect(() => {
    initializeTelegram();
    const t = setInterval(() => {
      if (refreshEnabled.current) refresh();
    }, 15000);
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
        body: JSON.stringify({ team: my?.id, ...input }),
      });
      const json = await res.json();
      if (!res.ok) throw Error(json.error);
      setNotice(json.warning || "Изменения сохранены");
      const next = await refresh();
      if ((input as { type?: string }).type === "pairs") setMatchDraft(null);
      if ((input as { type?: string }).type === "round" && next) {
        setRoundId(next.rounds.at(-1)!.id);
        setDay("all");
        setAdminView("current");
        setNewPairIds(null);
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
  const officialTeams = teams.filter(
    (t) => t.sourceUrl === "https://ablforpeople.com/divisions",
  );
  const adminTeams =
    officialTeams.length && !showLegacyTeams ? officialTeams : teams;
  const team = (id: string) => teams.find((t) => t.id === id);
  const storedPairs = r?.matches.map((m) => [m.a, m.b]) || [];
  const currentPairs =
    matchDraft && r && matchDraft.roundId === r.id
      ? matchDraft.pairs
      : storedPairs;
  const pairsDirty =
    JSON.stringify(currentPairs) !== JSON.stringify(storedPairs);
  const canEditPairs =
    !!r && !r.published && !r.matches.some((m) => m.slot || m.offers.length);
  const automaticPairs = (() => {
    try {
      return defaultDivisionPairs(teams);
    } catch {
      return [] as string[][];
    }
  })();
  const chosenNewPairs = newPairIds ?? automaticPairs;
  const myTeams = teams.filter((t) => t.mine);
  const my =
    myTeams.find((t) => t.id === activeTeamId) ||
    myTeams.find((t) => r?.matches.some((m) => [m.a, m.b].includes(t.id))) ||
    myTeams[0];
  const mine = r?.matches.find((m) => [m.a, m.b].includes(my?.id || ""));
  const bothMine =
    !!mine &&
    myTeams.some((t) => t.id === mine.a) &&
    myTeams.some((t) => t.id === mine.b);
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
        line.split(";").map((raw) => {
          const name = raw.trim().toLowerCase();
          const found = teams.filter(
            (t) =>
              t.name.toLowerCase() === name ||
              (t.division + " / " + t.name).toLowerCase() === name,
          );
          if (found.length !== 1)
            throw Error(
              found.length
                ? "Уточните дивизион: «Pale / Название команды»"
                : "Неизвестная команда: " + raw,
            );
          return found[0].id;
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
      const parsed = parsePairs(rows.join("\n"));
      validateDivisionPairs(teams, parsed);
      setNewPairIds(parsed);
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
        <p>
          {error ||
            (telegramLoading
              ? "Подключаем приложение…"
              : "Загружаем площадку…")}
        </p>
        <button disabled={telegramLoading} onClick={initializeTelegram}>
          Повторить
        </button>
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
                  await fetch("/api/auth/logout", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ miniApp: telegramMode }),
                  });
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
            <button
              disabled={telegramLoading}
              onClick={() => (telegramMode ? initializeTelegram() : auth())}
            >
              {telegramMode ? "Войти в Telegram" : "Войти через Telegram"}
            </button>
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
                    Ваш Telegram ID: <b>{data.user.id}</b>. В боте используйте
                    /teams, чтобы выбрать свои команды.. Выберите свои команды
                    командой /teams в боте.
                  </section>
                )}
                {my && !mine && (
                  <section className="message">
                    В этом туре матч вашей команды не назначен.
                  </section>
                )}
                {myTeams.length > 0 && (
                  <div className="captain-team-picker">
                    <label>
                      Моя команда
                      <select
                        aria-label="Моя команда"
                        value={my?.id || ""}
                        onChange={(e) => setActiveTeamId(e.target.value)}
                      >
                        {myTeams.map((t) => (
                          <option key={t.id} value={t.id}>
                            {t.division ? t.division + " · " : ""}
                            {t.name}
                          </option>
                        ))}
                      </select>
                    </label>
                    <small>
                      Вы действуете от имени выбранной команды. Другие команды
                      можно добавить командой /teams в боте.
                    </small>
                  </div>
                )}
                {bothMine && (
                  <div className="message">
                    Обе команды этой пары закреплены за вами. Вы можете
                    предложить время, но окончательно назначит его организатор.
                  </div>
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
                      const canConfirm =
                        theirs && open && !mine?.slot && !bothMine;
                      const cardDivision = slotHeading(
                        matches,
                        teams,
                        canConfirm,
                      );
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
                          <div
                            className={
                              "card-top " +
                              (!matches.length ? "card-heading-status" : "")
                            }
                          >
                            <span>{cardDivision}</span>
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
                                : canConfirm
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
                                  {own && theirs && !mine.slot && (
                                    <button
                                      className="withdraw-offer"
                                      disabled={busy || !open}
                                      onClick={() =>
                                        action({
                                          type: "withdraw",
                                          round: r.id,
                                          match: mine.id,
                                          slot: s.id,
                                        })
                                      }
                                    >
                                      Убрать мой выбор
                                    </button>
                                  )}
                                  {!mine.slot && (
                                    <button
                                      disabled={
                                        busy || !open || (bothMine && theirs)
                                      }
                                      onClick={() =>
                                        action({
                                          type: theirs
                                            ? "accept"
                                            : own
                                              ? "withdraw"
                                              : "offer",
                                          round: r.id,
                                          match: mine.id,
                                          slot: s.id,
                                        })
                                      }
                                    >
                                      {theirs
                                        ? bothMine
                                          ? "Назначит организатор"
                                          : "Подтвердить этот слот"
                                        : own
                                          ? "Убрать выбор слота"
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
                      <p className="muted">
                        Выбирайте соперников внутри дивизиона. При выборе уже
                        занятой команды её место в другой паре поменяется
                        автоматически. Изменения применятся после сохранения.
                      </p>
                      {!canEditPairs && (
                        <p className="pair-lock-note">
                          Пары зафиксированы: тур опубликован или уже началось
                          согласование. Назначение времени остаётся доступно.
                        </p>
                      )}
                      {canEditPairs && (
                        <div className="pair-toolbar">
                          <button
                            type="button"
                            className="ghost"
                            disabled={busy || automaticPairs.length !== 16}
                            onClick={() =>
                              setMatchDraft({
                                roundId: r.id,
                                baseline: JSON.stringify(storedPairs),
                                pairs: automaticPairs,
                              })
                            }
                          >
                            Загрузить пары по дивизионам
                          </button>
                          {pairsDirty && (
                            <span>Есть несохранённые изменения</span>
                          )}
                        </div>
                      )}
                      <MatchPairEditor
                        teams={teams}
                        value={currentPairs}
                        disabled={busy || !canEditPairs}
                        onChange={(next) =>
                          setMatchDraft({
                            roundId: r.id,
                            baseline:
                              matchDraft?.roundId === r.id
                                ? matchDraft.baseline
                                : JSON.stringify(storedPairs),
                            pairs: next,
                          })
                        }
                        extra={(index) => {
                          const m = r.matches[index];
                          return (
                            <div className="admin-match">
                              <label>
                                Время игры
                                <select
                                  aria-label={
                                    "Время " +
                                    team(currentPairs[index][0])?.name
                                  }
                                  value={
                                    m.slot ||
                                    (m.offers.length ? "__pending__" : "")
                                  }
                                  disabled={busy || pairsDirty}
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
                                  {m.offers.length > 0 && !m.slot && (
                                    <option value="__pending__" disabled>
                                      Предложено · ждёт подтверждения
                                    </option>
                                  )}
                                  {r.slots.map((slot) => (
                                    <option key={slot.id} value={slot.id}>
                                      {slot.date} {slot.time}{" "}
                                      {count(slot.id).length ? "· занято" : ""}
                                    </option>
                                  ))}
                                </select>
                              </label>
                              {m.offers.length > 0 && !m.slot && (
                                <div className="admin-pending">
                                  <strong>Ожидает подтверждения</strong>
                                  {m.offers.map((o) => (
                                    <small key={o.team + o.slot}>
                                      Предложила {team(o.team)?.name}:{" "}
                                      {o.slot.replace("T", " ")} МСК
                                    </small>
                                  ))}
                                  <button
                                    disabled={busy || pairsDirty}
                                    type="button"
                                    className="ghost"
                                    onClick={() =>
                                      action({
                                        type: "assign",
                                        round: r.id,
                                        match: m.id,
                                        slot: "",
                                      })
                                    }
                                  >
                                    Сбросить на «Не назначено»
                                  </button>
                                </div>
                              )}
                              {m.slot && count(m.slot).length > 1 && (
                                <small className="danger">
                                  Конфликт — выберите другое время одной из пар
                                </small>
                              )}
                            </div>
                          );
                        }}
                      />
                      {canEditPairs && (
                        <div className="pair-save">
                          <button
                            disabled={busy || !pairsDirty}
                            onClick={() =>
                              action({
                                type: "pairs",
                                round: r.id,
                                pairs: currentPairs,
                                expectedPairs:
                                  matchDraft?.baseline ||
                                  JSON.stringify(storedPairs),
                              })
                            }
                          >
                            Сохранить пары
                          </button>
                          {pairsDirty && (
                            <button
                              className="ghost"
                              onClick={() => setMatchDraft(null)}
                            >
                              Отменить изменения
                            </button>
                          )}
                        </div>
                      )}
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
                            const parsed = chosenNewPairs;
                            validateDivisionPairs(teams, parsed);
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
                          <a href="/api/pairs-template" download>
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
                        <div className="wide new-pair-section">
                          <div className="pair-toolbar">
                            <h3>Матчи нового тура</h3>
                            <button
                              type="button"
                              className="ghost"
                              disabled={busy || automaticPairs.length !== 16}
                              onClick={() => setNewPairIds(automaticPairs)}
                            >
                              Заполнить по дивизионам
                            </button>
                          </div>
                          <p className="muted">
                            Стартовые пары собраны по алфавиту внутри
                            дивизионов. Это заготовка — организатор может
                            выбрать других соперников.
                          </p>
                          {chosenNewPairs.length ? (
                            <MatchPairEditor
                              teams={teams}
                              value={chosenNewPairs}
                              onChange={setNewPairIds}
                              disabled={busy}
                            />
                          ) : (
                            <p className="error">
                              Проверьте состав и дивизионы 32 команд.
                            </p>
                          )}
                        </div>
                        <button disabled={busy || chosenNewPairs.length !== 16}>
                          Создать тур
                        </button>
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
                      <a
                        className="catalog-download"
                        href="/abl-teams.csv"
                        download
                      >
                        Скачать список Pale, Slow, Rook и Last для Excel ↓
                      </a>
                      <p className="muted">
                        Telegram ID капитан получает при входе через бота. Один
                        капитан может представлять несколько команд.
                      </p>
                      {officialTeams.length > 0 && (
                        <div className="catalog-summary">
                          <span>
                            Официальный каталог: {officialTeams.length} команды
                            · Pale, Slow, Rook, Last
                          </span>
                          {teams.length > officialTeams.length && (
                            <label>
                              <input
                                type="checkbox"
                                checked={showLegacyTeams}
                                onChange={(e) =>
                                  setShowLegacyTeams(e.target.checked)
                                }
                              />
                              Показать также старые команды из сохранённых туров
                              ({teams.length - officialTeams.length})
                            </label>
                          )}
                        </div>
                      )}
                      {adminTeams.map((t) => (
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
                              division: f.get("division"),
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
                            name="division"
                            aria-label={"Дивизион " + t.name}
                            defaultValue={t.division || ""}
                            placeholder="Дивизион"
                          />
                          <input
                            name="telegramId"
                            aria-label={"Telegram ID " + t.name}
                            defaultValue={t.telegramId}
                            placeholder="Telegram ID"
                          />
                          <input
                            name="logo"
                            type="text"
                            inputMode="url"
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
