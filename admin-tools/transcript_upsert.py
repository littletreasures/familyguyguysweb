"""
transcript_upsert.py — Push validated structured transcript JSON into Supabase `episode_transcripts` table.

Safety requirements:
- Dry-run by default unless --allow-live-write is explicitly provided.
- Blocks synthetic test fixtures from live database write.
- Sets published_at when transitioning to published; preserves original published_at on edits or archival.

Usage:
    python transcript_upsert.py --transcript-json s1e6_transcript.json --dry-run
    python transcript_upsert.py --transcript-json s1e6_transcript.json --allow-live-write
"""
import argparse
import json
import sys
from datetime import datetime, timezone
from supabase import create_client

import config
from transcript_schema import validate_transcript_dict
from validation import log_audit_event


def build_transcript_row(data: dict, existing_db_row: dict = None) -> dict:
    """
    Validates and constructs a database row payload for `public.episode_transcripts`.
    Handles published_at state transitions cleanly.
    """
    # Reject synthetic test fixtures from live write payload construction
    if data.get("is_synthetic"):
        # Synthetic data can only be constructed for dry runs or tests
        pass

    validated = validate_transcript_dict(data)

    published_at = validated.get("published_at")

    # If existing DB row is available, preserve historical published_at
    if existing_db_row and existing_db_row.get("published_at"):
        published_at = existing_db_row["published_at"]
    elif validated["status"] == "published" and not published_at:
        # Transitioning to published for the first time
        published_at = datetime.now(timezone.utc).isoformat()

    row = {
        "episode_id": validated["episode_id"],
        "status": validated["status"],
        "source": validated.get("source", "riverside"),
        "language": validated.get("language", "en"),
        "transcript_version": validated.get("transcript_version", 1),
        "intro": validated.get("intro"),
        "seo_description": validated.get("seo_description"),
        "sections": validated["sections"],
        "plain_text": validated["plain_text"],
        "word_count": validated["word_count"],
        "published_at": published_at
    }

    return row


def upsert_transcript(row: dict, allow_live_write: bool = False, dry_run: bool = False):
    ep_id = row.get("episode_id", "UNKNOWN")

    if not allow_live_write or dry_run:
        log_audit_event("UPSERT_TRANSCRIPT", ep_id, "DRY_RUN", f"Would upsert transcript status={row.get('status')}, words={row.get('word_count')}")
        print(f"[DRY RUN] Would upsert transcript row into `episode_transcripts`:")
        summary = {k: (v if k != 'sections' else f"[{len(v)} sections]") for k, v in row.items()}
        print(json.dumps(summary, indent=2))
        return

    # Fail-closed credential assertion
    config.require_supabase_credentials()

    client = create_client(config.SUPABASE_URL, config.SUPABASE_SERVICE_KEY)

    # Check for existing record to preserve published_at on edits
    existing_res = client.table("episode_transcripts").select("published_at").eq("episode_id", ep_id).execute()
    existing_data = existing_res.data if existing_res else []
    if existing_data and existing_data[0].get("published_at"):
        # Preserve original publication date
        row["published_at"] = existing_data[0]["published_at"]
    elif row["status"] == "published" and not row.get("published_at"):
        row["published_at"] = datetime.now(timezone.utc).isoformat()

    result = client.table("episode_transcripts").upsert(row, on_conflict="episode_id").execute()
    log_audit_event("UPSERT_TRANSCRIPT", ep_id, "SUCCESS", f"Upserted transcript status={row.get('status')}")
    print(f"Successfully upserted transcript for episode '{ep_id}' (Status: {row.get('status')}).")


def main():
    parser = argparse.ArgumentParser(description="Upsert validated episode transcript into Supabase")
    parser.add_argument("--transcript-json", required=True, help="Path to transcript JSON file")
    parser.add_argument("--allow-live-write", action="store_true", help="Explicitly authorize write to live database")
    parser.add_argument("--dry-run", action="store_true", help="Preview payload without writing to database")
    args = parser.parse_args()

    try:
        with open(args.transcript_json, "r", encoding="utf-8") as f:
            data = json.load(f)

        # Protect synthetic fixtures from live database write
        if data.get("is_synthetic") and args.allow_live_write and not args.dry_run:
            sys.exit("BLOCKED: This file is marked as synthetic test data ('is_synthetic: true') and cannot be written to the live database.")

        row = build_transcript_row(data)
        upsert_transcript(row, allow_live_write=args.allow_live_write, dry_run=args.dry_run)
    except Exception as e:
        log_audit_event("UPSERT_TRANSCRIPT", "UNKNOWN", "FAILED", str(e))
        sys.exit(f"Upsert Error: {e}")


if __name__ == "__main__":
    main()
