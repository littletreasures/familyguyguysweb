"""
omdb_fetch.py — Backfill the `episodes` table from the OMDb API.

Usage:
    python omdb_fetch.py --season 1 --episode 4 --episode-id s1e4
    python omdb_fetch.py --season 1 --episode 4 --episode-id s1e4 --dry-run
"""
import argparse
import sys
import requests
from supabase import create_client
import config


def fetch_episode_metadata(season: int, episode: int) -> dict:
    params = {
        "t": config.SHOW_TITLE,
        "Season": season,
        "Episode": episode,
        "apikey": config.OMDB_API_KEY,
    }
    resp = requests.get(config.OMDB_BASE_URL, params=params, timeout=15)
    resp.raise_for_status()
    data = resp.json()
    if data.get("Response") == "False":
        raise ValueError(f"OMDb error: {data.get('Error')}")
    return data


def map_to_episodes_row(episode_id: str, season: int, episode: int, omdb_data: dict, youtube_url: str = "") -> dict:
    def split_list(s):
        if not s or s == "N/A":
            return []
        return [x.strip() for x in s.split(",")]

    row = {
        "id": episode_id,
        "season": season,
        "episode_number": episode,
        "title": omdb_data.get("Title", ""),
        "air_date": omdb_data.get("Released", ""),
        "runtime": omdb_data.get("Runtime", ""),
        "imdb_rating": omdb_data.get("imdbRating", ""),
        "summary": omdb_data.get("Plot", ""),
        "cast": split_list(omdb_data.get("Actors", "")),
        "writers": split_list(omdb_data.get("Writer", "")),
        "director": omdb_data.get("Director", ""),
    }
    if youtube_url:
        row["youtube_url"] = youtube_url
    return row


def upsert_episode(row: dict, dry_run: bool = False):
    if dry_run:
        print("[DRY RUN] Would upsert into `episodes`:")
        for k, v in row.items():
            print(f"  {k}: {v}")
        return
    client = create_client(config.SUPABASE_URL, config.SUPABASE_SERVICE_KEY)
    result = client.table("episodes").upsert(row).execute()
    print("Upserted episode:", result.data)


def main():
    parser = argparse.ArgumentParser(description="Backfill episodes table from OMDb")
    parser.add_argument("--season", type=int, required=True)
    parser.add_argument("--episode", type=int, required=True)
    parser.add_argument("--episode-id", type=str, required=True,
                         help="Internal episode id, e.g. s1e4")
    parser.add_argument("--youtube-url", type=str, default="",
                         help="YouTube video link for the episode")
    parser.add_argument("--dry-run", action="store_true")
    args = parser.parse_args()

    if not config.OMDB_API_KEY:
        sys.exit("OMDB_API_KEY not set in .env")

    omdb_data = fetch_episode_metadata(args.season, args.episode)
    row = map_to_episodes_row(args.episode_id, args.season, args.episode, omdb_data, youtube_url=args.youtube_url)
    upsert_episode(row, dry_run=args.dry_run)


if __name__ == "__main__":
    main()
