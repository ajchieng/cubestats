"use client";

import { type FormEvent, useMemo, useRef, useState } from "react";
import { ComparisonDashboard } from "./components/comparison-dashboard";
import { CompetitorDashboard } from "./components/competitor-dashboard";
import { LandingPanel } from "./components/landing";
import { RecentSearches } from "./components/recent-searches";
import { DashboardSkeleton } from "./components/skeleton";
import { ThemeToggle } from "./components/theme-toggle";
import { errorText, fetchProgression } from "./lib/api";
import { buildAverageChartConfig } from "./lib/chart-utils";
import {
  exportComparisonReport,
  exportCompetitorReport,
} from "./lib/pdf-report";
import { useRecentSearches } from "./lib/recent-searches";
import type {
  AverageChartConfig,
  AverageChartMode,
  CompetitorProgression,
} from "./lib/types";
import { isValidWcaId, normalizeWcaId } from "./lib/wca-id";

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
  const [exportError, setExportError] = useState("");

  const wcaInputRef = useRef<HTMLInputElement>(null);
  const { recent, remember } = useRecentSearches();

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

  const primaryEmpty = wcaId.trim() === "";
  const compareEmpty = compareId.trim() === "";
  const primaryError = !primaryEmpty && !isValidWcaId(wcaId);
  const compareError = !compareEmpty && !isValidWcaId(compareId);
  const submitDisabled =
    isLoading || primaryEmpty || primaryError || compareError;

  async function runSearch(primaryRaw: string, compareRaw: string) {
    const normalizedWcaId = normalizeWcaId(primaryRaw);
    const normalizedCompareId = normalizeWcaId(compareRaw);

    if (!normalizedWcaId) {
      setError("Enter a WCA ID to search.");
      setProfile(null);
      setCompareProfile(null);
      return;
    }

    setIsLoading(true);
    setError("");
    setExportError("");
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
    remember(normalizedWcaId);
    setAverageChartMode("1m");
    setResultsPage(1);
    setSelectedEventId(
      primary.events.find((item) => item.event_id === "333")?.event_id ??
        primary.events[0]?.event_id ??
        ""
    );

    if (compareResult.status === "fulfilled") {
      setCompareProfile(compareResult.value);
      if (compareResult.value && normalizedCompareId) {
        remember(normalizedCompareId);
      }
    } else if (normalizedCompareId) {
      setError(
        `Couldn't load comparison ${normalizedCompareId}: ${errorText(
          compareResult.reason
        )}`
      );
    }

    setIsLoading(false);
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    runSearch(wcaId, compareId);
  }

  function handlePick(pickedId: string) {
    setWcaId(pickedId);
    setCompareId("");
    runSearch(pickedId, "");
  }

  function handleExportCompetitorReport() {
    if (!profile || !selectedEvent || !averageChart) {
      return;
    }

    try {
      setExportError("");
      exportCompetitorReport({
        profile,
        event: selectedEvent,
        averagePoints: averageChart.points,
      });
    } catch {
      setExportError("Could not export PDF. Try again.");
    }
  }

  function handleExportComparisonReport() {
    if (!profile || !compareProfile) {
      return;
    }

    try {
      setExportError("");
      exportComparisonReport({
        primary: profile,
        secondary: compareProfile,
        eventId: selectedEventId,
      });
    } catch {
      setExportError("Could not export PDF. Try again.");
    }
  }

  return (
    <main className="page-shell">
      <section className="workspace">
        <header className="app-header">
          <div>
            <div className="header-top">
              <p className="eyebrow">Unofficial WCA analytics</p>
              <ThemeToggle />
            </div>
            <h1>Cubestats</h1>
          </div>

          <form className="search-form" onSubmit={handleSubmit}>
            <div className="search-fields">
              <div className="search-field">
                <label htmlFor="wca-id">WCA ID</label>
                <div className="input-wrap">
                  <input
                    ref={wcaInputRef}
                    id="wca-id"
                    name="wca-id"
                    value={wcaId}
                    onChange={(event) => setWcaId(event.target.value)}
                    placeholder="2019CHIE01"
                    autoComplete="off"
                    spellCheck={false}
                    className={primaryError ? "invalid" : undefined}
                    aria-invalid={primaryError ? "true" : "false"}
                    aria-describedby="wca-id-hint"
                  />
                  {wcaId ? (
                    <button
                      type="button"
                      className="input-clear"
                      aria-label="Clear WCA ID"
                      onClick={() => {
                        setWcaId("");
                        wcaInputRef.current?.focus();
                      }}
                    >
                      ×
                    </button>
                  ) : null}
                </div>
                <p
                  id="wca-id-hint"
                  className={`field-hint${primaryError ? " error" : ""}`}
                >
                  {primaryError
                    ? "Invalid format — try e.g. 2019CHIE01"
                    : "Format: 2019CHIE01"}
                </p>
              </div>

              <div className="search-field">
                <label htmlFor="compare-id">Compare with (optional)</label>
                <div className="input-wrap">
                  <input
                    id="compare-id"
                    name="compare-id"
                    value={compareId}
                    onChange={(event) => setCompareId(event.target.value)}
                    placeholder="2016PARK06"
                    autoComplete="off"
                    spellCheck={false}
                    className={compareError ? "invalid" : undefined}
                    aria-invalid={compareError ? "true" : "false"}
                    aria-describedby="compare-id-hint"
                  />
                  {compareId ? (
                    <button
                      type="button"
                      className="input-clear"
                      aria-label="Clear comparison WCA ID"
                      onClick={() => setCompareId("")}
                    >
                      ×
                    </button>
                  ) : null}
                </div>
                <p
                  id="compare-id-hint"
                  className={`field-hint${compareError ? " error" : ""}`}
                >
                  {compareError
                    ? "Invalid format — try e.g. 2016PARK06"
                    : "Optional second competitor"}
                </p>
              </div>
            </div>

            <button type="submit" disabled={submitDisabled}>
              {isLoading ? "Loading" : compareId.trim() ? "Compare" : "Search"}
            </button>

            <RecentSearches recent={recent} onPick={handlePick} />
          </form>
        </header>

        {error ? (
          <p className="message error" role="alert">
            {error}
          </p>
        ) : null}

        {exportError ? (
          <p className="message error" role="alert">
            {exportError}
          </p>
        ) : null}

        {isLoading ? (
          <DashboardSkeleton />
        ) : profile && compareProfile ? (
          <ComparisonDashboard
            primary={profile}
            secondary={compareProfile}
            selectedEventId={selectedEventId}
            onSelectEvent={setSelectedEventId}
            onExportPdf={handleExportComparisonReport}
          />
        ) : profile && selectedEvent ? (
          <CompetitorDashboard
            profile={profile}
            selectedEvent={selectedEvent}
            averageChart={averageChart}
            averageChartMode={averageChartMode}
            resultsPage={resultsPage}
            onSelectEvent={setSelectedEventId}
            onAverageChartModeChange={setAverageChartMode}
            onResultsPageChange={setResultsPage}
            onExportPdf={handleExportCompetitorReport}
          />
        ) : (
          <LandingPanel onPick={handlePick} />
        )}
      </section>
    </main>
  );
}
