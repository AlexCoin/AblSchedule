"use client";
import type { ReactNode } from "react";
import type { Team } from "../lib/domain";
import { DIVISIONS, swapPairTeam, pairingTeams } from "../lib/division-pairs";
export default function MatchPairEditor({
  teams,
  value,
  onChange,
  disabled = false,
  extra,
}: {
  teams: Team[];
  value: string[][];
  onChange: (pairs: string[][]) => void;
  disabled?: boolean;
  extra?: (index: number) => ReactNode;
}) {
  const lookup = (id: string) => teams.find((t) => t.id === id);
  const groups = [
    ...DIVISIONS,
    ...new Set(
      value
        .map((p) => lookup(p[0])?.division || "Без дивизиона")
        .filter((d) => !DIVISIONS.includes(d)),
    ),
  ];
  return (
    <div className="pair-editor">
      {groups.map((division) => {
        const entries = value
          .map((pair, index) => ({ pair, index }))
          .filter(
            ({ pair }) =>
              (lookup(pair[0])?.division || "Без дивизиона") === division,
          );
        if (!entries.length) return null;
        const choices = pairingTeams(teams)
          .filter((t) => t.division === division)
          .sort((a, b) => a.name.localeCompare(b.name, "ru"));
        return (
          <details
            className="pair-division"
            key={division}
            open={division === "Pale"}
          >
            <summary className="pair-division-heading">
              <h4>{division}</h4>
              <span>{entries.length} матча</span>
            </summary>
            {entries.map(({ pair, index }) => (
              <div className="pair-row" data-pair-row={index} key={index}>
                <span className="pair-number">{index + 1}</span>
                <div className="pair-teams">
                  {[0, 1].map((side) => (
                    <label key={side}>
                      {side ? "Соперник" : "Команда"}
                      <select
                        aria-label={`Матч ${index + 1}: ${side ? "соперник" : "команда"}`}
                        disabled={disabled}
                        value={pair[side]}
                        onChange={(e) =>
                          onChange(
                            swapPairTeam(
                              teams,
                              value,
                              index,
                              side,
                              e.target.value,
                            ),
                          )
                        }
                      >
                        {!choices.some((t) => t.id === pair[side]) && (
                          <option value={pair[side]}>
                            {lookup(pair[side])?.name || pair[side]}
                          </option>
                        )}
                        {choices.map((t) => (
                          <option
                            value={t.id}
                            key={t.id}
                            disabled={t.id === pair[1 - side]}
                          >
                            {t.name}
                          </option>
                        ))}
                      </select>
                    </label>
                  ))}
                </div>
                {extra?.(index)}
              </div>
            ))}
          </details>
        );
      })}
    </div>
  );
}
