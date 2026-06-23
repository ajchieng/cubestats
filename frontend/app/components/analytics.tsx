import { Fragment, useId, useMemo } from "react";
import type {
  ChartPoint,
  EventProgression,
} from "../lib/types";
import {
  formatDetailedValue,
  isDisplayableChartPoint,
} from "../lib/chart-utils";

const HEATMAP_MONTHS = [
  "Jan",
  "Feb",
  "Mar",
  "Apr",
  "May",
  "Jun",
  "Jul",
  "Aug",
  "Sep",
  "Oct",
  "Nov",
  "Dec",
];

export function MilestonesStrip({ event }: { event: EventProgression }) {
  const milestones = useMemo(() => buildMilestones(event), [event]);

  const cards: { label: string; value: string; detail?: string }[] = [];

  if (milestones.pbCount > 0) {
    cards.push({
      label: "Single PBs set",
      value: milestones.pbCount.toLocaleString(),
      detail: event.stats.current_pb
        ? `current single ${event.stats.current_pb}`
        : undefined,
    });
  }

  if (milestones.debutDate) {
    cards.push({
      label: "Competing since",
      value: monthYear(milestones.debutDate),
      detail: event.stats.latest_date
        ? `latest ${monthYear(event.stats.latest_date)}`
        : undefined,
    });
  }

  if (milestones.biggestDrop) {
    cards.push({
      label: "Biggest single drop",
      value: formatDelta(milestones.biggestDrop.delta, event.unit),
      detail: [
        milestones.biggestDrop.point.display,
        monthYear(milestones.biggestDrop.point.date),
      ]
        .filter(Boolean)
        .join(" · "),
    });
  }

  if (milestones.longestGap) {
    cards.push({
      label: "Longest gap between single PBs",
      value: formatGap(milestones.longestGap.days),
      detail: `${monthYear(milestones.longestGap.from.date)} → ${monthYear(
        milestones.longestGap.to.date
      )}`,
    });
  }

  if (cards.length === 0 && milestones.barriers.length === 0) {
    return null;
  }

  return (
    <section className="milestones-panel" aria-label="Records and milestones">
      <div className="panel-title-row">
        <h3>Records &amp; milestones</h3>
        <span className="unit-label">{event.name} singles</span>
      </div>

      <div className="milestones">
        {cards.map((card) => (
          <div className="milestone-card" key={card.label}>
            <p className="label">{card.label}</p>
            <p className="milestone-value">{card.value}</p>
            {card.detail ? (
              <p className="milestone-detail">{card.detail}</p>
            ) : null}
          </div>
        ))}
      </div>

      {milestones.barriers.length > 0 ? (
        <div className="barrier-row">
          {milestones.barriers.map((barrier) => (
            <span className="barrier-chip" key={barrier.threshold}>
              {barrierLabel(barrier.threshold, event.unit)}
              <span>{barrier.date ? monthYear(barrier.date) : "—"}</span>
            </span>
          ))}
        </div>
      ) : null}
    </section>
  );
}

function buildMilestones(event: EventProgression) {
  const points = event.pb_progression.filter(isDisplayableChartPoint);

  let biggestDrop: { delta: number; point: ChartPoint } | null = null;
  for (let index = 1; index < points.length; index += 1) {
    const delta = points[index - 1].value - points[index].value;
    if (delta > 0 && (biggestDrop === null || delta > biggestDrop.delta)) {
      biggestDrop = { delta, point: points[index] };
    }
  }

  const datedPoints = points.filter(
    (point): point is ChartPoint & { date: string } => Boolean(point.date)
  );

  let longestGap: { days: number; from: ChartPoint; to: ChartPoint } | null =
    null;
  for (let index = 1; index < datedPoints.length; index += 1) {
    const days = dayDiff(datedPoints[index - 1].date, datedPoints[index].date);
    if (days !== null && (longestGap === null || days > longestGap.days)) {
      longestGap = {
        days,
        from: datedPoints[index - 1],
        to: datedPoints[index],
      };
    }
  }

  const currentPb = event.stats.current_pb_value;
  const barriers =
    currentPb === null
      ? []
      : barrierThresholds(event.unit)
          .filter((threshold) => currentPb < threshold)
          .slice(0, 5)
          .map((threshold) => ({
            threshold,
            date:
              points.find((point) => point.value < threshold)?.date ?? null,
          }));

  return {
    pbCount: points.length,
    debutDate: event.stats.first_date,
    biggestDrop,
    longestGap,
    barriers,
  };
}

function barrierThresholds(unit: string): number[] {
  if (unit === "seconds") {
    return [4, 5, 6, 7, 8, 9, 10, 12, 15, 20, 30, 60];
  }

  if (unit === "moves") {
    return [20, 22, 24, 26, 28, 30, 35, 40];
  }

  return [];
}

function barrierLabel(threshold: number, unit: string) {
  if (unit === "moves") {
    return `sub-${threshold} moves`;
  }

  return `sub-${threshold}`;
}

function formatDelta(delta: number, unit: string) {
  if (unit === "seconds") {
    return delta < 60 ? `−${delta.toFixed(2)}s` : `−${formatDetailedValue(delta, unit)}`;
  }

  if (unit === "moves") {
    return `−${Number.isInteger(delta) ? delta : delta.toFixed(2)} moves`;
  }

  return `−${formatDetailedValue(delta, unit)}`;
}

function formatGap(days: number) {
  if (days < 30) {
    return `${Math.max(days, 0)}d`;
  }

  const months = Math.round(days / 30.44);
  if (months < 12) {
    return `${months}mo`;
  }

  const years = Math.floor(months / 12);
  const remainingMonths = months % 12;
  return remainingMonths ? `${years}y ${remainingMonths}mo` : `${years}y`;
}

function dayDiff(start: string, end: string) {
  const startTime = new Date(start).getTime();
  const endTime = new Date(end).getTime();

  if (!Number.isFinite(startTime) || !Number.isFinite(endTime)) {
    return null;
  }

  return Math.round((endTime - startTime) / 86_400_000);
}

function monthYear(date: string | null) {
  if (!date) {
    return "Unknown";
  }

  const parsed = new Date(date);
  if (Number.isNaN(parsed.getTime())) {
    return "Unknown";
  }

  return new Intl.DateTimeFormat("en", {
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  }).format(parsed);
}

export function ActivityHeatmap({ events }: { events: EventProgression[] }) {
  const data = useMemo(() => buildActivity(events), [events]);
  const descriptionId = useId();

  const header = (
    <div className="panel-title-row">
      <h3>Activity</h3>
      <span className="unit-label">solves / month · all events</span>
    </div>
  );

  if (!data) {
    return (
      <section className="chart-panel">
        {header}
        <p className="empty-state">No dated results to chart activity.</p>
      </section>
    );
  }

  const monthDetails = data.years.flatMap((year) =>
    HEATMAP_MONTHS.map((month, monthIndex) => {
      const key = `${year}-${String(monthIndex + 1).padStart(2, "0")}`;
      const entry = data.byMonth.get(key);
      const solves = entry?.solves ?? 0;
      const competitions = entry?.competitions ?? 0;
      const competitionText = competitions
        ? ` across ${competitions} competition${competitions === 1 ? "" : "s"}`
        : "";

      return `${month} ${year}: ${solves} solve${
        solves === 1 ? "" : "s"
      }${competitionText}.`;
    })
  );

  return (
    <section className="chart-panel">
      {header}

      <div className="heatmap-scroll">
        <div
          className="heatmap"
          role="img"
          aria-describedby={descriptionId}
          aria-label="Solves per month, all events"
        >
          <span className="heatmap-corner" />
          {HEATMAP_MONTHS.map((month) => (
            <span className="heatmap-month" key={month}>
              {month}
            </span>
          ))}

          {data.years.map((year) => (
            <Fragment key={year}>
              <span className="heatmap-year">{year}</span>
              {HEATMAP_MONTHS.map((month, monthIndex) => {
                const key = `${year}-${String(monthIndex + 1).padStart(2, "0")}`;
                const entry = data.byMonth.get(key);
                const solves = entry?.solves ?? 0;
                const competitions = entry?.competitions ?? 0;
                const detail = competitions
                  ? ` · ${competitions} comp${competitions === 1 ? "" : "s"}`
                  : "";

                return (
                  <span
                    aria-hidden="true"
                    className={`heatmap-cell heat-${heatLevel(
                      solves,
                      data.maxSolves
                    )}`}
                    key={key}
                    title={`${month} ${year} · ${solves} solve${
                      solves === 1 ? "" : "s"
                    }${detail}`}
                  />
                );
              })}
            </Fragment>
          ))}
        </div>
      </div>

      <ul className="sr-only" id={descriptionId}>
        {monthDetails.map((detail) => (
          <li key={detail}>{detail}</li>
        ))}
      </ul>

      <div className="heatmap-footer">
        <p className="heatmap-summary">
          {data.totalCompetitions.toLocaleString()} competition
          {data.totalCompetitions === 1 ? "" : "s"} · busiest {data.busiest.label}{" "}
          ({data.busiest.solves} solves)
        </p>
        <div className="heatmap-legend" aria-hidden="true">
          <span>Less</span>
          {[0, 1, 2, 3, 4].map((level) => (
            <span className={`heatmap-cell heat-${level}`} key={level} />
          ))}
          <span>More</span>
        </div>
      </div>
    </section>
  );
}

function buildActivity(events: EventProgression[]) {
  const byMonth = new Map<
    string,
    { solves: number; competitions: Set<string> }
  >();

  for (const event of events) {
    for (const row of event.result_rows) {
      if (!row.date) {
        continue;
      }

      const key = row.date.slice(0, 7);
      const entry =
        byMonth.get(key) ?? { solves: 0, competitions: new Set<string>() };

      for (const attempt of row.attempts) {
        if (attempt.raw_value > 0) {
          entry.solves += 1;
        }
      }
      if (row.competition_id) {
        entry.competitions.add(row.competition_id);
      }

      byMonth.set(key, entry);
    }
  }

  if (byMonth.size === 0) {
    return null;
  }

  const monthKeys = Array.from(byMonth.keys()).sort();
  const firstYear = Number(monthKeys[0].slice(0, 4));
  const lastYear = Number(monthKeys[monthKeys.length - 1].slice(0, 4));
  const years: number[] = [];
  for (let year = firstYear; year <= lastYear; year += 1) {
    years.push(year);
  }

  const monthCounts = new Map<
    string,
    { solves: number; competitions: number }
  >();
  const allCompetitions = new Set<string>();
  let maxSolves = 0;
  let busiest = { label: "—", solves: -1 };

  for (const [key, entry] of byMonth) {
    monthCounts.set(key, {
      solves: entry.solves,
      competitions: entry.competitions.size,
    });
    maxSolves = Math.max(maxSolves, entry.solves);

    if (entry.solves > busiest.solves) {
      const monthIndex = Number(key.slice(5, 7)) - 1;
      busiest = {
        label: `${HEATMAP_MONTHS[monthIndex]} ${key.slice(0, 4)}`,
        solves: entry.solves,
      };
    }

    for (const competition of entry.competitions) {
      allCompetitions.add(competition);
    }
  }

  return {
    years,
    byMonth: monthCounts,
    maxSolves,
    totalCompetitions: allCompetitions.size,
    busiest,
  };
}

function heatLevel(solves: number, maxSolves: number) {
  if (solves <= 0 || maxSolves <= 0) {
    return 0;
  }

  return Math.min(4, Math.ceil((solves / maxSolves) * 4));
}
