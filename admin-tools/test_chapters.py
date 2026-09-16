"""
test_chapters.py — Unit tests for chapter derivation, typography sanitization, timestamp ordering, and dynamic fallback.
"""
import os
import sys
import unittest

sys.path.insert(0, os.path.dirname(__file__))

from pipeline.step6b_chapters import (
    format_seconds_to_timestamp,
    clean_chapter_title,
    _get_dynamic_fallback_beats,
    derive_chapters_from_alignment,
)


class TestChapterHelpers(unittest.TestCase):
    """Unit tests for formatting and sanitization helpers."""

    def test_format_seconds_to_timestamp(self):
        self.assertEqual(format_seconds_to_timestamp(0.0), "00:00")
        self.assertEqual(format_seconds_to_timestamp(45.2), "00:45")
        self.assertEqual(format_seconds_to_timestamp(75.0), "01:15")
        self.assertEqual(format_seconds_to_timestamp(3665.0), "1:01:05")
        self.assertEqual(format_seconds_to_timestamp(7325.0), "2:02:05")

    def test_clean_chapter_title_typography(self):
        # Em dash, en dash, double hyphen replaced
        self.assertEqual(
            clean_chapter_title("Cold Open — Hot Peter"),
            "Cold Open: Hot Peter"
        )
        self.assertEqual(
            clean_chapter_title("Act I – Arrival"),
            "Act I: Arrival"
        )
        self.assertEqual(
            clean_chapter_title("Act II -- Peter At The Mill"),
            "Act II: Peter At The Mill"
        )
        # Curly quotes straightened
        self.assertEqual(
            clean_chapter_title('“This House Is Freakin’ Sweet”'),
            '"This House Is Freakin\' Sweet"'
        )
        # Extra whitespace collapsed
        self.assertEqual(
            clean_chapter_title("  Cold Open:   Peter   "),
            "Cold Open: Peter"
        )


class TestDynamicFallbackBeats(unittest.TestCase):
    """Unit tests for dynamic fallback beat generator."""

    def test_dynamic_beats_have_no_test_fixture_bleed(self):
        beats = _get_dynamic_fallback_beats(
            episode_title="Holy Crap",
            season=2,
            episode=2,
            total_runtime=8000.0
        )
        self.assertGreaterEqual(len(beats), 5)
        self.assertEqual(beats[0]["target_sec"], 0.0)
        self.assertTrue(beats[0].get("required_start"))

        all_titles = " ".join(b["title"] for b in beats)
        # Ensure test episode 1 artifacts never appear
        self.assertNotIn("RHCP", all_titles)
        self.assertNotIn("Tim", all_titles)
        self.assertNotIn("Cherrywood", all_titles)
        self.assertNotIn("Newport", all_titles)
        self.assertIn("Holy Crap", all_titles)


class TestDeriveChaptersFromAlignment(unittest.TestCase):
    """Unit tests for anchor matching against alignment data."""

    def setUp(self):
        self.mock_alignment = {
            "segments": [
                {
                    "segment_id": 1,
                    "speaker": "Jason",
                    "matched": True,
                    "srt_start_seconds": 12.5,
                    "confidence": 0.95,
                    "text": "Welcome everyone."
                },
                {
                    "segment_id": 2,
                    "speaker": "Collin",
                    "matched": True,
                    "srt_start_seconds": 1200.0,
                    "confidence": 0.92,
                    "text": "Act one begins here."
                },
                {
                    "segment_id": 3,
                    "speaker": "Tyler",
                    "matched": True,
                    "srt_start_seconds": 2500.0,
                    "confidence": 0.91,
                    "text": "Moving on to act two."
                },
                {
                    "segment_id": 4,
                    "speaker": "Jason",
                    "matched": True,
                    "srt_start_seconds": 4000.0,
                    "confidence": 0.96,
                    "text": "Ratings time."
                },
                {
                    "segment_id": 5,
                    "speaker": "Tyler",
                    "matched": True,
                    "srt_start_seconds": 4800.0,
                    "confidence": 0.94,
                    "text": "Final thoughts."
                }
            ]
        }

    def test_derived_chapters_start_at_zero_and_ascend(self):
        custom_beats = [
            {"target_sec": 0.0, "title": "Cold Open", "required_start": True},
            {"target_sec": 1100.0, "title": "Act I: Discussion"},
            {"target_sec": 2400.0, "title": "Act II: Discussion"},
            {"target_sec": 3900.0, "title": "Host Ratings"},
            {"target_sec": 4700.0, "title": "Outro"},
        ]
        chapters = derive_chapters_from_alignment(
            self.mock_alignment,
            episode_title="Test Episode",
            season=1,
            episode=1,
            custom_beats=custom_beats,
        )

        self.assertEqual(len(chapters), 5)
        self.assertEqual(chapters[0]["timestamp"], "00:00")
        self.assertEqual(chapters[0]["time_seconds"], 0.0)

        # Strictly ascending
        for i in range(len(chapters) - 1):
            self.assertLess(
                chapters[i]["time_seconds"],
                chapters[i + 1]["time_seconds"]
            )


if __name__ == "__main__":
    unittest.main()
