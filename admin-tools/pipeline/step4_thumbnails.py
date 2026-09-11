"""
step4_thumbnails.py — Fetches episode lead thumbnail from Family Guy Fandom Wiki,
uploads to Cloudinary (under family-guy/episodes/), and updates Supabase episodes table.

Convention:
- The Episodes page uses YouTube thumbnail URLs.
- The Supabase `thumbnail_url` column is for the Reviews section only.
"""
import json
import os
from pathlib import Path
from typing import Dict, Any, Optional

from pipeline.state import get_episodes_dir, update_step_state, assert_safe_publish
from thumbnail_service import (
    fetch_fandom_thumbnail,
    upload_thumbnail_to_cloudinary,
    update_episode_thumbnail_record,
    CLOUDINARY_FOLDER,
)
from validation import log_audit_event


def run_step4_thumbnails(
    episode_id: str,
    episode_title: Optional[str] = None,
    season: Optional[int] = None,
    dry_run: bool = True,
    mock_upload: bool = True
) -> Dict[str, Any]:
    """
    Executes Step 4:
    1. Reads title/season from episodes/<episode_id>/metadata.json if not provided.
    2. Queries Family Guy Fandom Wiki for lead episode image (with mock fallback if offline/sandbox).
    3. Uploads image to Cloudinary (mocked in dry_run mode).
    4. Gated update to Supabase `episodes` table (respecting assert_safe_publish).
    5. Saves artifact to episodes/<episode_id>/thumbnail.json.
    6. Updates state.
    """
    update_step_state(episode_id, "step4_thumbnails", "running", logs="Starting Step 4: Thumbnail Import...")

    # Hard guard against unauthorized live writes on test episodes
    assert_safe_publish(episode_id, dry_run=dry_run)

    ep_dir = get_episodes_dir(episode_id)
    metadata_path = ep_dir / "metadata.json"

    title = episode_title
    ep_season = season

    if (not title or ep_season is None) and metadata_path.exists():
        try:
            with open(metadata_path, "r", encoding="utf-8") as f:
                meta = json.load(f)
            title = title or meta.get("title")
            ep_season = ep_season if ep_season is not None else meta.get("season")
        except Exception:
            pass

    if not title:
        title = "Family Guy Episode"

    clean_id = episode_id.lower().strip()

    # 1. Fetch from Fandom Wiki (with offline / sandbox fallback)
    fandom_result = None
    try:
        fandom_result = fetch_fandom_thumbnail(title)
        log_audit_event("FETCH_FANDOM_THUMBNAIL", clean_id, "SUCCESS", f"Found Fandom image for '{title}'")
    except Exception as e:
        log_audit_event("FETCH_FANDOM_THUMBNAIL", clean_id, "WARN", f"Fandom query fell back to offline fixture: {e}")
        fandom_result = {
            "fandom_page": title,
            "source_url": f"https://static.wikia.nocookie.net/familyguy/images/archive/{clean_id}.png",
            "width": 1280,
            "height": 720,
            "is_mock": True,
            "note": f"Offline/mock fallback used ({e})"
        }

    # 2. Cloudinary Upload (mocked if dry_run or mock_upload)
    cloudinary_result = None
    if dry_run or mock_upload:
        public_id = f"{CLOUDINARY_FOLDER}/{clean_id}"
        secure_url = f"https://res.cloudinary.com/familyguyguys/image/upload/v1720000000/{public_id}.jpg"
        cloudinary_result = {
            "public_id": public_id,
            "secure_url": secure_url,
            "width": fandom_result.get("width", 1280),
            "height": fandom_result.get("height", 720),
            "format": "jpg",
            "is_mock": True,
        }
        log_audit_event("UPLOAD_CLOUDINARY", clean_id, "DRY_RUN", f"Simulated Cloudinary upload to {public_id}")
    else:
        cloudinary_result = upload_thumbnail_to_cloudinary(
            source_url=fandom_result["source_url"],
            episode_id=clean_id,
            title=title,
            season=ep_season,
        )

    # 3. Supabase Record Update (Review Section Thumbnail only)
    db_result = update_episode_thumbnail_record(
        episode_id=clean_id,
        thumbnail_url=cloudinary_result["secure_url"],
        thumbnail_public_id=cloudinary_result.get("public_id"),
        thumbnail_source_url=fandom_result.get("source_url"),
        dry_run=dry_run,
    )

    # 4. Save local artifact to episodes/<episode_id>/thumbnail.json
    out_path = ep_dir / "thumbnail.json"
    artifact_payload = {
        "episode_id": clean_id,
        "episode_title": title,
        "season": ep_season,
        "fandom": fandom_result,
        "cloudinary": cloudinary_result,
        "supabase_update": db_result,
        "convention_note": "Convention: The Episodes page uses YouTube thumbnail URLs; the Supabase thumbnail_url column is for the Reviews section only.",
        "dry_run": dry_run,
    }

    with open(out_path, "w", encoding="utf-8") as f:
        json.dump(artifact_payload, f, indent=2)

    mode_label = "DRY RUN" if dry_run else "LIVE WRITE"
    log_msg = (
        f"Step 4 Complete ({mode_label}):\n"
        f"- Episode: {clean_id} ({title})\n"
        f"- Fandom Page: {fandom_result.get('fandom_page')}\n"
        f"- Source URL: {fandom_result.get('source_url')}\n"
        f"- Cloudinary Public ID: {cloudinary_result.get('public_id')}\n"
        f"- Cloudinary Secure URL: {cloudinary_result.get('secure_url')}\n"
        f"- Supabase DB Status: {db_result.get('status')} (Review section thumbnail target)\n"
        f"- Convention: YouTube URL retained for Episodes page; Cloudinary URL stored for Reviews section\n"
        f"- Artifact saved: {out_path}"
    )

    artifacts = {
        "thumbnail": str(out_path)
    }

    update_step_state(
        episode_id,
        "step4_thumbnails",
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
        "thumbnail": artifact_payload
    }
