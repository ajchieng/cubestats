import { useMemo } from "react";
import type {
  CompetitorProgression,
  EventProgression,
  ProgressionPoint,
  RankPositions,
} from "../lib/types";
import { formatDnfRate } from "../lib/result-utils";
import { ComparisonChart } from "./charts";

const COMPARE_COLORS = ["#145f76", "#c2410c"] as const;

export function ComparisonDashboard({
  primary,
  secondary,
  selectedEventId,
  onSelectEvent,
}: {
  primary: CompetitorProgression;
  secondary: CompetitorProgression;
  selectedEventId: string;
  onSelectEvent: (eventId: string) => void;
}) {
  const eventOptions = useMemo(() => {
    const names = new Map<string, string>();
    for (const event of primary.events) {
      names.set(event.event_id, event.name);
    }
    for (const event of secondary.events) {
      if (!names.has(event.event_id)) {
        names.set(event.event_id, event.name);
      }
    }
    return Array.from(names, ([id, name]) => ({ id, name }));
  }, [primary, secondary]);

  const headToHead = useMemo(() => {
    const byId = new Map(
      secondary.events.map((event) => [event.event_id, event])
    );
    let primaryWins = 0;
    let secondaryWins = 0;
    let ties = 0;
    let shared = 0;

    for (const event of primary.events) {
      const other = byId.get(event.event_id);
      if (!other) {
        continue;
      }

      const a = event.stats.current_pb_value;
      const b = other.stats.current_pb_value;
      if (a === null || b === null) {
        continue;
      }

      shared += 1;
      if (a < b) {
        primaryWins += 1;
      } else if (b < a) {
        secondaryWins += 1;
      } else {
        ties += 1;
      }
    }

    return { primaryWins, secondaryWins, ties, shared };
  }, [primary, secondary]);

  const activeEventId =
    eventOptions.find((option) => option.id === selectedEventId)?.id ??
    eventOptions[0]?.id ??
    "";
  const primaryEvent =
    primary.events.find((event) => event.event_id === activeEventId) ?? null;
  const secondEvent =
    secondary.events.find((event) => event.event_id === activeEventId) ?? null;
  const unit = primaryEvent?.unit ?? secondEvent?.unit ?? "seconds";
  const averageLabel =
    primaryEvent?.average_label ?? secondEvent?.average_label ?? "Ao5";

  const singleSeries = [
    {
      name: primary.name,
      color: COMPARE_COLORS[0],
      points: primaryEvent?.pb_progression ?? [],
    },
    {
      name: secondary.name,
      color: COMPARE_COLORS[1],
      points: secondEvent?.pb_progression ?? [],
    },
  ];
  const averageSeries = [
    {
      name: primary.name,
      color: COMPARE_COLORS[0],
      points: bestAverageProgression(primaryEvent?.average_points ?? []),
    },
    {
      name: secondary.name,
      color: COMPARE_COLORS[1],
      points: bestAverageProgression(secondEvent?.average_points ?? []),
    },
  ];

  return (
    <section className="dashboard" aria-label="Competitor comparison">
      <div className="summary-panel comparison-summary">
        <div className="versus">
          <div className="versus-side">
            <span
              className="swatch"
              style={{ background: COMPARE_COLORS[0] }}
            />
            <div>
              <h2>{primary.name}</h2>
              <p className="muted">{primary.wca_id}</p>
            </div>
          </div>
          <span className="versus-label">vs</span>
          <div className="versus-side">
            <span
              className="swatch"
              style={{ background: COMPARE_COLORS[1] }}
            />
            <div>
              <h2>{secondary.name}</h2>
              <p className="muted">{secondary.wca_id}</p>
            </div>
          </div>
        </div>

        <div className="event-picker">
          <label htmlFor="compare-event-id">Event</label>
          <select
            id="compare-event-id"
            value={activeEventId}
            onChange={(event) => onSelectEvent(event.target.value)}
          >
            {eventOptions.map((option) => (
              <option key={option.id} value={option.id}>
                {option.name}
              </option>
            ))}
          </select>
        </div>
      </div>

      {headToHead.shared > 0 ? (
        <p className="h2h-record">
          <strong style={{ color: COMPARE_COLORS[0] }}>{primary.name}</strong>{" "}
          {headToHead.primaryWins}
          {" – "}
          {headToHead.secondaryWins}{" "}
          <strong style={{ color: COMPARE_COLORS[1] }}>{secondary.name}</strong>{" "}
          on single PBs across {headToHead.shared} shared event
          {headToHead.shared === 1 ? "" : "s"}
          {headToHead.ties ? ` (${headToHead.ties} tied)` : ""}
        </p>
      ) : null}

      <div className="charts-grid">
        <ComparisonChart
          title="Single PB progression"
          unit={unit}
          series={singleSeries}
        />
        <ComparisonChart
          title={`Best ${averageLabel} progression`}
          unit={unit}
          series={averageSeries}
        />
      </div>

      <ComparisonStats
        primaryName={primary.name}
        secondName={secondary.name}
        primaryEvent={primaryEvent}
        secondEvent={secondEvent}
        averageLabel={averageLabel}
      />
    </section>
  );
}

function ComparisonStats({
  primaryName,
  secondName,
  primaryEvent,
  secondEvent,
  averageLabel,
}: {
  primaryName: string;
  secondName: string;
  primaryEvent: EventProgression | null;
  secondEvent: EventProgression | null;
  averageLabel: string;
}) {
  const a = primaryEvent?.stats ?? null;
  const b = secondEvent?.stats ?? null;

  const rows: {
    label: string;
    aDisplay: string | null;
    bDisplay: string | null;
    aValue: number | null;
    bValue: number | null;
    lowerBetter: boolean;
  }[] = [
    {
      label: "Single PB",
      aDisplay: a?.current_pb ?? null,
      bDisplay: b?.current_pb ?? null,
      aValue: a?.current_pb_value ?? null,
      bValue: b?.current_pb_value ?? null,
      lowerBetter: true,
    },
    {
      label: `Best ${averageLabel}`,
      aDisplay: a?.best_average ?? null,
      bDisplay: b?.best_average ?? null,
      aValue: a?.best_average_value ?? null,
      bValue: b?.best_average_value ?? null,
      lowerBetter: true,
    },
    {
      label: "National rank (single)",
      aDisplay: rankDisplay(a?.single_rank),
      bDisplay: rankDisplay(b?.single_rank),
      aValue: a?.single_rank?.country ?? null,
      bValue: b?.single_rank?.country ?? null,
      lowerBetter: true,
    },
    {
      label: "Average solve",
      aDisplay: a?.average_solve ?? null,
      bDisplay: b?.average_solve ?? null,
      aValue: a?.average_solve_value ?? null,
      bValue: b?.average_solve_value ?? null,
      lowerBetter: true,
    },
    {
      label: "Consistency (σ)",
      aDisplay: a?.solve_std_dev ?? null,
      bDisplay: b?.solve_std_dev ?? null,
      aValue: a?.solve_std_dev_value ?? null,
      bValue: b?.solve_std_dev_value ?? null,
      lowerBetter: true,
    },
    {
      label: "DNF rate",
      aDisplay: a ? formatDnfRate(a) : null,
      bDisplay: b ? formatDnfRate(b) : null,
      aValue: a?.dnf_rate ?? null,
      bValue: b?.dnf_rate ?? null,
      lowerBetter: true,
    },
  ];

  const neutralRows: {
    label: string;
    aDisplay: string | null;
    bDisplay: string | null;
  }[] = [
    {
      label: "Competitions",
      aDisplay: a ? a.competition_count.toLocaleString() : null,
      bDisplay: b ? b.competition_count.toLocaleString() : null,
    },
    {
      label: "Official solves",
      aDisplay: a ? a.solve_count.toLocaleString() : null,
      bDisplay: b ? b.solve_count.toLocaleString() : null,
    },
  ];

  return (
    <section className="results-panel" aria-label="Stat comparison">
      <div className="panel-title-row">
        <h3>Stat comparison</h3>
      </div>
      <div className="results-table-wrap">
        <table className="results-table compare-table">
          <thead>
            <tr>
              <th>Metric</th>
              <th>{primaryName}</th>
              <th>{secondName}</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => {
              const winner = rowWinner(row.aValue, row.bValue, row.lowerBetter);
              return (
                <tr key={row.label}>
                  <td>{row.label}</td>
                  <td
                    className={`result-value${winner === "a" ? " win" : ""}`}
                  >
                    {row.aDisplay ?? "—"}
                  </td>
                  <td
                    className={`result-value${winner === "b" ? " win" : ""}`}
                  >
                    {row.bDisplay ?? "—"}
                  </td>
                </tr>
              );
            })}
            {neutralRows.map((row) => (
              <tr key={row.label}>
                <td>{row.label}</td>
                <td className="result-value">{row.aDisplay ?? "—"}</td>
                <td className="result-value">{row.bDisplay ?? "—"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function bestAverageProgression(
  points: ProgressionPoint[]
): ProgressionPoint[] {
  const progression: ProgressionPoint[] = [];
  let best = Infinity;

  for (const point of points) {
    if (
      typeof point.value === "number" &&
      Number.isFinite(point.value) &&
      point.value < best
    ) {
      best = point.value;
      progression.push(point);
    }
  }

  return progression;
}

function rankDisplay(rank?: RankPositions | null) {
  const country = rank?.country;
  return typeof country === "number" && country > 0
    ? `#${country.toLocaleString()} nat`
    : null;
}

function rowWinner(
  aValue: number | null,
  bValue: number | null,
  lowerBetter: boolean
): "a" | "b" | null {
  if (aValue === null || bValue === null || aValue === bValue) {
    return null;
  }

  const aBetter = lowerBetter ? aValue < bValue : aValue > bValue;
  return aBetter ? "a" : "b";
}
