from __future__ import annotations

import os
from typing import List, Literal, Optional

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

from services.wca_api import (
    ExternalAPIError,
    InvalidWCAIDError,
    No333ResultsError,
    PersonNotFoundError,
    get_competitor_333_pb,
    get_competitor_progression,
)


class CompetitorPB(BaseModel):
    wca_id: str
    name: str
    event: Literal["333"]
    single_pb: Optional[str]
    average_pb: Optional[str]


class RankPositions(BaseModel):
    world: Optional[int]
    continent: Optional[int]
    country: Optional[int]


class EventStats(BaseModel):
    competition_count: int
    round_count: int
    solve_count: int
    average_solve: Optional[str]
    average_solve_value: Optional[float]
    median_solve: Optional[str]
    median_solve_value: Optional[float]
    current_pb: Optional[str]
    current_pb_value: Optional[float]
    best_average: Optional[str]
    best_average_value: Optional[float]
    single_rank: Optional[RankPositions] = None
    average_rank: Optional[RankPositions] = None
    solve_std_dev: Optional[str]
    solve_std_dev_value: Optional[float]
    worst_solve: Optional[str]
    worst_solve_value: Optional[float]
    dnf_count: int
    attempt_count: int
    dnf_rate: Optional[float]
    first_date: Optional[str]
    latest_date: Optional[str]


class ProgressionPoint(BaseModel):
    date: Optional[str]
    competition_id: str
    competition_name: str
    round: str
    format: str
    raw_value: int
    value: Optional[float]
    display: Optional[str]
    pb_number: Optional[int] = None
    index: Optional[int] = None


class ResultValue(BaseModel):
    raw_value: int
    value: Optional[float]
    display: Optional[str]


class ResultRow(BaseModel):
    date: Optional[str]
    competition_id: str
    competition_name: str
    round: str
    format: str
    best: ResultValue
    average: ResultValue
    attempts: List[ResultValue]


class EventProgression(BaseModel):
    event_id: str
    name: str
    unit: str
    average_label: str
    stats: EventStats
    solve_values: List[float]
    pb_progression: List[ProgressionPoint]
    average_points: List[ProgressionPoint]
    result_rows: List[ResultRow]


class KinchEventScore(BaseModel):
    event_id: str
    name: str
    score: float
    basis: Literal["average", "single", "points"]


class KinchScore(BaseModel):
    overall: Optional[float]
    event_count: int
    events: List[KinchEventScore]


class SumOfRanksGroup(BaseModel):
    world: Optional[int]
    continent: Optional[int]
    country: Optional[int]
    event_count: int


class SumOfRanks(BaseModel):
    single: SumOfRanksGroup
    average: SumOfRanksGroup


class AllAround(BaseModel):
    kinch: KinchScore
    sum_of_ranks: SumOfRanks


class CompetitorProgression(BaseModel):
    wca_id: str
    name: str
    events: List[EventProgression]
    all_around: Optional[AllAround] = None


app = FastAPI(title="Cubestats API")


def _allowed_origins() -> list[str]:
    """Resolve CORS origins from CUBESTATS_ALLOWED_ORIGINS (comma-separated).

    Falls back to the local dev frontend when the variable is unset, so local
    development keeps working without any configuration.
    """
    raw = os.environ.get("CUBESTATS_ALLOWED_ORIGINS", "http://localhost:3000")
    return [origin.strip() for origin in raw.split(",") if origin.strip()]


app.add_middleware(
    CORSMiddleware,
    allow_origins=_allowed_origins(),
    allow_credentials=True,
    allow_methods=["GET"],
    allow_headers=["*"],
)


@app.get("/health")
async def health() -> dict[str, str]:
    return {"status": "ok"}


@app.get("/api/competitor/{wca_id}/333-pb", response_model=CompetitorPB)
async def competitor_333_pb(wca_id: str) -> CompetitorPB:
    try:
        return CompetitorPB(**await get_competitor_333_pb(wca_id))
    except InvalidWCAIDError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    except PersonNotFoundError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
    except No333ResultsError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
    except ExternalAPIError as exc:
        raise HTTPException(status_code=502, detail=str(exc)) from exc


@app.get(
    "/api/competitor/{wca_id}/progression",
    response_model=CompetitorProgression,
)
async def competitor_progression(wca_id: str) -> CompetitorProgression:
    try:
        return CompetitorProgression(**await get_competitor_progression(wca_id))
    except InvalidWCAIDError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    except PersonNotFoundError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
    except No333ResultsError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
    except ExternalAPIError as exc:
        raise HTTPException(status_code=502, detail=str(exc)) from exc
