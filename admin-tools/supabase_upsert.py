"""
supabase_upsert.py — Push generated (or hand-edited) review JSON into
the `reviews` table, tagging draft_source='transcript'.

Usage:
    python supabase_upsert.py --review-json s1e4_review.json
    python supabase_upsert.py --review-json s1e4_review.json --dry-run
"""
import argparse
import json
import sys
from supabase import create_client
import config


def build_review_rows(review_data: dict) -> list:
    episode_id = review_data["episode_id"]
    rows = []
    for r in review_data.get("reviews", []):
        host_name = r.get("host_name")
        cohost_id = config.COHOST_UUIDS.get(host_name)
        if not cohost_id:
            print(f"WARNING: no UUID found for host '{host_name}', skipping.")
            continue
        rows.append({
            "episode_id": episode_id,
            "cohost_id": cohost_id,
            "rating": r.get("rating"),
            "review": r.get("review", ""),
            "pull_quote": r.get("pull_quote", ""),
            "draft_source": "transcript",
            "rating_terminology": r.get("rating_terminology", "Quahogs"),
            "rating_scale_max": r.get("rating_scale_max", 5),
        })
    return rows


def upsert_reviews(rows: list, dry_run: bool = False):
    if dry_run:
        print("[DRY RUN] Would upsert into `reviews`:")
        for row in rows:
            print(json.dumps(row, indent=2))
        return
    client = create_client(config.SUPABASE_URL, config.SUPABASE_SERVICE_KEY)
    result = client.table("reviews").upsert(rows, on_conflict="episode_id,cohost_id").execute()
    print("Upserted reviews:", result.data)


def main():
    parser = argparse.ArgumentParser(description="Upsert review JSON into Supabase")
    parser.add_argument("--review-json", required=True, help="Path to review JSON file")
    parser.add_argument("--dry-run", action="store_true")
    args = parser.parse_args()

    with open(args.review_json, "r") as f:
        review_data = json.load(f)

    rows = build_review_rows(review_data)
    if not rows:
        sys.exit("No valid review rows to upsert.")
    upsert_reviews(rows, dry_run=args.dry_run)


if __name__ == "__main__":
    main()
