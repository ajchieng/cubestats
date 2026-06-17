import type { ReactNode } from "react";
import type {
  ChartMode,
  ChartPoint,
  ProgressionPoint,
} from "../lib/types";
import {
  buildFitPath,
  buildXTicks,
  buildYTicks,
  chartPointTitle,
  CHART_HEIGHT,
  CHART_PADDING,
  CHART_WIDTH,
  formatAxisValue,
  formatDetailedValue,
  formatXTick,
  HISTOGRAM_HEIGHT,
  unitLabel,
} from "../lib/chart-utils";

export function SeriesChart({
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


type ComparisonSeries = {
  name: string;
  color: string;
  points: ProgressionPoint[];
};

export function ComparisonChart({
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

export function SolveHistogram({
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
