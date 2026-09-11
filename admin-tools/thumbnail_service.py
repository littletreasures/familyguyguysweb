"""
thumbnail_service.py — Utilities for fetching episode thumbnails from the Family Guy Fandom Wiki,
uploading them to Cloudinary, and updating episode records in Supabase.
"""
import json
import os
import requests
from typing import Dict, Any, Optional, List
from supabase import create_client
import config
from validation import log_audit_event

WIKI_API = "https://familyguy.fandom.com/api.php"
CLOUDINARY_FOLDER = "family-guy/episodes"
MANIFEST_DEFAULT_PATH = os.path.join(os.path.dirname(__file__), "episode-manifest.json")


def fetch_fandom_thumbnail(title: str) -> Dict[str, Any]:
    """
    Query the Family Guy Fandom Wiki API for an episode's lead image.
    """
    clean_title = title.strip()
    if not clean_title:
        raise ValueError("Episode title cannot be empty when querying Fandom Wiki.")

    params = {
        "action": "query",
        "prop": "pageimages",
        "piprop": "original",
        "redirects": "1",
        "titles": clean_title,
        "format": "json",
        "formatversion": "2",
    }
    headers = {
        "User-Agent": "FamilyGuyGuysPodcastThumbnailImporter/1.0 (personal editorial podcast site)",
        "Accept": "application/json, text/plain, */*",
    }

    resp = requests.get(WIKI_API, params=params, headers=headers, timeout=15)
    resp.raise_for_status()
    data = resp.json()

    pages = data.get("query", {}).get("pages", [])
    if not pages or pages[0].get("missing"):
        raise ValueError(f"No Fandom Wiki page found for '{clean_title}'.")

    page = pages[0]
    source_url = page.get("original", {}).get("source")
    if not source_url:
        raise ValueError(f"No lead thumbnail image available on Fandom Wiki for '{page.get('title')}'.")

    return {
        "fandom_page": page.get("title"),
        "source_url": source_url,
        "width": page.get("original", {}).get("width"),
        "height": page.get("original", {}).get("height"),
    }


def upload_thumbnail_to_cloudinary(
    source_url: str,
    episode_id: str,
    title: str = "",
    season: Optional[int] = None
) -> Dict[str, Any]:
    """
    Uploads an image from a URL to Cloudinary under the family-guy/episodes folder.
    """
    c_name = getattr(config, "CLOUDINARY_CLOUD_NAME", os.getenv("CLOUDINARY_CLOUD_NAME", "")).strip()
    c_key = getattr(config, "CLOUDINARY_API_KEY", os.getenv("CLOUDINARY_API_KEY", "")).strip()
    c_secret = getattr(config, "CLOUDINARY_API_SECRET", os.getenv("CLOUDINARY_API_SECRET", "")).strip()

    if not c_name or not c_key or not c_secret:
        raise ValueError(
            "Cloudinary credentials missing in admin-tools/.env "
            "(CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY, CLOUDINARY_API_SECRET)."
        )

    import cloudinary
    import cloudinary.uploader

    cloudinary.config(
        cloud_name=c_name,
        api_key=c_key,
        api_secret=c_secret,
        secure=True,
    )

    clean_id = episode_id.lower().strip()
    public_id = f"{CLOUDINARY_FOLDER}/{clean_id}"

    tags = ["family-guy", "episode-thumbnail", f"episode-{clean_id}"]
    if season:
        tags.append(f"season-{season}")

    result = cloudinary.uploader.upload(
        source_url,
        public_id=public_id,
        overwrite=True,
        unique_filename=False,
        use_filename=False,
        tags=tags,
        context={
            "episode_id": clean_id,
            "episode_title": title,
            "source_url": source_url,
        },
    )

    return {
        "public_id": result.get("public_id"),
        "secure_url": result.get("secure_url"),
        "width": result.get("width"),
        "height": result.get("height"),
        "format": result.get("format"),
    }


def update_episode_thumbnail_record(
    episode_id: str,
    thumbnail_url: str,
    thumbnail_public_id: Optional[str] = None,
    thumbnail_source_url: Optional[str] = None,
    dry_run: bool = False
) -> Dict[str, Any]:
    """
    Updates the thumbnail fields on the `episodes` table in Supabase.
    """
    clean_id = episode_id.lower().strip()
    payload = {
        "thumbnail_url": thumbnail_url,
        "thumbnail_public_id": thumbnail_public_id,
        "thumbnail_source_url": thumbnail_source_url,
        "thumbnail_status": "uploaded",
        "thumbnail_error": None,
    }

    if dry_run:
        log_audit_event("UPSERT_THUMBNAIL", clean_id, "DRY_RUN", f"Would update thumbnail_url={thumbnail_url}")
        return {"id": clean_id, "status": "dry_run", "payload": payload}

    config.require_supabase_credentials()
    client = create_client(config.SUPABASE_URL, config.SUPABASE_SERVICE_KEY)

    res = client.table("episodes").update(payload).eq("id", clean_id).execute()
    log_audit_event("UPSERT_THUMBNAIL", clean_id, "SUCCESS", f"Updated thumbnail for episode {clean_id}")
    return {"id": clean_id, "status": "success", "data": res.data}


def load_manifest_data(file_path: str = MANIFEST_DEFAULT_PATH) -> Dict[str, Any]:
    """
    Loads thumbnail manifest JSON generated by scrape-thumbnails.mjs or export routines.
    """
    if not os.path.exists(file_path):
        raise FileNotFoundError(f"Manifest file not found at '{file_path}'.")

    with open(file_path, "r", encoding="utf-8") as f:
        return json.load(f)


def sync_manifest_to_supabase(
    manifest_data: Dict[str, Any],
    dry_run: bool = False
) -> Dict[str, Any]:
    """
    Upserts thumbnail records from manifest JSON into Supabase episodes table.
    Matches episodes by `id` (e.g. 's1e4') or `slug`.
    """
    if dry_run:
        log_audit_event("UPSERT_MANIFEST", "ALL", "DRY_RUN", f"Would process {len(manifest_data)} entries.")
        return {"processed": len(manifest_data), "mode": "dry_run"}

    config.require_supabase_credentials()
    client = create_client(config.SUPABASE_URL, config.SUPABASE_SERVICE_KEY)

    updated_count = 0
    errors = []

    for slug, item in manifest_data.items():
        season = item.get("season")
        episode = item.get("episode")
        ep_id = f"s{season}e{episode}" if (season and episode) else None
        thumb_url = item.get("cloudinary_url") or item.get("thumbnail_url")
        public_id = item.get("public_id")

        if not thumb_url:
            continue

        try:
            payload = {
                "thumbnail_url": thumb_url,
                "thumbnail_public_id": public_id,
                "thumbnail_status": "uploaded",
                "thumbnail_error": None,
            }
            if ep_id:
                res = client.table("episodes").update(payload).eq("id", ep_id).execute()
            else:
                res = client.table("episodes").update(payload).eq("slug", slug).execute()

            if res.data:
                updated_count += len(res.data)
        except Exception as e:
            errors.append({"slug": slug, "error": str(e)})

    log_audit_event("UPSERT_MANIFEST", "ALL", "SUCCESS", f"Updated {updated_count} records, {len(errors)} errors.")
    return {"updated": updated_count, "errors": errors}
