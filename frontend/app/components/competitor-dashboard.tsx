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

export function CompetitorDashboard({
  profile,
  selectedEvent,
  averageChart,
  averageChartMode,
  resultsPage,
  onSelectEvent,
  onAverageChartModeChange,
  onResultsPageChange,
}: {
  profile: CompetitorProgression;
  selectedEvent: EventProgression;
  averageChart: AverageChartConfig | null;
  averageChartMode: AverageChartMode;
  resultsPage: number;
  onSelectEvent: (eventId: string) => void;
  onAverageChartModeChange: (mode: AverageChartMode) => void;
  onResultsPageChange: (page: number) => void;
}) {
  return (
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
              onSelectEvent(event.target.value);
              onResultsPageChange(1);
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

      {profile.all_around ? (
        <AllAroundPanel allAround={profile.all_around} />
      ) : null}

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

      <SolveHistogram
        unit={selectedEvent.unit}
        values={selectedEvent.solve_values}
        meanValue={selectedEvent.stats.average_solve_value}
      />

      <ActivityHeatmap events={profile.events} />

      <ResultsTable
        eventData={selectedEvent}
        page={resultsPage}
        onPageChange={onResultsPageChange}
      />
    </section>
  );
}
