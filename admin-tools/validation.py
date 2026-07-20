"""
validation.py — Schema validation and non-sensitive audit logging for admin tools.
"""
import logging
import re
from datetime import datetime, timezone
from typing import List, Optional, Dict, Any

try:
    from pydantic import BaseModel, Field, field_validator, ConfigDict
    PYDANTIC_AVAILABLE = True
except ImportError:
    PYDANTIC_AVAILABLE = False

# Configure structured audit logger (no secrets or sensitive payload bodies)
logger = logging.getLogger("admin_audit")
logger.setLevel(logging.INFO)
if not logger.handlers:
    ch = logging.StreamHandler()
    formatter = logging.Formatter("[AUDIT %(asctime)s] %(levelname)s: %(message)s")
    ch.setFormatter(formatter)
    logger.addHandler(ch)


def log_audit_event(action: str, episode_id: str, status: str, details: str = ""):
    """Log non-sensitive administrative action audit record."""
    timestamp = datetime.now(timezone.utc).isoformat()
    msg = f"Action={action} | EpisodeID={episode_id} | Status={status}"
    if details:
        msg += f" | Details={details}"
    logger.info(msg)


ALLOWED_EPISODE_FIELDS = {
    "id", "season", "episode_number", "title", "air_date",
    "runtime", "imdb_rating", "summary", "cast", "writers",
    "director", "youtube_url", "watch_status"
}

ALLOWED_REVIEW_FIELDS = {
    "episode_id", "cohost_id", "rating", "review",
    "pull_quote", "draft_source", "rating_terminology", "rating_scale_max"
}


def validate_url(url: Optional[str]) -> Optional[str]:
    if not url:
        return ""
    url = url.strip()
    if not url:
        return ""
    if not (url.startswith("https://") or url.startswith("http://")):
        raise ValueError(f"URL must start with https://: got '{url}'")
    if url.startswith("http://"):
        url = "https://" + url[7:]
    return url


def validate_episode_dict(data: Dict[str, Any]) -> Dict[str, Any]:
    """Validate episode dictionary using allow-list and bounds checking."""
    # Reject unallowed extra fields
    extra_fields = set(data.keys()) - ALLOWED_EPISODE_FIELDS
    if extra_fields:
        raise ValueError(f"Payload contains unexpected extra fields: {extra_fields}")

    ep_id = str(data.get("id", "")).strip()
    if not ep_id:
        raise ValueError("Episode 'id' is required.")

    season = int(data.get("season", 0))
    if season < 1:
        raise ValueError(f"Season must be >= 1, got {season}")

    ep_num = int(data.get("episode_number", 0))
    if ep_num < 1:
        raise ValueError(f"Episode number must be >= 1, got {ep_num}")

    title = str(data.get("title", "")).strip()
    if not title:
        raise ValueError("Episode 'title' cannot be empty.")

    yt_url = validate_url(data.get("youtube_url", ""))

    validated = {
        "id": ep_id,
        "season": season,
        "episode_number": ep_num,
        "title": title[:255],
        "air_date": str(data.get("air_date", "")).strip(),
        "runtime": str(data.get("runtime", "")).strip(),
        "imdb_rating": str(data.get("imdb_rating", "")).strip(),
        "summary": str(data.get("summary", "")).strip(),
        "cast": list(data.get("cast", [])),
        "writers": list(data.get("writers", [])),
        "director": str(data.get("director", "")).strip(),
    }
    if yt_url:
        validated["youtube_url"] = yt_url
    if "watch_status" in data:
        status = str(data["watch_status"]).strip().lower()
        if status not in {"backlog", "watched", "recorded", "published"}:
            raise ValueError(f"Invalid watch_status: '{status}'")
        validated["watch_status"] = status

    return validated


def validate_review_dict(data: Dict[str, Any], allowed_cohosts: Dict[str, str]) -> Dict[str, Any]:
    """Validate single review dictionary using strict schema allow-list."""
    extra_fields = set(data.keys()) - ALLOWED_REVIEW_FIELDS
    if extra_fields:
        raise ValueError(f"Review row contains unexpected extra fields: {extra_fields}")

    ep_id = str(data.get("episode_id", "")).strip()
    if not ep_id:
        raise ValueError("Review missing required 'episode_id'")

    cohost_id = str(data.get("cohost_id", "")).strip()
    valid_uuids = set(allowed_cohosts.values())
    if cohost_id not in valid_uuids:
        raise ValueError(f"Invalid or unauthorized cohost_id '{cohost_id}'")

    rating = data.get("rating")
    if rating is not None:
        try:
            rating = float(rating)
            if rating < 0.0 or rating > 5.0:
                raise ValueError(f"Rating {rating} out of valid bounds (0.0 to 5.0)")
        except (TypeError, ValueError) as e:
            raise ValueError(f"Invalid rating value '{rating}': {e}")

    return {
        "episode_id": ep_id,
        "cohost_id": cohost_id,
        "rating": rating,
        "review": str(data.get("review", "")).strip(),
        "pull_quote": str(data.get("pull_quote", "")).strip(),
        "draft_source": str(data.get("draft_source", "transcript")).strip(),
        "rating_terminology": str(data.get("rating_terminology", "Quahogs")).strip(),
        "rating_scale_max": float(data.get("rating_scale_max", 5.0)),
    }
