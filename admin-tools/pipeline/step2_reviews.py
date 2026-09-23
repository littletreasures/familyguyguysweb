"""
step2_reviews.py — 3-chunk review extraction, cross-chunk synthesis, guest filtering, and gated upsert.
Saves local artifact: episodes/<episode_id>/reviews.json
"""
import json
import os
import re
from datetime import datetime, timezone
from pathlib import Path
from typing import Dict, Any, List, Optional, Tuple

import config
from llm_client import generate_text, _extract_json
from supabase_upsert import build_review_rows, upsert_reviews
from validation import validate_review_dict, log_audit_event
from pipeline.state import get_episodes_dir, update_step_state, assert_safe_publish, is_test_episode_id
from pipeline.validators import validate_reviews_data


def extract_chunk_review_signals(chunk_text: str, chunk_index: int, guest_name: Optional[str] = None) -> Dict[str, Any]:
    """
    Extracts ratings, commentary, and candidate quotes from an individual chunk.
    Works for Jason, Collin, Tyler, and optional guest.
    """
    speakers = ["Jason", "Collin", "Tyler"]
    if guest_name and guest_name.strip():
        speakers.append(guest_name.strip())

    found_quotes: Dict[str, List[str]] = {s: [] for s in speakers}
    rating_signals: Dict[str, List[str]] = {s: [] for s in speakers}

    lines = chunk_text.splitlines()
    curr_speaker = None

    for line in lines:
        line_clean = line.strip()
        if not line_clean:
            continue

        # Match speaker line: Speaker (MM:SS.mmm)
        m = re.match(r"^([A-Za-z0-9 _.'\"-]+?)\s*\(((\d{1,2}:)?\d{1,2}:\d{2}(?:\.\d+)?)\)\s*$", line_clean)
        if m:
            raw_spk = m.group(1).strip()
            for s in speakers:
                if s.lower() == raw_spk.lower():
                    curr_speaker = s
                    break
                else:
                    curr_speaker = None
        elif curr_speaker:
            # Check for ratings mentions
            lowered = line_clean.lower()
            if any(w in lowered for w in ["score", "rating", "give this", "super bowl", "out of", "stars", "gut"]):
                rating_signals[curr_speaker].append(line_clean)
            elif len(line_clean.split()) >= 6:
                found_quotes[curr_speaker].append(line_clean)

    return {
        "chunk_index": chunk_index,
        "rating_signals": rating_signals,
        "found_quotes": found_quotes,
    }


def synthesize_reviews_from_chunks(
    chunk_1_text: str,
    chunk_2_text: str,
    chunk_3_text: str,
    episode_id: str,
    episode_title: str = "",
    guest_name: Optional[str] = None,
    provider: Optional[str] = None,
    model: Optional[str] = None,
    max_tokens: int = 4096,
) -> Dict[str, Any]:
    """
    Synthesizes reviews across all 3 chunks:
    1. Extracts chunk-level signals from Chunk 1, 2, and 3.
    2. Uses LLM to determine each speaker's FINAL stated rating,
       custom rating terminology unit, and Letterboxd-style review.
    3. Handles both hosts (Jason, Collin, Tyler) and optional guest (e.g. Tim).
    """
    ep_dir = get_episodes_dir(episode_id)
    g_name = guest_name.strip() if guest_name and guest_name.strip() else None

    # Chunk signals
    c1_signals = extract_chunk_review_signals(chunk_1_text, 1, guest_name=g_name)
    c2_signals = extract_chunk_review_signals(chunk_2_text, 2, guest_name=g_name)
    c3_signals = extract_chunk_review_signals(chunk_3_text, 3, guest_name=g_name)

    # Prompt combining all 3 chunks signals
    if g_name:
        system_prompt = f"""You are the podcast editor for Family Guy Guys (Jason, Collin, Tyler, and guest {g_name}).
Analyze the discussion across all 3 transcript chunks.
Extract each speaker's FINAL stated rating, custom rating unit, scale max, 2-5 sentence Letterboxd review, and verbatim pull quote.
You MUST include an entry in 'reviews' for each of the four speakers: Jason, Collin, Tyler, and {g_name}.
Look across all 3 chunks for running bits, but extract the FINAL stated score (usually in chunk 3).
Store ratings normalized to a 0.0 - 5.0 scale with full floating point precision (e.g. 4.75 for 95/100, do not round to 4.8).
Keep the host's raw stated score verbatim in rating_source_note (e.g. 'Stated as ninety-five bikinied Lois out of one hundred').
rating_scale_max is the host's stated scale (5 or 100).

MANDATORY FIRST-PERSON (POV) REQUIREMENT:
Every review MUST be written in the FIRST PERSON ('I', 'me', 'my', 'myself') from that specific speaker's own perspective, as if they personally wrote down their thoughts for a Letterboxd review. Summarize their actual thoughts, jokes, and words from the episode discussion.
NEVER use third-person phrasing to describe the reviewing host or guest.
- DO NOT write 'Jason felt...', 'Collin thought...', 'Tyler was not sold...', '{g_name} enjoyed...', 'his take', or 'left him cold'.
- If referencing another co-host, do so strictly from the reviewer's first-person perspective (e.g. 'I agreed with Collin that...' rather than 'Jason agreed with Collin that...').

Return ONLY a JSON object matching this schema:
{{
  "episode_id": "{episode_id}",
  "reviews": [
    {{
      "host_name": "Jason | Collin | Tyler | {g_name}",
      "rating": 4.75,
      "rating_source_note": "verbatim quoted raw score...",
      "rating_terminology": "unit...",
      "rating_scale_max": 100,
      "review": "2-5 sentence review written strictly in FIRST PERSON ('I', 'my') in this speaker's voice, summarizing their actual thoughts and words from the episode as if they wrote it themselves...",
      "pull_quote": "verbatim funniest line..."
    }}
  ]
}}
"""
    else:
        system_prompt = f"""You are the podcast editor for Family Guy Guys (Jason, Collin, Tyler).
Analyze the discussion across all 3 transcript chunks.
Extract each speaker's FINAL stated rating, custom rating unit, scale max, 2-5 sentence Letterboxd review, and verbatim pull quote.
You MUST include an entry in 'reviews' for each of the three hosts: Jason, Collin, and Tyler.
Do NOT include any guests or fourth speakers as there was no guest on this episode.
Look across all 3 chunks for running bits, but extract the FINAL stated score (usually in chunk 3).
Store ratings normalized to a 0.0 - 5.0 scale with full floating point precision (e.g. 4.75 for 95/100, do not round to 4.8).
Keep the host's raw stated score verbatim in rating_source_note (e.g. 'Stated as ninety-five bikinied Lois out of one hundred').
rating_scale_max is the host's stated scale (5 or 100).

MANDATORY FIRST-PERSON (POV) REQUIREMENT:
Every review MUST be written in the FIRST PERSON ('I', 'me', 'my', 'myself') from that specific speaker's own perspective, as if they personally wrote down their thoughts for a Letterboxd review. Summarize their actual thoughts, jokes, and words from the episode discussion.
NEVER use third-person phrasing to describe the reviewing host.
- DO NOT write 'Jason felt...', 'Collin thought...', 'Tyler was not sold...', 'his take', or 'left him cold'.
- If referencing another co-host, do so strictly from the reviewer's first-person perspective (e.g. 'I agreed with Collin that...' rather than 'Jason agreed with Collin that...').

Return ONLY a JSON object matching this schema:
{{
  "episode_id": "{episode_id}",
  "reviews": [
    {{
      "host_name": "Jason | Collin | Tyler",
      "rating": 4.75,
      "rating_source_note": "verbatim quoted raw score...",
      "rating_terminology": "unit...",
      "rating_scale_max": 100,
      "review": "2-5 sentence review written strictly in FIRST PERSON ('I', 'my') in this host's voice, summarizing their actual thoughts and words from the episode as if they wrote it themselves...",
      "pull_quote": "verbatim funniest line..."
    }}
  ]
}}
"""

    ratings_idx = chunk_3_text.lower().rfind("rating")
    ratings_slice = chunk_3_text[max(0, ratings_idx - 500):] if ratings_idx != -1 else chunk_3_text[-16000:]

    combined_input = f"""## Chunk 1 Highlights (Intro & Early Beats):
{json.dumps(c1_signals['rating_signals'], indent=2)}

## Chunk 2 Highlights (Mid-Episode & Guest Riffs):
{json.dumps(c2_signals['rating_signals'], indent=2)}

## Chunk 3 Highlights (Complete Ratings Segment & Closing Wrap):
{ratings_slice}
"""

    raw_llm = ""
    try:
        raw_llm = generate_text(
            f"{system_prompt}\n\n{combined_input}",
            max_tokens=max_tokens,
            provider=provider,
            model=model
        )
        reviews_data = _extract_json(raw_llm)
        return reviews_data
    except Exception as e:
        # Visibility requirement: write raw output to episodes/<episode_id>/llm_raw_step2_reviews.txt
        raw_file = ep_dir / "llm_raw_step2_reviews.txt"
        with open(raw_file, "w", encoding="utf-8") as f:
            f.write(raw_llm)
        err_msg = f"Step 2 Review Synthesis Failed: {e}. Raw model output saved to {raw_file}"
        log_audit_event("REVIEW_SYNTHESIS", episode_id, "ERROR", err_msg)
        update_step_state(
            episode_id,
            "step2_reviews",
            "error",
            logs=err_msg,
            artifacts={"llm_raw": str(raw_file)}
        )
        raise ValueError(err_msg) from e


def run_step2_reviews(
    episode_id: str,
    guest_name: Optional[str] = None,
    dry_run: bool = True,
    confirm_phrase: str = "",
    provider: Optional[str] = None,
    model: Optional[str] = None,
    max_tokens: int = 4096,
) -> Dict[str, Any]:
    """
    Executes Step 2:
    1. Cleans up any prior raw error file.
    2. Loads chunk_1.txt, chunk_2.txt, chunk_3.txt from episodes/<episode_id>/chunks/.
    3. Runs per-chunk analysis and cross-chunk synthesis using specified LLM provider/model.
    4. Validates review schema and host coverage (hard-fails if unknown host appears when guest_name is None).
    5. Writes local artifact episodes/<episode_id>/reviews.json (including guest).
    6. Filters guest reviews out of Supabase payload (hosts only).
    7. Gated upsert to Supabase reviews table.
    8. Updates state with per-step LLM provenance.
    """
    prov_used = (provider or config.LLM_PROVIDER).lower().strip()
    model_used = model or config.DEFAULT_PROVIDER_MODELS.get(prov_used, "")
    g_name = guest_name.strip() if guest_name and guest_name.strip() else None

    ep_dir = get_episodes_dir(episode_id)

    # Clean up any stale error file at the start of the run
    raw_file = ep_dir / "llm_raw_step2_reviews.txt"
    if raw_file.exists():
        try:
            raw_file.unlink()
        except Exception:
            pass

    update_step_state(
        episode_id,
        "step2_reviews",
        "running",
        logs=f"Synthesizing reviews across chunks with {prov_used} ({model_used})..."
    )

    assert_safe_publish(episode_id, dry_run)

    c1_path = ep_dir / "chunks" / "chunk_1.txt"
    c2_path = ep_dir / "chunks" / "chunk_2.txt"
    c3_path = ep_dir / "chunks" / "chunk_3.txt"

    if not c1_path.exists() or not c2_path.exists() or not c3_path.exists():
        err = f"Missing chunks in {ep_dir / 'chunks'}. Run Step 0 first."
        update_step_state(episode_id, "step2_reviews", "error", logs=err)
        raise FileNotFoundError(err)

    with open(c1_path, "r", encoding="utf-8") as f:
        c1_text = f.read()
    with open(c2_path, "r", encoding="utf-8") as f:
        c2_text = f.read()
    with open(c3_path, "r", encoding="utf-8") as f:
        c3_text = f.read()

    # 1. Synthesize across all 3 chunks
    reviews_data = synthesize_reviews_from_chunks(
        chunk_1_text=c1_text,
        chunk_2_text=c2_text,
        chunk_3_text=c3_text,
        episode_id=episode_id,
        guest_name=g_name,
        provider=prov_used,
        model=model_used,
        max_tokens=max_tokens,
    )

    # 2. Automated machine validation (enforces guest_name)
    val_result = validate_reviews_data(reviews_data, guest_name=g_name)
    if not val_result["passed"]:
        err_msg = f"Step 2 Quality Gate Failed: {val_result['errors']}"
        update_step_state(episode_id, "step2_reviews", "error", logs=err_msg, validation=val_result)
        raise ValueError(err_msg)

    # 3. Save local artifact: episodes/<episode_id>/reviews.json (PRESERVES GUEST)
    reviews_path = ep_dir / "reviews.json"
    with open(reviews_path, "w", encoding="utf-8") as f:
        json.dump(reviews_data, f, indent=2)

    artifacts = {
        "reviews": str(reviews_path)
    }

    # 4. Prepare Supabase payload: EXCLUDES GUEST (hosts only in COHOST_UUIDS)
    supabase_rows = build_review_rows(reviews_data)
    included_hosts = [config.COHOST_UUIDS.get(r["cohost_id"], r["cohost_id"]) for r in supabase_rows]
    excluded_guests = [
        r["host_name"] for r in reviews_data.get("reviews", [])
        if r.get("host_name") not in config.COHOST_UUIDS
    ]

    # 5. Gated database write
    if not dry_run:
        if confirm_phrase.strip() != "PUBLISH TO PRODUCTION":
            err = "Operation rejected: You must type 'PUBLISH TO PRODUCTION' to authorize database updates."
            update_step_state(episode_id, "step2_reviews", "error", logs=err, artifacts=artifacts, validation=val_result)
            raise ValueError(err)
        upsert_reviews(supabase_rows, dry_run=False)
        log_msg = (
            f"Pushed {len(supabase_rows)} validated host review row(s) to Supabase (Production).\n"
            f"Excluded guest(s) from DB: {', '.join(excluded_guests) if excluded_guests else 'None'}."
        )
    else:
        upsert_reviews(supabase_rows, dry_run=True)
        all_speakers = [r['host_name'] for r in reviews_data.get('reviews', [])]
        log_msg = (
            f"Step 2 Complete (DRY RUN):\n"
            f"- Model used: {prov_used} ({model_used})\n"
            f"- Extracted reviews across 3 chunks for: {', '.join(all_speakers)}\n"
            f"- Local artifact saved to {reviews_path} (includes all {len(all_speakers)} speakers)\n"
            f"- Supabase review rows prepared: {len(supabase_rows)} (Hosts only: Jason, Collin, Tyler)\n"
            f"- Guest reviews correctly excluded from DB upsert: {', '.join(excluded_guests)}\n"
            f"- Database write simulated (0 DB writes performed)."
        )

    llm_provenance = {
        "provider": prov_used,
        "model": model_used,
        "generated_at": datetime.now(timezone.utc).isoformat(),
    }

    update_step_state(
        episode_id,
        "step2_reviews",
        "done",
        logs=log_msg,
        artifacts=artifacts,
        validation=val_result,
        approved=True,
        llm_provenance=llm_provenance,
    )

    return {
        "status": "done",
        "reviews_data": reviews_data,
        "supabase_rows": supabase_rows,
        "excluded_guests": excluded_guests,
        "artifacts": artifacts,
        "validation": val_result,
        "logs": log_msg
    }
