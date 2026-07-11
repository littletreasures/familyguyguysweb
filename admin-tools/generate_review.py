"""
generate_review.py — CLI: transcript file -> review JSON via chosen LLM provider.

Usage:
    python generate_review.py --transcript s1e4fagugu-end.txt --episode-id s1e4 --out s1e4_review.json
    python generate_review.py --transcript s1e4fagugu-end.txt --episode-id s1e4 --provider openai
"""
import argparse
import json
import sys
import config
from llm_client import generate_review_json


def main():
    parser = argparse.ArgumentParser(description="Generate review JSON from transcript via LLM")
    parser.add_argument("--transcript", required=True, help="Path to transcript .txt file")
    parser.add_argument("--episode-id", required=True, help="Internal episode id, e.g. s1e4")
    parser.add_argument("--episode-title", default="", help="Episode title (optional)")
    parser.add_argument("--provider", default=None,
                         help="Override LLM_PROVIDER from .env (gemini|openai|anthropic)")
    parser.add_argument("--out", default=None, help="Output JSON file path (default: stdout)")
    args = parser.parse_args()

    if args.provider:
        config.LLM_PROVIDER = args.provider.lower()

    with open(args.transcript, "r", encoding="utf-8") as f:
        transcript_text = f.read()

    result = generate_review_json(args.episode_id, args.episode_title, transcript_text)

    output_str = json.dumps(result, indent=2)
    if args.out:
        with open(args.out, "w") as f:
            f.write(output_str)
        print(f"Saved review JSON to {args.out}")
    else:
        print(output_str)


if __name__ == "__main__":
    main()
