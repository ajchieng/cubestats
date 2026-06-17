"""Tests for the HTTP fetch layer and the full progression transform, with the
upstream WCA API mocked via respx. Covers the error taxonomy and a happy-path
end-to-end run including world-record fetching."""

import httpx
import pytest
import respx

from services.wca_api import (
    BASE_URL,
    ExternalAPIError,
    InvalidWCAIDError,
    No333ResultsError,
    PersonNotFoundError,
    fetch_person,
    fetch_world_records,
    get_competitor_progression,
)


def _url(path: str) -> str:
    return f"{BASE_URL}/{path}"


class TestFetchPersonErrors:
    @respx.mock
    async def test_404_maps_to_person_not_found(self):
        respx.get(_url("persons/2019TEST01.json")).mock(
            return_value=httpx.Response(404)
        )
        with pytest.raises(PersonNotFoundError):
            await fetch_person("2019TEST01")

    @respx.mock
    async def test_500_maps_to_external_api_error(self):
        respx.get(_url("persons/2019TEST01.json")).mock(
            return_value=httpx.Response(500)
        )
        with pytest.raises(ExternalAPIError):
            await fetch_person("2019TEST01")

    @respx.mock
    async def test_network_failure_maps_to_external_api_error(self):
        respx.get(_url("persons/2019TEST01.json")).mock(
            side_effect=httpx.ConnectError("boom")
        )
        with pytest.raises(ExternalAPIError):
            await fetch_person("2019TEST01")

    @respx.mock
    async def test_invalid_json_maps_to_external_api_error(self):
        respx.get(_url("persons/2019TEST01.json")).mock(
            return_value=httpx.Response(200, text="not json")
        )
        with pytest.raises(ExternalAPIError):
            await fetch_person("2019TEST01")


class TestFetchWorldRecords:
    @respx.mock
    async def test_reads_record_from_first_item(self):
        respx.get(_url("rank/world/single/333.json")).mock(
            return_value=httpx.Response(200, json={"items": [{"best": 276}, {"best": 280}]})
        )
        respx.get(_url("rank/world/average/333.json")).mock(
            return_value=httpx.Response(200, json={"items": [{"best": 371}]})
        )
        records = await fetch_world_records(["333"])
        assert records["333"] == {"single": 276, "average": 371}

    @respx.mock
    async def test_mbf_skips_average_request(self):
        single_route = respx.get(_url("rank/world/single/333mbf.json")).mock(
            return_value=httpx.Response(200, json={"items": [{"best": 380350302}]})
        )
        average_route = respx.get(_url("rank/world/average/333mbf.json")).mock(
            return_value=httpx.Response(200, json={"items": [{"best": 1}]})
        )
        records = await fetch_world_records(["333mbf"])
        assert records["333mbf"]["single"] == 380350302
        assert "average" not in records["333mbf"]
        assert single_route.called
        assert not average_route.called

    @respx.mock
    async def test_failed_record_fetch_degrades_to_none(self):
        respx.get(_url("rank/world/single/333.json")).mock(
            return_value=httpx.Response(500)
        )
        respx.get(_url("rank/world/average/333.json")).mock(
            side_effect=httpx.ConnectError("down")
        )
        records = await fetch_world_records(["333"])
        assert records["333"] == {"single": None, "average": None}


PERSON = {
    "name": "Test Person",
    "rank": {
        "singles": [
            {"eventId": "333", "rank": {"world": 1000, "continent": 100, "country": 10}}
        ],
        "averages": [
            {"eventId": "333", "rank": {"world": 2000, "continent": 200, "country": 20}}
        ],
    },
    "results": {
        "CompA": {
            "333": [
                {
                    "round": "Final",
                    "format": "Average of 5",
                    "best": 1200,
                    "average": 1400,
                    "solves": [1200, 1300, 1400, 1500, 1450],
                }
            ]
        }
    },
}


def _mock_happy_path():
    respx.get(_url("persons/2019TEST01.json")).mock(
        return_value=httpx.Response(200, json=PERSON)
    )
    respx.get(_url("competitions/CompA.json")).mock(
        return_value=httpx.Response(
            200,
            json={"id": "CompA", "name": "Comp A", "date": {"from": "2021-01-01", "till": "2021-01-01"}},
        )
    )
    respx.get(_url("rank/world/single/333.json")).mock(
        return_value=httpx.Response(200, json={"items": [{"best": 276}]})
    )
    respx.get(_url("rank/world/average/333.json")).mock(
        return_value=httpx.Response(200, json={"items": [{"best": 371}]})
    )


class TestGetCompetitorProgression:
    async def test_invalid_id_rejected_before_any_request(self):
        with pytest.raises(InvalidWCAIDError):
            await get_competitor_progression("nope")

    @respx.mock
    async def test_person_with_no_results_raises(self):
        respx.get(_url("persons/2019TEST01.json")).mock(
            return_value=httpx.Response(200, json={"name": "Empty", "results": {}})
        )
        with pytest.raises(No333ResultsError):
            await get_competitor_progression("2019TEST01")

    @respx.mock
    async def test_end_to_end_shape(self):
        _mock_happy_path()
        data = await get_competitor_progression("2019test01")

        assert data["wca_id"] == "2019TEST01"
        assert data["name"] == "Test Person"
        assert [e["event_id"] for e in data["events"]] == ["333"]

        event = data["events"][0]
        assert event["stats"]["current_pb"] == "12.00s"
        assert event["stats"]["single_rank"]["country"] == 10

    @respx.mock
    async def test_end_to_end_all_around(self):
        _mock_happy_path()
        data = await get_competitor_progression("2019TEST01")

        all_around = data["all_around"]
        kinch = all_around["kinch"]
        assert kinch["event_count"] == 17
        assert kinch["events"][0]["event_id"] == "333"
        assert kinch["events"][0]["basis"] == "average"
        assert kinch["events"][0]["score"] == pytest.approx(100 * 3.71 / 14.0)
        assert kinch["overall"] == pytest.approx(round(100 * 3.71 / 14.0 / 17, 2))
        assert all_around["sum_of_ranks"]["single"]["world"] == 1000

    @respx.mock
    async def test_world_record_failure_still_returns_sum_of_ranks(self):
        respx.get(_url("persons/2019TEST01.json")).mock(
            return_value=httpx.Response(200, json=PERSON)
        )
        respx.get(_url("competitions/CompA.json")).mock(
            return_value=httpx.Response(200, json={"id": "CompA", "name": "Comp A", "date": {"from": "2021-01-01"}})
        )
        # World-record endpoints are down.
        respx.get(_url("rank/world/single/333.json")).mock(side_effect=httpx.ConnectError("down"))
        respx.get(_url("rank/world/average/333.json")).mock(side_effect=httpx.ConnectError("down"))

        data = await get_competitor_progression("2019TEST01")
        all_around = data["all_around"]
        # Kinch can't score without records, but Sum of Ranks still works.
        assert all_around["kinch"]["overall"] is None
        assert all_around["kinch"]["events"] == []
        assert all_around["sum_of_ranks"]["single"]["world"] == 1000
