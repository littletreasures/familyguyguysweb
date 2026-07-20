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
from validation import validate_review_dict, log_audit_event


def build_review_rows(review_data: dict) -> list:
    episode_id = review_data.get("episode_id", "").strip()
    if not episode_id:
        raise ValueError("Missing required 'episode_id' in review data JSON")

    rows = []
    for r in review_data.get("reviews", []):
        host_name = r.get("host_name")
        cohost_id = config.COHOST_UUIDS.get(host_name)
        if not cohost_id:
            log_audit_event("BUILD_REVIEWS", episode_id, "WARN", f"No host UUID for '{host_name}'")
            continue

        raw_row = {
            "episode_id": episode_id,
            "cohost_id": cohost_id,
            "rating": r.get("rating"),
            "review": r.get("review", ""),
            "pull_quote": r.get("pull_quote", ""),
            "draft_source": "transcript",
            "rating_terminology": r.get("rating_terminology", "Quahogs"),
            "rating_scale_max": r.get("rating_scale_max", 5),
        }
        # Validate schema allow-list and rating bounds (0 to 5)
        validated_row = validate_review_dict(raw_row, config.COHOST_UUIDS)
        rows.append(validated_row)

    return rows


def upsert_reviews(rows: list, dry_run: bool = False):
    if not rows:
        print("No review rows provided.")
        return

    ep_id = rows[0]["episode_id"]
    if dry_run:
        log_audit_event("UPSERT_REVIEWS", ep_id, "DRY_RUN", f"Would upsert {len(rows)} review row(s).")
        print(f"[DRY RUN] Would upsert {len(rows)} row(s) into `reviews`:")
        for row in rows:
            print(json.dumps(row, indent=2))
        return

    # Fail closed assertion
    config.require_supabase_credentials()

    client = create_client(config.SUPABASE_URL, config.SUPABASE_SERVICE_KEY)
    result = client.table("reviews").upsert(rows, on_conflict="episode_id,cohost_id").execute()
    log_audit_event("UPSERT_REVIEWS", ep_id, "SUCCESS", f"Upserted {len(rows)} review row(s).")
    print("Upserted reviews:", result.data)


def main():
    parser = argparse.ArgumentParser(description="Upsert review JSON into Supabase")
    parser.add_argument("--review-json", required=True, help="Path to review JSON file")
    parser.add_argument("--dry-run", action="store_true")
    args = parser.parse_args()

    try:
        with open(args.review_json, "r") as f:
            review_data = json.load(f)

        rows = build_review_rows(review_data)
        if not rows:
            sys.exit("No valid review rows to upsert.")

        upsert_reviews(rows, dry_run=args.dry_run)
    except Exception as e:
        log_audit_event("UPSERT_REVIEWS", "UNKNOWN", "FAILED", str(e))
        sys.exit(f"Error: {e}")


if __name__ == "__main__":
    main()

