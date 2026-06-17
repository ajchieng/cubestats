# Cubestats — Architecture & Deep-Dive

A very detailed, end-to-end breakdown of how Cubestats works: the tech stack, every
moving part, the data model, the algorithms, and the domain concepts behind them.

If you only read one section, read **[2. The 30-second mental model](#2-the-30-second-mental-model)**
and **[8. WCA domain primer](#8-wca-domain-primer)** — almost everything else follows from those.

---

## Table of contents

1. [What Cubestats is](#1-what-cubestats-is)
2. [The 30-second mental model](#2-the-30-second-mental-model)
3. [Tech stack](#3-tech-stack)
4. [Repository layout](#4-repository-layout)
5. [How it runs locally](#5-how-it-runs-locally)
6. [The upstream data source](#6-the-upstream-data-source)
7. [Backend deep-dive](#7-backend-deep-dive)
8. [WCA domain primer](#8-wca-domain-primer)
9. [The API contract](#9-the-api-contract)
10. [Frontend deep-dive](#10-frontend-deep-dive)
11. [Feature-by-feature walkthrough](#11-feature-by-feature-walkthrough)
12. [Cross-cutting concerns](#12-cross-cutting-concerns)
13. [Known limitations & gotchas](#13-known-limitations--gotchas)
14. [Glossary](#14-glossary)

---

## 1. What Cubestats is

Cubestats is an **unofficial analytics dashboard for World Cube Association (WCA)
competitors**. You type in a competitor's WCA ID (e.g. `2019CHIE01`), and it builds a
rich, per-event view of their official competition history:

- Personal-best (PB) progression over time (single and average).
- Summary statistics (PB, best average, mean/median solve, consistency, DNF rate, world/continental/national rank).
- An **all-around profile**: a **Kinch score** + **Sum of Ranks**, with an event-strength **radar chart**.
- A distribution histogram of every solve.
- A "records & milestones" strip (biggest PB drop, longest gap, sub-X barriers crossed).
- A month-by-month activity heatmap across all events.
- A paginated, color-coded results table of every official round.
- A **head-to-head comparison mode** that overlays two competitors.

It is a read-only viewer. It stores nothing, has no accounts, and writes no data — it
reads public WCA results from a third-party static JSON mirror and reshapes them for display.

---

## 2. The 30-second mental model

```
┌─────────────┐     HTTP (JSON)     ┌──────────────────┐   HTTP (JSON)   ┌────────────────────────┐
│  Browser    │ ──────────────────► │  FastAPI backend │ ──────────────► │  WCA REST API (GitHub  │
│  (Next.js)  │ ◄────────────────── │  (Python)        │ ◄────────────── │  raw JSON mirror)      │
└─────────────┘   progression JSON  └──────────────────┘   person +      └────────────────────────┘
                                                            competition
                                                            JSON files
```

1. The **browser** (a Next.js client component) takes a WCA ID and calls the backend.
2. The **backend** fetches that person's full results file, fetches metadata for every
   competition they attended (for dates/names) plus the world record for each of their
   events (for the Kinch score), then crunches everything into a clean, display-ready shape.
3. The browser renders charts, tables, and stats from that single JSON response — all
   chart math (SVG paths, regression fits, bucketing, the heatmap) happens client-side.

The backend exists primarily to **(a)** keep the third-party API off the browser, **(b)**
do the heavy result-parsing in one place, and **(c)** normalize WCA's quirky integer
encodings into clean numbers + formatted strings.

---

## 3. Tech stack

### Backend
| Piece | What / why |
| --- | --- |
| **Python 3** | Language. Uses `from __future__ import annotations` for lazy type hints. |
| **FastAPI** | HTTP framework. Declares routes, request/response models, and auto-validation. |
| **Pydantic** | Response models (`BaseModel` subclasses). The route return values are validated/serialized against these. |
| **httpx** (async) | Async HTTP client used to fetch upstream JSON, with a connection pool + concurrency limit. |
| **uvicorn** (`[standard]`) | ASGI server that actually runs the FastAPI app. |
| **asyncio** | Concurrency for fetching many competition files in parallel. |
| stdlib `statistics` | `mean`, `median`, `pstdev` for the summary stats. |
| stdlib `re` | WCA-ID format validation. |

Dependencies live in [`backend/requirements.txt`](backend/requirements.txt):
`fastapi`, `uvicorn[standard]`, `httpx`, `pydantic`.

### Frontend
| Piece | What / why |
| --- | --- |
| **Next.js** (App Router) | React framework. The app is a single route (`app/page.tsx`). |
| **React** | UI library. The page is a **client component** (`"use client"`). |
| **TypeScript** (`strict`) | All frontend code is typed; types mirror the backend's Pydantic models. |
| **Plain CSS** | One global stylesheet, [`app/globals.css`](frontend/app/globals.css). No CSS framework, no CSS-in-JS. |
| **Hand-rolled SVG charts** | No charting library. Every chart is bespoke `<svg>` built from the data. |

Notable: there is **no charting dependency, no state manager, no data-fetching library**.
Everything is `fetch` + `useState`/`useMemo` + inline SVG. This keeps the dependency
surface tiny at the cost of more hand-written math.

### Tooling / orchestration
| Piece | What / why |
| --- | --- |
| **concurrently** (root dev dep) | Runs the backend and frontend together with one command. |
| **scripts/setup.sh** | Bootstraps the Python venv + installs deps for both halves. |
| **Turbopack / Webpack** | `next dev --webpack` for dev; `next build` uses Turbopack. `next.config.mjs` pins the Turbopack `root`. |

---

## 4. Repository layout

```
cubestats/
├── package.json                 # Root orchestration scripts (setup/dev) + concurrently
├── README.md                    # Quick-start
├── ARCHITECTURE.md              # (this file)
├── scripts/
│   └── setup.sh                 # venv + dependency bootstrap
├── backend/
│   ├── requirements.txt         # Python deps
│   ├── requirements-dev.txt     # + pytest / pytest-asyncio / respx for tests
│   ├── pytest.ini               # pytest config (asyncio auto mode, pythonpath)
│   ├── main.py                  # FastAPI app: routes + Pydantic response models
│   ├── services/
│   │   └── wca_api.py           # ALL the data fetching + parsing + stats logic
│   ├── tests/                   # pytest suite (parsing, all-around, fetch layer)
│   └── utils/
│       └── time_format.py       # format_centiseconds helper (used by legacy endpoint)
└── frontend/
    ├── package.json             # next/react deps
    ├── next.config.mjs          # Turbopack root pin
    ├── tsconfig.json            # strict TS, bundler module resolution
    └── app/
        ├── layout.tsx           # Root HTML shell + metadata
        ├── page.tsx             # Search state + top-level view orchestration
        ├── components/
        │   ├── all-around.tsx   # Kinch + Sum of Ranks summary and strength radar
        │   ├── analytics.tsx    # Milestones + activity heatmap
        │   ├── charts.tsx       # Series, comparison, and histogram charts
        │   ├── comparison-dashboard.tsx
        │   ├── competitor-dashboard.tsx
        │   ├── metric.tsx
        │   └── results-table.tsx
        ├── lib/
        │   ├── api.ts           # Backend fetch + error mapping
        │   ├── chart-utils.ts   # Chart geometry, bucketing, fits, formatting
        │   ├── result-utils.ts  # Result display and Ao5 helpers
        │   └── types.ts         # Shared API and chart types
        └── globals.css          # All styling
```

The backend's data logic remains concentrated in **`backend/services/wca_api.py`**.
The frontend is split by responsibility: `page.tsx` owns orchestration, `components/`
owns rendering, and `lib/` owns shared types and pure utilities.

---

## 5. How it runs locally

### Setup ([`scripts/setup.sh`](scripts/setup.sh))
1. Resolves the repo root and `cd`s there.
2. Creates `backend/venv` (a Python virtualenv) if it doesn't exist.
3. Upgrades `pip` and installs `backend/requirements.txt` into that venv.
4. Runs `npm --prefix frontend install`.

### Dev ([`package.json`](package.json) root)
```bash
npm run dev
```
- Runs `setup` first (idempotent), then `concurrently` launches two long-running processes:
  - **Backend:** `cd backend && ./venv/bin/python -m uvicorn main:app` → serves on `http://localhost:8000`.
  - **Frontend:** `npm --prefix frontend run dev` → `next dev --webpack` on `http://localhost:3000`.

There are also `start-backend` / `start-frontend` scripts to run either half alone.

### How the halves find each other
- The frontend calls `API_BASE_URL`, which is `process.env.NEXT_PUBLIC_API_BASE_URL` or
  falls back to `http://localhost:8000`.
- The backend's CORS middleware only allows the origin `http://localhost:3000` and only
  the `GET` method.

So in the default local setup, the browser (`:3000`) talks to FastAPI (`:8000`), which
talks to GitHub's raw CDN.

---

## 6. The upstream data source

The backend reads from **Robin Ingelbrecht's WCA REST API**, which is just a tree of
static JSON files served from GitHub raw:

```
BASE_URL = https://raw.githubusercontent.com/robiningelbrecht/wca-rest-api/refs/heads/v1
```

Three file types are consumed:

- **`/persons/{WCA_ID}.json`** — one competitor: their name, `rank` block, and a
  `results` object keyed by competition ID. Each competition maps event IDs → arrays of
  round results.
- **`/competitions/{COMPETITION_ID}.json`** — one competition: its `name` and `date`
  (`{from, till}`). Used to attach human-readable names and dates to the results (the
  person file does not contain competition dates).
- **`/rank/world/{single|average}/{EVENT_ID}.json`** — the world ranking for an event,
  sorted best-first, so **the world record is always `items[0].best`**. Fetched only for
  the events a competitor competes in, and used as the denominator for the Kinch score
  (see §7.9). These files are static and change rarely, so they are aggressively cached.

Every request carries a polite `User-Agent` header that credits the upstream API author.
This is a **static, unauthenticated, public** dataset — no API keys, no rate-limit auth.

---

## 7. Backend deep-dive

All logic lives in [`backend/services/wca_api.py`](backend/services/wca_api.py); HTTP
plumbing in [`backend/main.py`](backend/main.py).

### 7.1 Module-level constants & state
- `BASE_URL`, `EVENT_333`, `WCA_ID_PATTERN` (`^\d{4}[A-Z]{4}\d{2}$`), `REQUEST_HEADERS`.
- `EVENT_NAMES` — maps event IDs (`333`, `222`, `333bf`, `minx`, …) to display names.
- `EVENT_ORDER` — canonical ordering so events always render in the familiar WCA order.
- `CURRENT_EVENTS` / `_CURRENT_EVENT_SET` — the **17 events the WCA currently holds**.
  Used as the denominator for all-around metrics; deprecated events (`333ft`, `magic`,
  `mmagic`) are deliberately excluded so scores match the community-standard definition.
- `_competition_cache: Dict[str, Dict]` — a **process-lifetime in-memory cache** of
  fetched competition metadata, so repeated lookups (across requests) don't refetch the
  same competition file.
- `_world_record_cache: Dict[str, Optional[int]]` — a process-lifetime cache of world
  records keyed by `"{single|average}/{event_id}"`. Records change rarely, so the first
  request that needs them pays the fetch cost and the rest are free.

### 7.2 Error taxonomy
A small exception hierarchy that the route layer maps to HTTP status codes:

| Exception | Meaning | HTTP |
| --- | --- | --- |
| `InvalidWCAIDError` | ID fails the regex | 400 |
| `PersonNotFoundError` | upstream 404 for the person | 404 |
| `No333ResultsError` | person exists but has no usable results | 404 |
| `ExternalAPIError` | upstream unreachable / bad response | 502 |
| `WCAAPIError` | base class | — |

### 7.3 The fetch layer
- **`normalize_wca_id`** — trims, uppercases, regex-validates; raises `InvalidWCAIDError`.
- **`fetch_person`** — GETs the person file; maps 404 → `PersonNotFoundError`,
  other ≥400 / network / bad-JSON → `ExternalAPIError`.
- **`fetch_competitions(ids)`** — fetches many competition files **concurrently**:
  - dedupes IDs,
  - opens one `httpx.AsyncClient`,
  - throttles to **8 concurrent requests** with an `asyncio.Semaphore`,
  - checks `_competition_cache` first, stores results back into it,
  - gathers all with `asyncio.gather`.
- **`_fetch_competition`** — single competition GET that is **fault-tolerant**: on any
  error it returns a fallback `{"id", "name": id, "date": None}` so one bad competition
  never breaks the whole response.

### 7.4 The core transform: `get_competitor_progression`
1. Normalize ID → `fetch_person`.
2. Pull `results` (a dict keyed by competition ID). Empty → `No333ResultsError`.
3. Collect the competition IDs and `fetch_competitions` for names/dates.
4. Read the person's `rank` block.
5. For each event the person has results in (`_event_ids_from_results`, sorted by
   `EVENT_ORDER`), call `_build_event_progression`.
6. Drop events with zero rounds; if nothing remains → `No333ResultsError`.
7. `fetch_world_records` for the competitor's current events, then `_build_all_around`
   (Kinch + Sum of Ranks — see §7.9). A world-record fetch failure is swallowed so it can
   never break the core response; Sum of Ranks still works without it.
8. Return `{wca_id, name, events, all_around}`.

### 7.5 The heavy lifter: `_build_event_progression(event_id, results, competitions, rank_data)`
This is where raw WCA integers become charts. Step by step:

1. **Flatten rounds.** Walk every competition's results for this event, building a list
   of round dicts with: competition id/name, date, round name, format, raw best/average,
   the list of valid solves, and the raw attempt list.
2. **Sort** rounds chronologically by `(date, competition_id, round_index)`.
   Undated rounds sort last (sentinel `"9999-12-31"`).
3. **Single iteration** over sorted rounds accumulates:
   - `all_solve_values` — every valid single solve, normalized to seconds/moves/score.
   - `dnf_count` / `attempt_count` — DNF count and total real attempts (ignores skipped `0`s).
   - `pb_progression` — appends a point **only when the best single improves** (a running
     best). Each gets a `pb_number`.
   - `average_points` — appends **every** round's average in chronological order (with an
     `index`). `best_average_raw` tracks the running best average.
4. **Compute stats:**
   - mean/median via `statistics.mean`/`median`,
   - **consistency `σ`** via `statistics.pstdev` (population SD), requires ≥2 solves,
   - `worst_solve` = max of normalized solves,
   - `dnf_rate` = `dnf_count / attempt_count`,
   - `current_pb` / `best_average` formatted + numeric,
   - `single_rank` / `average_rank` via `_event_rank`,
   - first/latest known dates.
5. **Build `result_rows`** — every round, formatted for the table, in **reverse**
   (most recent first). Each has best, average, and the per-attempt values.
6. Return a fat dict: `event_id`, `name`, `unit`, `average_label`, `stats`,
   `solve_values`, `pb_progression`, `average_points`, `result_rows`.

### 7.6 Value normalization & formatting (the WCA-encoding glue)
WCA stores results as integers with special sentinels. These helpers decode them:

- **`_normalized_value(event_id, raw)`** → a clean float:
  - `333fm` (Fewest Moves): raw `≥ 1000` means an encoded *average* of moves → `raw/100`;
    otherwise it's a literal move count.
  - `333mbf` (Multi-Blind): kept as-is (a packed "score").
  - everything else: **centiseconds → seconds** via `raw / 100`.
- **`_is_better_result(a, b)`** → `a < b`. **Lower is always "better"** in this codebase
  (the frontend mirrors this assumption everywhere).
- **`_format_seconds`** → `SS.cc`, `M:SS.cc`, or `H:MM:SS.cc` depending on magnitude.
- **`_format_normalized`** → unit-aware string (`"12.34s"`, `"25 moves"`, `"30 score"`).
- **`_format_any_result_value`** → handles sentinels: `-1 → "DNF"`, `-2 → "DNS"`,
  `0 → None` (no attempt).
- **`_unit_for_event`** → `"moves"` for `333fm`, `"score"` for `333mbf`, else `"seconds"`.
- **`_average_format_for_event`** → `"Mo3"` vs `"Ao5"` (blind events default to Mo3).
- **`_event_rank` / `_positive_int`** → pulls `{world, continent, country}` from the
  person's rank block for the event, returning `None` if unranked.

### 7.7 The legacy endpoint
`get_competitor_333_pb` is an older, narrower path that returns just the 3x3 single +
average PB. It uses `_rank_best` (reads the precomputed `rank` block) with a fallback
`_scan_result_bests` (scans all results). It's still wired up at `/api/competitor/{id}/333-pb`
but the UI uses the richer `/progression` endpoint.

### 7.8 `utils/time_format.py`
A single helper `format_centiseconds(value) -> "SS.ss"`, used by the legacy 333-PB
endpoint. The progression path uses the more capable formatters inside `wca_api.py`.

### 7.9 All-around metrics: `_build_all_around`
Two whole-competitor "all-around" metrics, computed once per request from the already-built
events plus the fetched world records:

- **`fetch_world_records(event_ids)`** — for each current event the competitor does, GETs
  `/rank/world/single/{event}.json` and (except for `333mbf`) `/rank/world/average/{event}.json`
  concurrently (semaphore of 8, shared client), reading `items[0].best` as the record.
  Cached in `_world_record_cache`; fault-tolerant per file (any error → `None`).
- **Kinch score** (`_kinch_for_event`) — each event is scored **0–100 as a percentage of
  the world record**. It prefers the **average** basis (`100 × WR_avg / PR_avg`) and falls
  back to **single** when the competitor has no average. **Multi-Blind** is special-cased to
  use **net points** (`_decode_mbf_points`: `99 − raw // 10_000_000`), since its packed
  score isn't linear. Scores are clamped at 100. The **overall** Kinch is the sum of all
  event scores divided by **17** (`len(CURRENT_EVENTS)`), so events not competed count as 0.
- **Sum of Ranks** (`_sum_of_ranks`) — sums the competitor's **world / continent / country**
  rank across their current events, separately for **single** and **average**. It reads the
  ranks already present in each event's stats, so it needs **no extra fetches**. It is
  computed over **competed events only** (it does not penalize missing events with a
  "last place + 1" placeholder).

`_build_all_around` returns `{kinch: {overall, event_count, events[]}, sum_of_ranks:
{single, average}}`. Per-event Kinch scores (with their `basis`) drive the radar chart.

---

## 8. WCA domain primer

Understanding the data requires understanding speedcubing competition rules. This is the
context that explains *why* the code looks the way it does.

- **Event IDs.** `333` = 3×3, `222` = 2×2, `444`–`777` = bigger cubes, `333bf` = 3×3
  blindfolded, `333oh` = one-handed, `333fm` = fewest moves, `minx` = Megaminx,
  `pyram` = Pyraminx, `clock`, `skewb`, `sq1` = Square-1, `*mbf` = multi-blind, etc.
- **Single vs. Average.** Each round produces a **single** (best individual solve) and,
  for most events, an **average**:
  - **Ao5** (Average of 5): do 5 solves, drop the best and worst, mean the middle 3.
  - **Mo3** (Mean of 3): mean of all 3 solves (used by big cubes, FM, blind).
- **Time units (centiseconds).** Times are stored as integer **centiseconds**
  (1/100 s). `1234 → 12.34 s`. Hence the pervasive `raw / 100`.
- **Sentinels.** In a solves array: a **positive** value is a real time; **`-1` = DNF**
  (Did Not Finish), **`-2` = DNS** (Did Not Start), **`0`** = no result / slot unused.
- **Lower is better.** Faster time, fewer moves → smaller number → better. The whole app
  treats "minimum = best".
- **Special events:**
  - **333fm (Fewest Moves)** is scored in **move count**, not time. A multi-attempt FM
    average is encoded ×100 (decimals), which is why `_normalized_value` divides by 100
    when `raw ≥ 1000`.
  - **333mbf (Multi-Blind)** uses a packed score integer encoding puzzles solved/attempted
    and time — Cubestats treats it as an opaque "score" and skips time-based niceties.
- **Ranks.** WCA publishes each competitor's standing in the **world**, their
  **continent**, and their **country** for each event's single and average. These become
  the WR/CR/NR badges.

---

## 9. The API contract

FastAPI app in [`backend/main.py`](backend/main.py). CORS allows origin
`http://localhost:3000`, method `GET` only.

### `GET /health`
→ `{"status": "ok"}`. Liveness check.

### `GET /api/competitor/{wca_id}/333-pb` (legacy)
→ `CompetitorPB`: `{wca_id, name, event: "333", single_pb, average_pb}`.

### `GET /api/competitor/{wca_id}/progression` (the one the UI uses)
→ `CompetitorProgression`. Shape (validated by Pydantic):

```jsonc
{
  "wca_id": "2019CHIE01",
  "name": "…",
  "events": [
    {
      "event_id": "333",
      "name": "3x3 Cube",
      "unit": "seconds",            // "seconds" | "moves" | "score"
      "average_label": "Ao5",       // "Ao5" | "Mo3"
      "stats": {
        "competition_count": 12,
        "round_count": 40,
        "solve_count": 180,
        "average_solve": "14.20s", "average_solve_value": 14.2,
        "median_solve": "13.90s",  "median_solve_value": 13.9,
        "current_pb": "9.41s",     "current_pb_value": 9.41,
        "best_average": "11.20s",  "best_average_value": 11.2,
        "single_rank":  { "world": 114038, "continent": 40455, "country": 911 },
        "average_rank": { "world": 107200, "continent": 38581, "country": 862 },
        "solve_std_dev": "2.10s",  "solve_std_dev_value": 2.10,
        "worst_solve": "37.41s",   "worst_solve_value": 37.41,
        "dnf_count": 3, "attempt_count": 180, "dnf_rate": 0.0167,
        "first_date": "2019-01-19", "latest_date": "2025-02-22"
      },
      "solve_values": [9.41, 10.2, …],     // every valid single, normalized
      "pb_progression":  [ ProgressionPoint, … ],   // running-best singles
      "average_points":  [ ProgressionPoint, … ],   // every round average, chronological
      "result_rows":     [ ResultRow, … ]           // every round, most-recent-first
    }
  ],
  "all_around": {                          // nullable; whole-competitor metrics
    "kinch": {
      "overall": 52.02,                    // mean % of WR over all 17 events (nullable)
      "event_count": 17,
      "events": [                          // only events with a score, for the radar
        { "event_id": "333", "name": "3x3 Cube", "score": 78.4, "basis": "average" }
      ]
    },
    "sum_of_ranks": {
      "single":  { "world": 13120, "continent": 4200, "country": 90, "event_count": 17 },
      "average": { "world": 14005, "continent": 4510, "country": 96, "event_count": 17 }
    }
  }
}
```

Supporting shapes:
- **`ProgressionPoint`**: `{date, competition_id, competition_name, round, format, raw_value, value, display, pb_number?, index?}`.
- **`ResultValue`**: `{raw_value, value, display}`.
- **`ResultRow`**: `{date, competition_id, competition_name, round, format, best, average, attempts: ResultValue[]}`.
- **`RankPositions`**: `{world, continent, country}` (each nullable).
- **`KinchEventScore`**: `{event_id, name, score, basis}` where `basis` is `"average" | "single" | "points"`.
- **`SumOfRanksGroup`**: `{world, continent, country, event_count}` (sums nullable).

Errors come back as FastAPI's `{"detail": "…"}` with status 400/404/502.

---

## 10. Frontend deep-dive

[`frontend/app/page.tsx`](frontend/app/page.tsx) is the client entry point and owns
search state plus the single/comparison render branch. Feature UI lives in
[`frontend/app/components`](frontend/app/components), while API access, shared types,
and pure data/chart helpers live in [`frontend/app/lib`](frontend/app/lib).
[`layout.tsx`](frontend/app/layout.tsx) is just the HTML shell + `<title>`/metadata.

### 10.1 Types
TypeScript types in `app/lib/types.ts` mirror the backend Pydantic models exactly
(`EventStats`, `ProgressionPoint`, `ResultRow`, `EventProgression`,
`CompetitorProgression`, `RankPositions`, `AllAround`, `KinchScore`,
`KinchEventScore`, `SumOfRanks`, `SumOfRanksGroup`, …). Two UI-only types:
`ChartMode = "date" | "index"` and `AverageChartMode = "raw" | "1m" | "6m" | "1y"`.

### 10.2 Constants
`API_BASE_URL`, chart geometry (`CHART_WIDTH=860`, `CHART_HEIGHT=330`,
`HISTOGRAM_HEIGHT=300`, `CHART_PADDING`), `RAW_POINT_SPACING`, `RAW_SCROLL_THRESHOLD`,
`RESULTS_PAGE_SIZE=12`, `AVERAGE_CHART_OPTIONS`, `COMPARE_COLORS` (teal + burnt orange),
`HEATMAP_MONTHS`.

### 10.3 `Home` — the root component & state
State held with `useState`:
- `wcaId`, `compareId` — the two search inputs.
- `profile`, `compareProfile` — the two fetched `CompetitorProgression`s.
- `selectedEventId` — shared across single & comparison views.
- `averageChartMode` — which bucketing the average chart uses.
- `resultsPage` — table pagination.
- `error`, `isLoading`.

Derived via `useMemo`:
- `selectedEvent` — the chosen event from `profile` (falls back to 333 / first).
- `averageChart` — the bucketed config for the average chart.

**`handleSubmit`** fetches both competitors **in parallel** with `Promise.allSettled`:
- primary failure → show error, bail.
- primary success → set profile, default the event to `333` (or first).
- compare success → set `compareProfile` (enables comparison mode).
- compare failure (only if an ID was entered) → keep primary, surface a comparison-specific error.

**Render branches:**
1. `profile && compareProfile` → `<ComparisonDashboard>`.
2. else `profile && selectedEvent` → the full single-competitor dashboard.
3. else → nothing (just the search box / messages).

### 10.4 The chart engine (`SeriesChart`)
A from-scratch SVG line chart used for PB & average progression. It:
- filters to plottable points (finite value, and a date in `date` mode),
- computes min/max for x (timestamps or indices) and y (with padding, clamped at 0),
- defines `scaleX`/`scaleY` mapping data → SVG coordinates,
- draws axes, grid lines, tick labels (`buildXTicks`/`buildYTicks`),
- draws the data polyline + circles (with `<title>` tooltips),
- optionally draws a **regression fit line** (see below),
- supports a horizontally-scrolling wide mode for dense "raw" average data,
- accepts a `controls` slot (the average chart's Raw/1M/6M/1Y segmented control).

**Regression fit (`buildFitPath`)** — genuinely the most mathematical part of the app:
- Normalizes x to `[0,1]`.
- Fits a **least-squares linear** model (`fitLinear`) and a **quadratic** model
  (`fitQuadratic`, which solves a 3×3 normal-equation system via Gaussian elimination
  with partial pivoting in `solve3x3`).
- Computes **R²** for each (`rSquared`) and **picks the quadratic only if it improves R²
  by > 0.06** — otherwise the simpler line wins (guards against overfitting).
- Samples the chosen model at 80 points to draw a smooth dashed trend curve.

### 10.5 The average-chart bucketing
The average chart has four modes (`AVERAGE_CHART_OPTIONS`):
- **Raw** — every average as an indexed point; if there are many (> `RAW_SCROLL_THRESHOLD`)
  the chart widens and scrolls.
- **1M / 6M / 1Y** — `bucketAveragePoints` groups averages into monthly / half-year /
  yearly buckets (`averageBucketForDate`) and plots the **mean per bucket**, producing a
  smoothed trend.

### 10.6 Other helper functions
- `fetchProgression` / `errorText` / `getErrorMessage` — fetch + error mapping.
- `formatAxisValue` / `formatDetailedValue` / `unitLabel` — unit-aware number formatting
  mirroring the backend's `_format_*` functions.
- `displayResultValue` / `displayAttemptValue` / `droppedAo5AttemptIndexes` — table cell
  rendering, including detecting which two Ao5 attempts were dropped (best + worst, with
  DNF treated as the worst) so they can be shown in parentheses.
- `average` / `sum` — tiny numeric utilities.

---

## 11. Feature-by-feature walkthrough

### Summary stat grid (`Metric`, `RankBadges`)
Cards for current PB, best average, mean/median solve, **consistency (σ)**,
**worst single**, **DNF rate**, competition & solve counts. The PB and best-average cards
also render **rank badges** (`NR` country / `CR` continent / `WR` world) via `RankBadges`,
hidden when the competitor is unranked.

### All-around profile (`AllAroundPanel` + `KinchRadar`)
Rendered right after the summary grid, from `profile.all_around` (hidden if it's null).
It shows the **overall Kinch score** as a headline number, a **Sum of Ranks** block
(single & average, each with NR/CR/WR badges reusing the metric-card badge styling), and
an **event-strength radar** — a hand-rolled SVG (rings at 25/50/75/100, one axis per
scored event, a filled polygon, per-point tooltips, short event labels). The radar needs
≥ 3 scored events; below that it shows a small empty state. All the math (Kinch, SoR) is
done backend-side; the frontend only lays it out.

### Records & milestones strip (`MilestonesStrip` + `buildMilestones`)
Computed entirely client-side from `pb_progression` (singles only):
- **Single PBs set** (count) with current PB.
- **Competing since** (debut month) + latest result.
- **Biggest single drop** — largest improvement between consecutive PBs (`formatDelta`).
- **Longest gap between single PBs** — max day-gap between consecutive PB dates
  (`dayDiff` + `formatGap` → `"1y 4mo"` style).
- **Sub-X barrier chips** — the 5 lowest standard barriers crossed (`barrierThresholds`
  is unit-aware: time thresholds for seconds, move thresholds for FM, none for MBF), each
  tagged with the month first crossed.

### Charts (PB progression + average results)
Two `SeriesChart`s: the PB-progression chart (with the regression fit line on) and the
average chart (with the Raw/1M/6M/1Y control). Both are unit-aware.

### Solve distribution histogram (`SolveHistogram`)
From `solve_values`: chooses a bucket count via `√n` (clamped 6–24), bins the solves,
draws SVG bars with count grid-lines and value-axis ticks, per-bar tooltips, and a dashed
**mean marker** line. Falls back to an empty state under 2 solves.

### Activity heatmap (`ActivityHeatmap` + `buildActivity` + `heatLevel`)
A GitHub-style grid aggregated across **all** events:
- bins every round by `YYYY-MM`, counting real solves (`raw_value > 0`) and distinct comps,
- rows = each year from debut→latest (gaps included), columns = Jan–Dec,
- cell shade = one of 5 levels scaled to the busiest month (`heat-0..heat-4`),
- tooltips per cell, plus a footer (total comps, busiest month) and a Less→More legend.

### Results table (`ResultsTable`)
Paginated (12 rows/page), most-recent-first. Columns: date, competition, round, format,
best, average, and the 5 individual solves. Two special behaviors:
- **Dropped Ao5 attempts** (best + worst) are shown in parentheses and dimmed.
- **Color-coded solves** (`solveValueColor`) — each solve is tinted by its distance from
  the event **median single**, scaled by **2σ**: faster-than-median = green (lighter the
  better), slower = red (lighter the further out), darkest at the median. DNF/DNS keep
  default styling.

### Head-to-head comparison (`ComparisonDashboard`, `ComparisonChart`, `ComparisonStats`)
Entered by filling the second WCA ID. No backend change — it just calls `/progression`
twice. It renders:
- a **versus header** with colored swatches and a shared event picker over the **union**
  of both competitors' events,
- a **head-to-head record** ("A 5 – 3 B on single PBs across N shared events"), tallied by
  comparing current single PB on every shared event,
- two **overlaid** `ComparisonChart`s — single-PB progression and **best-Ao5 progression**
  (the latter derived client-side by `bestAverageProgression`, a running best over the
  average history) — each plotting both competitors on a shared scale with a legend,
- a **stat comparison table** (`ComparisonStats`) with the better cell highlighted green
  per "lower is better" row (`rowWinner`), using `rankDisplay` for national rank.

The comparison view intentionally hides the single-competitor deep dives (histogram,
milestones, heatmap, full table) to stay focused.

---

## 12. Cross-cutting concerns

- **CORS.** Backend restricts to `http://localhost:3000`, `GET` only. Change this for any
  non-local deployment.
- **Caching.** `_competition_cache` (by competition ID) and `_world_record_cache` (by
  `"{single|average}/{event_id}"`) are in-memory dicts shared across requests for the
  process lifetime. Neither **persists** across restarts nor has eviction — so world
  records are effectively frozen until the process restarts. Person/results files are
  *not* cached.
- **Concurrency.** Competition fetches run in parallel, capped at 8 by a semaphore, under
  a single shared `httpx.AsyncClient` with a 10s timeout.
- **Fault tolerance.** A failed competition fetch degrades to id-as-name with no date,
  rather than failing the request.
- **Error surfacing.** Backend raises typed exceptions → HTTP status + `{detail}`. The
  frontend's `getErrorMessage` turns those into user-friendly copy (404/400/502 cases).
- **"Lower is better" invariant.** Both halves assume minimum = best. This is correct for
  every standard event but is an explicit assumption to remember when touching ranking,
  PB, coloring, or comparison logic (notably MBF, where the "score" semantics differ).
- **Inline styles.** A handful of inline `style={...}` usages exist **only** for genuinely
  dynamic values (per-competitor line/​swatch colors, the solve-gradient color, chart
  widths). The linter flags these; they can't move to static CSS.

---

## 13. Known limitations & gotchas

- **Backend tests, no frontend tests.** `wca_api.py` (normalization, DNF counting, rank
  extraction, MBF/FM encodings, Kinch/Sum-of-Ranks, and the fetch layer with the upstream
  mocked) is covered by a `pytest` suite under `backend/tests/` — run it with
  `python -m pytest` from `backend/` after installing `requirements-dev.txt`. The frontend
  (chart math, bucketing, regression fits) still has no automated coverage.
- **No persistence / no DB.** Everything is recomputed per request; the only cache is the
  volatile competition dict.
- **Upstream coupling.** Entirely dependent on the third-party GitHub JSON mirror's
  availability, freshness, and schema. There's no fallback source.
- **MBF (`333mbf`) is a second-class citizen.** Its packed score isn't decoded into the
  human "X/Y in T" format; time-style stats/barriers are skipped or approximate. (The
  Kinch path *does* decode net points via `_decode_mbf_points`, but only for scoring.)
- **Sum of Ranks counts competed events only.** It does not penalize events a competitor
  has never done (no "last place + 1" placeholder), so two competitors' SoRs aren't
  directly comparable unless they compete in the same set of events. The UI labels the
  contributing event count to make this explicit.
- **Kinch depends on world-record freshness.** Scores are relative to `items[0]` of the
  upstream `rank/world` files and to the cached records, so they drift if the mirror or
  the cache is stale.
- **`tsconfig` `target: es5`** triggers a TypeScript deprecation warning on type-check
  (harmless today; will need bumping eventually).
- **CORS + `API_BASE_URL` are hard-coded to localhost** — both must change to deploy.
- **Rank "freshness."** Ranks come from the upstream `rank` block and reflect whenever the
  mirror was last regenerated, not live WCA standings.

---

## 14. Glossary

| Term | Meaning |
| --- | --- |
| **WCA** | World Cube Association — the governing body for speedcubing; the source of all results. |
| **WCA ID** | A competitor's unique ID, format `YYYYLLLLNN` (e.g. `2019CHIE01`). |
| **Single** | The best individual solve in a round. |
| **Average** | Ao5 (drop best+worst of 5, mean the middle 3) or Mo3 (mean of 3). |
| **PB** | Personal best — the lowest single (or average) so far. |
| **Centiseconds** | Integer 1/100-second units WCA stores times in. `1234 → 12.34s`. |
| **DNF / DNS** | Did Not Finish (`-1`) / Did Not Start (`-2`). |
| **FM / `333fm`** | Fewest Moves — scored in move count, not time. |
| **MBF / `333mbf`** | Multi-Blind — packed score; opaque "score" unit here. |
| **σ (sigma)** | Population standard deviation of singles — the "consistency" metric. |
| **WR / CR / NR** | World / Continental / National rank position. |
| **Kinch score** | An all-around metric: each event scored 0–100 as a % of the world record, averaged over all 17 current events (missing events count as 0). |
| **Sum of Ranks (SoR)** | The sum of a competitor's world/continent/country ranks across events — lower is better. Here, summed over competed events only. |
| **Progression point** | One `{date, value, …}` sample on a chart line. |
| **Running best** | A series that only appends when the value improves (used for PBs). |
```
