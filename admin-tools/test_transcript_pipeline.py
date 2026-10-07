"""
test_transcript_pipeline.py — Unit tests for transcript ingestion, schema validation, derived field recalculation, and upsert payload preparation.
"""
import os
import sys
import tempfile
import unittest

sys.path.insert(0, os.path.dirname(__file__))

from transcript_ingest import ingest_transcript_file, parse_riverside_text
from transcript_schema import validate_transcript_dict
from transcript_upsert import build_transcript_row


class TestTranscriptPipeline(unittest.TestCase):
    def test_ingest_creates_draft_with_null_published_at(self):
        sample_text = (
            "Jason (00:01.9)\n"
            "Yeah. let me make sure I got all my stuff in here.\n\n"
            "Collin (00:03.462)\n"
            "Yeah.\n"
        )
        with tempfile.NamedTemporaryFile(mode="w+", delete=False, encoding="utf-8") as tmp:
            tmp.write(sample_text)
            tmp_path = tmp.name

        try:
            doc = ingest_transcript_file(tmp_path, episode_id="s1e6", intro="Intro test")
            self.assertEqual(doc["status"], "draft")
            self.assertIsNone(doc["published_at"])
            self.assertEqual(doc["episode_id"], "s1e6")
            self.assertGreater(doc["word_count"], 0)
            self.assertIn("Jason [00:01]:", doc["plain_text"])
        finally:
            if os.path.exists(tmp_path):
                os.remove(tmp_path)

    def test_publish_transition_assigns_published_at(self):
        draft_data = {
            "episode_id": "s1e6",
            "status": "draft",
            "published_at": None,
            "sections": [
                {
                    "id": "sec-1",
                    "heading": "Intro",
                    "start_seconds": 0.0,
                    "end_seconds": 30.0,
                    "entries": [
                        {"start_seconds": 0.0, "end_seconds": 15.0, "speaker": "Jason", "text": "Hello world"}
                    ]
                }
            ]
        }

        row = build_transcript_row(draft_data, publish=True)
        self.assertEqual(row["status"], "published")
        self.assertIsNotNone(row["published_at"])
        self.assertGreater(len(row["published_at"]), 10)

    def test_recalculate_derived_fields_ignores_caller_bogus_values(self):
        draft_data = {
            "episode_id": "s1e6",
            "status": "draft",
            "published_at": None,
            "plain_text": "BOGUS CALLER SUPPLIED TEXT",
            "word_count": 999999,
            "sections": [
                {
                    "id": "sec-1",
                    "heading": "Real Heading",
                    "start_seconds": 0.0,
                    "end_seconds": 30.0,
                    "entries": [
                        {"start_seconds": 0.0, "end_seconds": 10.0, "speaker": "Tyler", "text": "Genuine speech content"}
                    ]
                }
            ]
        }

        row = build_transcript_row(draft_data)
        self.assertNotEqual(row["plain_text"], "BOGUS CALLER SUPPLIED TEXT")
        self.assertIn("Genuine speech content", row["plain_text"])
        self.assertIn("## Real Heading", row["plain_text"])
        self.assertNotEqual(row["word_count"], 999999)
        self.assertEqual(row["word_count"], 8)

    def test_cannot_have_published_status_with_null_published_at(self):
        invalid_data = {
            "episode_id": "s1e6",
            "status": "published",
            "published_at": None,
            "sections": [
                {
                    "id": "sec-1",
                    "heading": "Real Heading",
                    "start_seconds": 0.0,
                    "end_seconds": 30.0,
                    "entries": [
                        {"start_seconds": 0.0, "end_seconds": 10.0, "speaker": "Tyler", "text": "Genuine speech content"}
                    ]
                }
            ]
        }

        with self.assertRaises(ValueError):
            validate_transcript_dict(invalid_data)

    def test_preserve_existing_published_at_on_edits(self):
        existing_row = {"published_at": "2020-01-01T00:00:00Z"}
        updated_data = {
            "episode_id": "s1e6",
            "status": "published",
            "published_at": "2026-08-26T12:00:00Z",
            "sections": [
                {
                    "id": "sec-1",
                    "heading": "Real Heading",
                    "start_seconds": 0.0,
                    "end_seconds": 30.0,
                    "entries": [
                        {"start_seconds": 0.0, "end_seconds": 10.0, "speaker": "Tyler", "text": "Genuine speech content"}
                    ]
                }
            ]
        }

        row = build_transcript_row(updated_data, existing_db_row=existing_row)
        self.assertEqual(row["published_at"], "2020-01-01T00:00:00Z")

    def test_step6_credits_gracefully_proceeds_without_chunk_1(self):
        """Verifies Step 6 credit scroll generation gracefully proceeds when chunks/chunk_1.txt is absent."""
        import tempfile
        from pathlib import Path
        from unittest.mock import patch
        from pipeline.step6_credits import run_step6_credits

        with tempfile.TemporaryDirectory() as tmpdir:
            tmp_path = Path(tmpdir)
            with patch("pipeline.step6_credits.get_episodes_dir", return_value=tmp_path), \
                 patch("pipeline.step6_credits.update_step_state"), \
                 patch("pipeline.step6_credits.generate_text", side_effect=Exception("LLM offline")):
                res = run_step6_credits("s99e99_test", podcast_episode_number=12, dry_run=True)
                self.assertEqual(res["status"], "done")
                self.assertTrue((tmp_path / "credits.md").exists())
                self.assertEqual(res["body_digits_count"], 0)
                self.assertIn("Twelve", res["credits"])

    def _setup_mock_chunks(self, base_dir: Path):
        chunks_dir = base_dir / "chunks"
        chunks_dir.mkdir(parents=True, exist_ok=True)
        (chunks_dir / "chunk_1.txt").write_text("Jason (00:01.0)\nCold open discussion starts here.\n", encoding="utf-8")
        (chunks_dir / "chunk_2.txt").write_text("Collin (01:00.0)\nAct two discussion and analysis.\n", encoding="utf-8")
        (chunks_dir / "chunk_3.txt").write_text("Tyler (02:00.0)\nFinal ratings and wrap up.\n", encoding="utf-8")
        return chunks_dir

    def test_intro_and_seo_description_survive_run_step3_transcript(self):
        from pathlib import Path
        from unittest.mock import patch
        import json
        from pipeline.step3_transcript import run_step3_transcript

        with tempfile.TemporaryDirectory() as tmpdir:
            tmp_path = Path(tmpdir)
            chunks_dir = self._setup_mock_chunks(tmp_path)
            with patch("pipeline.step3_transcript.get_episodes_dir", return_value=tmp_path), \
                 patch("pipeline.step3_transcript.update_step_state"), \
                 patch("pipeline.step3_transcript.upsert_transcript"):
                res = run_step3_transcript(
                    "s02e05",
                    publish=False,
                    dry_run=True,
                    chunks_dir=str(chunks_dir),
                    intro="A detailed editorial introduction describing the episode stakes and bits.",
                    seo_description="A natural meta description covering the review discussion.",
                )
                self.assertEqual(res["status"], "done")
                artifact_path = tmp_path / "transcript.json"
                self.assertTrue(artifact_path.exists())
                with open(artifact_path, "r", encoding="utf-8") as f:
                    data = json.load(f)
                self.assertEqual(data["intro"], "A detailed editorial introduction describing the episode stakes and bits.")
                self.assertEqual(data["seo_description"], "A natural meta description covering the review discussion.")

    def test_live_publish_with_blank_intro_fails(self):
        from pathlib import Path
        from unittest.mock import patch
        from pipeline.step3_transcript import run_step3_transcript

        with tempfile.TemporaryDirectory() as tmpdir:
            tmp_path = Path(tmpdir)
            chunks_dir = self._setup_mock_chunks(tmp_path)
            with patch("pipeline.step3_transcript.get_episodes_dir", return_value=tmp_path), \
                 patch("pipeline.step3_transcript.update_step_state"), \
                 patch("pipeline.step3_transcript.upsert_transcript"):
                with self.assertRaises(ValueError) as ctx:
                    run_step3_transcript(
                        "s02e05",
                        publish=True,
                        dry_run=False,
                        chunks_dir=str(chunks_dir),
                        intro="",
                        seo_description="Join Collin, Tyler, and Jason as they review Family Guy episode 5 with ratings and in-depth discussion breakdown.",
                    )
                self.assertIn("Transcript intro is required for a live publish", str(ctx.exception))

    def test_live_publish_with_blank_seo_description_fails(self):
        from pathlib import Path
        from unittest.mock import patch
        from pipeline.step3_transcript import run_step3_transcript

        with tempfile.TemporaryDirectory() as tmpdir:
            tmp_path = Path(tmpdir)
            chunks_dir = self._setup_mock_chunks(tmp_path)
            with patch("pipeline.step3_transcript.get_episodes_dir", return_value=tmp_path), \
                 patch("pipeline.step3_transcript.update_step_state"), \
                 patch("pipeline.step3_transcript.upsert_transcript"):
                with self.assertRaises(ValueError) as ctx:
                    run_step3_transcript(
                        "s02e05",
                        publish=True,
                        dry_run=False,
                        chunks_dir=str(chunks_dir),
                        intro="A full editorial intro describing the episode discussions and recurring jokes.",
                        seo_description="",
                    )
                self.assertIn("SEO description is required for a live publish", str(ctx.exception))

    def test_dry_run_transcript_assembly_succeeds_without_editorial_metadata(self):
        from pathlib import Path
        from unittest.mock import patch
        import json
        from pipeline.step3_transcript import run_step3_transcript

        with tempfile.TemporaryDirectory() as tmpdir:
            tmp_path = Path(tmpdir)
            chunks_dir = self._setup_mock_chunks(tmp_path)
            with patch("pipeline.step3_transcript.get_episodes_dir", return_value=tmp_path), \
                 patch("pipeline.step3_transcript.update_step_state"), \
                 patch("pipeline.step3_transcript.upsert_transcript"):
                res = run_step3_transcript(
                    "s02e05",
                    publish=False,
                    dry_run=True,
                    chunks_dir=str(chunks_dir),
                    intro="",
                    seo_description="",
                )
                self.assertEqual(res["status"], "done")
                artifact_path = tmp_path / "transcript.json"
                self.assertTrue(artifact_path.exists())
                with open(artifact_path, "r", encoding="utf-8") as f:
                    data = json.load(f)
                self.assertIsNone(data["intro"])
                self.assertIsNone(data["seo_description"])

    def test_custom_section_headings_appear_in_emitted_json(self):
        from pathlib import Path
        from unittest.mock import patch
        import json
        from pipeline.step3_transcript import run_step3_transcript

        custom_headings = [
            "Part 1: The Grand Opening",
            "Part 2: Deep Dive Discussion",
            "Part 3: Final Scores and Outro",
        ]
        with tempfile.TemporaryDirectory() as tmpdir:
            tmp_path = Path(tmpdir)
            chunks_dir = self._setup_mock_chunks(tmp_path)
            with patch("pipeline.step3_transcript.get_episodes_dir", return_value=tmp_path), \
                 patch("pipeline.step3_transcript.update_step_state"), \
                 patch("pipeline.step3_transcript.upsert_transcript"):
                res = run_step3_transcript(
                    "s02e05",
                    publish=False,
                    dry_run=True,
                    chunks_dir=str(chunks_dir),
                    section_headings=custom_headings,
                )
                self.assertEqual(res["status"], "done")
                artifact_path = tmp_path / "transcript.json"
                with open(artifact_path, "r", encoding="utf-8") as f:
                    data = json.load(f)
                headings = [s["heading"] for s in data["sections"]]
                self.assertEqual(headings, custom_headings)

    def test_valid_intro_and_seo_survive_build_transcript_row(self):
        from transcript_upsert import build_transcript_row

        raw_data = {
            "episode_id": "s02e05",
            "status": "draft",
            "intro": "Editorial context intro",
            "seo_description": "Custom SEO meta description",
            "sections": [
                {
                    "id": "sec-1",
                    "heading": "Part 1",
                    "start_seconds": 0.0,
                    "end_seconds": 20.0,
                    "entries": [
                        {"start_seconds": 0.0, "end_seconds": 10.0, "speaker": "Jason", "text": "Speech"}
                    ]
                }
            ]
        }
        row = build_transcript_row(raw_data)
        self.assertEqual(row["intro"], "Editorial context intro")
        self.assertEqual(row["seo_description"], "Custom SEO meta description")

    def test_validate_transcript_editorial_metadata_helper(self):
        from pipeline.step3_transcript import validate_transcript_editorial_metadata

        # Empty fields fail
        v_empty = validate_transcript_editorial_metadata("", "")
        self.assertFalse(v_empty["passed"])
        self.assertEqual(len(v_empty["errors"]), 2)

        # Word count warning on intro
        v_short_intro = validate_transcript_editorial_metadata(
            "Short intro with only eight words right here.",
            "A" * 150,
        )
        self.assertTrue(v_short_intro["passed"])
        self.assertTrue(any("recommended range is 100–200" in w for w in v_short_intro["warnings"]))

        # Character count warning on SEO
        v_short_seo = validate_transcript_editorial_metadata(
            "Word " * 120,
            "Too short SEO description",
        )
        self.assertTrue(v_short_seo["passed"])
        self.assertTrue(any("recommended range is 140–160" in w for w in v_short_seo["warnings"]))

        # Ideal ranges pass cleanly with no warnings
        v_ideal = validate_transcript_editorial_metadata(
            "Word " * 120,
            "X" * 150,
        )
        self.assertTrue(v_ideal["passed"])
        self.assertEqual(len(v_ideal["errors"]), 0)
        self.assertEqual(len(v_ideal["warnings"]), 0)


if __name__ == "__main__":
    unittest.main()
