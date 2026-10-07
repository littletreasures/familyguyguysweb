"""
test_step7_feed_sync.py — Unit tests for Step 7 podcast feed sync, canonical RSS URL normalization,
and gated database updates.
"""
import json
import os
import sys
import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch, MagicMock

sys.path.insert(0, os.path.dirname(__file__))

from pipeline.step7_feed_sync import (
    normalize_rss_canonical_url,
    run_step7_feed_sync,
)


class TestStep7FeedSync(unittest.TestCase):
    def test_valid_canonical_url_normalizes_with_trailing_slash(self):
        url = "https://rss.com/podcasts/family-guy-guys/3215265/"
        normalized = normalize_rss_canonical_url(url)
        self.assertEqual(normalized, "https://rss.com/podcasts/family-guy-guys/3215265/")

    def test_valid_canonical_url_without_trailing_slash_normalizes_correctly(self):
        url = "https://rss.com/podcasts/family-guy-guys/3215265"
        normalized = normalize_rss_canonical_url(url)
        self.assertEqual(normalized, "https://rss.com/podcasts/family-guy-guys/3215265/")

    def test_internal_id_url_fails(self):
        url1 = "https://rss.com/podcasts/family-guy-guys/s02e05/"
        url2 = "https://rss.com/podcasts/family-guy-guys/s02e05"
        self.assertIsNone(normalize_rss_canonical_url(url1))
        self.assertIsNone(normalize_rss_canonical_url(url2))

    def test_mp3_enclosure_url_fails(self):
        url1 = "https://media.rss.com/family-guy-guys/2026_01_31_s1e1.mp3"
        url2 = "https://content.rss.com/episodes/audio.mp3"
        self.assertIsNone(normalize_rss_canonical_url(url1))
        self.assertIsNone(normalize_rss_canonical_url(url2))

    def test_player_embed_url_fails(self):
        url = "https://player.rss.com/family-guy-guys/3215265"
        self.assertIsNone(normalize_rss_canonical_url(url))

    def test_operator_url_takes_precedence_and_is_resolved(self):
        with tempfile.TemporaryDirectory() as tmpdir:
            tmp_path = Path(tmpdir)
            with patch("pipeline.step7_feed_sync.get_episodes_dir", return_value=tmp_path), \
                 patch("pipeline.step7_feed_sync.parse_podcast_feed", return_value=[]), \
                 patch("pipeline.step7_feed_sync.update_step_state"):
                res = run_step7_feed_sync(
                    "s02e05",
                    season=2,
                    episode_number=5,
                    canonical_podcast_url="https://rss.com/podcasts/family-guy-guys/3215265",
                    dry_run=True,
                )
                self.assertEqual(res["status"], "done")
                payload = res["feed_sync"]
                self.assertEqual(
                    payload["resolved_canonical_podcast_url"],
                    "https://rss.com/podcasts/family-guy-guys/3215265/",
                )
                self.assertEqual(payload["canonical_url_source"], "operator_input")
                self.assertTrue(payload["validation"]["passed"])
                self.assertNotIn("current_podcast_url", payload)

    def test_missing_operator_url_uses_feed_canonical_link(self):
        mock_item = {
            "title": "Episode 5",
            "season": 2,
            "episode_number": 5,
            "enclosure_url": "https://media.rss.com/ep5.mp3",
            "canonical_link": "https://rss.com/podcasts/family-guy-guys/9876543/",
        }
        with tempfile.TemporaryDirectory() as tmpdir:
            tmp_path = Path(tmpdir)
            with patch("pipeline.step7_feed_sync.get_episodes_dir", return_value=tmp_path), \
                 patch("pipeline.step7_feed_sync.parse_podcast_feed", return_value=[mock_item]), \
                 patch("pipeline.step7_feed_sync.update_step_state"):
                res = run_step7_feed_sync(
                    "s02e05",
                    season=2,
                    episode_number=5,
                    canonical_podcast_url="",
                    dry_run=True,
                )
                self.assertEqual(res["status"], "done")
                payload = res["feed_sync"]
                self.assertEqual(
                    payload["resolved_canonical_podcast_url"],
                    "https://rss.com/podcasts/family-guy-guys/9876543/",
                )
                self.assertEqual(payload["canonical_url_source"], "rss_feed_link")
                self.assertEqual(payload["feed_enclosure_url"], "https://media.rss.com/ep5.mp3")
                self.assertTrue(payload["validation"]["passed"])

    def test_missing_operator_url_plus_invalid_feed_link_results_in_no_resolved_url(self):
        mock_item = {
            "title": "Episode 5",
            "season": 2,
            "episode_number": 5,
            "enclosure_url": "https://media.rss.com/ep5.mp3",
            "canonical_link": "https://rss.com/podcasts/family-guy-guys/s02e05/",  # invalid internal ID!
        }
        with tempfile.TemporaryDirectory() as tmpdir:
            tmp_path = Path(tmpdir)
            with patch("pipeline.step7_feed_sync.get_episodes_dir", return_value=tmp_path), \
                 patch("pipeline.step7_feed_sync.parse_podcast_feed", return_value=[mock_item]), \
                 patch("pipeline.step7_feed_sync.update_step_state"):
                res = run_step7_feed_sync(
                    "s02e05",
                    season=2,
                    episode_number=5,
                    canonical_podcast_url="",
                    dry_run=True,
                )
                self.assertEqual(res["status"], "error")
                payload = res["feed_sync"]
                self.assertIsNone(payload["resolved_canonical_podcast_url"])
                self.assertIsNone(payload["canonical_url_source"])
                self.assertFalse(payload["validation"]["passed"])
                self.assertGreater(len(payload["validation"]["errors"]), 0)

    def test_live_mode_with_no_valid_canonical_url_performs_no_supabase_write(self):
        with tempfile.TemporaryDirectory() as tmpdir:
            tmp_path = Path(tmpdir)
            with patch("pipeline.step7_feed_sync.get_episodes_dir", return_value=tmp_path), \
                 patch("pipeline.step7_feed_sync.parse_podcast_feed", return_value=[]), \
                 patch("pipeline.step7_feed_sync.update_step_state"), \
                 patch("supabase.create_client") as mock_supabase_create:
                res = run_step7_feed_sync(
                    "s02e05",
                    season=2,
                    episode_number=5,
                    canonical_podcast_url="",
                    dry_run=False,
                )
                self.assertEqual(res["status"], "error")
                self.assertFalse(res["feed_sync"]["validation"]["passed"])
                # Supabase client must NEVER be called
                mock_supabase_create.assert_not_called()

    def test_artifact_has_no_current_podcast_url_and_has_resolved_canonical(self):
        with tempfile.TemporaryDirectory() as tmpdir:
            tmp_path = Path(tmpdir)
            with patch("pipeline.step7_feed_sync.get_episodes_dir", return_value=tmp_path), \
                 patch("pipeline.step7_feed_sync.parse_podcast_feed", return_value=[]), \
                 patch("pipeline.step7_feed_sync.update_step_state"):
                run_step7_feed_sync(
                    "s02e05",
                    season=2,
                    episode_number=5,
                    canonical_podcast_url="https://rss.com/podcasts/family-guy-guys/3215265/",
                    dry_run=True,
                )
                artifact_file = tmp_path / "feed_sync.json"
                self.assertTrue(artifact_file.exists())
                with open(artifact_file, "r", encoding="utf-8") as f:
                    data = json.load(f)

                self.assertNotIn("current_podcast_url", data)
                self.assertIn("resolved_canonical_podcast_url", data)
                self.assertEqual(data["resolved_canonical_podcast_url"], "https://rss.com/podcasts/family-guy-guys/3215265/")
                self.assertEqual(data["operator_canonical_podcast_url"], "https://rss.com/podcasts/family-guy-guys/3215265/")
                self.assertIn("validation", data)
                self.assertTrue(data["validation"]["passed"])


if __name__ == "__main__":
    unittest.main()
