"""
step7_feed_sync.py — Safe podcast RSS feed synchronization for Mission Control.
Preserves canonical RSS.com episode page URLs (e.g. https://rss.com/podcasts/family-guy-guys/3038733/)
to prevent breaking the prerendered player embed iframe on static review pages.
"""
import json
import os
import re
from urllib.parse import urlparse
import xml.etree.ElementTree as ET
from pathlib import Path
from typing import Dict, Any, List, Optional
import requests

from pipeline.state import get_episodes_dir, update_step_state, assert_safe_publish
from sync_feed import PODCAST_FEED_URL, NAMESPACES
from validation import log_audit_event

RSS_CANONICAL_RE = re.compile(
    r"^https://rss\.com/podcasts/([^/]+)/(\d+)/?$",
    re.IGNORECASE,
)


def normalize_rss_canonical_url(value: str) -> Optional[str]:
    """
    Validates and normalizes an RSS.com canonical episode page URL.
    Requires numeric episode ID: https://rss.com/podcasts/<slug>/<numeric-id>/
    Accepts missing final slash and normalizes with trailing slash.
    Rejects internal IDs (s02e05), MP3 enclosures, player embeds, etc.
    """
    clean = (value or "").strip()
    match = RSS_CANONICAL_RE.fullmatch(clean)
    if not match:
        return None
    slug, numeric_episode_id = match.groups()
    return f"https://rss.com/podcasts/{slug}/{numeric_episode_id}/"


def parse_podcast_feed(url: str = PODCAST_FEED_URL) -> List[Dict[str, Any]]:
    """Fetches and parses the RSS feed from RSS.com / Riverside."""
    try:
        resp = requests.get(url, timeout=15)
        resp.raise_for_status()
        root = ET.fromstring(resp.content)
    except Exception:
        # Fallback for sandbox / offline mode
        return []

    channel = root.find("channel")
    if channel is None:
        return []

    episodes = []
    items = channel.findall("item")
    for item in items:
        title_el = item.find("title")
        title = title_el.text if title_el is not None else ""

        enclosure = item.find("enclosure")
        media_url = enclosure.attrib.get("url") if enclosure is not None else None

        link_el = item.find("link")
        link_url = link_el.text if link_el is not None else None

        season_el = item.find("itunes:season", NAMESPACES)
        episode_el = item.find("itunes:episode", NAMESPACES)

        season = int(season_el.text) if season_el is not None else None
        episode_num = int(episode_el.text) if episode_el is not None else None

        if season is None or episode_num is None:
            m = re.search(r"[sS](\d+)\s*[eE](\d+)", title)
            if m:
                season = int(m.group(1))
                episode_num = int(m.group(2))

        episodes.append({
            "title": title,
            "season": season,
            "episode_number": episode_num,
            "enclosure_url": media_url,
            "canonical_link": link_url,
        })
    return episodes


def run_step7_feed_sync(
    episode_id: str,
    season: Optional[int] = None,
    episode_number: Optional[int] = None,
    canonical_podcast_url: str = "",
    dry_run: bool = True,
) -> Dict[str, Any]:
    """
    Executes Step 7:
    1. Reads metadata to identify season and episode_number.
    2. Validates and normalizes operator canonical_podcast_url.
    3. Inspects podcast RSS feed for matching episode.
    4. Resolves canonical URL (operator input takes precedence, then feed canonical link).
    5. Gated database write (respects assert_safe_publish, dry_run, and validation passes).
    6. Saves artifact to episodes/<episode_id>/feed_sync.json.
    7. Updates state.
    """
    update_step_state(episode_id, "step7_feed_sync", "running", logs="Starting Step 7: Podcast Feed Sync...")

    # Hard guard against unauthorized live writes on test episodes
    assert_safe_publish(episode_id, dry_run=dry_run)

    ep_dir = get_episodes_dir(episode_id)
    metadata_path = ep_dir / "metadata.json"

    ep_season = season
    ep_num = episode_number

    if (ep_season is None or ep_num is None) and metadata_path.exists():
        try:
            with open(metadata_path, "r", encoding="utf-8") as f:
                meta = json.load(f)
            ep_season = ep_season if ep_season is not None else meta.get("season")
            ep_num = ep_num if ep_num is not None else meta.get("episode_number")
        except Exception:
            pass

    # 1. Parse feed items
    feed_items = parse_podcast_feed()
    matching_feed_item = None
    for item in feed_items:
        if item.get("season") == ep_season and item.get("episode_number") == ep_num:
            matching_feed_item = item
            break

    # 2. Normalize and resolve canonical URL
    operator_url = normalize_rss_canonical_url(canonical_podcast_url)
    feed_url = None
    if matching_feed_item:
        feed_url = normalize_rss_canonical_url(
            matching_feed_item.get("canonical_link", "")
        )

    resolved_canonical_url = operator_url or feed_url
    url_source = (
        "operator_input" if operator_url else "rss_feed_link" if feed_url else None
    )

    warnings: List[str] = []
    errors: List[str] = []

    if canonical_podcast_url and not operator_url:
        warnings.append(
            f"Provided canonical URL '{canonical_podcast_url}' is not a valid numeric RSS.com page URL."
        )

    if operator_url and feed_url and operator_url != feed_url:
        warnings.append(
            f"Operator canonical URL '{operator_url}' differs from feed canonical URL '{feed_url}'. Preferring operator-entered URL."
        )

    if not resolved_canonical_url:
        errors.append(
            "No valid canonical RSS.com episode page URL found. Please provide a valid URL (e.g. https://rss.com/podcasts/family-guy-guys/3215265/)."
        )

    validation_passed = resolved_canonical_url is not None

    feed_sync_payload = {
        "episode_id": episode_id,
        "season": ep_season,
        "episode_number": ep_num,
        "operator_canonical_podcast_url": operator_url,
        "feed_canonical_url": feed_url,
        "resolved_canonical_podcast_url": resolved_canonical_url,
        "canonical_url_source": url_source,
        "feed_enclosure_url": matching_feed_item.get("enclosure_url") if matching_feed_item else None,
        "validation": {
            "passed": validation_passed,
            "warnings": warnings,
            "errors": errors,
        },
        "notes": (
            "The canonical RSS.com page URL is retained for player embed derivation. "
            "The MP3 enclosure URL is informational only and is never written to podcast_url."
        ),
        "dry_run": dry_run,
    }

    # Live Supabase write only if: not dry_run AND resolved_canonical_url is not None AND validation passed
    if not dry_run and resolved_canonical_url is not None and validation_passed:
        import config
        from supabase import create_client
        config.require_supabase_credentials()
        client = create_client(config.SUPABASE_URL, config.SUPABASE_SERVICE_KEY)
        query = client.table("episodes").update({"podcast_url": resolved_canonical_url})
        if ep_season is not None and ep_num is not None:
            query = query.eq("season", ep_season).eq("episode_number", ep_num)
        else:
            query = query.eq("id", episode_id)
        query.execute()
        log_audit_event("FEED_SYNC", episode_id, "LIVE", f"Updated podcast_url to {resolved_canonical_url}")
    else:
        log_audit_event(
            "FEED_SYNC",
            episode_id,
            "DRY_RUN" if dry_run else "VALIDATION_SKIPPED",
            f"Resolved URL: {resolved_canonical_url} (dry_run={dry_run}, passed={validation_passed})"
        )

    out_path = ep_dir / "feed_sync.json"
    with open(out_path, "w", encoding="utf-8") as f:
        json.dump(feed_sync_payload, f, indent=2)

    mode_label = "DRY RUN" if dry_run else "LIVE WRITE"
    status_label = "PASSED" if validation_passed else "FAILED / INCOMPLETE"
    log_msg = (
        f"Step 7 Complete ({mode_label}):\n"
        f"- Episode: {episode_id} (Season {ep_season}, Episode {ep_num})\n"
        f"- Resolved Canonical URL: {resolved_canonical_url or 'None'}\n"
        f"- Source: {url_source or 'None'}\n"
        f"- Enclosure Audio URL: {matching_feed_item.get('enclosure_url') if matching_feed_item else 'None'}\n"
        f"- Validation: {status_label}\n"
        f"- Warnings: {len(warnings)}, Errors: {len(errors)}\n"
        f"- Artifact saved: {out_path}"
    )

    artifacts = {
        "feed_sync": str(out_path)
    }

    step_status = "done" if validation_passed else "error"
    update_step_state(
        episode_id,
        "step7_feed_sync",
        step_status,
        logs=log_msg,
        artifacts=artifacts,
        validation=feed_sync_payload["validation"],
        approved=validation_passed,
    )

    return {
        "status": step_status,
        "artifacts": artifacts,
        "logs": log_msg,
        "feed_sync": feed_sync_payload
    }
