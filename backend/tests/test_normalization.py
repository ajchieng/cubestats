"""Unit tests for the WCA integer-encoding glue: normalization, formatting,
sentinels, ID validation, and rank extraction."""

import pytest

from services.wca_api import (
    InvalidWCAIDError,
    _average_format_for_event,
    _decode_mbf_points,
    _event_rank,
    _format_any_result_value,
    _format_normalized,
    _format_seconds,
    _is_better_result,
    _normalized_value,
    _positive_int,
    _unit_for_event,
    normalize_wca_id,
)


class TestNormalizeWcaId:
    def test_trims_and_uppercases(self):
        assert normalize_wca_id("  2019chie01 ") == "2019CHIE01"

    @pytest.mark.parametrize(
        "bad",
        ["2019CHIE0", "19CHIE01", "2019CHI01", "2019CHIE011", "ABCD1234EF", ""],
    )
    def test_rejects_malformed_ids(self, bad):
        with pytest.raises(InvalidWCAIDError):
            normalize_wca_id(bad)


class TestNormalizedValue:
    def test_centiseconds_to_seconds(self):
        assert _normalized_value("333", 1234) == 12.34

    @pytest.mark.parametrize("raw", [0, -1, -2, None])
    def test_non_positive_and_none_are_dropped(self, raw):
        assert _normalized_value("333", raw) is None

    def test_fm_literal_move_count(self):
        # A single FM solve is a literal move count.
        assert _normalized_value("333fm", 25) == 25.0

    def test_fm_encoded_average_divides_by_100(self):
        # An FM *average* is encoded x100 (raw >= 1000).
        assert _normalized_value("333fm", 2467) == 24.67

    def test_mbf_kept_as_packed_score(self):
        assert _normalized_value("333mbf", 380350302) == 380350302.0


class TestDecodeMbfPoints:
    def test_decodes_world_record(self):
        # Real MBF single WR packed value -> 61 net points.
        assert _decode_mbf_points(380350302) == 61

    def test_decodes_mid_value(self):
        # DD = 69 -> 99 - 69 = 30 points.
        assert _decode_mbf_points(690_000_000) == 30

    @pytest.mark.parametrize("raw", [0, -1, None, "x"])
    def test_invalid_inputs_return_none(self, raw):
        assert _decode_mbf_points(raw) is None

    def test_non_positive_points_return_none(self):
        # DD = 99 -> 0 points, which is not a valid result.
        assert _decode_mbf_points(990_000_000) is None


class TestIsBetterResult:
    def test_lower_is_better(self):
        assert _is_better_result(1200, 1500) is True
        assert _is_better_result(1500, 1200) is False
        assert _is_better_result(1200, 1200) is False


class TestUnitForEvent:
    @pytest.mark.parametrize(
        "event_id,unit",
        [("333fm", "moves"), ("333mbf", "score"), ("333", "seconds"), ("minx", "seconds")],
    )
    def test_unit(self, event_id, unit):
        assert _unit_for_event(event_id) == unit


class TestFormatSeconds:
    @pytest.mark.parametrize(
        "seconds,expected",
        [
            (12.34, "12.34s"),
            (59.99, "59.99s"),
            (60.0, "1:00.00"),
            (75.5, "1:15.50"),
            (3661.0, "1:01:01.00"),
        ],
    )
    def test_format(self, seconds, expected):
        assert _format_seconds(seconds) == expected


class TestFormatNormalized:
    def test_fm_integer_moves(self):
        assert _format_normalized("333fm", 25.0) == "25 moves"

    def test_fm_fractional_average(self):
        assert _format_normalized("333fm", 24.67) == "24.67 moves"

    def test_mbf_score(self):
        assert _format_normalized("333mbf", 380350302.0) == "380350302 score"

    def test_seconds(self):
        assert _format_normalized("333", 12.34) == "12.34s"


class TestFormatAnyResultValue:
    @pytest.mark.parametrize(
        "raw,expected",
        [(-1, "DNF"), (-2, "DNS"), (0, None), (1234, "12.34s")],
    )
    def test_sentinels_and_values(self, raw, expected):
        assert _format_any_result_value("333", raw) == expected


class TestPositiveInt:
    @pytest.mark.parametrize("value,expected", [(5, 5), (0, None), (-3, None), ("7", None), (None, None)])
    def test_positive_int(self, value, expected):
        assert _positive_int(value) == expected


class TestEventRank:
    RANK_DATA = {
        "singles": [
            {"eventId": "333", "rank": {"world": 1000, "continent": 100, "country": 10}},
            {"eventId": "222", "rank": {"world": 0, "continent": 0, "country": 0}},
        ],
    }

    def test_returns_positions_for_event(self):
        assert _event_rank(self.RANK_DATA, "singles", "333") == {
            "world": 1000,
            "continent": 100,
            "country": 10,
        }

    def test_all_zero_positions_return_none(self):
        # Zero ranks are sentinels for "unranked" -> the whole entry is None.
        assert _event_rank(self.RANK_DATA, "singles", "222") is None

    def test_missing_event_returns_none(self):
        assert _event_rank(self.RANK_DATA, "singles", "444") is None

    def test_missing_rank_type_returns_none(self):
        assert _event_rank(self.RANK_DATA, "averages", "333") is None

    def test_non_dict_rank_data_returns_none(self):
        assert _event_rank(None, "singles", "333") is None


class TestAverageFormatForEvent:
    def test_detects_mean_of_3_from_rounds(self):
        rounds = [{"format": "Mean of 3"}]
        assert _average_format_for_event("333", rounds) == "Mo3"

    def test_detects_average_of_5_from_rounds(self):
        rounds = [{"format": "Average of 5"}]
        assert _average_format_for_event("333", rounds) == "Ao5"

    def test_blind_events_default_to_mo3(self):
        assert _average_format_for_event("333bf", []) == "Mo3"

    def test_default_is_ao5(self):
        assert _average_format_for_event("333", []) == "Ao5"
