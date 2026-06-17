"""Tests for the all-around metrics: Kinch score and Sum of Ranks."""

import pytest

from services.wca_api import (
    CURRENT_EVENTS,
    _build_all_around,
    _kinch_for_event,
    _sum_of_ranks,
)


# Real 3x3 world records (centiseconds): single 2.76s, average 3.71s.
WR_333_SINGLE = 276
WR_333_AVERAGE = 371


class TestKinchForEvent:
    def test_prefers_average_basis(self):
        score, basis = _kinch_for_event("333", 12.0, 14.0, WR_333_SINGLE, WR_333_AVERAGE)
        assert basis == "average"
        assert score == pytest.approx(100 * 3.71 / 14.0)

    def test_falls_back_to_single_without_average(self):
        score, basis = _kinch_for_event("333", 12.0, None, WR_333_SINGLE, WR_333_AVERAGE)
        assert basis == "single"
        assert score == pytest.approx(100 * 2.76 / 12.0)

    def test_score_clamped_at_100(self):
        # A PR faster than the WR (stale data) must not exceed 100.
        score, basis = _kinch_for_event("333", 1.0, 1.0, WR_333_SINGLE, WR_333_AVERAGE)
        assert score == 100.0
        assert basis == "average"

    def test_mbf_uses_points(self):
        # WR 61 points; competitor 30 points (packed 690_000_000).
        score, basis = _kinch_for_event("333mbf", 690_000_000.0, None, 380350302, None)
        assert basis == "points"
        assert score == pytest.approx(100 * 30 / 61)

    def test_returns_none_without_record(self):
        assert _kinch_for_event("333", 12.0, 14.0, None, None) == (None, None)

    def test_returns_none_without_personal_result(self):
        assert _kinch_for_event("333", None, None, WR_333_SINGLE, WR_333_AVERAGE) == (None, None)


def _event(event_id, name, single_rank, average_rank):
    return {
        "event_id": event_id,
        "name": name,
        "stats": {"single_rank": single_rank, "average_rank": average_rank},
    }


class TestSumOfRanks:
    def test_sums_across_current_events(self):
        events = [
            _event("333", "3x3", {"world": 1000, "continent": 100, "country": 10},
                   {"world": 2000, "continent": 200, "country": 20}),
            _event("222", "2x2", {"world": 500, "continent": 50, "country": 5},
                   {"world": 600, "continent": 60, "country": 6}),
        ]
        sor = _sum_of_ranks(events)
        assert sor["single"] == {"world": 1500, "continent": 150, "country": 15, "event_count": 2}
        assert sor["average"] == {"world": 2600, "continent": 260, "country": 26, "event_count": 2}

    def test_excludes_deprecated_events(self):
        events = [
            _event("333", "3x3", {"world": 1000, "continent": 100, "country": 10}, None),
            _event("magic", "Magic", {"world": 1, "continent": 1, "country": 1}, None),
        ]
        sor = _sum_of_ranks(events)
        # The deprecated 'magic' event must not contribute.
        assert sor["single"]["world"] == 1000
        assert sor["single"]["event_count"] == 1

    def test_excludes_unranked_events(self):
        events = [
            _event("333", "3x3", {"world": 1000, "continent": 100, "country": 10}, None),
            _event("444", "4x4", None, None),
        ]
        sor = _sum_of_ranks(events)
        assert sor["single"]["event_count"] == 1
        # No average ranks anywhere -> sums are None.
        assert sor["average"]["world"] is None
        assert sor["average"]["event_count"] == 0


class TestBuildAllAround:
    def _event_with_pb(self, event_id, name, pb, best_avg, single_rank, average_rank):
        return {
            "event_id": event_id,
            "name": name,
            "stats": {
                "current_pb_value": pb,
                "best_average_value": best_avg,
                "single_rank": single_rank,
                "average_rank": average_rank,
            },
        }

    def test_combines_kinch_and_sor(self):
        events = [
            self._event_with_pb(
                "333", "3x3 Cube", 12.0, 14.0,
                {"world": 1000, "continent": 100, "country": 10},
                {"world": 2000, "continent": 200, "country": 20},
            )
        ]
        world_records = {"333": {"single": WR_333_SINGLE, "average": WR_333_AVERAGE}}
        result = _build_all_around(events, world_records)

        kinch = result["kinch"]
        assert kinch["event_count"] == len(CURRENT_EVENTS) == 17
        assert len(kinch["events"]) == 1
        assert kinch["events"][0]["event_id"] == "333"
        assert kinch["events"][0]["basis"] == "average"
        # Overall divides the single event's score by all 17 events.
        single_score = 100 * 3.71 / 14.0
        assert kinch["overall"] == pytest.approx(round(single_score / 17, 2))
        assert result["sum_of_ranks"]["single"]["world"] == 1000

    def test_overall_none_without_any_scores(self):
        events = [
            self._event_with_pb("333", "3x3 Cube", 12.0, 14.0, None, None)
        ]
        # No world records available -> no scored events.
        result = _build_all_around(events, {})
        assert result["kinch"]["overall"] is None
        assert result["kinch"]["events"] == []

    def test_skips_events_outside_current_set(self):
        events = [
            self._event_with_pb("magic", "Magic", 5.0, 6.0, None, None)
        ]
        world_records = {"magic": {"single": 100, "average": 120}}
        result = _build_all_around(events, world_records)
        # Deprecated events never score, even with a record present.
        assert result["kinch"]["events"] == []
