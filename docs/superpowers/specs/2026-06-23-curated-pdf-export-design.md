# Curated PDF Export Design

## Goal

Add a one-click PDF export for the currently loaded Cubestats view. The export should produce a polished, one-page report that a speedcuber can save, share, or attach without using the browser print dialog.

## Scope

The first version supports two report shapes:

- Single competitor report for the currently selected event.
- Comparison report when a comparison competitor is loaded.

The feature is client-side only. It does not add accounts, persistence, backend PDF rendering, server storage, or a print stylesheet workflow.

## User Experience

Show an `Export PDF` button only after a dashboard has loaded. In single-competitor mode, the button exports the currently selected competitor and event. In comparison mode, the same button exports the current comparison and selected event.

The action downloads a PDF directly. The filename should be stable and readable:

- `cubestats-2019CHIE01-333.pdf`
- `cubestats-2019CHIE01-vs-2016PARK06-333.pdf`

If generation fails, the UI should show a short error message near the dashboard controls and leave the current dashboard state intact.

## Single Competitor Report

The one-page report contains:

- Header: Cubestats, competitor name, WCA ID, selected event, and export date.
- Key stats: current PB, best average, world/continent/country ranks, average solve, median solve, consistency, DNF rate, competitions, and official solves.
- Compact chart sections for PB progression and average history. These charts use the same loaded data as the dashboard, but are drawn specifically for the PDF page instead of screenshotting the DOM.
- Milestones: single PB count, competing since, biggest PB drop, longest gap, and up to five barrier milestones.
- Footer: `Unofficial WCA analytics. Data from public WCA result mirrors.`

## Comparison Report

When a comparison profile is loaded, the export changes to a comparison report containing:

- Header: Cubestats, both competitor names and WCA IDs, selected event, and export date.
- Head-to-head single PB record across shared events.
- Comparison stat table for the selected event: single PB, best average, national single rank, average solve, consistency, DNF rate, competitions, and official solves.
- Compact chart sections for single PB progression and best average progression for both competitors.
- Footer: `Unofficial WCA analytics. Data from public WCA result mirrors.`

If one competitor has no selected-event data, the report should keep the table row and chart area readable with `N/A` rather than failing.

## Implementation Design

Use a small client-side PDF library, most likely `jspdf`, in the frontend. Keep generation logic in a new `frontend/app/lib/pdf-report.ts` module so React components only pass current state and trigger the download.

The module should expose two public functions:

- `exportCompetitorReport(args)` for single-competitor dashboards.
- `exportComparisonReport(args)` for comparison dashboards.

The report module owns:

- Page constants: size, margins, typography, colors, spacing.
- Text truncation helpers.
- Stat-table drawing helpers.
- Lightweight line-chart drawing helpers.
- Milestone extraction helpers where existing frontend utilities do not already expose the needed values.
- Filename generation.

React wiring should stay minimal:

- `page.tsx` continues to own current profile, comparison profile, selected event, average chart mode, and errors.
- `CompetitorDashboard` receives an export callback or renders an export action passed from `page.tsx`.
- `ComparisonDashboard` receives the matching comparison export action.

Do not introduce backend PDF generation in this version.

## Layout Constraints

The PDF must be one page by construction. Use a compact report layout rather than trying to mirror the full dashboard:

- Header band.
- Two-column stat grid or stat table.
- Two compact chart blocks.
- Milestone strip.
- Footer.

If data is too dense, prefer summarizing or truncating labels over spilling to page two. The exported report should remain legible at normal PDF viewer zoom.

## Error Handling

Handle these cases:

- No loaded profile: hide or disable export.
- Missing selected event: hide or disable export.
- PDF generation exception: surface `Could not export PDF. Try again.` in the existing dashboard UI.
- Missing comparison event data: render `N/A` values and an empty chart message.

## Testing And Verification

Run:

```bash
npm --prefix frontend run build
```

Manual checks:

- Load a single competitor, select an event, export PDF, and verify the file downloads.
- Open the PDF and confirm it is one page, readable, and has no clipped text.
- Load a comparison, export PDF, and verify the comparison-specific report is used.
- Confirm changing the selected event changes the exported report.
- Confirm frontend build passes after adding the PDF dependency and TypeScript module.

## Non-Goals

- Full multi-page all-events report.
- Pixel-perfect dashboard screenshot export.
- Browser print workflow.
- Server-side PDF rendering.
- Saved reports, public report URLs, or account-based history.
