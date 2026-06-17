"""Tests for `_build_event_progression`: the transform from raw WCA round data
into PB progression, average history, and summary stats."""

import pytest

from services.wca_api import _build_event_progression


COMPETITIONS = {
    "CompA": {"name": "Comp A", "date": {"from": "2020-01-01", "till": "2020-01-01"}},
    "CompB": {"name": "Comp B", "date": {"from": "2021-06-15", "till": "2021-06-15"}},
}

# CompA is chronologically first; its best (15.00) sets the initial PB, and CompB's
# best (12.00) improves it. CompA contains one DNF (-1).
RESULTS = {
    "CompA": {
        "333": [
            {
                "round": "First round",
                "format": "Average of 5",
                "best": 1500,
                "average": 1700,
                "solves": [1500, 1600, 1700, 1800, -1],
            }
        ]
    },
    "CompB": {
        "333": [
            {
                "round": "Final",
                "format": "Average of 5",
                "best": 1200,
                "average": 1400,
                "solves": [1200, 1300, 1400, 1500, 1450],
            }
        ]
    },
}

RANK_DATA = {
    "singles": [
        {"eventId": "333", "rank": {"world": 1000, "continent": 100, "country": 10}}
    ],
    "averages": [
        {"eventId": "333", "rank": {"world": 2000, "continent": 200, "country": 20}}
    ],
}


@pytest.fixture
def event():
    return _build_event_progression("333", RESULTS, COMPETITIONS, RANK_DATA)


class TestShape:
    def test_event_identity(self, event):
        assert event["event_id"] == "333"
        assert event["name"] == "3x3 Cube"
        assert event["unit"] == "seconds"
        assert event["average_label"] == "Ao5"


class TestStats:
    def test_counts(self, event):
        stats = event["stats"]
        assert stats["competition_count"] == 2
        assert stats["round_count"] == 2
        # 9 valid singles: 4 from CompA (the DNF is excluded) + 5 from CompB.
        assert stats["solve_count"] == 9

    def test_dnf_accounting(self, event):
        stats = event["stats"]
        # 10 real attempts (no skipped 0s), exactly one DNF.
        assert stats["attempt_count"] == 10
        assert stats["dnf_count"] == 1
        assert stats["dnf_rate"] == pytest.approx(0.1)

    def test_personal_bests(self, event):
        stats = event["stats"]
        assert stats["current_pb_value"] == 12.0
        assert stats["current_pb"] == "12.00s"
        assert stats["best_average_value"] == 14.0
        assert stats["best_average"] == "14.00s"

    def test_aggregate_solve_stats(self, event):
        stats = event["stats"]
        assert stats["worst_solve_value"] == 18.0
        assert stats["median_solve_value"] == 15.0
        assert stats["average_solve_value"] == pytest.approx(134.5 / 9)
        assert stats["solve_std_dev_value"] is not None

    def test_dates(self, event):
        stats = event["stats"]
        assert stats["first_date"] == "2020-01-01"
        assert stats["latest_date"] == "2021-06-15"

    def test_ranks_extracted(self, event):
        stats = event["stats"]
        assert stats["single_rank"] == {"world": 1000, "continent": 100, "country": 10}
        assert stats["average_rank"] == {"world": 2000, "continent": 200, "country": 20}


class TestProgressionSeries:
    def test_pb_progression_only_on_improvement(self, event):
        pbs = event["pb_progression"]
        # 15.00 (initial), then 12.00 (improves) — two points.
        assert [p["value"] for p in pbs] == [15.0, 12.0]
        assert [p["pb_number"] for p in pbs] == [1, 2]

    def test_average_points_chronological_with_index(self, event):
        avgs = event["average_points"]
        assert [a["value"] for a in avgs] == [17.0, 14.0]
        assert [a["index"] for a in avgs] == [1, 2]

    def test_result_rows_most_recent_first(self, event):
        rows = event["result_rows"]
        assert [r["competition_id"] for r in rows] == ["CompB", "CompA"]
        # Five attempts per row, formatted; CompA's last attempt is a DNF.
        assert rows[1]["attempts"][-1]["display"] == "DNF"


class TestEdgeCases:
    def test_undated_competition_sorts_last(self):
        comps = {
            "Dated": {"name": "Dated", "date": {"from": "2020-01-01"}},
            "Undated": {"name": "Undated", "date": None},
        }
        results = {
            "Undated": {"333": [{"round": "F", "format": "Average of 5", "best": 900, "average": 1000, "solves": [900]}]},
            "Dated": {"333": [{"round": "F", "format": "Average of 5", "best": 1100, "average": 1200, "solves": [1100]}]},
        }
        event = _build_event_progression("333", results, comps, None)
        # Dated round is processed first, so its best (11.00) is the initial PB even
        # though the undated round has a numerically lower best.
        assert event["pb_progression"][0]["value"] == 11.0
        assert event["stats"]["single_rank"] is None

    def test_fewest_moves_uses_move_unit(self):
        comps = {"C": {"name": "C", "date": {"from": "2020-01-01"}}}
        results = {
            "C": {"333fm": [{"round": "F", "format": "Mean of 3", "best": 25, "average": 2667, "solves": [25, 26, 27]}]}
        }
        event = _build_event_progression("333fm", results, comps, None)
        assert event["unit"] == "moves"
        assert event["average_label"] == "Mo3"
        assert event["stats"]["current_pb"] == "25 moves"
        # Encoded average 2667 -> 26.67 moves.
        assert event["stats"]["best_average"] == "26.67 moves"
