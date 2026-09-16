"""
test_validation.py — Comprehensive unit tests for episode payload validation and helper logic.
"""
import os
import sys
import unittest

sys.path.insert(0, os.path.dirname(__file__))

from validation import validate_episode_dict, validate_url, ALLOWED_EPISODE_FIELDS


class TestValidateUrl(unittest.TestCase):
    """Unit tests for validate_url helper function."""

    def test_empty_or_none_returns_empty_string(self):
        self.assertEqual(validate_url(None), "")
        self.assertEqual(validate_url(""), "")
        self.assertEqual(validate_url("   "), "")

    def test_https_url_preserved(self):
        url = "https://www.youtube.com/watch?v=dQw4w9WgXcQ"
        self.assertEqual(validate_url(url), url)

    def test_http_url_upgraded_to_https(self):
        url = "http://www.youtube.com/watch?v=dQw4w9WgXcQ"
        expected = "https://www.youtube.com/watch?v=dQw4w9WgXcQ"
        self.assertEqual(validate_url(url), expected)

    def test_url_with_whitespace_stripped(self):
        url = "  https://youtu.be/dQw4w9WgXcQ  "
        self.assertEqual(validate_url(url), "https://youtu.be/dQw4w9WgXcQ")

    def test_invalid_scheme_raises_value_error(self):
        invalid_urls = [
            "ftp://files.example.com",
            "javascript:alert(1)",
            "www.youtube.com/watch?v=xyz",
            "htp://typo.com",
            "not-a-url",
        ]
        for url in invalid_urls:
            with self.subTest(url=url):
                with self.assertRaises(ValueError) as ctx:
                    validate_url(url)
                self.assertIn("URL must start with https://", str(ctx.exception))


class TestValidateEpisodeDict(unittest.TestCase):
    """Unit tests for validate_episode_dict."""

    def setUp(self):
        """Standard minimal valid episode payload for testing variations."""
        self.valid_minimal = {
            "id": "s01e01",
            "season": 1,
            "episode_number": 1,
            "title": "Death Has a Shadow",
        }

    def test_minimal_valid_payload(self):
        """Minimal payload with only required fields should validate with clean defaults."""
        result = validate_episode_dict(self.valid_minimal)
        expected = {
            "id": "s01e01",
            "season": 1,
            "episode_number": 1,
            "title": "Death Has a Shadow",
            "air_date": "",
            "runtime": "",
            "imdb_rating": "",
            "summary": "",
            "cast": [],
            "writers": [],
            "director": "",
        }
        self.assertEqual(result, expected)
        self.assertNotIn("youtube_url", result)
        self.assertNotIn("watch_status", result)

    def test_full_valid_payload(self):
        """Full payload with all allowed fields should validate and retain all data."""
        payload = {
            "id": "s01e01",
            "season": 1,
            "episode_number": 1,
            "title": "Death Has a Shadow",
            "air_date": "1999-01-31",
            "runtime": "22 min",
            "imdb_rating": "7.8",
            "summary": "Peter loses his job after drinking too much at a bachelor party.",
            "cast": ["Seth MacFarlane", "Alex Borstein", "Seth Green", "Mila Kunis"],
            "writers": ["Seth MacFarlane"],
            "director": "Peter Shin",
            "youtube_url": "https://www.youtube.com/watch?v=xyz123",
            "watch_status": "published",
        }
        result = validate_episode_dict(payload)
        self.assertEqual(result["id"], "s01e01")
        self.assertEqual(result["season"], 1)
        self.assertEqual(result["episode_number"], 1)
        self.assertEqual(result["title"], "Death Has a Shadow")
        self.assertEqual(result["air_date"], "1999-01-31")
        self.assertEqual(result["runtime"], "22 min")
        self.assertEqual(result["imdb_rating"], "7.8")
        self.assertEqual(result["summary"], "Peter loses his job after drinking too much at a bachelor party.")
        self.assertEqual(result["cast"], ["Seth MacFarlane", "Alex Borstein", "Seth Green", "Mila Kunis"])
        self.assertEqual(result["writers"], ["Seth MacFarlane"])
        self.assertEqual(result["director"], "Peter Shin")
        self.assertEqual(result["youtube_url"], "https://www.youtube.com/watch?v=xyz123")
        self.assertEqual(result["watch_status"], "published")

    def test_rejects_unexpected_extra_fields(self):
        """Any field not in ALLOWED_EPISODE_FIELDS must raise ValueError."""
        payload = dict(self.valid_minimal)
        payload["unauthorized_field"] = "malicious_payload"
        payload["bonus_key"] = 42

        with self.assertRaises(ValueError) as ctx:
            validate_episode_dict(payload)
        err_msg = str(ctx.exception)
        self.assertIn("Payload contains unexpected extra fields", err_msg)
        self.assertTrue("unauthorized_field" in err_msg or "bonus_key" in err_msg)

    def test_missing_or_blank_id_raises_value_error(self):
        """Missing, empty, or whitespace-only id should raise ValueError."""
        test_cases = [
            {},  # missing
            {"id": ""},  # empty string
            {"id": "   "},  # whitespace only
        ]
        for base in test_cases:
            payload = dict(self.valid_minimal)
            payload.update(base)
            if "id" not in base:
                del payload["id"]
            with self.subTest(payload=payload):
                with self.assertRaises(ValueError) as ctx:
                    validate_episode_dict(payload)
                self.assertIn("Episode 'id' is required", str(ctx.exception))

    def test_id_stripping_and_coercion(self):
        """ID with whitespace should be stripped; numeric ID should be coerced to string."""
        payload1 = dict(self.valid_minimal, id="  s02e05  ")
        self.assertEqual(validate_episode_dict(payload1)["id"], "s02e05")

        payload2 = dict(self.valid_minimal, id=105)
        self.assertEqual(validate_episode_dict(payload2)["id"], "105")

    def test_invalid_season_raises_value_error(self):
        """Missing season, season < 1, or non-integer season must raise ValueError."""
        # Missing season defaults to 0 -> raises
        payload_missing = dict(self.valid_minimal)
        del payload_missing["season"]
        with self.assertRaises(ValueError) as ctx:
            validate_episode_dict(payload_missing)
        self.assertIn("Season must be >= 1", str(ctx.exception))

        # Zero and negative values
        for bad_season in [0, -1, -99]:
            with self.subTest(season=bad_season):
                payload = dict(self.valid_minimal, season=bad_season)
                with self.assertRaises(ValueError) as ctx:
                    validate_episode_dict(payload)
                self.assertIn("Season must be >= 1", str(ctx.exception))

        # Non-numeric string
        payload_non_int = dict(self.valid_minimal, season="season_one")
        with self.assertRaises(ValueError):
            validate_episode_dict(payload_non_int)

    def test_season_coerces_valid_string_integer(self):
        """Numeric strings for season should be converted to int."""
        payload = dict(self.valid_minimal, season="2")
        self.assertEqual(validate_episode_dict(payload)["season"], 2)

    def test_invalid_episode_number_raises_value_error(self):
        """Missing episode_number, number < 1, or non-integer must raise ValueError."""
        # Missing defaults to 0 -> raises
        payload_missing = dict(self.valid_minimal)
        del payload_missing["episode_number"]
        with self.assertRaises(ValueError) as ctx:
            validate_episode_dict(payload_missing)
        self.assertIn("Episode number must be >= 1", str(ctx.exception))

        # Zero and negative values
        for bad_ep_num in [0, -1, -10]:
            with self.subTest(episode_number=bad_ep_num):
                payload = dict(self.valid_minimal, episode_number=bad_ep_num)
                with self.assertRaises(ValueError) as ctx:
                    validate_episode_dict(payload)
                self.assertIn("Episode number must be >= 1", str(ctx.exception))

        # Non-numeric string
        payload_non_int = dict(self.valid_minimal, episode_number="three")
        with self.assertRaises(ValueError):
            validate_episode_dict(payload_non_int)

    def test_episode_number_coerces_valid_string_integer(self):
        """Numeric strings for episode_number should be converted to int."""
        payload = dict(self.valid_minimal, episode_number="12")
        self.assertEqual(validate_episode_dict(payload)["episode_number"], 12)

    def test_missing_or_blank_title_raises_value_error(self):
        """Missing, empty, or whitespace-only title must raise ValueError."""
        test_cases = [
            {},  # missing
            {"title": ""},  # empty string
            {"title": "   \t\n  "},  # whitespace only
        ]
        for base in test_cases:
            payload = dict(self.valid_minimal)
            payload.update(base)
            if "title" not in base:
                del payload["title"]
            with self.subTest(payload=payload):
                with self.assertRaises(ValueError) as ctx:
                    validate_episode_dict(payload)
                self.assertIn("Episode 'title' cannot be empty", str(ctx.exception))

    def test_title_strips_and_truncates_to_255_chars(self):
        """Title with surrounding whitespace is stripped, and titles > 255 chars are truncated."""
        payload_spaces = dict(self.valid_minimal, title="   I Never Met the Dead Man   ")
        self.assertEqual(validate_episode_dict(payload_spaces)["title"], "I Never Met the Dead Man")

        long_title = "A" * 300
        payload_long = dict(self.valid_minimal, title=long_title)
        result = validate_episode_dict(payload_long)
        self.assertEqual(len(result["title"]), 255)
        self.assertEqual(result["title"], "A" * 255)

    def test_youtube_url_upgrades_http_and_trims(self):
        """youtube_url with http:// is upgraded to https://, and whitespace is trimmed."""
        payload = dict(self.valid_minimal, youtube_url="  http://www.youtube.com/watch?v=abc12345  ")
        result = validate_episode_dict(payload)
        self.assertEqual(result["youtube_url"], "https://www.youtube.com/watch?v=abc12345")

    def test_youtube_url_empty_is_omitted(self):
        """Empty or whitespace-only youtube_url should not be present in output."""
        payload1 = dict(self.valid_minimal, youtube_url="")
        self.assertNotIn("youtube_url", validate_episode_dict(payload1))

        payload2 = dict(self.valid_minimal, youtube_url="   ")
        self.assertNotIn("youtube_url", validate_episode_dict(payload2))

    def test_youtube_url_invalid_scheme_raises_value_error(self):
        """youtube_url with invalid scheme raises ValueError."""
        payload = dict(self.valid_minimal, youtube_url="ftp://youtube.com/v/123")
        with self.assertRaises(ValueError) as ctx:
            validate_episode_dict(payload)
        self.assertIn("URL must start with https://", str(ctx.exception))

    def test_watch_status_valid_options_and_normalization(self):
        """Valid watch statuses (backlog, watched, recorded, published) are normalized to lowercase."""
        valid_statuses = ["backlog", "watched", "recorded", "published"]
        for status in valid_statuses:
            with self.subTest(status=status):
                payload = dict(self.valid_minimal, watch_status=status.upper())
                result = validate_episode_dict(payload)
                self.assertEqual(result["watch_status"], status)

        # Surrounding whitespace
        payload_ws = dict(self.valid_minimal, watch_status="  Recorded  ")
        self.assertEqual(validate_episode_dict(payload_ws)["watch_status"], "recorded")

    def test_watch_status_invalid_raises_value_error(self):
        """Invalid watch status raises ValueError."""
        invalid_statuses = ["draft", "finished", "in_progress", "unknown", ""]
        for bad_status in invalid_statuses:
            with self.subTest(status=bad_status):
                payload = dict(self.valid_minimal, watch_status=bad_status)
                with self.assertRaises(ValueError) as ctx:
                    validate_episode_dict(payload)
                self.assertIn("Invalid watch_status", str(ctx.exception))

    def test_cast_and_writers_conversion(self):
        """cast and writers provided as iterables/tuples are converted to lists."""
        payload = dict(
            self.valid_minimal,
            cast=("Actor One", "Actor Two"),
            writers=("Writer One",),
        )
        result = validate_episode_dict(payload)
        self.assertIsInstance(result["cast"], list)
        self.assertEqual(result["cast"], ["Actor One", "Actor Two"])
        self.assertIsInstance(result["writers"], list)
        self.assertEqual(result["writers"], ["Writer One"])

    def test_string_fields_stripped(self):
        """String fields (air_date, runtime, imdb_rating, summary, director) are stripped of whitespace."""
        payload = dict(
            self.valid_minimal,
            air_date="  2000-01-01  ",
            runtime="  22 min  ",
            imdb_rating="  8.1  ",
            summary="  A fun episode summary.  ",
            director="  Dominic Polcino  ",
        )
        result = validate_episode_dict(payload)
        self.assertEqual(result["air_date"], "2000-01-01")
        self.assertEqual(result["runtime"], "22 min")
        self.assertEqual(result["imdb_rating"], "8.1")
        self.assertEqual(result["summary"], "A fun episode summary.")
        self.assertEqual(result["director"], "Dominic Polcino")


if __name__ == "__main__":
    unittest.main()
