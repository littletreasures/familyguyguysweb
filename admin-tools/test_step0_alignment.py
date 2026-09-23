"""
test_step0_alignment.py — Unit tests for anchor-based piecewise offset alignment,
rupture detection, re-anchor scanning, offset clustering, unanchored SRT regions,
audit generation, and known-cuts parsing.
"""
import os
import sys
import tempfile
import unittest
from pathlib import Path

sys.path.insert(0, os.path.dirname(__file__))

from pipeline.step0_transcript_prep import (
    detect_rupture_point,
    scan_reanchors,
    cluster_offsets,
    detect_unanchored_srt_regions,
    write_unmatched_audit,
    align_transcript_with_srt,
    parse_known_cuts,
)


class TestStep0PiecewiseAlignment(unittest.TestCase):
    def test_detect_rupture_point_finds_rupture_before_8_turn_gap(self):
        # 10 healthy turns, then 8 unmatched turns, then 10 turns
        segments = []
        for i in range(10):
            segments.append({
                "segment_id": i + 1,
                "riverside_start_seconds": float(i * 10),
                "riverside_time": f"00:{i * 10:02d}",
                "matched": True,
                "unmatched": False,
            })
        for i in range(10, 18):
            segments.append({
                "segment_id": i + 1,
                "riverside_start_seconds": float(i * 10),
                "riverside_time": f"00:{i * 10:02d}",
                "matched": False,
                "unmatched": True,
            })
        for i in range(18, 28):
            segments.append({
                "segment_id": i + 1,
                "riverside_start_seconds": float(i * 10),
                "riverside_time": f"00:{i * 10:02d}",
                "matched": True,
                "unmatched": False,
            })

        srt_duration = 500.0
        rupture_idx = detect_rupture_point(segments, srt_duration)
        # Should return index 9 (segment_id 10), which is the last matched segment before the 8-turn gap
        self.assertEqual(rupture_idx, 9)
        self.assertEqual(segments[rupture_idx]["segment_id"], 10)

    def test_detect_rupture_point_returns_none_for_healthy_transcripts(self):
        # Healthy transcript with max gap of 2 to 4 turns
        segments = []
        for i in range(50):
            # Introduce occasional small gaps of 2 turns
            is_unmatched = i in (12, 13, 30, 31, 32)
            segments.append({
                "segment_id": i + 1,
                "riverside_start_seconds": float(i * 5),
                "riverside_time": f"00:{i * 5:02d}",
                "matched": not is_unmatched,
                "unmatched": is_unmatched,
            })

        srt_duration = 300.0
        rupture_idx = detect_rupture_point(segments, srt_duration)
        self.assertIsNone(rupture_idx)

    def test_detect_rupture_point_ignores_audio_tail_extending_past_srt_end(self):
        # 20 matched turns under srt_duration=100.0, then 10 unmatched turns past 100.0s
        segments = []
        for i in range(20):
            segments.append({
                "segment_id": i + 1,
                "riverside_start_seconds": float(i * 5),  # 0 to 95s
                "riverside_time": f"00:{i * 5:02d}",
                "matched": True,
                "unmatched": False,
            })
        for i in range(20, 32):
            segments.append({
                "segment_id": i + 1,
                "riverside_start_seconds": float(100 + (i - 20) * 5),  # 100s to 155s
                "riverside_time": f"01:{(i - 20) * 5:02d}",
                "matched": False,
                "unmatched": True,
            })

        srt_duration = 100.0
        rupture_idx = detect_rupture_point(segments, srt_duration)
        self.assertIsNone(rupture_idx)

    def test_scan_reanchors_enforces_similarity_and_margin(self):
        # Cues across SRT
        srt_cues = [
            {"index": 1, "start_seconds": 10.0, "end_seconds": 15.0, "text": "peter griffin went to the store", "tokens": ["peter", "griffin", "went", "store"]},
            {"index": 2, "start_seconds": 15.0, "end_seconds": 20.0, "text": "and bought some beer", "tokens": ["bought", "beer"]},
            # Candidate cue far away
            {"index": 50, "start_seconds": 500.0, "end_seconds": 505.0, "text": "peter griffin went to the store", "tokens": ["peter", "griffin", "went", "store"]},
            # Another distinct cue
            {"index": 100, "start_seconds": 1000.0, "end_seconds": 1005.0, "text": "brian and stewie travel through time", "tokens": ["brian", "stewie", "travel", "time"]},
        ]

        turns = [
            # Turn 0: Unique match at cue 100 -> sim=1.0, margin=1.0 (no second match) -> ACCEPT
            {
                "speaker": "Brian",
                "time_str": "20:00.0",
                "start_seconds": 1200.0,
                "text": "brian and stewie travel through time",
                "tokens": ["brian", "stewie", "travel", "time"],
                "unmatched": True,
            },
            # Turn 1: Ambiguous match at cue 1 and cue 50 -> sim=1.0, second_score=1.0 -> margin=0.0 < 0.15 -> REJECT
            {
                "speaker": "Peter",
                "time_str": "20:10.0",
                "start_seconds": 1210.0,
                "text": "peter griffin went to the store",
                "tokens": ["peter", "griffin", "went", "store"],
                "unmatched": True,
            },
            # Turn 2: Low similarity -> only matches "beer" -> sim=0.25 < 0.8 -> REJECT
            {
                "speaker": "Lois",
                "time_str": "20:20.0",
                "start_seconds": 1220.0,
                "text": "drinking delicious cold fresh beer",
                "tokens": ["drinking", "delicious", "cold", "fresh", "beer"],
                "unmatched": True,
            },
        ]

        anchors = scan_reanchors(turns, srt_cues, start_idx=0, max_turns=10)
        self.assertEqual(len(anchors), 1)
        self.assertEqual(anchors[0]["turn_idx"], 0)
        self.assertEqual(anchors[0]["srt_cue_start_index"], 100)
        self.assertGreaterEqual(anchors[0]["similarity"], 0.8)
        self.assertGreaterEqual(anchors[0]["margin"], 0.15)
        # offset = srt - riverside = 1000.0 - 1200.0 = -200.0
        self.assertAlmostEqual(anchors[0]["offset"], -200.0, places=1)

    def test_cluster_offsets_groups_noisy_offsets_and_finds_median(self):
        # 6 anchors clustered around -375s (+/- 5s), and 1 outlier at -200s
        anchors = [
            {"offset": -374.0, "riverside_start_seconds": 1000.0, "srt_start_seconds": 626.0},
            {"offset": -376.0, "riverside_start_seconds": 1010.0, "srt_start_seconds": 634.0},
            {"offset": -375.0, "riverside_start_seconds": 1020.0, "srt_start_seconds": 645.0},
            {"offset": -370.0, "riverside_start_seconds": 1030.0, "srt_start_seconds": 660.0},
            {"offset": -379.0, "riverside_start_seconds": 1040.0, "srt_start_seconds": 661.0},
            {"offset": -375.5, "riverside_start_seconds": 1050.0, "srt_start_seconds": 674.5},
            {"offset": -200.0, "riverside_start_seconds": 1060.0, "srt_start_seconds": 860.0},  # outlier
        ]

        dominant_offset, dominant_cluster = cluster_offsets(anchors, tolerance=15.0)
        # Expected median of dominant cluster: sorted [-379.0, -376.0, -375.5, -375.0, -374.0, -370.0] -> (-375.5 + -375.0)/2 = -375.25
        self.assertAlmostEqual(dominant_offset, -375.25, delta=1.0)
        self.assertEqual(len(dominant_cluster), 6)
        for a in dominant_cluster:
            self.assertNotEqual(a["offset"], -200.0)

    def test_detect_unanchored_srt_regions_identifies_gaps_ge_60s(self):
        # SRT cues covering 0 to 300s
        srt_cues = [
            {"index": 1, "start_seconds": 0.0, "end_seconds": 10.0, "text": "cue 1"},
            {"index": 2, "start_seconds": 10.0, "end_seconds": 20.0, "text": "cue 2"},
            # Gap of 70s here (20.0s to 90.0s)
            {"index": 3, "start_seconds": 25.0, "end_seconds": 50.0, "text": "gap cue A"},
            {"index": 4, "start_seconds": 55.0, "end_seconds": 90.0, "text": "gap cue B"},
            # Resumes matched
            {"index": 5, "start_seconds": 95.0, "end_seconds": 110.0, "text": "cue 5"},
            {"index": 6, "start_seconds": 110.0, "end_seconds": 120.0, "text": "cue 6"},
            # Short gap of 30s (120s to 150s)
            {"index": 7, "start_seconds": 125.0, "end_seconds": 145.0, "text": "short gap cue"},
            # Matched
            {"index": 8, "start_seconds": 150.0, "end_seconds": 160.0, "text": "cue 8"},
        ]

        # Alignment matched cues 1, 2 (0-20s), 5, 6 (95-120s), and 8 (150-160s)
        alignment = [
            {"segment_id": 1, "matched": True, "srt_cue_start_index": 1, "srt_cue_end_index": 2, "srt_start_seconds": 0.0, "srt_end_seconds": 20.0},
            {"segment_id": 2, "matched": True, "srt_cue_start_index": 5, "srt_cue_end_index": 6, "srt_start_seconds": 95.0, "srt_end_seconds": 120.0},
            {"segment_id": 3, "matched": True, "srt_cue_start_index": 8, "srt_cue_end_index": 8, "srt_start_seconds": 150.0, "srt_end_seconds": 160.0},
        ]

        unanchored = detect_unanchored_srt_regions(alignment, srt_cues, min_duration=60.0)
        self.assertEqual(len(unanchored), 1)
        region = unanchored[0]
        # Region spans cues 3 and 4 (25.0s to 90.0s = 65.0s >= 60.0s)
        self.assertEqual(region["start_cue_index"], 3)
        self.assertEqual(region["end_cue_index"], 4)
        self.assertAlmostEqual(region["duration"], 65.0, places=1)

    def test_write_unmatched_audit_creates_file(self):
        with tempfile.TemporaryDirectory() as tmp_dir:
            ep_dir = Path(tmp_dir)
            episode_id = "test_ep"
            srt_name = "test.srt"
            alignment = [
                {"segment_id": 1, "riverside_time": "00:05.0", "speaker": "Jason", "text": "Matched turn", "matched": True, "unmatched": False},
                {"segment_id": 2, "riverside_time": "00:15.0", "speaker": "Collin", "text": "Cut discussion line", "matched": False, "unmatched": True},
                {"segment_id": 3, "riverside_time": "00:25.0", "speaker": "Tyler", "text": "Another cut line", "matched": False, "unmatched": True},
            ]
            substantive_turns = list(alignment)

            out_path = write_unmatched_audit(ep_dir, episode_id, srt_name, substantive_turns, alignment)
            self.assertTrue(out_path.exists())
            content = out_path.read_text(encoding="utf-8")
            self.assertIn("Segment ID | Riverside Time | Speaker | Text", content)
            self.assertIn("2 | 00:15.0 | Collin | Cut discussion line", content)
            self.assertIn("3 | 00:25.0 | Tyler | Another cut line", content)
            self.assertNotIn("Matched turn", content)

    def test_parse_known_cuts_various_formats(self):
        # 43:32, 7m10s -> 2612.0s, 430.0s
        c1 = parse_known_cuts("43:32, 7m10s")
        self.assertIsNotNone(c1)
        self.assertAlmostEqual(c1[0], 2612.0)
        self.assertAlmostEqual(c1[1], 430.0)

        # 43:32, 430s
        c2 = parse_known_cuts("43:32, 430s")
        self.assertIsNotNone(c2)
        self.assertAlmostEqual(c2[0], 2612.0)
        self.assertAlmostEqual(c2[1], 430.0)

        # 43:32, 07:10
        c3 = parse_known_cuts("43:32, 07:10")
        self.assertIsNotNone(c3)
        self.assertAlmostEqual(c3[0], 2612.0)
        self.assertAlmostEqual(c3[1], 430.0)

        # Empty or invalid string
        self.assertIsNone(parse_known_cuts(""))
        self.assertIsNone(parse_known_cuts("invalid"))

    def test_cluster_offsets_empty_returns_default(self):
        median_l, cluster = cluster_offsets([])
        self.assertEqual(median_l, 0.0)
        self.assertEqual(cluster, [])

    def test_align_transcript_with_srt_target_offset_func(self):
        # A turn at riverside 1000s, matching cue at srt 600s (offset = -400s)
        # Without target_offset_func: window is 910s..1090s -> cue at 600s is outside -> unmatched
        # With target_offset_func: window centered at 1000 + (-400) = 600s -> matched!
        srt_cues = [
            {"index": 1, "start_seconds": 600.0, "end_seconds": 605.0, "text": "peter griffin went to the store", "tokens": ["peter", "griffin", "went", "store"]},
        ]
        turns = [
            {
                "speaker": "Peter",
                "time_str": "16:40.0",
                "start_seconds": 1000.0,
                "text": "peter griffin went to the store",
                "tokens": ["peter", "griffin", "went", "store"],
            }
        ]

        # 1. Pass without offset func: fails because 600 is outside [910, 1090]
        unaligned = align_transcript_with_srt(turns, srt_cues)
        self.assertFalse(unaligned[0]["matched"])
        self.assertTrue(unaligned[0]["unmatched"])

        # 2. Pass with target_offset_func returning -400.0: succeeds!
        aligned = align_transcript_with_srt(turns, srt_cues, target_offset_func=lambda t: -400.0)
        self.assertTrue(aligned[0]["matched"])
        self.assertFalse(aligned[0]["unmatched"])
        self.assertAlmostEqual(aligned[0]["srt_start_seconds"], 600.0)

        # 3. Pass with piecewise_offsets dict
        aligned_dict = align_transcript_with_srt(turns, srt_cues, piecewise_offsets={"rupture_time": 500.0, "post_cut_offset": -400.0})
        self.assertTrue(aligned_dict[0]["matched"])


if __name__ == "__main__":
    unittest.main()
