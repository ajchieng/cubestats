import type {
  AverageChartConfig,
  AverageChartMode,
  CompetitorProgression,
  EventProgression,
} from "../lib/types";
import { formatDnfRate } from "../lib/result-utils";
import { AllAroundPanel } from "./all-around";
import { ActivityHeatmap, MilestonesStrip } from "./analytics";
import { SeriesChart, SolveHistogram } from "./charts";
import { Metric } from "./metric";
import { ResultsTable } from "./results-table";

const AVERAGE_CHART_OPTIONS: { mode: AverageChartMode; label: string }[] = [
  { mode: "raw", label: "Raw" },
  { mode: "1m", label: "1M" },
  { mode: "6m", label: "6M" },
  { mode: "1y", label: "1Y" },
];

const EVENT_SHORT_LABELS: Record<string, string> = {
  "333": "3x3",
  "222": "2x2",
  "444": "4x4",
  "555": "5x5",
  "666": "6x6",
  "777": "7x7",
  "333oh": "OH",
  "333bf": "3BLD",
  pyram: "Pyra",
  skewb: "Skewb",
  minx: "Mega",
  clock: "Clock",
  sq1: "SQ1",
  "444bf": "4BLD",
  "555bf": "5BLD",
  "333mbf": "MBLD",
  "333fm": "FM",
};

export function CompetitorDashboard({
  profile,
  selectedEvent,
  averageChart,
  averageChartMode,
  resultsPage,
  onSelectEvent,
  onAverageChartModeChange,
  onResultsPageChange,
  onExportPdf,
}: {
  profile: CompetitorProgression;
  selectedEvent: EventProgression;
  averageChart: AverageChartConfig | null;
  averageChartMode: AverageChartMode;
  resultsPage: number;
  onSelectEvent: (eventId: string) => void;
  onAverageChartModeChange: (mode: AverageChartMode) => void;
  onResultsPageChange: (page: number) => void;
  onExportPdf: () => void;
}) {
  const totalCompetitions = new Set(
    profile.events.flatMap((event) =>
      event.result_rows
        .map((row) => row.competition_id)
        .filter((competitionId) => competitionId.length > 0)
    )
  ).size;
  const kinchScore = profile.all_around?.kinch.overall;

  return (
    <section className="dashboard" aria-label="Competitor progression">
      <div className="profile-hero">
        <div className="profile-heading">
          <p className="label">Competitor</p>
          <h2>{profile.name}</h2>
          <div className="profile-meta">
            <span>{profile.wca_id}</span>
            <span>{totalCompetitions.toLocaleString()} competitions</span>
          </div>
        </div>

        {typeof kinchScore === "number" ? (
          <div className="hero-kinch" aria-label="Kinch all-around score">
            <p className="label">Kinch all-around</p>
            <p className="kinch-value">{kinchScore.toFixed(2)}</p>
          </div>
        ) : null}

        <div className="report-actions">
          <button type="button" className="secondary-action" onClick={onExportPdf}>
            Export PDF
          </button>
        </div>
      </div>

      <div className="event-tabs" aria-label="Events">
        {profile.events.map((event) => (
          <button
            aria-pressed={event.event_id === selectedEvent.event_id}
            className={event.event_id === selectedEvent.event_id ? "active" : ""}
            key={event.event_id}
            onClick={() => {
              onSelectEvent(event.event_id);
              onResultsPageChange(1);
            }}
            type="button"
          >
            {EVENT_SHORT_LABELS[event.event_id] ?? event.name}
          </button>
        ))}
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

      <div className="charts-grid">
        <SeriesChart
          title="PB progression"
          mode="date"
          unit={selectedEvent.unit}
          points={selectedEvent.pb_progression}
          showFit
          emptyLabel="No dated PB progression points."
        />
        <SolveHistogram
          unit={selectedEvent.unit}
          values={selectedEvent.solve_values}
          meanValue={selectedEvent.stats.average_solve_value}
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
                  onClick={() => onAverageChartModeChange(option.mode)}
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

      {profile.all_around ? (
        <AllAroundPanel allAround={profile.all_around} />
      ) : null}

      <MilestonesStrip event={selectedEvent} />

      <ActivityHeatmap events={profile.events} />

      <ResultsTable
        eventData={selectedEvent}
        page={resultsPage}
        onPageChange={onResultsPageChange}
      />
    </section>
  );
}
