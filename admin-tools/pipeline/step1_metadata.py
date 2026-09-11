"""
step1_metadata.py — Fetch, preview, validate, and upsert episode metadata.
Saves local artifact: episodes/<episode_id>/metadata.json
"""
import json
import os
from pathlib import Path
from typing import Dict, Any, Optional

import config
from omdb_fetch import fetch_episode_metadata, map_to_episodes_row, upsert_episode
from validation import validate_episode_dict
from pipeline.state import get_episodes_dir, update_step_state, assert_safe_publish, is_test_episode_id

# Fallback test fixture for s02e99 / testing
FIXTURE_S02E99 = {
    "Title": "Peter, Peter, Caviar Eater",
    "Released": "23 Sep 1999",
    "Runtime": "22 min",
    "imdbRating": "7.8",
    "Plot": "When Lois' aunt dies, she leaves the Griffins the Cherrywood Manor in Newport.",
    "Actors": "Seth MacFarlane, Alex Borstein, Seth Green, Mila Kunis",
    "Writer": "Seth MacFarlane, David Zuckerman, Chris Sheridan",
    "Director": "Jeff Myers",
    "Response": "True"
}


def fetch_and_prepare_metadata(
    episode_id: str,
    season: int,
    episode: int,
    youtube_url: str = "",
    custom_overrides: Optional[Dict[str, Any]] = None
) -> Dict[str, Any]:
    """
    Fetches metadata from OMDb (or uses fixture if test episode/offline),
    maps to internal schema, applies overrides, and validates.
    """
    clean_id = episode_id.lower().strip()
    omdb_data = None

    if is_test_episode_id(clean_id):
        omdb_data = dict(FIXTURE_S02E99)
    else:
        try:
            omdb_data = fetch_episode_metadata(season, episode)
        except Exception as e:
            # If OMDb fails in test environment, fallback to fixture if available
            if is_test_episode_id(clean_id):
                omdb_data = dict(FIXTURE_S02E99)
            else:
                raise e

    row = map_to_episodes_row(clean_id, season, episode, omdb_data, youtube_url=youtube_url)

    if custom_overrides:
        for k, v in custom_overrides.items():
            if k in row and v is not None:
                row[k] = v

    validated_row = validate_episode_dict(row)
    return validated_row


def run_step1_metadata(
    episode_id: str,
    season: int,
    episode: int,
    youtube_url: str = "",
    custom_overrides: Optional[Dict[str, Any]] = None,
    dry_run: bool = True,
    confirm_phrase: str = ""
) -> Dict[str, Any]:
    """
    Executes Step 1:
    1. Prepares metadata row.
    2. Writes local artifact episodes/<episode_id>/metadata.json.
    3. Gated database upsert.
    4. Updates state.
    """
    update_step_state(episode_id, "step1_metadata", "running", logs="Fetching and preparing episode metadata...")

    assert_safe_publish(episode_id, dry_run)

    row = fetch_and_prepare_metadata(
        episode_id=episode_id,
        season=season,
        episode=episode,
        youtube_url=youtube_url,
        custom_overrides=custom_overrides
    )

    # Save local artifact
    ep_dir = get_episodes_dir(episode_id)
    metadata_path = ep_dir / "metadata.json"
    with open(metadata_path, "w", encoding="utf-8") as f:
        json.dump(row, f, indent=2)

    artifacts = {
        "metadata": str(metadata_path)
    }

    if not dry_run:
        if confirm_phrase.strip() != "PUBLISH TO PRODUCTION":
            err = "Operation rejected: You must type 'PUBLISH TO PRODUCTION' to authorize live database updates."
            update_step_state(episode_id, "step1_metadata", "error", logs=err, artifacts=artifacts)
            raise ValueError(err)
        upsert_episode(row, dry_run=False)
        log_msg = f"Successfully pushed episode metadata for '{episode_id}' to Supabase (Production)."
    else:
        upsert_episode(row, dry_run=True)
        log_msg = (
            f"Step 1 Complete (DRY RUN):\n"
            f"- Episode ID: {row['id']}\n"
            f"- Title: {row['title']}\n"
            f"- Air Date: {row['air_date']}\n"
            f"- Runtime: {row['runtime']}\n"
            f"- IMDb: {row['imdb_rating']}\n"
            f"- Writers: {', '.join(row['writers'])}\n"
            f"- Director: {row['director']}\n"
            f"- Database write simulated (0 DB writes performed).\n"
            f"- Artifact written to {metadata_path}"
        )

    update_step_state(
        episode_id,
        "step1_metadata",
        "done",
        logs=log_msg,
        artifacts=artifacts,
        validation={"passed": True, "errors": [], "warnings": []},
        approved=True
    )

    return {
        "status": "done",
        "row": row,
        "artifacts": artifacts,
        "logs": log_msg
    }
