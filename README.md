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

## Frontend Only

```bash
cd frontend
npm install
npm run dev
```

The frontend calls the FastAPI backend. The backend reads WCA data from Robin Ingelbrecht's unofficial WCA REST API static JSON endpoints and keeps that third-party API access out of the browser.
