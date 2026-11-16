"use client";
import { useState } from "react";
import type { Round, Team } from "../lib/domain";
import { negotiationStatus } from "../lib/negotiation-status";

const labels = {
  empty: "Нет заявок",
  "one-sided": "Выбрала только одна команда",
  "no-common": "Нет общих слотов",
  confirmation: "Есть общий слот — ждём подтверждения",
  agreed: "Согласовано",
};

export default function UnagreedMatches({
  round,
  teams,
}: {
  round: Round;
  teams: Team[];
}) {
  const [withoutCommon, setWithoutCommon] = useState(false);
  const pending = round.matches
    .filter((m) => !m.slot)
    .map((match) => ({ match, ...negotiationStatus(match) }));
  const noCommon = pending.filter((m) => !m.common.length);
  const shown = withoutCommon ? noCommon : pending;
  const team = (id: string) => teams.find((t) => t.id === id);
  const formatSlot = (id: string) => {
    const slot = round.slots.find((s) => s.id === id);
    if (!slot) return id.replace("T", " ");
    return (
      slot.date.slice(8, 10) + "." + slot.date.slice(5, 7) + " · " + slot.time
    );
  };
  return (
    <section
      className="panel negotiation-report"
      aria-label="Несогласованные матчи"
    >
      <h3>Не договорились · {round.name}</h3>
      <div className="negotiation-metrics">
        <span>
          <b>{pending.length}</b> без согласованного времени
        </span>
        <span>
          <b>{noCommon.length}</b> без общих выбранных слотов
        </span>
      </div>
      {!pending.length ? (
        <p className="muted">
          Все пары согласовали время или получили назначение организатора.
        </p>
      ) : (
        <>
          <label className="negotiation-filter">
            <input
              type="checkbox"
              checked={withoutCommon}
              onChange={(e) => setWithoutCommon(e.target.checked)}
            />
            Только без общих слотов
          </label>
          <details open>
            <summary>Список матчей ({shown.length})</summary>
            {!shown.length && (
              <p className="muted">Матчей без общих слотов нет.</p>
            )}
            <div className="negotiation-list">
              {shown.map(({ match, status, a, b, common }) => (
                <article
                  className="negotiation-row"
                  key={match.id}
                  data-negotiation={status}
                >
                  <div className="negotiation-heading">
                    <strong>
                      {team(match.a)?.name} — {team(match.b)?.name}
                    </strong>
                    <span>{team(match.a)?.division}</span>
                  </div>
                  <p
                    className={
                      status === "no-common" ? "negotiation-warning" : "muted"
                    }
                  >
                    {labels[status]}
                  </p>
                  <div className="negotiation-choices">
                    {[
                      { id: match.a, slots: a },
                      { id: match.b, slots: b },
                    ].map(({ id, slots }) => (
                      <div key={id}>
                        <b>{team(id)?.name}</b>
                        <span>
                          {slots.length
                            ? slots.map(formatSlot).join(", ") + " МСК"
                            : "Слоты не выбраны"}
                        </span>
                      </div>
                    ))}
                  </div>
                  {!!common.length && (
                    <small>
                      Общие варианты: {common.map(formatSlot).join(", ")} МСК.
                      Нужно подтверждение соперника.
                    </small>
                  )}
                </article>
              ))}
            </div>
          </details>
        </>
      )}
    </section>
  );
}
