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


if __name__ == "__main__":
    unittest.main()
