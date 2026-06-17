import type {
  AverageChartConfig,
  AverageChartMode,
  ChartMode,
  ChartPoint,
  ProgressionPoint,
} from "./types";

export const CHART_WIDTH = 860;
export const CHART_HEIGHT = 330;
export const HISTOGRAM_HEIGHT = 300;
const RAW_POINT_SPACING = 18;
const RAW_SCROLL_THRESHOLD = 45;
export const CHART_PADDING = {
  top: 24,
  right: 28,
  bottom: 54,
  left: 66,
};

export function buildAverageChartConfig(
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

export function isDisplayableChartPoint(
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

export function chartPointTitle(point: ChartPoint) {
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

export function buildXTicks(minX: number, maxX: number, mode: ChartMode) {
  if (minX === maxX) {
    return [minX];
  }

  if (mode === "index") {
    const middle = Math.round((minX + maxX) / 2);
    return Array.from(new Set([minX, middle, maxX]));
  }

  return [minX, minX + (maxX - minX) / 2, maxX];
}

export function buildYTicks(minY: number, maxY: number) {
  if (minY === maxY) {
    return [minY];
  }

  return [minY, minY + (maxY - minY) / 2, maxY];
}

export function formatXTick(value: number, mode: ChartMode) {
  if (mode === "index") {
    return `${Math.round(value)}`;
  }

  return new Intl.DateTimeFormat("en", {
    month: "short",
    year: "numeric",
  }).format(new Date(value));
}

export function formatAxisValue(value: number, unit: string) {
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

export function formatDetailedValue(value: number, unit: string) {
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

export function unitLabel(unit: string) {
  if (unit === "seconds") {
    return "time";
  }

  if (unit === "moves") {
    return "moves";
  }

  return "score";
}

export function buildFitPath(
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
