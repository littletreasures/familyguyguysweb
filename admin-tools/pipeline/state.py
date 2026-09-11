"""
state.py — Per-episode state persistence and checklist management for Mission Control.
State files are stored at: admin-tools/state/<episode_id>.json
Artifacts are stored at: episodes/<episode_id>/
"""
import hashlib
import json
import os
from datetime import datetime, timezone
from pathlib import Path
from typing import Dict, Any, Optional

STATE_DIR = Path(__file__).resolve().parent.parent / "state"
DEFAULT_EPISODES_ROOT = Path(__file__).resolve().parent.parent.parent / "episodes"

STEP_NAMES = [
    "step0_transcript_prep",
    "step1_metadata",
    "step2_reviews",
    "step3_transcript_publish",
    "step4_thumbnails",
    "step5_youtube",
    "step6_credits",
    "step6b_chapters",
    "step7_feed_sync",
]


def is_test_episode_id(episode_id: str) -> bool:
    """Returns True if the episode ID is a testing fixture (e.g. s02e99, s99e99, *_test)."""
    clean = episode_id.lower().strip()
    if clean in {"s02e99", "s99e99", "s01e99"}:
        return True
    if clean.endswith("_test") or clean.startswith("test_") or "_test_" in clean or "fixture" in clean:
        return True
    return False


def assert_safe_publish(episode_id: str, dry_run: bool) -> None:
    """
    Hard defense-in-depth safety guard:
    Rejects any live database or external production write if the episode ID is a test fixture.
    """
    if not dry_run and is_test_episode_id(episode_id):
        raise PermissionError(
            f"CRITICAL SAFETY VIOLATION: Episode ID '{episode_id}' is a test fixture and is PERMANENTLY LOCKED "
            "to dry_run=True. Production database writes are strictly forbidden."
        )


def compute_file_hash(file_path: str) -> str:
    """Computes SHA-256 hash of a local file."""
    sha = hashlib.sha256()
    with open(file_path, "rb") as f:
        while chunk := f.read(65536):
            sha.update(chunk)
    return sha.hexdigest()


def get_episodes_dir(episode_id: str, root_dir: Optional[Path] = None) -> Path:
    """Returns and ensures the episode artifact directory: episodes/<episode_id>/"""
    base = root_dir or DEFAULT_EPISODES_ROOT
    ep_dir = base / episode_id.lower().strip()
    ep_dir.mkdir(parents=True, exist_ok=True)
    return ep_dir


def get_state_file_path(episode_id: str) -> Path:
    """Returns path to the state file: admin-tools/state/<episode_id>.json"""
    STATE_DIR.mkdir(parents=True, exist_ok=True)
    return STATE_DIR / f"{episode_id.lower().strip()}.json"


def create_initial_state(
    episode_id: str,
    season: int = 1,
    episode: int = 1,
    podcast_episode_number: Optional[int] = None,
    episode_title: str = "",
    guest_name: str = "",
    youtube_url: str = "",
    riverside_transcript_path: str = "",
    srt_path: str = "",
    dry_run: bool = True,
) -> Dict[str, Any]:
    """Creates a fresh state dictionary for an episode."""
    # Enforce test episode locked to dry_run
    if is_test_episode_id(episode_id):
        dry_run = True

    steps = {}
    for step in STEP_NAMES:
        steps[step] = {
            "status": "pending",  # pending | running | done | error | skipped
            "updated_at": None,
            "logs": "",
            "artifacts": {},
            "validation": {"passed": True, "errors": [], "warnings": []},
            "approved": False,
        }

    return {
        "episode_id": episode_id.lower().strip(),
        "season": season,
        "episode": episode,
        "podcast_episode_number": podcast_episode_number,
        "episode_title": episode_title,
        "guest_name": guest_name,
        "youtube_url": youtube_url,
        "riverside_transcript_path": riverside_transcript_path,
        "srt_path": srt_path,
        "dry_run": dry_run,
        "source_metadata": {},
        "created_at": datetime.now(timezone.utc).isoformat(),
        "updated_at": datetime.now(timezone.utc).isoformat(),
        "steps": steps,
    }


def load_episode_state(episode_id: str) -> Dict[str, Any]:
    """Loads existing state or initializes a new state dictionary."""
    clean_id = episode_id.lower().strip()
    path = get_state_file_path(clean_id)
    if path.exists():
        try:
            with open(path, "r", encoding="utf-8") as f:
                state = json.load(f)
            # Enforce test fixture lock
            if is_test_episode_id(clean_id):
                state["dry_run"] = True
            if "steps" not in state:
                state["steps"] = {}
            for step in STEP_NAMES:
                if step not in state["steps"]:
                    state["steps"][step] = {
                        "status": "pending",
                        "updated_at": None,
                        "logs": "",
                        "artifacts": {},
                        "validation": {"passed": True, "errors": [], "warnings": []},
                        "approved": False,
                    }
            return state
        except Exception:
            pass
    return create_initial_state(clean_id)


def save_episode_state(episode_id: str, state: Dict[str, Any]) -> None:
    """Persists state dictionary to disk atomically."""
    clean_id = episode_id.lower().strip()
    if is_test_episode_id(clean_id):
        state["dry_run"] = True
    path = get_state_file_path(clean_id)
    state["updated_at"] = datetime.now(timezone.utc).isoformat()
    tmp_path = path.with_suffix(".tmp")
    with open(tmp_path, "w", encoding="utf-8") as f:
        json.dump(state, f, indent=2)
    tmp_path.replace(path)


def update_step_state(
    episode_id: str,
    step_name: str,
    status: str,
    logs: str = "",
    artifacts: Optional[Dict[str, str]] = None,
    validation: Optional[Dict[str, Any]] = None,
    approved: Optional[bool] = None,
    source_metadata: Optional[Dict[str, Any]] = None,
) -> Dict[str, Any]:
    """Updates a single step's execution state and saves immediately."""
    state = load_episode_state(episode_id)
    step_data = state["steps"].get(step_name, {})
    step_data["status"] = status
    step_data["updated_at"] = datetime.now(timezone.utc).isoformat()
    if logs:
        step_data["logs"] = logs
    if artifacts is not None:
        step_data.setdefault("artifacts", {}).update(artifacts)
    if validation is not None:
        step_data["validation"] = validation
    if approved is not None:
        step_data["approved"] = approved
    if source_metadata is not None:
        state.setdefault("source_metadata", {}).update(source_metadata)

    state["steps"][step_name] = step_data
    save_episode_state(episode_id, state)
    return state


load_step_state = load_episode_state
save_step_state = save_episode_state
