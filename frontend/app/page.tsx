"use client";

import { type FormEvent, type ReactNode, useMemo, useState } from "react";

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

type EventProgression = {
  event_id: string;
  name: string;
  unit: "seconds" | "moves" | "score" | string;
  average_label: string;
  stats: EventStats;
  pb_progression: ProgressionPoint[];
  average_points: ProgressionPoint[];
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
const RAW_POINT_SPACING = 18;
const RAW_SCROLL_THRESHOLD = 45;
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

export default function Home() {
  const [wcaId, setWcaId] = useState("");
  const [profile, setProfile] = useState<CompetitorProgression | null>(null);
  const [selectedEventId, setSelectedEventId] = useState("");
  const [averageChartMode, setAverageChartMode] =
    useState<AverageChartMode>("1m");
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

    if (!normalizedWcaId) {
      setError("Enter a WCA ID to search.");
      setProfile(null);
      return;
    }

    setIsLoading(true);
    setError("");
    setProfile(null);

    try {
      const response = await fetch(
        `${API_BASE_URL}/api/competitor/${encodeURIComponent(
          normalizedWcaId
        )}/progression`
      );
      const data = (await response.json().catch(() => null)) as
        | CompetitorProgression
        | ApiErrorResponse
        | null;

      if (!response.ok) {
        throw new Error(getErrorMessage(data, response.status));
      }

      const progression = data as CompetitorProgression;
      setProfile(progression);
      setAverageChartMode("1m");
      setSelectedEventId(
        progression.events.find((event) => event.event_id === "333")?.event_id ??
          progression.events[0]?.event_id ??
          ""
      );
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Something went wrong while building the progression."
      );
    } finally {
      setIsLoading(false);
    }
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
            <label htmlFor="wca-id">WCA ID</label>
            <div className="search-row">
              <input
                id="wca-id"
                name="wca-id"
                value={wcaId}
                onChange={(event) => setWcaId(event.target.value)}
                placeholder="2019CHIE01"
                autoComplete="off"
                spellCheck={false}
              />
              <button type="submit" disabled={isLoading}>
                {isLoading ? "Loading" : "Search"}
              </button>
            </div>
          </form>
        </header>

        {error ? <p className="message error">{error}</p> : null}
        {isLoading ? <p className="message">Loading progression data...</p> : null}

        {profile && selectedEvent ? (
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
                  onChange={(event) => setSelectedEventId(event.target.value)}
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
              <Metric label="Current PB" value={selectedEvent.stats.current_pb} />
              <Metric
                label={`Best ${selectedEvent.average_label}`}
                value={selectedEvent.stats.best_average}
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
                label="Competitions"
                value={selectedEvent.stats.competition_count.toLocaleString()}
              />
              <Metric
                label="Official solves"
                value={selectedEvent.stats.solve_count.toLocaleString()}
              />
            </div>

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
          </section>
        ) : null}
      </section>
    </main>
  );
}

function Metric({
  label,
  value,
}: {
  label: string;
  value: string | number | null | undefined;
}) {
  return (
    <div className="metric">
      <p className="label">{label}</p>
      <p className="metric-value">{value ?? "N/A"}</p>
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
