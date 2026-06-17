import type { EventStats, ResultRow, ResultValue } from "./types";

export function formatDnfRate(stats: EventStats) {
  if (stats.dnf_rate === null || stats.attempt_count === 0) {
    return "N/A";
  }

  return `${(stats.dnf_rate * 100).toFixed(1)}% (${stats.dnf_count}/${stats.attempt_count})`;
}

export function displayResultValue(result: ResultValue) {
  return result.display ?? "";
}

export function displayAttemptValue(
  attempt: ResultValue | undefined,
  isDropped: boolean
) {
  const display = attempt?.display ?? "";

  if (!display || !isDropped) {
    return display;
  }

  return `(${display})`;
}

export function solveValueColor(
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

export function droppedAo5AttemptIndexes(row: ResultRow) {
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
