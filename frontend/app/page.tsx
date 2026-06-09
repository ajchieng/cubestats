"use client";

import {
  Fragment,
  type FormEvent,
  type ReactNode,
  useMemo,
  useState,
} from "react";

type RankPositions = {
  world: number | null;
  continent: number | null;
  country: number | null;
};

type EventStats = {
  competition_count: number;
  round_count: number;
  solve_count: number;
  average_solve: string | null;
  average_solve_value: number | null;
  median_solve: string | null;
  median_solve_value: number | null;
  current_pb: string | null;
  current_pb_value: number | null;
  best_average: string | null;
  best_average_value: number | null;
  single_rank: RankPositions | null;
  average_rank: RankPositions | null;
  solve_std_dev: string | null;
  solve_std_dev_value: number | null;
  worst_solve: string | null;
  worst_solve_value: number | null;
  dnf_count: number;
  attempt_count: number;
  dnf_rate: number | null;
  first_date: string | null;
  latest_date: string | null;
};

type ProgressionPoint = {
  date: string | null;
  competition_id: string;
  competition_name: string;
  round: string;
  format: string;
  raw_value: number;
  value: number | null;
  display: string | null;
  pb_number?: number | null;
  index?: number | null;
};

type ResultValue = {
  raw_value: number;
  value: number | null;
  display: string | null;
};

type ResultRow = {
  date: string | null;
  competition_id: string;
  competition_name: string;
  round: string;
  format: string;
  best: ResultValue;
  average: ResultValue;
  attempts: ResultValue[];
};

type EventProgression = {
  event_id: string;
  name: string;
  unit: "seconds" | "moves" | "score" | string;
  average_label: string;
  stats: EventStats;
  solve_values: number[];
  pb_progression: ProgressionPoint[];
  average_points: ProgressionPoint[];
  result_rows: ResultRow[];
};

type CompetitorProgression = {
  wca_id: string;
  name: string;
  events: EventProgression[];
};

type ApiErrorResponse = {
  detail?: string;
};

type ChartPoint = ProgressionPoint & {
  value: number;
};

type ChartMode = "date" | "index";
type AverageChartMode = "raw" | "1m" | "6m" | "1y";

type AverageChartConfig = {
  mode: ChartMode;
  points: ProgressionPoint[];
  chartWidth?: number;
  scroll?: boolean;
};

const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:8000";

const CHART_WIDTH = 860;
const CHART_HEIGHT = 330;
const HISTOGRAM_HEIGHT = 300;
const RAW_POINT_SPACING = 18;
const RAW_SCROLL_THRESHOLD = 45;
const RESULTS_PAGE_SIZE = 12;
const CHART_PADDING = {
  top: 24,
  right: 28,
  bottom: 54,
  left: 66,
};
const AVERAGE_CHART_OPTIONS: { mode: AverageChartMode; label: string }[] = [
  { mode: "raw", label: "Raw" },
  { mode: "1m", label: "1M" },
  { mode: "6m", label: "6M" },
  { mode: "1y", label: "1Y" },
];
const COMPARE_COLORS = ["#145f76", "#c2410c"] as const;
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

export default function Home() {
  const [wcaId, setWcaId] = useState("");
  const [compareId, setCompareId] = useState("");
  const [profile, setProfile] = useState<CompetitorProgression | null>(null);
  const [compareProfile, setCompareProfile] =
    useState<CompetitorProgression | null>(null);
  const [selectedEventId, setSelectedEventId] = useState("");
  const [averageChartMode, setAverageChartMode] =
    useState<AverageChartMode>("1m");
  const [resultsPage, setResultsPage] = useState(1);
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  const selectedEvent = useMemo(() => {
    if (!profile) {
      return null;
    }

    return (
      profile.events.find((event) => event.event_id === selectedEventId) ??
      profile.events[0] ??
      null
    );
  }, [profile, selectedEventId]);

  const averageChart = useMemo<AverageChartConfig | null>(() => {
    if (!selectedEvent) {
      return null;
    }

    return buildAverageChartConfig(
      selectedEvent.average_points,
      selectedEvent.unit,
      averageChartMode
    );
  }, [averageChartMode, selectedEvent]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const normalizedWcaId = wcaId.trim().toUpperCase();
    const normalizedCompareId = compareId.trim().toUpperCase();

    if (!normalizedWcaId) {
      setError("Enter a WCA ID to search.");
      setProfile(null);
      setCompareProfile(null);
      return;
    }

    setIsLoading(true);
    setError("");
    setProfile(null);
    setCompareProfile(null);

    const [primaryResult, compareResult] = await Promise.allSettled([
      fetchProgression(normalizedWcaId),
      normalizedCompareId
        ? fetchProgression(normalizedCompareId)
        : Promise.resolve(null),
    ]);

    if (primaryResult.status === "rejected") {
      setError(errorText(primaryResult.reason));
      setIsLoading(false);
      return;
    }

    const primary = primaryResult.value;
    setProfile(primary);
    setAverageChartMode("1m");
    setResultsPage(1);
    setSelectedEventId(
      primary.events.find((item) => item.event_id === "333")?.event_id ??
        primary.events[0]?.event_id ??
        ""
    );

    if (compareResult.status === "fulfilled") {
      setCompareProfile(compareResult.value);
    } else if (normalizedCompareId) {
      setError(
        `Couldn't load comparison ${normalizedCompareId}: ${errorText(
          compareResult.reason
        )}`
      );
    }

    setIsLoading(false);
  }

  return (
    <main className="page-shell">
      <section className="workspace">
        <header className="app-header">
          <div>
            <p className="eyebrow">Unofficial WCA analytics</p>
            <h1>Cubestats</h1>
          </div>

          <form className="search-form" onSubmit={handleSubmit}>
            <div className="search-fields">
              <div className="search-field">
                <label htmlFor="wca-id">WCA ID</label>
                <input
                  id="wca-id"
                  name="wca-id"
                  value={wcaId}
                  onChange={(event) => setWcaId(event.target.value)}
                  placeholder="2019CHIE01"
                  autoComplete="off"
                  spellCheck={false}
                />
              </div>
              <div className="search-field">
                <label htmlFor="compare-id">Compare with (optional)</label>
                <input
                  id="compare-id"
                  name="compare-id"
                  value={compareId}
                  onChange={(event) => setCompareId(event.target.value)}
                  placeholder="2016PARK06"
                  autoComplete="off"
                  spellCheck={false}
                />
              </div>
            </div>
            <button type="submit" disabled={isLoading}>
              {isLoading ? "Loading" : compareId.trim() ? "Compare" : "Search"}
            </button>
          </form>
        </header>

        {error ? <p className="message error">{error}</p> : null}
        {isLoading ? <p className="message">Loading progression data...</p> : null}

        {profile && compareProfile ? (
          <ComparisonDashboard
            primary={profile}
            secondary={compareProfile}
            selectedEventId={selectedEventId}
            onSelectEvent={setSelectedEventId}
          />
        ) : profile && selectedEvent ? (
          <section className="dashboard" aria-label="Competitor progression">
            <div className="summary-panel">
              <div>
                <p className="label">Competitor</p>
                <h2>{profile.name}</h2>
                <p className="muted">{profile.wca_id}</p>
              </div>

              <div className="event-picker">
                <label htmlFor="event-id">Event</label>
                <select
                  id="event-id"
                  value={selectedEvent.event_id}
                  onChange={(event) => {
                    setSelectedEventId(event.target.value);
                    setResultsPage(1);
                  }}
                >
                  {profile.events.map((event) => (
                    <option key={event.event_id} value={event.event_id}>
                      {event.name}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="stat-grid">
              <Metric
                label="Current PB"
                value={selectedEvent.stats.current_pb}
                rank={selectedEvent.stats.single_rank}
              />
              <Metric
                label={`Best ${selectedEvent.average_label}`}
                value={selectedEvent.stats.best_average}
                rank={selectedEvent.stats.average_rank}
              />
              <Metric
                label="Average solve"
                value={selectedEvent.stats.average_solve}
              />
              <Metric
                label="Median solve"
                value={selectedEvent.stats.median_solve}
              />
              <Metric
                label="Consistency (σ)"
                value={selectedEvent.stats.solve_std_dev}
              />
              <Metric
                label="Worst single"
                value={selectedEvent.stats.worst_solve}
              />
              <Metric
                label="DNF rate"
                value={formatDnfRate(selectedEvent.stats)}
              />
              <Metric
                label="Competitions"
                value={selectedEvent.stats.competition_count.toLocaleString()}
              />
              <Metric
                label="Official solves"
                value={selectedEvent.stats.solve_count.toLocaleString()}
              />
            </div>

            <MilestonesStrip event={selectedEvent} />

            <div className="charts-grid">
              <SeriesChart
                title="PB progression"
                mode="date"
                unit={selectedEvent.unit}
                points={selectedEvent.pb_progression}
                showFit
                emptyLabel="No dated PB progression points."
              />
              <SeriesChart
                title={`${selectedEvent.average_label} results`}
                mode={averageChart?.mode ?? "date"}
                unit={selectedEvent.unit}
                points={averageChart?.points ?? []}
                chartWidth={averageChart?.chartWidth}
                scroll={averageChart?.scroll}
                controls={
                  <div
                    className="segmented-control"
                    role="group"
                    aria-label={`${selectedEvent.average_label} chart mode`}
                  >
                    {AVERAGE_CHART_OPTIONS.map((option) => (
                      <button
                        aria-pressed={averageChartMode === option.mode}
                        className={
                          averageChartMode === option.mode ? "active" : ""
                        }
                        key={option.mode}
                        onClick={() => setAverageChartMode(option.mode)}
                        type="button"
                      >
                        {option.label}
                      </button>
                    ))}
                  </div>
                }
                emptyLabel={`No official ${selectedEvent.average_label} results.`}
              />
            </div>

            <SolveHistogram
              unit={selectedEvent.unit}
              values={selectedEvent.solve_values}
              meanValue={selectedEvent.stats.average_solve_value}
            />

            <ActivityHeatmap events={profile.events} />

            <ResultsTable
              eventData={selectedEvent}
              page={resultsPage}
              onPageChange={setResultsPage}
            />
          </section>
        ) : null}
      </section>
    </main>
  );
}

function ResultsTable({
  eventData,
  page,
  onPageChange,
}: {
  eventData: EventProgression;
  page: number;
  onPageChange: (page: number) => void;
}) {
  const rows = eventData.result_rows ?? [];
  const totalPages = Math.max(1, Math.ceil(rows.length / RESULTS_PAGE_SIZE));
  const currentPage = Math.min(page, totalPages);
  const startIndex = (currentPage - 1) * RESULTS_PAGE_SIZE;
  const visibleRows = rows.slice(startIndex, startIndex + RESULTS_PAGE_SIZE);

  return (
    <section className="results-panel" aria-label={`${eventData.name} results`}>
      <div className="panel-title-row">
        <h3>Results</h3>
        <span className="unit-label">
          {rows.length.toLocaleString()} round{rows.length === 1 ? "" : "s"}
        </span>
      </div>

      {rows.length === 0 ? (
        <p className="empty-state">No official round results for this event.</p>
      ) : (
        <>
          <div className="results-table-wrap">
            <table className="results-table">
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Competition</th>
                  <th>Round</th>
                  <th>Format</th>
                  <th>Best</th>
                  <th>Average</th>
                  {Array.from({ length: 5 }, (_, index) => (
                    <th key={`solve-head-${index}`}>Solve {index + 1}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {visibleRows.map((row) => {
                  const droppedAttempts = droppedAo5AttemptIndexes(row);

                  return (
                    <tr key={`${row.competition_id}-${row.round}-${row.format}`}>
                      <td className="nowrap">{row.date ?? "N/A"}</td>
                      <td>
                        <div className="competition-cell">
                          <span>{row.competition_name}</span>
                          <span>{row.competition_id}</span>
                        </div>
                      </td>
                      <td>{row.round}</td>
                      <td>{row.format || "N/A"}</td>
                      <td className="result-value">
                        {displayResultValue(row.best)}
                      </td>
                      <td className="result-value">
                        {displayResultValue(row.average)}
                      </td>
                      {Array.from({ length: 5 }, (_, index) => {
                        const attempt = row.attempts[index];
                        const isDropped = droppedAttempts.has(index);
                        const color = solveValueColor(
                          attempt?.value ?? null,
                          eventData.stats
                        );

                        return (
                          <td
                            className={
                              isDropped
                                ? "result-value dropped-attempt"
                                : "result-value"
                            }
                            key={`${row.competition_id}-${row.round}-attempt-${index}`}
                            style={color ? { color } : undefined}
                          >
                            {displayAttemptValue(attempt, isDropped)}
                          </td>
                        );
                      })}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {totalPages > 1 ? (
            <div className="pagination-controls">
              <button
                type="button"
                disabled={currentPage === 1}
                onClick={() => onPageChange(currentPage - 1)}
              >
                Previous
              </button>
              <span>
                Page {currentPage} of {totalPages}
              </span>
              <button
                type="button"
                disabled={currentPage === totalPages}
                onClick={() => onPageChange(currentPage + 1)}
              >
                Next
              </button>
            </div>
          ) : null}
        </>
      )}
    </section>
  );
}

function Metric({
  label,
  value,
  rank,
}: {
  label: string;
  value: string | number | null | undefined;
  rank?: RankPositions | null;
}) {
  return (
    <div className="metric">
      <p className="label">{label}</p>
      <p className="metric-value">{value ?? "N/A"}</p>
      <RankBadges rank={rank} />
    </div>
  );
}

function RankBadges({ rank }: { rank?: RankPositions | null }) {
  if (!rank) {
    return null;
  }

  const badges = [
    { key: "NR", value: rank.country },
    { key: "CR", value: rank.continent },
    { key: "WR", value: rank.world },
  ].filter(
    (badge): badge is { key: string; value: number } =>
      typeof badge.value === "number" && badge.value > 0
  );

  if (badges.length === 0) {
    return null;
  }

  return (
    <div className="rank-badges">
      {badges.map((badge) => (
        <span className="rank-badge" key={badge.key}>
          <span className="rank-badge-key">{badge.key}</span>
          {badge.value.toLocaleString()}
        </span>
      ))}
    </div>
  );
}

function SeriesChart({
  title,
  mode,
  unit,
  points,
  showFit = false,
  chartWidth = CHART_WIDTH,
  scroll = false,
  controls,
  emptyLabel,
}: {
  title: string;
  mode: ChartMode;
  unit: string;
  points: ProgressionPoint[];
  showFit?: boolean;
  chartWidth?: number;
  scroll?: boolean;
  controls?: ReactNode;
  emptyLabel: string;
}) {
  const chartPoints = points.filter(
    (point): point is ChartPoint =>
      typeof point.value === "number" &&
      Number.isFinite(point.value) &&
      (mode === "index" || Boolean(point.date))
  );

  if (chartPoints.length === 0) {
    return (
      <section className="chart-panel">
        <div className="panel-title-row">
          <h3>{title}</h3>
          <div className="panel-actions">
            {controls}
            <span className="unit-label">{unitLabel(unit)}</span>
          </div>
        </div>
        <p className="empty-state">{emptyLabel}</p>
      </section>
    );
  }

  const xValues = chartPoints.map((point, pointIndex) =>
    mode === "date"
      ? new Date(point.date as string).getTime()
      : point.index ?? pointIndex + 1
  );
  const yValues = chartPoints.map((point) => point.value);
  const minX = Math.min(...xValues);
  const maxX = Math.max(...xValues);
  const minY = Math.min(...yValues);
  const maxY = Math.max(...yValues);
  const yPadding = Math.max((maxY - minY) * 0.14, unit === "seconds" ? 0.8 : 1);
  const chartMinY = Math.max(0, minY - yPadding);
  const chartMaxY = maxY + yPadding;

  const plotWidth = chartWidth - CHART_PADDING.left - CHART_PADDING.right;
  const plotHeight = CHART_HEIGHT - CHART_PADDING.top - CHART_PADDING.bottom;

  function scaleX(value: number) {
    if (minX === maxX) {
      return CHART_PADDING.left + plotWidth / 2;
    }

    return CHART_PADDING.left + ((value - minX) / (maxX - minX)) * plotWidth;
  }

  function scaleY(value: number) {
    if (chartMinY === chartMaxY) {
      return CHART_PADDING.top + plotHeight / 2;
    }

    return (
      CHART_PADDING.top +
      ((value - chartMinY) / (chartMaxY - chartMinY)) * plotHeight
    );
  }

  const linePath = chartPoints
    .map((point, pointIndex) => {
      const command = pointIndex === 0 ? "M" : "L";
      return `${command} ${scaleX(xValues[pointIndex]).toFixed(2)} ${scaleY(
        point.value
      ).toFixed(2)}`;
    })
    .join(" ");

  const fitPath =
    showFit && chartPoints.length >= 2
      ? buildFitPath(xValues, yValues, scaleX, scaleY)
      : "";
  const xTicks = buildXTicks(minX, maxX, mode);
  const yTicks = buildYTicks(chartMinY, chartMaxY);

  const chartSvg = (
    <svg
      aria-label={title}
      className={`chart${scroll ? " chart-wide" : ""}`}
      role="img"
      style={scroll ? { width: chartWidth } : undefined}
      viewBox={`0 0 ${chartWidth} ${CHART_HEIGHT}`}
    >
      <line
        className="axis"
        x1={CHART_PADDING.left}
        y1={CHART_PADDING.top}
        x2={CHART_PADDING.left}
        y2={CHART_HEIGHT - CHART_PADDING.bottom}
      />
      <line
        className="axis"
        x1={CHART_PADDING.left}
        y1={CHART_HEIGHT - CHART_PADDING.bottom}
        x2={chartWidth - CHART_PADDING.right}
        y2={CHART_HEIGHT - CHART_PADDING.bottom}
      />

      {yTicks.map((tick) => (
        <g key={`y-${tick}`}>
          <line
            className="grid-line"
            x1={CHART_PADDING.left}
            y1={scaleY(tick)}
            x2={chartWidth - CHART_PADDING.right}
            y2={scaleY(tick)}
          />
          <text
            className="axis-label"
            x={CHART_PADDING.left - 12}
            y={scaleY(tick) + 4}
            textAnchor="end"
          >
            {formatAxisValue(tick, unit)}
          </text>
        </g>
      ))}

      {xTicks.map((tick) => (
        <text
          className="axis-label"
          key={`x-${tick}`}
          x={scaleX(tick)}
          y={CHART_HEIGHT - 18}
          textAnchor="middle"
        >
          {formatXTick(tick, mode)}
        </text>
      ))}

      {fitPath ? <path className="fit-line" d={fitPath} /> : null}
      <path className="data-line" d={linePath} />

      {chartPoints.map((point, pointIndex) => (
        <circle
          className="data-point"
          key={`${point.competition_id}-${point.round}-${pointIndex}`}
          cx={scaleX(xValues[pointIndex])}
          cy={scaleY(point.value)}
          r="4.5"
        >
          <title>{chartPointTitle(point)}</title>
        </circle>
      ))}
    </svg>
  );

  return (
    <section className="chart-panel">
      <div className="panel-title-row">
        <h3>{title}</h3>
        <div className="panel-actions">
          {controls}
          <span className="unit-label">{unitLabel(unit)}</span>
        </div>
      </div>

      {scroll ? <div className="chart-scroll">{chartSvg}</div> : chartSvg}
    </section>
  );
}

function ComparisonDashboard({
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

type ComparisonSeries = {
  name: string;
  color: string;
  points: ProgressionPoint[];
};

function ComparisonChart({
  title,
  unit,
  series,
}: {
  title: string;
  unit: string;
  series: ComparisonSeries[];
}) {
  const prepared = series.map((entry) => ({
    name: entry.name,
    color: entry.color,
    chartPoints: entry.points.filter(
      (point): point is ChartPoint =>
        typeof point.value === "number" &&
        Number.isFinite(point.value) &&
        Boolean(point.date)
    ),
  }));
  const allPoints = prepared.flatMap((entry) => entry.chartPoints);

  const legend = (
    <div className="chart-legend">
      {prepared.map((entry) => (
        <span className="legend-item" key={entry.name}>
          <span
            className="legend-swatch"
            style={{ background: entry.color }}
          />
          {entry.name}
        </span>
      ))}
    </div>
  );

  if (allPoints.length === 0) {
    return (
      <section className="chart-panel">
        <div className="panel-title-row">
          <h3>{title}</h3>
          <div className="panel-actions">
            {legend}
            <span className="unit-label">{unitLabel(unit)}</span>
          </div>
        </div>
        <p className="empty-state">No shared data to compare for this event.</p>
      </section>
    );
  }

  const xValues = allPoints.map((point) =>
    new Date(point.date as string).getTime()
  );
  const yValues = allPoints.map((point) => point.value);
  const minX = Math.min(...xValues);
  const maxX = Math.max(...xValues);
  const minY = Math.min(...yValues);
  const maxY = Math.max(...yValues);
  const yPadding = Math.max((maxY - minY) * 0.14, unit === "seconds" ? 0.8 : 1);
  const chartMinY = Math.max(0, minY - yPadding);
  const chartMaxY = maxY + yPadding;
  const plotWidth = CHART_WIDTH - CHART_PADDING.left - CHART_PADDING.right;
  const plotHeight = CHART_HEIGHT - CHART_PADDING.top - CHART_PADDING.bottom;

  function scaleX(value: number) {
    if (minX === maxX) {
      return CHART_PADDING.left + plotWidth / 2;
    }
    return CHART_PADDING.left + ((value - minX) / (maxX - minX)) * plotWidth;
  }

  function scaleY(value: number) {
    if (chartMinY === chartMaxY) {
      return CHART_PADDING.top + plotHeight / 2;
    }
    return (
      CHART_PADDING.top +
      ((value - chartMinY) / (chartMaxY - chartMinY)) * plotHeight
    );
  }

  const xTicks = buildXTicks(minX, maxX, "date");
  const yTicks = buildYTicks(chartMinY, chartMaxY);

  return (
    <section className="chart-panel">
      <div className="panel-title-row">
        <h3>{title}</h3>
        <div className="panel-actions">
          {legend}
          <span className="unit-label">{unitLabel(unit)}</span>
        </div>
      </div>
      <svg
        aria-label={title}
        className="chart"
        role="img"
        viewBox={`0 0 ${CHART_WIDTH} ${CHART_HEIGHT}`}
      >
        <line
          className="axis"
          x1={CHART_PADDING.left}
          y1={CHART_PADDING.top}
          x2={CHART_PADDING.left}
          y2={CHART_HEIGHT - CHART_PADDING.bottom}
        />
        <line
          className="axis"
          x1={CHART_PADDING.left}
          y1={CHART_HEIGHT - CHART_PADDING.bottom}
          x2={CHART_WIDTH - CHART_PADDING.right}
          y2={CHART_HEIGHT - CHART_PADDING.bottom}
        />

        {yTicks.map((tick) => (
          <g key={`y-${tick}`}>
            <line
              className="grid-line"
              x1={CHART_PADDING.left}
              y1={scaleY(tick)}
              x2={CHART_WIDTH - CHART_PADDING.right}
              y2={scaleY(tick)}
            />
            <text
              className="axis-label"
              x={CHART_PADDING.left - 12}
              y={scaleY(tick) + 4}
              textAnchor="end"
            >
              {formatAxisValue(tick, unit)}
            </text>
          </g>
        ))}

        {xTicks.map((tick) => (
          <text
            className="axis-label"
            key={`x-${tick}`}
            x={scaleX(tick)}
            y={CHART_HEIGHT - 18}
            textAnchor="middle"
          >
            {formatXTick(tick, "date")}
          </text>
        ))}

        {prepared.map((entry) => {
          if (entry.chartPoints.length === 0) {
            return null;
          }

          const linePath = entry.chartPoints
            .map((point, pointIndex) => {
              const command = pointIndex === 0 ? "M" : "L";
              return `${command} ${scaleX(
                new Date(point.date as string).getTime()
              ).toFixed(2)} ${scaleY(point.value).toFixed(2)}`;
            })
            .join(" ");

          return (
            <g key={entry.name}>
              <path
                className="data-line"
                style={{ stroke: entry.color }}
                d={linePath}
              />
              {entry.chartPoints.map((point, pointIndex) => (
                <circle
                  className="data-point"
                  key={`${entry.name}-${pointIndex}`}
                  cx={scaleX(new Date(point.date as string).getTime())}
                  cy={scaleY(point.value)}
                  r="4"
                  style={{ stroke: entry.color }}
                >
                  <title>{`${entry.name} | ${chartPointTitle(point)}`}</title>
                </circle>
              ))}
            </g>
          );
        })}
      </svg>
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

function MilestonesStrip({ event }: { event: EventProgression }) {
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

function ActivityHeatmap({ events }: { events: EventProgression[] }) {
  const data = useMemo(() => buildActivity(events), [events]);

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

  return (
    <section className="chart-panel">
      {header}

      <div className="heatmap-scroll">
        <div className="heatmap" role="img" aria-label="Solves per month, all events">
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

function SolveHistogram({
  unit,
  values,
  meanValue,
}: {
  unit: string;
  values: number[];
  meanValue: number | null;
}) {
  const finiteValues = values.filter(
    (value) => typeof value === "number" && Number.isFinite(value)
  );

  const header = (
    <div className="panel-title-row">
      <h3>Solve distribution</h3>
      <span className="unit-label">{unitLabel(unit)}</span>
    </div>
  );

  if (finiteValues.length < 2) {
    return (
      <section className="chart-panel">
        {header}
        <p className="empty-state">Not enough solves to chart a distribution.</p>
      </section>
    );
  }

  const minValue = Math.min(...finiteValues);
  const maxValue = Math.max(...finiteValues);
  const span = maxValue - minValue || 1;
  const bucketCount = Math.max(
    6,
    Math.min(24, Math.round(Math.sqrt(finiteValues.length)))
  );
  const bucketWidth = span / bucketCount;

  const buckets = Array.from({ length: bucketCount }, (_, index) => ({
    start: minValue + index * bucketWidth,
    end: minValue + (index + 1) * bucketWidth,
    count: 0,
  }));

  for (const value of finiteValues) {
    const bucketIndex = Math.min(
      bucketCount - 1,
      Math.floor(((value - minValue) / span) * bucketCount)
    );
    buckets[bucketIndex].count += 1;
  }

  const maxCount = Math.max(...buckets.map((bucket) => bucket.count));
  const plotWidth = CHART_WIDTH - CHART_PADDING.left - CHART_PADDING.right;
  const plotHeight =
    HISTOGRAM_HEIGHT - CHART_PADDING.top - CHART_PADDING.bottom;
  const baseline = HISTOGRAM_HEIGHT - CHART_PADDING.bottom;
  const slotWidth = plotWidth / bucketCount;
  const barGap = Math.min(6, slotWidth * 0.18);

  function valueToX(value: number) {
    const clamped = Math.max(minValue, Math.min(maxValue, value));
    return CHART_PADDING.left + ((clamped - minValue) / span) * plotWidth;
  }

  const countTicks = Array.from(
    new Set(buildYTicks(0, maxCount).map((tick) => Math.round(tick)))
  );
  const xTicks = Array.from({ length: bucketCount + 1 }, (_, index) =>
    index === bucketCount ? maxValue : minValue + index * bucketWidth
  ).filter((_, index) => index % Math.ceil(bucketCount / 5) === 0);

  const showMean =
    typeof meanValue === "number" &&
    Number.isFinite(meanValue) &&
    meanValue >= minValue &&
    meanValue <= maxValue;

  return (
    <section className="chart-panel">
      {header}
      <svg
        aria-label="Solve time distribution"
        className="chart"
        role="img"
        viewBox={`0 0 ${CHART_WIDTH} ${HISTOGRAM_HEIGHT}`}
      >
        <line
          className="axis"
          x1={CHART_PADDING.left}
          y1={CHART_PADDING.top}
          x2={CHART_PADDING.left}
          y2={baseline}
        />
        <line
          className="axis"
          x1={CHART_PADDING.left}
          y1={baseline}
          x2={CHART_WIDTH - CHART_PADDING.right}
          y2={baseline}
        />

        {countTicks.map((tick) => {
          const y =
            maxCount === 0
              ? baseline
              : baseline - (tick / maxCount) * plotHeight;
          return (
            <g key={`count-${tick}`}>
              <line
                className="grid-line"
                x1={CHART_PADDING.left}
                y1={y}
                x2={CHART_WIDTH - CHART_PADDING.right}
                y2={y}
              />
              <text
                className="axis-label"
                x={CHART_PADDING.left - 12}
                y={y + 4}
                textAnchor="end"
              >
                {tick}
              </text>
            </g>
          );
        })}

        {buckets.map((bucket, index) => {
          const height =
            maxCount === 0 ? 0 : (bucket.count / maxCount) * plotHeight;
          const x = CHART_PADDING.left + index * slotWidth + barGap / 2;
          const width = Math.max(1, slotWidth - barGap);

          return (
            <rect
              className="histogram-bar"
              key={`bucket-${index}`}
              x={x}
              y={baseline - height}
              width={width}
              height={height}
              rx={3}
            >
              <title>
                {`${formatDetailedValue(bucket.start, unit)} – ${formatDetailedValue(
                  bucket.end,
                  unit
                )} | ${bucket.count} solve${bucket.count === 1 ? "" : "s"}`}
              </title>
            </rect>
          );
        })}

        {xTicks.map((tick, index) => (
          <text
            className="axis-label"
            key={`x-${index}`}
            x={valueToX(tick)}
            y={HISTOGRAM_HEIGHT - 18}
            textAnchor="middle"
          >
            {formatAxisValue(tick, unit)}
          </text>
        ))}

        {showMean ? (
          <g>
            <line
              className="fit-line"
              x1={valueToX(meanValue as number)}
              y1={CHART_PADDING.top}
              x2={valueToX(meanValue as number)}
              y2={baseline}
            />
            <text
              className="axis-label marker-label"
              x={valueToX(meanValue as number)}
              y={CHART_PADDING.top - 8}
              textAnchor="middle"
            >
              mean
            </text>
          </g>
        ) : null}
      </svg>
    </section>
  );
}

function formatDnfRate(stats: EventStats) {
  if (stats.dnf_rate === null || stats.attempt_count === 0) {
    return "N/A";
  }

  return `${(stats.dnf_rate * 100).toFixed(1)}% (${stats.dnf_count}/${stats.attempt_count})`;
}

function displayResultValue(result: ResultValue) {
  return result.display ?? "";
}

function displayAttemptValue(
  attempt: ResultValue | undefined,
  isDropped: boolean
) {
  const display = attempt?.display ?? "";

  if (!display || !isDropped) {
    return display;
  }

  return `(${display})`;
}

function solveValueColor(
  value: number | null,
  stats: EventStats
): string | undefined {
  const median = stats.median_solve_value;

  if (value === null || !Number.isFinite(value) || median === null) {
    return undefined;
  }

  const best = stats.current_pb_value ?? median;
  const worst = stats.worst_solve_value ?? median;
  const sigma = stats.solve_std_dev_value;
  const scale =
    sigma && sigma > 0
      ? 2 * sigma
      : Math.max(median - best, worst - median, 0);

  // t = 0 at the median (darkest), 1 at the extremes (lightest).
  const distance = Math.abs(value - median);
  const t = scale > 0 ? Math.min(1, distance / scale) : 0;

  if (value <= median) {
    // Faster than the median is better -> green, lighter the better it is.
    return `hsl(142, 68%, ${(24 + t * 20).toFixed(1)}%)`;
  }

  // Slower than the median -> red, lighter the further from the median.
  return `hsl(4, 74%, ${(32 + t * 22).toFixed(1)}%)`;
}

function droppedAo5AttemptIndexes(row: ResultRow) {
  const dropped = new Set<number>();

  if (!row.format.includes("Average of 5") || row.attempts.length < 5) {
    return dropped;
  }

  const attempts = row.attempts.slice(0, 5);
  const positiveAttempts = attempts
    .map((attempt, index) => ({ index, rawValue: attempt.raw_value }))
    .filter((attempt) => attempt.rawValue > 0);

  if (positiveAttempts.length < 4) {
    return dropped;
  }

  const fastest = positiveAttempts.reduce((best, attempt) =>
    attempt.rawValue < best.rawValue ? attempt : best
  );
  const dnfAttempt = attempts
    .map((attempt, index) => ({ index, rawValue: attempt.raw_value }))
    .find((attempt) => attempt.rawValue === -1);
  const slowest =
    dnfAttempt ??
    positiveAttempts.reduce((worst, attempt) =>
      attempt.rawValue > worst.rawValue ? attempt : worst
    );

  dropped.add(fastest.index);
  dropped.add(slowest.index);

  return dropped;
}

function buildAverageChartConfig(
  points: ProgressionPoint[],
  unit: string,
  mode: AverageChartMode
): AverageChartConfig {
  if (mode === "raw") {
    const rawPoints = points.filter(isDisplayableChartPoint);
    const chartWidth =
      rawPoints.length > RAW_SCROLL_THRESHOLD
        ? Math.max(
            CHART_WIDTH,
            CHART_PADDING.left +
              CHART_PADDING.right +
              (rawPoints.length - 1) * RAW_POINT_SPACING
          )
        : CHART_WIDTH;

    return {
      mode: "index",
      points: rawPoints,
      chartWidth,
      scroll: chartWidth > CHART_WIDTH,
    };
  }

  return {
    mode: "date",
    points: bucketAveragePoints(points, unit, mode),
  };
}

function isDisplayableChartPoint(
  point: ProgressionPoint
): point is ChartPoint {
  return typeof point.value === "number" && Number.isFinite(point.value);
}

function bucketAveragePoints(
  points: ProgressionPoint[],
  unit: string,
  mode: Exclude<AverageChartMode, "raw">
) {
  const buckets = new Map<
    string,
    {
      label: string;
      startDate: string;
      values: number[];
      rawValues: number[];
      dates: string[];
    }
  >();

  for (const point of points) {
    if (!isDisplayableChartPoint(point) || !point.date) {
      continue;
    }

    const bucket = averageBucketForDate(point.date, mode);
    if (!bucket) {
      continue;
    }

    const current =
      buckets.get(bucket.key) ??
      {
        label: bucket.label,
        startDate: bucket.startDate,
        values: [],
        rawValues: [],
        dates: [],
      };

    current.values.push(point.value);
    current.rawValues.push(point.raw_value);
    current.dates.push(point.date);
    buckets.set(bucket.key, current);
  }

  return Array.from(buckets.values())
    .sort((left, right) => left.startDate.localeCompare(right.startDate))
    .map((bucket, index): ProgressionPoint => {
      const meanValue = average(bucket.values);
      const sortedDates = [...bucket.dates].sort();
      const firstDate = sortedDates[0];
      const latestDate = sortedDates[sortedDates.length - 1];

      return {
        date: bucket.startDate,
        competition_id: bucket.label,
        competition_name: `${bucket.label} mean`,
        round: `${bucket.values.length} result${
          bucket.values.length === 1 ? "" : "s"
        }`,
        format:
          firstDate === latestDate ? firstDate : `${firstDate} to ${latestDate}`,
        raw_value: Math.round(average(bucket.rawValues)),
        value: meanValue,
        display: `${bucket.label}: ${formatDetailedValue(meanValue, unit)}`,
        index: index + 1,
      };
    });
}

function averageBucketForDate(
  dateValue: string,
  mode: Exclude<AverageChartMode, "raw">
) {
  const [yearPart, monthPart] = dateValue.split("-");
  const year = Number(yearPart);
  const monthIndex = Number(monthPart) - 1;

  if (!Number.isInteger(year) || !Number.isInteger(monthIndex)) {
    return null;
  }

  if (mode === "1m") {
    return {
      key: `${year}-${String(monthIndex + 1).padStart(2, "0")}`,
      label: new Intl.DateTimeFormat("en", {
        month: "short",
        year: "numeric",
      }).format(new Date(Date.UTC(year, monthIndex, 1))),
      startDate: `${year}-${String(monthIndex + 1).padStart(2, "0")}-01`,
    };
  }

  if (mode === "6m") {
    const halfStartMonth = monthIndex < 6 ? 0 : 6;
    const halfLabel = halfStartMonth === 0 ? "Jan-Jun" : "Jul-Dec";

    return {
      key: `${year}-h${halfStartMonth === 0 ? "1" : "2"}`,
      label: `${halfLabel} ${year}`,
      startDate: `${year}-${String(halfStartMonth + 1).padStart(2, "0")}-01`,
    };
  }

  return {
    key: `${year}`,
    label: `${year}`,
    startDate: `${year}-01-01`,
  };
}

function chartPointTitle(point: ChartPoint) {
  return [
    point.display,
    point.date,
    point.competition_name,
    point.round,
    point.format,
  ]
    .filter(Boolean)
    .join(" | ");
}

async function fetchProgression(
  wcaId: string
): Promise<CompetitorProgression> {
  const response = await fetch(
    `${API_BASE_URL}/api/competitor/${encodeURIComponent(wcaId)}/progression`
  );
  const data = (await response.json().catch(() => null)) as
    | CompetitorProgression
    | ApiErrorResponse
    | null;

  if (!response.ok) {
    throw new Error(getErrorMessage(data, response.status));
  }

  return data as CompetitorProgression;
}

function errorText(reason: unknown) {
  return reason instanceof Error
    ? reason.message
    : "Something went wrong while building the progression.";
}

function getErrorMessage(
  data: CompetitorProgression | ApiErrorResponse | null,
  status: number
) {
  if (data && "detail" in data && data.detail) {
    return data.detail;
  }

  if (status === 404) {
    return "No matching competitor results were found.";
  }

  if (status === 400) {
    return "That WCA ID does not look valid.";
  }

  return "The backend could not complete the progression search.";
}

function buildXTicks(minX: number, maxX: number, mode: ChartMode) {
  if (minX === maxX) {
    return [minX];
  }

  if (mode === "index") {
    const middle = Math.round((minX + maxX) / 2);
    return Array.from(new Set([minX, middle, maxX]));
  }

  return [minX, minX + (maxX - minX) / 2, maxX];
}

function buildYTicks(minY: number, maxY: number) {
  if (minY === maxY) {
    return [minY];
  }

  return [minY, minY + (maxY - minY) / 2, maxY];
}

function formatXTick(value: number, mode: ChartMode) {
  if (mode === "index") {
    return `${Math.round(value)}`;
  }

  return new Intl.DateTimeFormat("en", {
    month: "short",
    year: "numeric",
  }).format(new Date(value));
}

function formatAxisValue(value: number, unit: string) {
  if (unit === "seconds") {
    if (value < 60) {
      return value.toFixed(1);
    }

    const minutes = Math.floor(value / 60);
    const seconds = value - minutes * 60;
    return `${minutes}:${seconds.toFixed(0).padStart(2, "0")}`;
  }

  if (unit === "moves") {
    return value.toFixed(value < 10 ? 1 : 0);
  }

  return value.toFixed(0);
}

function formatDetailedValue(value: number, unit: string) {
  if (unit === "seconds") {
    if (value < 60) {
      return value.toFixed(2);
    }

    const minutes = Math.floor(value / 60);
    const seconds = value - minutes * 60;
    return `${minutes}:${seconds.toFixed(2).padStart(5, "0")}`;
  }

  if (unit === "moves") {
    return value.toFixed(2);
  }

  return value.toFixed(0);
}

function unitLabel(unit: string) {
  if (unit === "seconds") {
    return "time";
  }

  if (unit === "moves") {
    return "moves";
  }

  return "score";
}

function buildFitPath(
  xs: number[],
  ys: number[],
  scaleX: (value: number) => number,
  scaleY: (value: number) => number
) {
  const minX = Math.min(...xs);
  const maxX = Math.max(...xs);
  const rangeX = maxX - minX || 1;
  const normalizedXs = xs.map((xValue) => (xValue - minX) / rangeX);
  const linear = fitLinear(normalizedXs, ys);
  const quadratic = fitQuadratic(normalizedXs, ys);
  const model =
    quadratic && quadratic.r2 - linear.r2 > 0.06 ? quadratic : linear;
  const samples = 80;
  const pathParts: string[] = [];

  for (let index = 0; index < samples; index += 1) {
    const normalizedX = index / (samples - 1);
    const actualX = minX + normalizedX * rangeX;
    const yValue = model.predict(normalizedX);
    const command = index === 0 ? "M" : "L";
    pathParts.push(
      `${command} ${scaleX(actualX).toFixed(2)} ${scaleY(yValue).toFixed(2)}`
    );
  }

  return pathParts.join(" ");
}

function fitLinear(xs: number[], ys: number[]) {
  const xMean = average(xs);
  const yMean = average(ys);
  const numerator = xs.reduce(
    (total, xValue, index) => total + (xValue - xMean) * (ys[index] - yMean),
    0
  );
  const denominator = xs.reduce(
    (total, xValue) => total + Math.pow(xValue - xMean, 2),
    0
  );
  const slope = denominator === 0 ? 0 : numerator / denominator;
  const intercept = yMean - slope * xMean;
  const predict = (xValue: number) => intercept + slope * xValue;

  return {
    predict,
    r2: rSquared(xs, ys, predict),
  };
}

function fitQuadratic(xs: number[], ys: number[]) {
  if (xs.length < 4) {
    return null;
  }

  const n = xs.length;
  const sumX = sum(xs);
  const sumX2 = sum(xs.map((xValue) => Math.pow(xValue, 2)));
  const sumX3 = sum(xs.map((xValue) => Math.pow(xValue, 3)));
  const sumX4 = sum(xs.map((xValue) => Math.pow(xValue, 4)));
  const sumY = sum(ys);
  const sumXY = sum(xs.map((xValue, index) => xValue * ys[index]));
  const sumX2Y = sum(
    xs.map((xValue, index) => Math.pow(xValue, 2) * ys[index])
  );
  const coefficients = solve3x3(
    [
      [n, sumX, sumX2],
      [sumX, sumX2, sumX3],
      [sumX2, sumX3, sumX4],
    ],
    [sumY, sumXY, sumX2Y]
  );

  if (!coefficients) {
    return null;
  }

  const [a, b, c] = coefficients;
  const predict = (xValue: number) => a + b * xValue + c * Math.pow(xValue, 2);

  return {
    predict,
    r2: rSquared(xs, ys, predict),
  };
}

function solve3x3(matrix: number[][], vector: number[]) {
  const rows = matrix.map((row, index) => [...row, vector[index]]);

  for (let pivotIndex = 0; pivotIndex < 3; pivotIndex += 1) {
    let pivotRow = pivotIndex;

    for (let rowIndex = pivotIndex + 1; rowIndex < 3; rowIndex += 1) {
      if (
        Math.abs(rows[rowIndex][pivotIndex]) >
        Math.abs(rows[pivotRow][pivotIndex])
      ) {
        pivotRow = rowIndex;
      }
    }

    if (Math.abs(rows[pivotRow][pivotIndex]) < 1e-10) {
      return null;
    }

    [rows[pivotIndex], rows[pivotRow]] = [rows[pivotRow], rows[pivotIndex]];

    const pivot = rows[pivotIndex][pivotIndex];
    for (let columnIndex = pivotIndex; columnIndex < 4; columnIndex += 1) {
      rows[pivotIndex][columnIndex] /= pivot;
    }

    for (let rowIndex = 0; rowIndex < 3; rowIndex += 1) {
      if (rowIndex === pivotIndex) {
        continue;
      }

      const factor = rows[rowIndex][pivotIndex];
      for (let columnIndex = pivotIndex; columnIndex < 4; columnIndex += 1) {
        rows[rowIndex][columnIndex] -= factor * rows[pivotIndex][columnIndex];
      }
    }
  }

  return rows.map((row) => row[3]);
}

function rSquared(
  xs: number[],
  ys: number[],
  predict: (xValue: number) => number
) {
  const yMean = average(ys);
  const totalVariance = ys.reduce(
    (total, yValue) => total + Math.pow(yValue - yMean, 2),
    0
  );

  if (totalVariance === 0) {
    return 1;
  }

  const residualVariance = xs.reduce(
    (total, xValue, index) =>
      total + Math.pow(ys[index] - predict(xValue), 2),
    0
  );

  return 1 - residualVariance / totalVariance;
}

function average(values: number[]) {
  return sum(values) / values.length;
}

function sum(values: number[]) {
  return values.reduce((total, value) => total + value, 0);
}
