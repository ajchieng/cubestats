export type RankPositions = {
  world: number | null;
  continent: number | null;
  country: number | null;
};

export type EventStats = {
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

export type ProgressionPoint = {
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

export type ResultValue = {
  raw_value: number;
  value: number | null;
  display: string | null;
};

export type ResultRow = {
  date: string | null;
  competition_id: string;
  competition_name: string;
  round: string;
  format: string;
  best: ResultValue;
  average: ResultValue;
  attempts: ResultValue[];
};

export type EventProgression = {
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

export type KinchEventScore = {
  event_id: string;
  name: string;
  score: number;
  basis: "average" | "single" | "points";
};

export type KinchScore = {
  overall: number | null;
  event_count: number;
  events: KinchEventScore[];
};

export type SumOfRanksGroup = {
  world: number | null;
  continent: number | null;
  country: number | null;
  event_count: number;
};

export type SumOfRanks = {
  single: SumOfRanksGroup;
  average: SumOfRanksGroup;
};

export type AllAround = {
  kinch: KinchScore;
  sum_of_ranks: SumOfRanks;
};

export type CompetitorProgression = {
  wca_id: string;
  name: string;
  events: EventProgression[];
  all_around: AllAround | null;
};

export type ApiErrorResponse = {
  detail?: string;
};

export type ChartPoint = ProgressionPoint & {
  value: number;
};

export type ChartMode = "date" | "index";
export type AverageChartMode = "raw" | "1m" | "6m" | "1y";

export type AverageChartConfig = {
  mode: ChartMode;
  points: ProgressionPoint[];
  chartWidth?: number;
  scroll?: boolean;
};
