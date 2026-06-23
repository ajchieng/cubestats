# Curated PDF Export Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a one-click browser-side PDF export that downloads a curated one-page Cubestats report for the current single-competitor or comparison view.

**Architecture:** Keep PDF generation isolated in `frontend/app/lib/pdf-report.ts` so React components only trigger export from current loaded state. Use `jspdf` to draw text, stat tables, and compact line charts directly into a single landscape page; do not screenshot the DOM or add backend rendering. Wire one export action through `page.tsx` into the existing dashboard components and surface generation failures in the existing page message area.

**Tech Stack:** Next.js App Router, React client components, strict TypeScript, plain CSS, `jspdf`, existing Cubestats API types and chart data.

---

## File Structure

- Modify: `frontend/package.json` and `frontend/package-lock.json`
  - Add the runtime `jspdf` dependency.
- Create: `frontend/app/lib/pdf-report.ts`
  - Own all PDF layout constants, formatting, compact chart drawing, report functions, and filename generation.
- Modify: `frontend/app/page.tsx`
  - Import export functions, track PDF export errors, and pass export callbacks into dashboard components.
- Modify: `frontend/app/components/competitor-dashboard.tsx`
  - Render an `Export PDF` button in the single-competitor hero/action area.
- Modify: `frontend/app/components/comparison-dashboard.tsx`
  - Render an `Export PDF` button in the comparison summary/action area.
- Modify: `frontend/app/globals.css`
  - Add styles for report action placement and the export button.

No backend files change.

## Task 1: Add PDF Dependency

**Files:**
- Modify: `frontend/package.json`
- Modify: `frontend/package-lock.json`

- [ ] **Step 1: Install `jspdf`**

Run:

```bash
npm --prefix frontend install jspdf
```

Expected: `frontend/package.json` gains `"jspdf"` under `dependencies`, and `frontend/package-lock.json` updates with the resolved package tree.

- [ ] **Step 2: Verify the dependency resolves in the frontend build**

Run:

```bash
npm --prefix frontend run build
```

Expected: the build reaches the existing Next.js production build path. If it fails before application type checking because dependency install was blocked by network access, request approval for the install command and rerun Step 1.

- [ ] **Step 3: Commit dependency update**

Run:

```bash
git add frontend/package.json frontend/package-lock.json
git commit -m "add pdf export dependency"
```

Expected: a commit containing only the dependency files.

## Task 2: Create The PDF Report Module

**Files:**
- Create: `frontend/app/lib/pdf-report.ts`

- [ ] **Step 1: Create the module with typed public exports and shared helpers**

Create `frontend/app/lib/pdf-report.ts` with this implementation:

```ts
import { jsPDF } from "jspdf";
import type {
  CompetitorProgression,
  EventProgression,
  ProgressionPoint,
  RankPositions,
} from "./types";
import { formatDnfRate } from "./result-utils";

type PdfPoint = ProgressionPoint & { value: number };

type CompetitorReportArgs = {
  profile: CompetitorProgression;
  event: EventProgression;
  averagePoints: ProgressionPoint[];
};

type ComparisonReportArgs = {
  primary: CompetitorProgression;
  secondary: CompetitorProgression;
  eventId: string;
};

type StatCell = {
  label: string;
  value: string;
};

type Series = {
  name: string;
  color: string;
  points: PdfPoint[];
};

const PAGE = {
  orientation: "landscape" as const,
  unit: "pt" as const,
  format: "letter" as const,
  width: 792,
  height: 612,
  margin: 36,
};

const COLORS = {
  ink: "#172033",
  muted: "#667085",
  line: "#d6dae3",
  panel: "#f6f8fb",
  primary: "#2563eb",
  secondary: "#9a3412",
  accent: "#0f766e",
};

export function exportCompetitorReport({
  profile,
  event,
  averagePoints,
}: CompetitorReportArgs) {
  const doc = createDoc();
  drawHeader(doc, "Cubestats", profile.name, [
    profile.wca_id,
    event.name,
    `Exported ${formatExportDate(new Date())}`,
  ]);

  drawStatGrid(doc, 36, 112, 340, competitorStats(event), 3);
  drawMilestones(doc, 414, 112, 342, buildMilestones(event));

  drawLineChart(doc, {
    x: 36,
    y: 268,
    width: 340,
    height: 132,
    title: "PB progression",
    unit: event.unit,
    series: [
      {
        name: "Single PB",
        color: COLORS.primary,
        points: displayablePoints(event.pb_progression),
      },
    ],
  });

  drawLineChart(doc, {
    x: 414,
    y: 268,
    width: 342,
    height: 132,
    title: `${event.average_label} history`,
    unit: event.unit,
    series: [
      {
        name: event.average_label,
        color: COLORS.accent,
        points: displayablePoints(averagePoints),
      },
    ],
  });

  drawRecentRows(doc, 36, 438, 720, event);
  drawFooter(doc);
  doc.save(`cubestats-${profile.wca_id}-${event.event_id}.pdf`);
}

export function exportComparisonReport({
  primary,
  secondary,
  eventId,
}: ComparisonReportArgs) {
  const primaryEvent = findEvent(primary, eventId);
  const secondaryEvent = findEvent(secondary, eventId);
  const eventName = primaryEvent?.name ?? secondaryEvent?.name ?? eventId;
  const unit = primaryEvent?.unit ?? secondaryEvent?.unit ?? "seconds";
  const averageLabel =
    primaryEvent?.average_label ?? secondaryEvent?.average_label ?? "Average";

  const doc = createDoc();
  drawHeader(doc, "Cubestats comparison", `${primary.name} vs ${secondary.name}`, [
    `${primary.wca_id} vs ${secondary.wca_id}`,
    eventName,
    `Exported ${formatExportDate(new Date())}`,
  ]);

  drawComparisonSummary(doc, 36, 112, 720, primary, secondary);
  drawComparisonTable(doc, 36, 174, 720, primary.name, secondary.name, primaryEvent, secondaryEvent);

  drawLineChart(doc, {
    x: 36,
    y: 322,
    width: 340,
    height: 142,
    title: "Single PB progression",
    unit,
    series: [
      {
        name: primary.name,
        color: COLORS.primary,
        points: displayablePoints(primaryEvent?.pb_progression ?? []),
      },
      {
        name: secondary.name,
        color: COLORS.secondary,
        points: displayablePoints(secondaryEvent?.pb_progression ?? []),
      },
    ],
  });

  drawLineChart(doc, {
    x: 414,
    y: 322,
    width: 342,
    height: 142,
    title: `Best ${averageLabel} progression`,
    unit,
    series: [
      {
        name: primary.name,
        color: COLORS.primary,
        points: bestAverageProgression(primaryEvent?.average_points ?? []),
      },
      {
        name: secondary.name,
        color: COLORS.secondary,
        points: bestAverageProgression(secondaryEvent?.average_points ?? []),
      },
    ],
  });

  drawFooter(doc);
  doc.save(`cubestats-${primary.wca_id}-vs-${secondary.wca_id}-${eventId}.pdf`);
}

function createDoc() {
  const doc = new jsPDF({
    orientation: PAGE.orientation,
    unit: PAGE.unit,
    format: PAGE.format,
  });
  doc.setProperties({
    title: "Cubestats report",
    subject: "Unofficial WCA analytics snapshot",
    creator: "Cubestats",
  });
  return doc;
}

function drawHeader(
  doc: jsPDF,
  product: string,
  title: string,
  details: string[]
) {
  doc.setFillColor(COLORS.ink);
  doc.rect(0, 0, PAGE.width, 82, "F");
  doc.setTextColor("#ffffff");
  doc.setFont("helvetica", "bold");
  doc.setFontSize(13);
  doc.text(product, PAGE.margin, 28);
  doc.setFontSize(24);
  doc.text(truncate(title, 54), PAGE.margin, 58);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.text(details.filter(Boolean).join("  /  "), 430, 32, { maxWidth: 326 });
}

function drawStatGrid(
  doc: jsPDF,
  x: number,
  y: number,
  width: number,
  stats: StatCell[],
  columns: number
) {
  const cellWidth = width / columns;
  const cellHeight = 46;
  stats.forEach((stat, index) => {
    const col = index % columns;
    const row = Math.floor(index / columns);
    const left = x + col * cellWidth;
    const top = y + row * cellHeight;
    doc.setFillColor(COLORS.panel);
    doc.roundedRect(left, top, cellWidth - 8, cellHeight - 8, 5, 5, "F");
    doc.setTextColor(COLORS.muted);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(7);
    doc.text(stat.label.toUpperCase(), left + 9, top + 14);
    doc.setTextColor(COLORS.ink);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(12);
    doc.text(truncate(stat.value, 14), left + 9, top + 31);
  });
}

function competitorStats(event: EventProgression): StatCell[] {
  const stats = event.stats;
  return [
    { label: "Current PB", value: stats.current_pb ?? "N/A" },
    { label: `Best ${event.average_label}`, value: stats.best_average ?? "N/A" },
    { label: "Single WR/CR/NR", value: rankTriplet(stats.single_rank) },
    { label: "Average solve", value: stats.average_solve ?? "N/A" },
    { label: "Median", value: stats.median_solve ?? "N/A" },
    { label: "Consistency", value: stats.solve_std_dev ?? "N/A" },
    { label: "DNF rate", value: formatDnfRate(stats) },
    { label: "Competitions", value: stats.competition_count.toLocaleString() },
    { label: "Official solves", value: stats.solve_count.toLocaleString() },
  ];
}

function rankTriplet(rank: RankPositions | null) {
  if (!rank) {
    return "N/A";
  }
  return [rank.world, rank.continent, rank.country]
    .map((value) => (typeof value === "number" ? `#${value}` : "N/A"))
    .join(" / ");
}

function drawMilestones(
  doc: jsPDF,
  x: number,
  y: number,
  width: number,
  milestones: StatCell[]
) {
  doc.setTextColor(COLORS.ink);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(13);
  doc.text("Milestones", x, y);
  drawStatGrid(doc, x, y + 16, width, milestones, 2);
}

function buildMilestones(event: EventProgression): StatCell[] {
  const points = displayablePoints(event.pb_progression);
  const biggestDrop = biggestPbDrop(points, event.unit);
  const longestGap = longestPbGap(points);
  return [
    { label: "Single PBs set", value: points.length.toLocaleString() },
    { label: "Competing since", value: event.stats.first_date ? monthYear(event.stats.first_date) : "N/A" },
    { label: "Biggest PB drop", value: biggestDrop },
    { label: "Longest PB gap", value: longestGap },
  ];
}

function drawLineChart(
  doc: jsPDF,
  config: {
    x: number;
    y: number;
    width: number;
    height: number;
    title: string;
    unit: string;
    series: Series[];
  }
) {
  doc.setTextColor(COLORS.ink);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(13);
  doc.text(config.title, config.x, config.y);

  const chartY = config.y + 18;
  const chartHeight = config.height - 18;
  doc.setDrawColor(COLORS.line);
  doc.setLineWidth(0.7);
  doc.rect(config.x, chartY, config.width, chartHeight);

  const allPoints = config.series.flatMap((item) => item.points);
  if (allPoints.length === 0) {
    doc.setTextColor(COLORS.muted);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(9);
    doc.text("No shared chart data for this event.", config.x + 16, chartY + chartHeight / 2);
    return;
  }

  const { minX, maxX, minY, maxY } = chartBounds(allPoints);
  config.series.forEach((item) => {
    if (item.points.length === 0) {
      return;
    }
    doc.setDrawColor(item.color);
    doc.setLineWidth(1.6);
    const plotted = item.points.map((point, index) =>
      plotPoint(point, index, item.points.length, minX, maxX, minY, maxY, config.x, chartY, config.width, chartHeight)
    );
    plotted.forEach((point, index) => {
      if (index === 0) {
        return;
      }
      const previous = plotted[index - 1];
      doc.line(previous.x, previous.y, point.x, point.y);
    });
    doc.setFillColor(item.color);
    const last = plotted[plotted.length - 1];
    doc.circle(last.x, last.y, 2.4, "F");
  });

  drawLegend(doc, config.x, config.y + config.height - 4, config.series);
  drawAxisLabels(doc, config.x, chartY, config.width, chartHeight, config.unit, minY, maxY);
}

function drawLegend(doc: jsPDF, x: number, y: number, series: Series[]) {
  let cursor = x;
  series.forEach((item) => {
    doc.setFillColor(item.color);
    doc.circle(cursor + 3, y - 3, 3, "F");
    doc.setTextColor(COLORS.muted);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(7);
    doc.text(truncate(item.name, 20), cursor + 10, y);
    cursor += 112;
  });
}

function drawAxisLabels(
  doc: jsPDF,
  x: number,
  y: number,
  width: number,
  height: number,
  unit: string,
  minY: number,
  maxY: number
) {
  doc.setTextColor(COLORS.muted);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(7);
  doc.text(formatChartValue(maxY, unit), x + 5, y + 10);
  doc.text(formatChartValue(minY, unit), x + 5, y + height - 5);
  doc.text("oldest", x + width - 72, y + height - 5);
  doc.text("latest", x + width - 34, y + height - 5);
}

function drawRecentRows(
  doc: jsPDF,
  x: number,
  y: number,
  width: number,
  event: EventProgression
) {
  const rows = event.result_rows.slice(0, 4);
  doc.setTextColor(COLORS.ink);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(13);
  doc.text("Recent rounds", x, y);

  doc.setFontSize(8);
  doc.setTextColor(COLORS.muted);
  doc.text("Date", x, y + 24);
  doc.text("Competition", x + 78, y + 24);
  doc.text("Round", x + 380, y + 24);
  doc.text("Best", x + 500, y + 24);
  doc.text(event.average_label, x + 590, y + 24);

  doc.setDrawColor(COLORS.line);
  doc.line(x, y + 30, x + width, y + 30);

  rows.forEach((row, index) => {
    const top = y + 48 + index * 22;
    doc.setTextColor(COLORS.ink);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    doc.text(row.date ?? "N/A", x, top);
    doc.text(truncate(row.competition_name, 46), x + 78, top);
    doc.text(truncate(row.round, 18), x + 380, top);
    doc.text(row.best.display ?? "N/A", x + 500, top);
    doc.text(row.average.display ?? "N/A", x + 590, top);
  });
}

function drawComparisonSummary(
  doc: jsPDF,
  x: number,
  y: number,
  width: number,
  primary: CompetitorProgression,
  secondary: CompetitorProgression
) {
  const record = headToHeadRecord(primary, secondary);
  doc.setFillColor(COLORS.panel);
  doc.roundedRect(x, y, width, 44, 6, 6, "F");
  doc.setTextColor(COLORS.ink);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(13);
  doc.text(`${primary.name} ${record.primaryWins} - ${record.secondaryWins} ${secondary.name}`, x + 14, y + 19);
  doc.setTextColor(COLORS.muted);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);
  doc.text(`Single PB record across ${record.shared} shared events${record.ties ? `, ${record.ties} tied` : ""}.`, x + 14, y + 34);
}

function drawComparisonTable(
  doc: jsPDF,
  x: number,
  y: number,
  width: number,
  primaryName: string,
  secondaryName: string,
  primaryEvent: EventProgression | null,
  secondaryEvent: EventProgression | null
) {
  const rows = comparisonRows(primaryEvent, secondaryEvent);
  const rowHeight = 18;
  doc.setTextColor(COLORS.ink);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(12);
  doc.text("Selected-event comparison", x, y);
  doc.setFontSize(8);
  doc.text(truncate(primaryName, 30), x + 260, y);
  doc.text(truncate(secondaryName, 30), x + 500, y);
  rows.forEach((row, index) => {
    const top = y + 22 + index * rowHeight;
    if (index % 2 === 0) {
      doc.setFillColor(COLORS.panel);
      doc.rect(x, top - 11, width, rowHeight, "F");
    }
    doc.setTextColor(COLORS.ink);
    doc.setFont("helvetica", index === 0 ? "bold" : "normal");
    doc.setFontSize(8);
    doc.text(row.label, x + 8, top);
    doc.text(row.a, x + 260, top);
    doc.text(row.b, x + 500, top);
  });
}

function comparisonRows(
  primaryEvent: EventProgression | null,
  secondaryEvent: EventProgression | null
) {
  const a = primaryEvent?.stats ?? null;
  const b = secondaryEvent?.stats ?? null;
  const averageLabel = primaryEvent?.average_label ?? secondaryEvent?.average_label ?? "Average";
  return [
    { label: "Single PB", a: a?.current_pb ?? "N/A", b: b?.current_pb ?? "N/A" },
    { label: `Best ${averageLabel}`, a: a?.best_average ?? "N/A", b: b?.best_average ?? "N/A" },
    { label: "National rank (single)", a: rankValue(a?.single_rank?.country), b: rankValue(b?.single_rank?.country) },
    { label: "Average solve", a: a?.average_solve ?? "N/A", b: b?.average_solve ?? "N/A" },
    { label: "Consistency", a: a?.solve_std_dev ?? "N/A", b: b?.solve_std_dev ?? "N/A" },
    { label: "DNF rate", a: a ? formatDnfRate(a) : "N/A", b: b ? formatDnfRate(b) : "N/A" },
    { label: "Competitions", a: a?.competition_count.toLocaleString() ?? "N/A", b: b?.competition_count.toLocaleString() ?? "N/A" },
    { label: "Official solves", a: a?.solve_count.toLocaleString() ?? "N/A", b: b?.solve_count.toLocaleString() ?? "N/A" },
  ];
}

function drawFooter(doc: jsPDF) {
  doc.setDrawColor(COLORS.line);
  doc.line(PAGE.margin, PAGE.height - 34, PAGE.width - PAGE.margin, PAGE.height - 34);
  doc.setTextColor(COLORS.muted);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);
  doc.text("Unofficial WCA analytics. Data from public WCA result mirrors.", PAGE.margin, PAGE.height - 18);
}

function findEvent(profile: CompetitorProgression, eventId: string) {
  return profile.events.find((event) => event.event_id === eventId) ?? null;
}

function displayablePoints(points: ProgressionPoint[]): PdfPoint[] {
  return points.filter((point): point is PdfPoint => typeof point.value === "number" && Number.isFinite(point.value));
}

function bestAverageProgression(points: ProgressionPoint[]): PdfPoint[] {
  let best: number | null = null;
  const output: PdfPoint[] = [];
  for (const point of displayablePoints(points)) {
    if (best === null || point.value < best) {
      best = point.value;
      output.push(point);
    }
  }
  return output;
}

function chartBounds(points: PdfPoint[]) {
  const values = points.map((point) => point.value);
  const minY = Math.min(...values);
  const maxY = Math.max(...values);
  const dated = points
    .map((point) => (point.date ? new Date(point.date).getTime() : NaN))
    .filter(Number.isFinite);
  const minX = dated.length ? Math.min(...dated) : 0;
  const maxX = dated.length ? Math.max(...dated) : Math.max(1, points.length - 1);
  return {
    minX,
    maxX: maxX === minX ? minX + 1 : maxX,
    minY,
    maxY: maxY === minY ? minY + 1 : maxY,
  };
}

function plotPoint(
  point: PdfPoint,
  index: number,
  seriesLength: number,
  minX: number,
  maxX: number,
  minY: number,
  maxY: number,
  x: number,
  y: number,
  width: number,
  height: number
) {
  const dateX = point.date ? new Date(point.date).getTime() : NaN;
  const normalizedX = Number.isFinite(dateX)
    ? (dateX - minX) / (maxX - minX)
    : seriesLength <= 1
      ? 1
      : index / (seriesLength - 1);
  const normalizedY = (point.value - minY) / (maxY - minY);
  return {
    x: x + 16 + normalizedX * (width - 32),
    y: y + 10 + (1 - normalizedY) * (height - 26),
  };
}

function formatChartValue(value: number, unit: string) {
  if (unit === "seconds") {
    if (value >= 60) {
      const minutes = Math.floor(value / 60);
      const seconds = value - minutes * 60;
      return `${minutes}:${seconds.toFixed(2).padStart(5, "0")}`;
    }
    return value.toFixed(2);
  }
  if (unit === "moves") {
    return `${Math.round(value)} moves`;
  }
  return value.toFixed(0);
}

function biggestPbDrop(points: PdfPoint[], unit: string) {
  let bestDrop: number | null = null;
  for (let index = 1; index < points.length; index += 1) {
    const drop = points[index - 1].value - points[index].value;
    if (drop > 0 && (bestDrop === null || drop > bestDrop)) {
      bestDrop = drop;
    }
  }
  if (bestDrop === null) {
    return "N/A";
  }
  return unit === "moves" ? `-${Math.round(bestDrop)} moves` : `-${formatChartValue(bestDrop, unit)}`;
}

function longestPbGap(points: PdfPoint[]) {
  const dated = points.filter((point): point is PdfPoint & { date: string } => Boolean(point.date));
  let longestDays: number | null = null;
  for (let index = 1; index < dated.length; index += 1) {
    const days = Math.round((new Date(dated[index].date).getTime() - new Date(dated[index - 1].date).getTime()) / 86_400_000);
    if (Number.isFinite(days) && days >= 0 && (longestDays === null || days > longestDays)) {
      longestDays = days;
    }
  }
  if (longestDays === null) {
    return "N/A";
  }
  if (longestDays < 30) {
    return `${longestDays}d`;
  }
  const months = Math.round(longestDays / 30.44);
  if (months < 12) {
    return `${months}mo`;
  }
  const years = Math.floor(months / 12);
  const remainder = months % 12;
  return remainder ? `${years}y ${remainder}mo` : `${years}y`;
}

function headToHeadRecord(primary: CompetitorProgression, secondary: CompetitorProgression) {
  const secondaryById = new Map(secondary.events.map((event) => [event.event_id, event]));
  let primaryWins = 0;
  let secondaryWins = 0;
  let ties = 0;
  let shared = 0;
  for (const event of primary.events) {
    const other = secondaryById.get(event.event_id);
    const a = event.stats.current_pb_value;
    const b = other?.stats.current_pb_value ?? null;
    if (!other || a === null || b === null) {
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
}

function rankValue(value: number | null | undefined) {
  return typeof value === "number" ? `#${value}` : "N/A";
}

function monthYear(date: string) {
  const parsed = new Date(date);
  if (Number.isNaN(parsed.getTime())) {
    return "N/A";
  }
  return new Intl.DateTimeFormat("en", {
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  }).format(parsed);
}

function formatExportDate(date: Date) {
  return new Intl.DateTimeFormat("en", {
    year: "numeric",
    month: "short",
    day: "numeric",
    timeZone: "UTC",
  }).format(date);
}

function truncate(value: string, maxLength: number) {
  return value.length > maxLength ? `${value.slice(0, Math.max(0, maxLength - 1))}...` : value;
}
```

- [ ] **Step 2: Run the frontend build**

Run:

```bash
npm --prefix frontend run build
```

Expected: the build passes or reports only errors in the new module. If TypeScript reports a mismatch, fix the exact referenced line before continuing.

- [ ] **Step 3: Commit the standalone report module**

Run:

```bash
git add frontend/app/lib/pdf-report.ts
git commit -m "add curated pdf report generator"
```

Expected: a commit containing only `frontend/app/lib/pdf-report.ts`.

## Task 3: Wire Export Actions Into Page State

**Files:**
- Modify: `frontend/app/page.tsx`

- [ ] **Step 1: Update imports**

In `frontend/app/page.tsx`, add the PDF exports next to the existing library imports:

```ts
import {
  exportComparisonReport,
  exportCompetitorReport,
} from "./lib/pdf-report";
```

- [ ] **Step 2: Add PDF error state**

After the existing `isLoading` state, add:

```ts
const [exportError, setExportError] = useState("");
```

- [ ] **Step 3: Clear export errors when searches start**

Inside `runSearch`, after `setError("");`, add:

```ts
setExportError("");
```

- [ ] **Step 4: Add export handlers**

Add these functions below `handlePick`:

```ts
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
```

- [ ] **Step 5: Render export errors**

After the existing `error` message block, add:

```tsx
{exportError ? (
  <p className="message error" role="alert">
    {exportError}
  </p>
) : null}
```

- [ ] **Step 6: Pass export handlers into dashboards**

Update the comparison dashboard call:

```tsx
<ComparisonDashboard
  primary={profile}
  secondary={compareProfile}
  selectedEventId={selectedEventId}
  onSelectEvent={setSelectedEventId}
  onExportPdf={handleExportComparisonReport}
/>
```

Update the competitor dashboard call:

```tsx
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
```

- [ ] **Step 7: Run build and confirm expected prop errors**

Run:

```bash
npm --prefix frontend run build
```

Expected: TypeScript reports that `onExportPdf` is not yet defined on `CompetitorDashboard` and `ComparisonDashboard` props. Continue to Task 4 to implement those props.

## Task 4: Add Export Buttons To Dashboard Components

**Files:**
- Modify: `frontend/app/components/competitor-dashboard.tsx`
- Modify: `frontend/app/components/comparison-dashboard.tsx`

- [ ] **Step 1: Add the competitor dashboard prop**

In `frontend/app/components/competitor-dashboard.tsx`, add `onExportPdf` to the destructured props:

```ts
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
```

- [ ] **Step 2: Add the competitor export button**

Inside the `.profile-hero` block, after the Kinch block, add:

```tsx
<div className="report-actions">
  <button type="button" className="secondary-action" onClick={onExportPdf}>
    Export PDF
  </button>
</div>
```

- [ ] **Step 3: Add the comparison dashboard prop**

In `frontend/app/components/comparison-dashboard.tsx`, add `onExportPdf` to the destructured props:

```ts
export function ComparisonDashboard({
  primary,
  secondary,
  selectedEventId,
  onSelectEvent,
  onExportPdf,
}: {
  primary: CompetitorProgression;
  secondary: CompetitorProgression;
  selectedEventId: string;
  onSelectEvent: (eventId: string) => void;
  onExportPdf: () => void;
}) {
```

- [ ] **Step 4: Add the comparison export button**

Inside the `.summary-panel comparison-summary` block, after the event picker, add:

```tsx
<div className="report-actions">
  <button type="button" className="secondary-action" onClick={onExportPdf}>
    Export PDF
  </button>
</div>
```

- [ ] **Step 5: Run build**

Run:

```bash
npm --prefix frontend run build
```

Expected: the previous `onExportPdf` prop errors are gone. Any remaining errors should point to styling-independent TypeScript issues in `page.tsx` or `pdf-report.ts`.

- [ ] **Step 6: Commit React wiring**

Run:

```bash
git add frontend/app/page.tsx frontend/app/components/competitor-dashboard.tsx frontend/app/components/comparison-dashboard.tsx
git commit -m "wire pdf export action"
```

Expected: a commit containing only the React wiring files.

## Task 5: Style Export Controls

**Files:**
- Modify: `frontend/app/globals.css`

- [ ] **Step 1: Add report action styles**

Add this CSS near the existing button/control styles in `frontend/app/globals.css`:

```css
.report-actions {
  display: flex;
  align-items: center;
  justify-content: flex-end;
  gap: 10px;
  margin-left: auto;
}

.secondary-action {
  min-height: 40px;
  border: 1px solid var(--border);
  border-radius: 8px;
  background: var(--surface);
  color: var(--text);
  font: inherit;
  font-weight: 700;
  padding: 0 14px;
  cursor: pointer;
  transition:
    border-color 160ms ease,
    background 160ms ease,
    transform 160ms ease;
}

.secondary-action:hover {
  border-color: var(--text-muted);
  background: var(--surface-strong);
  transform: translateY(-1px);
}

.secondary-action:focus-visible {
  outline: 3px solid var(--focus-ring);
  outline-offset: 2px;
}
```

If `--surface-strong`, `--text-muted`, or `--focus-ring` are not defined in the current CSS, replace them with the closest existing tokens from `:root` rather than adding a new color system.

- [ ] **Step 2: Check responsive behavior**

If `.profile-hero` or `.comparison-summary` needs wrapping to avoid cramped mobile layout, add:

```css
.profile-hero,
.comparison-summary {
  align-items: flex-start;
}

@media (max-width: 720px) {
  .report-actions {
    width: 100%;
    justify-content: stretch;
    margin-left: 0;
  }

  .secondary-action {
    width: 100%;
  }
}
```

- [ ] **Step 3: Run build**

Run:

```bash
npm --prefix frontend run build
```

Expected: build passes.

- [ ] **Step 4: Commit styles**

Run:

```bash
git add frontend/app/globals.css
git commit -m "style pdf export controls"
```

Expected: a commit containing only the CSS changes.

## Task 6: Manual PDF Verification

**Files:**
- No code changes unless verification finds a defect.

- [ ] **Step 1: Start the app**

Run:

```bash
npm run dev
```

Expected: FastAPI starts on `http://localhost:8000` and Next.js starts on `http://localhost:3000`.

- [ ] **Step 2: Verify single-competitor export**

In the browser:

1. Open `http://localhost:3000`.
2. Search `2019CHIE01`.
3. Select event `3x3`.
4. Click `Export PDF`.
5. Open the downloaded `cubestats-2019CHIE01-333.pdf`.

Expected:

- The file downloads directly without opening the browser print dialog.
- The report is one page.
- Header, stats, charts, recent rounds, milestones, and footer are visible.
- No text overlaps or clips.

- [ ] **Step 3: Verify comparison export**

In the browser:

1. Search primary `2019CHIE01`.
2. Enter comparison `2016PARK06`.
3. Submit comparison.
4. Select event `3x3`.
5. Click `Export PDF`.
6. Open the downloaded `cubestats-2019CHIE01-vs-2016PARK06-333.pdf`.

Expected:

- The comparison report downloads directly.
- It includes both names, both WCA IDs, the head-to-head record, comparison table, two charts, and footer.
- The report remains one page and readable.

- [ ] **Step 4: Verify selected event changes the report**

In the browser:

1. Change the selected event to another available event.
2. Click `Export PDF`.
3. Open the downloaded PDF.

Expected: filename and report header use the new event ID/name, and stats/charts correspond to the selected event.

- [ ] **Step 5: Final build check**

Run:

```bash
npm --prefix frontend run build
```

Expected: build passes.

- [ ] **Step 6: Commit verification fixes if needed**

If manual verification required code changes, commit them:

```bash
git add frontend/app/lib/pdf-report.ts frontend/app/page.tsx frontend/app/components/competitor-dashboard.tsx frontend/app/components/comparison-dashboard.tsx frontend/app/globals.css
git commit -m "polish pdf export report"
```

Expected: no commit is needed if Task 6 found no defects.

## Self-Review Notes

- Spec coverage: the plan covers dependency setup, a client-side generator, single and comparison reports, one-page layout, direct download filenames, error handling, and manual PDF checks.
- Scope check: the plan does not add backend rendering, browser print, accounts, saved reports, public report URLs, or all-events multi-page exports.
- Type consistency: public functions use `CompetitorProgression`, `EventProgression`, and `ProgressionPoint` from `frontend/app/lib/types.ts`; React handlers pass the loaded page state directly.
