"""
step3_transcript.py — Reassembles 3 transcript chunks into a single structured,
validated document, validates against transcript_schema.py, and performs gated
upsert into Supabase `episode_transcripts`.
"""
import json
import os
from pathlib import Path
from typing import Dict, Any, List, Optional

from pipeline.state import get_episodes_dir, update_step_state, assert_safe_publish
from transcript_cleaner import calculate_plain_text
from transcript_ingest import parse_riverside_text
from transcript_schema import validate_transcript_dict
from transcript_upsert import build_transcript_row, upsert_transcript


def reassemble_transcript_sections(
    chunk_paths: List[str],
    section_headings: Optional[List[str]] = None
) -> List[Dict[str, Any]]:
    """
    Parses each chunk file and reassembles into 3 structured sections.
    Reconciles boundary timestamps across adjacent chunks so:
    - section[i].end_seconds == section[i+1].start_seconds (zero-gap, zero-overlap)
    - entry bounds strictly respect section bounds
    """
    if len(chunk_paths) != 3:
        raise ValueError(f"Expected exactly 3 chunk file paths, got {len(chunk_paths)}")

    default_headings = [
        "Part 1: Cold Open & Act I",
        "Part 2: Act II & Discussion",
        "Part 3: Final Ratings & Closing"
    ]

    parsed_sections: List[Dict[str, Any]] = []

    for idx, path in enumerate(chunk_paths):
        if not os.path.exists(path):
            raise FileNotFoundError(f"Transcript chunk not found at: {path}")

        with open(path, "r", encoding="utf-8", errors="replace") as f:
            content = f.read()

        heading = section_headings[idx] if (section_headings and idx < len(section_headings)) else default_headings[idx]
        section_id = f"part-{idx + 1}"

        sec_list = parse_riverside_text(content, default_heading=heading)
        if not sec_list or not sec_list[0].get("entries"):
            raise ValueError(f"No valid transcript entries parsed from {path}")

        section = sec_list[0]
        section["id"] = section_id
        section["heading"] = heading
        parsed_sections.append(section)

    # Reconcile boundary transitions between chunk 1 -> chunk 2
    c2_start = parsed_sections[1]["entries"][0]["start_seconds"]
    parsed_sections[0]["entries"][-1]["end_seconds"] = c2_start
    parsed_sections[0]["end_seconds"] = c2_start
    parsed_sections[1]["start_seconds"] = c2_start

    # Reconcile boundary transitions between chunk 2 -> chunk 3
    c3_start = parsed_sections[2]["entries"][0]["start_seconds"]
    parsed_sections[1]["entries"][-1]["end_seconds"] = c3_start
    parsed_sections[1]["end_seconds"] = c3_start
    parsed_sections[2]["start_seconds"] = c3_start

    # Ensure last entry of chunk 3 matches chunk 3 end_seconds
    c3_last_end = parsed_sections[2]["entries"][-1]["end_seconds"]
    parsed_sections[2]["end_seconds"] = c3_last_end

    return parsed_sections


def run_step3_transcript(
    episode_id: str,
    publish: bool = False,
    dry_run: bool = True,
    chunks_dir: Optional[str] = None,
    section_headings: Optional[List[str]] = None,
    intro: str = "",
    seo_description: str = "",
) -> Dict[str, Any]:
    """
    Executes Step 3:
    1. Reassembles 3 transcript chunks into 1 document with 3 non-overlapping sections.
    2. Reconciles inter-chunk boundary timestamps.
    3. Runs schema validation (transcript_schema.py).
    4. Calculates plain_text and word_count.
    5. Saves artifact to episodes/<episode_id>/transcript.json.
    6. Executes gated Supabase upsert (respecting assert_safe_publish and dry_run).
    7. Updates state.
    """
    update_step_state(episode_id, "step3_transcript_publish", "running", logs="Starting Step 3: Transcript Reassembly & Upsert...")

    # Hard guard against unauthorized live writes on test episodes
    assert_safe_publish(episode_id, dry_run=dry_run)

    ep_dir = get_episodes_dir(episode_id)
    target_chunks_dir = Path(chunks_dir) if chunks_dir else ep_dir / "chunks"

    c1_path = str(target_chunks_dir / "chunk_1.txt")
    c2_path = str(target_chunks_dir / "chunk_2.txt")
    c3_path = str(target_chunks_dir / "chunk_3.txt")
    chunk_paths = [c1_path, c2_path, c3_path]

    for p in chunk_paths:
        if not os.path.exists(p):
            err = f"Missing required chunk file: {p}. Ensure Step 0 has completed."
            update_step_state(episode_id, "step3_transcript", "error", logs=err)
            raise FileNotFoundError(err)

    # 1. Reassemble sections
    sections = reassemble_transcript_sections(chunk_paths, section_headings=section_headings)

    # 2. Build draft document
    raw_doc = {
        "episode_id": episode_id.lower().strip(),
        "status": "published" if publish else "draft",
        "source": "riverside",
        "language": "en",
        "transcript_version": 1,
        "intro": intro.strip() if intro else None,
        "seo_description": seo_description.strip() if seo_description else None,
        "sections": sections,
    }

    # 3. Validate & build database row (recomputes plain_text and word_count)
    row = build_transcript_row(raw_doc, publish=publish)
    validated = validate_transcript_dict(row)

    # 4. Save local artifact to episodes/<episode_id>/transcript.json
    out_path = ep_dir / "transcript.json"
    with open(out_path, "w", encoding="utf-8") as f:
        json.dump(row, f, indent=2)

    # 5. Database upsert (dry-run or live)
    upsert_transcript(row, allow_live_write=not dry_run, dry_run=dry_run)

    # 6. Build section summary for audit and logs
    section_summary = [
        {
            "id": s["id"],
            "heading": s["heading"],
            "start_seconds": s["start_seconds"],
            "end_seconds": s["end_seconds"],
            "entries_count": len(s["entries"]),
            "duration_minutes": round((s["end_seconds"] - s["start_seconds"]) / 60.0, 1),
        }
        for s in row["sections"]
    ]

    mode_label = "DRY RUN" if dry_run else "LIVE WRITE"
    log_msg = (
        f"Step 3 Complete ({mode_label}):\n"
        f"- Reassembled 3 sections into single document\n"
        f"- Total entries: {sum(s['entries_count'] for s in section_summary)}\n"
        f"- Total word count: {row['word_count']:,} words\n"
        f"- Status: {row['status']}\n"
        f"- Schema validation: PASSED (Pydantic / EpisodeTranscriptModel)\n"
        f"- Section 1 ({section_summary[0]['heading']}): {section_summary[0]['entries_count']} entries, {section_summary[0]['start_seconds']}s -> {section_summary[0]['end_seconds']}s ({section_summary[0]['duration_minutes']} min)\n"
        f"- Section 2 ({section_summary[1]['heading']}): {section_summary[1]['entries_count']} entries, {section_summary[1]['start_seconds']}s -> {section_summary[1]['end_seconds']}s ({section_summary[1]['duration_minutes']} min)\n"
        f"- Section 3 ({section_summary[2]['heading']}): {section_summary[2]['entries_count']} entries, {section_summary[2]['start_seconds']}s -> {section_summary[2]['end_seconds']}s ({section_summary[2]['duration_minutes']} min)\n"
        f"- Artifact saved: {out_path}"
    )

    artifacts = {
        "transcript": str(out_path)
    }

    update_step_state(
        episode_id,
        "step3_transcript_publish",
        "done",
        logs=log_msg,
        artifacts=artifacts,
        validation={"passed": True, "errors": [], "warnings": []},
        approved=True,
    )

    return {
        "status": "done",
        "artifacts": artifacts,
        "logs": log_msg,
        "sections": section_summary,
        "word_count": row["word_count"],
        "schema_validation": "passed"
    }
