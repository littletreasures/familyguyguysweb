"""
test_chapters.py — Unit tests for chapter derivation, typography sanitization, timestamp ordering, and dynamic fallback.
"""
import json
import os
import sys
import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch

sys.path.insert(0, os.path.dirname(__file__))

from pipeline.step6b_chapters import (
    format_seconds_to_timestamp,
    clean_chapter_title,
    _get_dynamic_fallback_beats,
    derive_chapters_from_alignment,
    run_step6b_chapters,
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


class TestChaptersGuardrail(unittest.TestCase):
    """Unit tests for the 70% match rate guardrail in run_step6b_chapters."""

    @patch("pipeline.step6b_chapters.update_step_state")
    @patch("pipeline.step6b_chapters.get_episodes_dir")
    def test_refuses_auto_generation_when_match_rate_below_70(self, mock_get_dir, mock_update_state):
        with tempfile.TemporaryDirectory() as tmpdir:
            tmp_path = Path(tmpdir)
            mock_get_dir.return_value = tmp_path
            alignment_file = tmp_path / "alignment.json"
            alignment_data = {
                "summary": {
                    "match_percentage": 48.8,
                    "matched_segments": 100,
                    "unmatched_segments": 105,
                },
                "segments": [
                    {
                        "segment_id": 1,
                        "matched": True,
                        "srt_start_seconds": 0.0,
                        "confidence": 0.95,
                        "text": "Intro",
                    },
                    {
                        "segment_id": 2,
                        "matched": True,
                        "srt_start_seconds": 600.0,
                        "confidence": 0.95,
                        "text": "Discussion",
                    },
                ],
            }
            with open(alignment_file, "w", encoding="utf-8") as f:
                json.dump(alignment_data, f)

            with self.assertRaises(ValueError) as ctx:
                run_step6b_chapters("s01e99_test", dry_run=True)

            self.assertIn("below the 70.0% guardrail (incomplete map)", str(ctx.exception))
            self.assertIn("48.8%", str(ctx.exception))
            mock_update_state.assert_called_with(
                "s01e99_test",
                "step6b_chapters",
                "error",
                logs=str(ctx.exception),
            )

    @patch("pipeline.step6b_chapters.update_step_state")
    @patch("pipeline.step6b_chapters.get_episodes_dir")
    def test_allows_custom_chapters_when_match_rate_below_70(self, mock_get_dir, mock_update_state):
        with tempfile.TemporaryDirectory() as tmpdir:
            tmp_path = Path(tmpdir)
            mock_get_dir.return_value = tmp_path
            alignment_file = tmp_path / "alignment.json"
            alignment_data = {
                "summary": {
                    "match_percentage": 48.8,
                    "matched_segments": 100,
                    "unmatched_segments": 105,
                },
                "segments": [],
            }
            with open(alignment_file, "w", encoding="utf-8") as f:
                json.dump(alignment_data, f)

            custom_chapters = [
                {"timestamp": "00:00", "time_seconds": 0.0, "title": "Cold Open"},
                {"timestamp": "05:00", "time_seconds": 300.0, "title": "Act I"},
            ]
            result = run_step6b_chapters("s01e99_test", dry_run=True, custom_chapters=custom_chapters)
            self.assertEqual(result["status"], "done")
            self.assertEqual(result["source_mode"], "custom")
            self.assertEqual(len(result["chapters"]), 2)
            self.assertTrue((tmp_path / "chapters.txt").exists())


if __name__ == "__main__":
    unittest.main()

