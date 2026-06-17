import type { EventProgression } from "../lib/types";
import {
  displayAttemptValue,
  displayResultValue,
  droppedAo5AttemptIndexes,
  solveValueColor,
} from "../lib/result-utils";

const RESULTS_PAGE_SIZE = 12;

export function ResultsTable({
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
