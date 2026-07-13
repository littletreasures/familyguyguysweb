"""
sync_feed.py — Sync Riverside RSS feed episodes to Supabase database.
Fetches the Riverside XML feed, parses the audio enclosure URLs, and updates
the `podcast_url` column in your Supabase `episodes` table based on matching season and episode numbers.

Usage:
    python sync_feed.py
    python sync_feed.py --dry-run
"""
import argparse
import xml.etree.ElementTree as ET
import requests
from supabase import create_client
import config


# XML Namespaces used in podcast feeds
NAMESPACES = {
    "itunes": "http://www.itunes.com/dtds/podcast-1.0.dtd",
    "content": "http://purl.org/rss/1.0/modules/content/",
}

RIVERSIDE_FEED_URL = "https://api.riverside.com/hosting/ybzPu9xT.rss"


def fetch_and_parse_feed(url: str) -> list:
    print(f"Fetching RSS feed from: {url}")
    resp = requests.get(url, timeout=15)
    resp.raise_for_status()
    
    root = ET.fromstring(resp.content)
    channel = root.find("channel")
    if channel is None:
        raise ValueError("Invalid RSS feed format: no <channel> element found.")
        
    episodes = []
    items = channel.findall("item")
    print(f"Found {len(items)} items in feed.")
    
    for item in items:
        title = item.find("title")
        title_text = title.text if title is not None else "Untitled"
        
        enclosure = item.find("enclosure")
        media_url = enclosure.attrib.get("url") if enclosure is not None else None
        
        season_el = item.find("itunes:season", NAMESPACES)
        episode_el = item.find("itunes:episode", NAMESPACES)
        
        season = int(season_el.text) if season_el is not None else None
        episode_num = int(episode_el.text) if episode_el is not None else None
        
        # If no explicit season/episode tags, try parsing from title (e.g., "S1E3" or "Season 1 Episode 3")
        if season is None or episode_num is None:
            import re
            match = re.search(r"[sS](\d+)\s*[eE](\d+)", title_text)
            if match:
                season = int(match.group(1))
                episode_num = int(match.group(2))
                
        if season is not None and episode_num is not None and media_url:
            episodes.append({
                "title": title_text,
                "season": season,
                "episode_number": episode_num,
                "podcast_url": media_url,
            })
            
    return episodes


def sync_to_supabase(episodes: list, dry_run: bool = False):
    client = create_client(config.SUPABASE_URL, config.SUPABASE_SERVICE_KEY)
    
    for ep in episodes:
        print(f"\nProcessing: {ep['title']} (Season {ep['season']} Episode {ep['episode_number']})")
        print(f"  Enclosure URL: {ep['podcast_url']}")
        
        if dry_run:
            print("  [DRY RUN] Would update podcast_url in Supabase.")
            continue
            
        # Find matching episode in Supabase
        res = client.table("episodes").select("id, title, podcast_url").eq("season", ep["season"]).eq("episode_number", ep["episode_number"]).execute()
        
        if not res.data:
            print(f"  WARNING: No matching episode found in database for Season {ep['season']}, Episode {ep['episode_number']}.")
            continue
            
        db_ep = res.data[0]
        db_id = db_ep["id"]
        current_url = db_ep.get("podcast_url")
        
        if current_url == ep["podcast_url"]:
            print("  Already up-to-date in database.")
        else:
            print(f"  Updating podcast_url from '{current_url}' to '{ep['podcast_url']}'...")
            update_res = client.table("episodes").update({"podcast_url": ep["podcast_url"]}).eq("id", db_id).execute()
            print(f"  Successfully updated: {update_res.data}")


def main():
    parser = argparse.ArgumentParser(description="Sync podcast audio URLs from Riverside RSS to Supabase")
    parser.add_argument("--dry-run", action="store_true", help="Print updates without modifying the database")
    args = parser.parse_args()
    
    try:
        feed_episodes = fetch_and_parse_feed(RIVERSIDE_FEED_URL)
        if not feed_episodes:
            print("No valid episodes with audio enclosures found in feed.")
            return
            
        sync_to_supabase(feed_episodes, dry_run=args.dry_run)
        print("\nFeed sync process finished successfully.")
    except Exception as e:
        print(f"Error: {e}")


if __name__ == "__main__":
    main()
