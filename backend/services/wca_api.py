from __future__ import annotations

import asyncio
import re
from statistics import mean, median
from typing import Any, Dict, List, Optional, Tuple

import httpx

from utils.time_format import format_centiseconds


BASE_URL = "https://raw.githubusercontent.com/robiningelbrecht/wca-rest-api/refs/heads/v1"
EVENT_333 = "333"
WCA_ID_PATTERN = re.compile(r"^\d{4}[A-Z]{4}\d{2}$")
REQUEST_HEADERS = {
    "Accept": "application/json",
    "User-Agent": "Cubestats (API contact: ingelbrecht_robin@hotmail.com)",
}

EVENT_NAMES = {
    "333": "3x3 Cube",
    "222": "2x2 Cube",
    "444": "4x4 Cube",
    "555": "5x5 Cube",
    "666": "6x6 Cube",
    "777": "7x7 Cube",
    "333bf": "3x3 Blindfolded",
    "333fm": "3x3 Fewest Moves",
    "333oh": "3x3 One-Handed",
    "clock": "Clock",
    "minx": "Megaminx",
    "pyram": "Pyraminx",
    "skewb": "Skewb",
    "sq1": "Square-1",
    "444bf": "4x4 Blindfolded",
    "555bf": "5x5 Blindfolded",
    "333mbf": "3x3 Multi-Blind",
    "333ft": "3x3 With Feet",
    "magic": "Magic",
    "mmagic": "Master Magic",
}

EVENT_ORDER = {
    event_id: index
    for index, event_id in enumerate(
        [
            "333",
            "222",
            "444",
            "555",
            "666",
            "777",
            "333bf",
            "333fm",
            "333oh",
            "clock",
            "minx",
            "pyram",
            "skewb",
            "sq1",
            "444bf",
            "555bf",
            "333mbf",
            "333ft",
            "magic",
            "mmagic",
        ]
    )
}

_competition_cache: Dict[str, Dict[str, Any]] = {}


class WCAAPIError(Exception):
    """Base class for WCA PB Finder backend errors."""


class InvalidWCAIDError(WCAAPIError):
    pass


class PersonNotFoundError(WCAAPIError):
    pass


class No333ResultsError(WCAAPIError):
    pass


class ExternalAPIError(WCAAPIError):
    pass


def normalize_wca_id(wca_id: str) -> str:
    normalized = wca_id.strip().upper()
    if not WCA_ID_PATTERN.fullmatch(normalized):
        raise InvalidWCAIDError(
            "Invalid WCA ID. Use the format YYYYLLLLNN, for example 2019CHIE01."
        )
    return normalized


async def get_competitor_333_pb(wca_id: str) -> Dict[str, Any]:
    normalized_wca_id = normalize_wca_id(wca_id)
    person = await fetch_person(normalized_wca_id)

    single_best = _rank_best(person, "singles", EVENT_333)
    average_best = _rank_best(person, "averages", EVENT_333)

    fallback_single, fallback_average = _scan_result_bests(person, EVENT_333)
    single_best = single_best or fallback_single
    average_best = average_best or fallback_average

    if single_best is None and average_best is None:
        raise No333ResultsError(
            f"No official 3x3 results were found for WCA ID {normalized_wca_id}."
        )

    return {
        "wca_id": normalized_wca_id,
        "name": str(person.get("name") or "Unknown competitor"),
        "event": EVENT_333,
        "single_pb": format_centiseconds(single_best),
        "average_pb": format_centiseconds(average_best),
    }


async def fetch_person(wca_id: str) -> Dict[str, Any]:
    url = f"{BASE_URL}/persons/{wca_id}.json"

    try:
        async with httpx.AsyncClient(timeout=10.0, headers=REQUEST_HEADERS) as client:
            response = await client.get(url)
    except httpx.RequestError as exc:
        raise ExternalAPIError("Unable to reach the WCA data API.") from exc

    if response.status_code == 404:
        raise PersonNotFoundError(f"No competitor was found for WCA ID {wca_id}.")

    if response.status_code >= 400:
        raise ExternalAPIError(
            f"The WCA data API returned an error ({response.status_code})."
        )

    try:
        data = response.json()
    except ValueError as exc:
        raise ExternalAPIError("The WCA data API returned invalid JSON.") from exc

    if not isinstance(data, dict):
        raise ExternalAPIError("The WCA data API returned an unexpected response.")

    return data


async def get_competitor_progression(wca_id: str) -> Dict[str, Any]:
    normalized_wca_id = normalize_wca_id(wca_id)
    person = await fetch_person(normalized_wca_id)
    results = person.get("results")

    if not isinstance(results, dict) or not results:
        raise No333ResultsError(
            f"No official WCA results were found for WCA ID {normalized_wca_id}."
        )

    competition_ids = [
        competition_id
        for competition_id, competition_results in results.items()
        if isinstance(competition_id, str) and isinstance(competition_results, dict)
    ]
    competitions = await fetch_competitions(competition_ids)

    event_ids = _event_ids_from_results(results)
    events = [
        _build_event_progression(event_id, results, competitions)
        for event_id in event_ids
    ]
    events = [event for event in events if event["stats"]["round_count"] > 0]

    if not events:
        raise No333ResultsError(
            f"No official WCA results were found for WCA ID {normalized_wca_id}."
        )

    return {
        "wca_id": normalized_wca_id,
        "name": str(person.get("name") or "Unknown competitor"),
        "events": events,
    }


async def fetch_competitions(competition_ids: List[str]) -> Dict[str, Dict[str, Any]]:
    unique_ids = list(dict.fromkeys(competition_ids))
    if not unique_ids:
        return {}

    async with httpx.AsyncClient(timeout=10.0, headers=REQUEST_HEADERS) as client:
        semaphore = asyncio.Semaphore(8)

        async def fetch_one(competition_id: str) -> Tuple[str, Dict[str, Any]]:
            if competition_id in _competition_cache:
                return competition_id, _competition_cache[competition_id]

            async with semaphore:
                metadata = await _fetch_competition(client, competition_id)
                _competition_cache[competition_id] = metadata
                return competition_id, metadata

        pairs = await asyncio.gather(*(fetch_one(competition_id) for competition_id in unique_ids))

    return dict(pairs)


async def _fetch_competition(
    client: httpx.AsyncClient, competition_id: str
) -> Dict[str, Any]:
    url = f"{BASE_URL}/competitions/{competition_id}.json"

    try:
        response = await client.get(url)
    except httpx.RequestError:
        return {"id": competition_id, "name": competition_id, "date": None}

    if response.status_code >= 400:
        return {"id": competition_id, "name": competition_id, "date": None}

    try:
        data = response.json()
    except ValueError:
        return {"id": competition_id, "name": competition_id, "date": None}

    if not isinstance(data, dict):
        return {"id": competition_id, "name": competition_id, "date": None}

    return data


def _rank_best(person: Dict[str, Any], rank_type: str, event_id: str) -> Optional[int]:
    rank_data = person.get("rank")
    if not isinstance(rank_data, dict):
        return None

    entries = rank_data.get(rank_type)
    if not isinstance(entries, list):
        return None

    for entry in entries:
        if not isinstance(entry, dict):
            continue

        if entry.get("eventId") == event_id:
            return _valid_result_value(entry.get("best"))

    return None


def _event_ids_from_results(results: Dict[str, Any]) -> List[str]:
    event_ids = set()

    for competition_results in results.values():
        if not isinstance(competition_results, dict):
            continue

        for event_id, event_results in competition_results.items():
            if isinstance(event_id, str) and isinstance(event_results, list) and event_results:
                event_ids.add(event_id)

    return sorted(
        event_ids,
        key=lambda event_id: (EVENT_ORDER.get(event_id, 1000), EVENT_NAMES.get(event_id, event_id)),
    )


def _build_event_progression(
    event_id: str,
    results: Dict[str, Any],
    competitions: Dict[str, Dict[str, Any]],
) -> Dict[str, Any]:
    rounds: List[Dict[str, Any]] = []

    for competition_id, competition_results in results.items():
        if not isinstance(competition_id, str) or not isinstance(competition_results, dict):
            continue

        event_results = competition_results.get(event_id)
        if not isinstance(event_results, list):
            continue

        competition = competitions.get(competition_id, {})
        competition_date = _competition_start_date(competition)
        competition_name = str(competition.get("name") or competition_id)

        for round_index, result in enumerate(event_results):
            if not isinstance(result, dict):
                continue

            best_raw = _valid_result_value(result.get("best"))
            average_raw = _valid_result_value(result.get("average"))
            solves_raw = _valid_solve_values(result.get("solves"))
            round_name = str(result.get("round") or f"Round {round_index + 1}")
            format_name = str(result.get("format") or "")

            rounds.append(
                {
                    "competition_id": competition_id,
                    "competition_name": competition_name,
                    "date": competition_date,
                    "round": round_name,
                    "format": format_name,
                    "round_index": round_index,
                    "best_raw": best_raw,
                    "average_raw": average_raw,
                    "solves_raw": solves_raw,
                }
            )

    rounds.sort(
        key=lambda round_result: (
            round_result["date"] or "9999-12-31",
            round_result["competition_id"],
            round_result["round_index"],
        )
    )

    pb_progression: List[Dict[str, Any]] = []
    average_points: List[Dict[str, Any]] = []
    all_solve_values: List[float] = []
    best_average_raw: Optional[int] = None
    current_pb_raw: Optional[int] = None
    average_format = _average_format_for_event(event_id, rounds)

    for round_result in rounds:
        best_raw = round_result["best_raw"]
        average_raw = round_result["average_raw"]

        for solve_raw in round_result["solves_raw"]:
            value = _normalized_value(event_id, solve_raw)
            if value is not None:
                all_solve_values.append(value)

        if best_raw is not None and (
            current_pb_raw is None or _is_better_result(best_raw, current_pb_raw)
        ):
            current_pb_raw = best_raw
            point = _point_from_round(event_id, round_result, best_raw)
            point["pb_number"] = len(pb_progression) + 1
            pb_progression.append(point)

        if average_raw is not None:
            if best_average_raw is None or _is_better_result(average_raw, best_average_raw):
                best_average_raw = average_raw

            point = _point_from_round(event_id, round_result, average_raw)
            point["index"] = len(average_points) + 1
            average_points.append(point)

    competition_count = len(
        {
            round_result["competition_id"]
            for round_result in rounds
            if round_result["competition_id"]
        }
    )

    return {
        "event_id": event_id,
        "name": EVENT_NAMES.get(event_id, event_id),
        "unit": _unit_for_event(event_id),
        "average_label": average_format,
        "stats": {
            "competition_count": competition_count,
            "round_count": len(rounds),
            "solve_count": len(all_solve_values),
            "average_solve": _format_normalized(event_id, mean(all_solve_values))
            if all_solve_values
            else None,
            "average_solve_value": mean(all_solve_values)
            if all_solve_values
            else None,
            "median_solve": _format_normalized(event_id, median(all_solve_values))
            if all_solve_values
            else None,
            "median_solve_value": median(all_solve_values)
            if all_solve_values
            else None,
            "current_pb": _format_result_value(event_id, current_pb_raw),
            "current_pb_value": _normalized_value(event_id, current_pb_raw),
            "best_average": _format_result_value(event_id, best_average_raw),
            "best_average_value": _normalized_value(event_id, best_average_raw),
            "first_date": _first_known_date(rounds),
            "latest_date": _latest_known_date(rounds),
        },
        "pb_progression": pb_progression,
        "average_points": average_points,
    }


def _point_from_round(
    event_id: str, round_result: Dict[str, Any], raw_value: int
) -> Dict[str, Any]:
    return {
        "date": round_result["date"],
        "competition_id": round_result["competition_id"],
        "competition_name": round_result["competition_name"],
        "round": round_result["round"],
        "format": round_result["format"],
        "raw_value": raw_value,
        "value": _normalized_value(event_id, raw_value),
        "display": _format_result_value(event_id, raw_value),
    }


def _competition_start_date(competition: Dict[str, Any]) -> Optional[str]:
    date = competition.get("date")
    if not isinstance(date, dict):
        return None

    start_date = date.get("from")
    if not isinstance(start_date, str):
        return None

    return start_date


def _first_known_date(rounds: List[Dict[str, Any]]) -> Optional[str]:
    known_dates = [round_result["date"] for round_result in rounds if round_result["date"]]
    return known_dates[0] if known_dates else None


def _latest_known_date(rounds: List[Dict[str, Any]]) -> Optional[str]:
    known_dates = [round_result["date"] for round_result in rounds if round_result["date"]]
    return known_dates[-1] if known_dates else None


def _average_format_for_event(event_id: str, rounds: List[Dict[str, Any]]) -> str:
    for round_result in rounds:
        format_name = round_result["format"]
        if "Mean of 3" in format_name:
            return "Mo3"
        if "Average of 5" in format_name:
            return "Ao5"

    if event_id in {"333bf", "444bf", "555bf"}:
        return "Mo3"

    return "Ao5"


def _unit_for_event(event_id: str) -> str:
    if event_id == "333fm":
        return "moves"
    if event_id == "333mbf":
        return "score"
    return "seconds"


def _valid_solve_values(value: Any) -> List[int]:
    if not isinstance(value, list):
        return []

    return [
        solve_value
        for solve_value in value
        if isinstance(solve_value, int) and solve_value > 0
    ]


def _is_better_result(candidate: int, current_best: int) -> bool:
    return candidate < current_best


def _normalized_value(event_id: str, raw_value: Optional[int]) -> Optional[float]:
    if raw_value is None or raw_value <= 0:
        return None

    if event_id == "333fm":
        if raw_value >= 1000:
            return raw_value / 100
        return float(raw_value)

    if event_id == "333mbf":
        return float(raw_value)

    return raw_value / 100


def _format_result_value(event_id: str, raw_value: Optional[int]) -> Optional[str]:
    value = _normalized_value(event_id, raw_value)
    if value is None:
        return None

    return _format_normalized(event_id, value)


def _format_normalized(event_id: str, value: float) -> str:
    if event_id == "333fm":
        if value == int(value):
            return f"{int(value)} moves"
        return f"{value:.2f} moves"

    if event_id == "333mbf":
        return f"{int(value)} score"

    return _format_seconds(value)


def _format_seconds(seconds: float) -> str:
    if seconds < 60:
        return f"{seconds:.2f}s"

    minutes = int(seconds // 60)
    remaining_seconds = seconds - (minutes * 60)

    if minutes < 60:
        return f"{minutes}:{remaining_seconds:05.2f}"

    hours = minutes // 60
    remaining_minutes = minutes % 60
    return f"{hours}:{remaining_minutes:02d}:{remaining_seconds:05.2f}"


def _scan_result_bests(
    person: Dict[str, Any], event_id: str
) -> Tuple[Optional[int], Optional[int]]:
    results = person.get("results")
    if not isinstance(results, dict):
        return None, None

    single_values: List[int] = []
    average_values: List[int] = []

    for competition_results in results.values():
        if not isinstance(competition_results, dict):
            continue

        event_results = competition_results.get(event_id)
        if not isinstance(event_results, list):
            continue

        for result in event_results:
            if not isinstance(result, dict):
                continue

            best = _valid_result_value(result.get("best"))
            average = _valid_result_value(result.get("average"))

            if best is not None:
                single_values.append(best)
            if average is not None:
                average_values.append(average)

    single_best = min(single_values) if single_values else None
    average_best = min(average_values) if average_values else None
    return single_best, average_best


def _valid_result_value(value: Any) -> Optional[int]:
    if not isinstance(value, int):
        return None

    if value <= 0:
        return None

    return value
