"""
transcript_ingest.py — Ingest and structure Riverside transcript exports into structured draft JSON.

Usage:
    python transcript_ingest.py --transcript raw_riverside.txt --episode-id s1e6 --out s1e6_transcript.json
"""
import argparse
import json
import re
import sys
from typing import List, Dict, Any

from transcript_cleaner import normalize_speaker_name, clean_speech_text, calculate_plain_text
from transcript_schema import validate_transcript_dict


def parse_riverside_timestamp(ts: str) -> float:
    """
    Parses timestamps like '00:01.9', '01:14.572', '01:00:07.372' into seconds (float).
    """
    clean = ts.strip().strip("()")
    parts = clean.split(":")

    if len(parts) == 2:
        minutes = int(parts[0])
        seconds = float(parts[1])
        return round(minutes * 60 + seconds, 3)

    if len(parts) == 3:
        hours = int(parts[0])
        minutes = int(parts[1])
        seconds = float(parts[2])
        return round(hours * 3600 + minutes * 60 + seconds, 3)

    raise ValueError(f"Unrecognized timestamp format: '{ts}'")


def parse_riverside_text(text: str, default_heading: str = "Full Episode Discussion") -> List[Dict[str, Any]]:
    """
    Parses Riverside speaker-tagged transcript text:
    Speaker (MM:SS.mmm)
    or Speaker (HH:MM:SS.mmm)
    followed by speech lines.
    """
    header_pattern = re.compile(r"^([A-Za-z0-9 _.'\"-]+?)\s*\(((\d{1,2}:)?\d{1,2}:\d{2}(?:\.\d+)?)\)\s*$")

    lines = text.splitlines()
    entries: List[Dict[str, Any]] = []

    current_speaker = None
    current_start = None
    current_text_lines = []

    def flush_entry():
        nonlocal current_speaker, current_start, current_text_lines
        if current_speaker and current_start is not None:
            combined = clean_speech_text(" ".join(current_text_lines))
            if combined:
                entries.append({
                    "start_seconds": current_start,
                    "speaker": current_speaker,
                    "text": combined
                })
        current_speaker = None
        current_start = None
        current_text_lines = []

    for line in lines:
        trimmed = line.strip()
        if not trimmed:
            continue

        match = header_pattern.match(trimmed)
        if match:
            flush_entry()
            raw_speaker = match.group(1).strip()
            raw_time = match.group(2).strip()
            current_speaker = normalize_speaker_name(raw_speaker)
            current_start = parse_riverside_timestamp(raw_time)
        elif current_speaker and current_start is not None:
            current_text_lines.append(trimmed)

    flush_entry()

    if not entries:
        raise ValueError(
            "Unsupported transcript format: Input does not contain recognized Riverside speaker-tagged lines (e.g. 'Jason (00:01.9)'). "
            "In Phase 1, only Riverside speaker-tagged .txt format is supported. (SRT, VTT, and JSON adapters are planned for subsequent phases)."
        )

    # Assign end_seconds for entries
    for i in range(len(entries)):
        if i < len(entries) - 1:
            entries[i]["end_seconds"] = entries[i + 1]["start_seconds"]
        else:
            word_count = len(entries[i]["text"].split())
            estimated_duration = max(5.0, round(word_count / 2.5, 1))
            entries[i]["end_seconds"] = round(entries[i]["start_seconds"] + estimated_duration, 3)

    first_start = entries[0]["start_seconds"]
    last_end = entries[-1]["end_seconds"]

    return [
        {
            "id": "episode-discussion",
            "heading": default_heading,
            "start_seconds": first_start,
            "end_seconds": last_end,
            "entries": entries
        }
    ]


def ingest_transcript_file(
    file_path: str,
    episode_id: str,
    intro: str = "",
    seo_description: str = ""
) -> Dict[str, Any]:
    """
    Ingests a Riverside transcript export file into a validated draft transcript document.
    Ingestion strictly produces draft records (status='draft', published_at=None).
    Publishing is an explicit admin action handled via the upsert/publishing workflow.
    """
    with open(file_path, "r", encoding="utf-8") as f:
        content = f.read()

    sections = parse_riverside_text(content)
    plain_text, word_count = calculate_plain_text(sections)

    raw_doc = {
        "episode_id": episode_id.lower().strip(),
        "status": "draft",
        "source": "riverside",
        "language": "en",
        "transcript_version": 1,
        "intro": intro.strip() if intro else None,
        "seo_description": seo_description.strip() if seo_description else None,
        "sections": sections,
        "plain_text": plain_text,
        "word_count": word_count,
        "published_at": None
    }

    return validate_transcript_dict(raw_doc)


def main():
    parser = argparse.ArgumentParser(description="Ingest Riverside transcript text into structured draft JSON")
    parser.add_argument("--transcript", required=True, help="Path to Riverside .txt export file")
    parser.add_argument("--episode-id", required=True, help="Episode ID (e.g. s1e6)")
    parser.add_argument("--intro", default="", help="Optional episode introduction text")
    parser.add_argument("--seo-description", default="", help="Optional SEO description meta text")
    parser.add_argument("--out", default=None, help="Output JSON file path (default: stdout)")
    args = parser.parse_args()

    try:
        doc = ingest_transcript_file(
            file_path=args.transcript,
            episode_id=args.episode_id,
            intro=args.intro,
            seo_description=args.seo_description
        )

        formatted_json = json.dumps(doc, indent=2)
        if args.out:
            with open(args.out, "w", encoding="utf-8") as f:
                f.write(formatted_json)
            print(f"Successfully wrote draft transcript to {args.out}")
        else:
            print(formatted_json)
    except Exception as e:
        sys.exit(f"Ingest Error: {e}")


if __name__ == "__main__":
    main()
