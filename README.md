# Cubestats

A full-stack WCA analytics app for inspecting a competitor's personal best progression, official average history, and event-level statistics.

## Structure

```text
backend/
  FastAPI app and WCA data parser
frontend/
  Next.js app
scripts/
  setup helper
```

## Run Everything

```bash
npm run dev
```

The root dev script installs missing dependencies, starts the FastAPI backend on `http://localhost:8000`, and starts the Next.js frontend on `http://localhost:3000`.

## Backend Only

```bash
cd backend
python -m venv venv
source venv/bin/activate
pip install -r requirements.txt
uvicorn main:app --reload
```

Example endpoint:

```text
GET http://localhost:8000/api/competitor/2019CHIE01/progression
```

### Tests

The backend parsing logic (WCA encodings, DNF accounting, Kinch/Sum-of-Ranks, the
fetch layer) is covered by a `pytest` suite. Install the dev dependencies and run it
from the `backend` directory:

```bash
cd backend
./venv/bin/python -m pip install -r requirements-dev.txt
./venv/bin/python -m pytest
```

Upstream HTTP calls are mocked (via `respx`), so the suite runs offline and fast.

## Frontend Only

```bash
cd frontend
npm install
npm run dev
```

The frontend calls the FastAPI backend. The backend reads WCA data from Robin Ingelbrecht's unofficial WCA REST API static JSON endpoints and keeps that third-party API access out of the browser.

## Deployment

The two halves are deployed separately and connected with two environment variables. Both default to localhost, so local development needs no configuration.

### Backend

| Variable | Purpose | Example |
| --- | --- | --- |
| `CUBESTATS_ALLOWED_ORIGINS` | Comma-separated CORS allowlist. Set to your deployed frontend's URL(s). | `https://cubestats.example.com` |
| `PORT` | Port to bind (read by `start-backend-prod`; most platforms inject it). | `8000` |

Serve it with a production command that binds all interfaces:

```bash
npm run start-backend-prod
# or directly:
cd backend && uvicorn main:app --host 0.0.0.0 --port $PORT
```

See [`backend/.env.example`](backend/.env.example).

### Frontend

| Variable | Purpose | Example |
| --- | --- | --- |
| `NEXT_PUBLIC_API_BASE_URL` | Public URL of the backend the browser calls. | `https://api.cubestats.example.com` |

This is a build-time variable (Next.js inlines `NEXT_PUBLIC_*` at build), so set it before `npm run build`. See [`frontend/.env.example`](frontend/.env.example).

```bash
cd frontend && npm install && npm run build && npm run start
```

> The backend origin allowlist and the frontend's API URL must agree: the backend must list the frontend's exact origin in `CUBESTATS_ALLOWED_ORIGINS`, or the browser will block requests with a CORS error.
