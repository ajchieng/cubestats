# Repository Guidelines

## Project Structure & Module Organization

Cubestats is a split full-stack app. `backend/` contains the FastAPI service, with HTTP routes and Pydantic models in `backend/main.py`, WCA fetching and statistics logic in `backend/services/wca_api.py`, utilities in `backend/utils/`, and pytest coverage in `backend/tests/`. `frontend/` contains the Next.js App Router UI. `frontend/app/page.tsx` owns top-level orchestration, `frontend/app/components/` contains React views, `frontend/app/lib/` contains shared API, chart, result, and type helpers, and `frontend/app/globals.css` holds all styling. Keep broader architecture notes in `ARCHITECTURE.md` when structure changes materially.

## Build, Test, and Development Commands

- `npm run setup`: creates `backend/venv`, installs backend requirements, and installs frontend npm packages.
- `npm run dev`: runs setup, then starts FastAPI on `http://localhost:8000` and Next.js on `http://localhost:3000`.
- `npm run start-backend`: starts only the local FastAPI service.
- `npm run start-frontend`: starts only the Next.js dev server.
- `npm --prefix frontend run build`: production-builds the frontend and catches TypeScript/module errors.
- `cd backend && ./venv/bin/python -m pytest`: runs the backend test suite.

## Coding Style & Naming Conventions

Backend code is Python 3 with typed FastAPI/Pydantic models. Use clear snake_case for functions, fields, and test names. Keep domain parsing and computed statistics in service-layer helpers rather than route handlers. Frontend code is strict TypeScript React. Use PascalCase for components, kebab-case filenames such as `results-table.tsx`, and named utility exports from `frontend/app/lib/`. Styling is plain CSS in `globals.css`; avoid introducing a CSS framework without a clear need.

## Testing Guidelines

Backend tests use `pytest`, `pytest-asyncio`, and `respx`; upstream HTTP calls should stay mocked so tests run offline. Add tests under `backend/tests/test_*.py` for parser changes, API normalization, ranking/all-around math, and fetch behavior. For frontend changes, run `npm --prefix frontend run build`; there is no separate frontend test runner configured.

## Commit & Pull Request Guidelines

The current history uses short, lowercase, descriptive commit subjects such as `data visualisations`. Keep commits focused and imperative or noun-phrase based. Pull requests should describe the user-visible change, note backend/frontend impact, list validation commands run, link any related issue, and include screenshots for UI changes.

## Security & Configuration Tips

Do not put secrets in tracked files. Local defaults work without env vars; deployment uses `CUBESTATS_ALLOWED_ORIGINS`, `PORT`, and `NEXT_PUBLIC_API_BASE_URL`. Keep browser access routed through the backend rather than calling the third-party WCA data source directly from frontend code.
