"""
validators.py — Automated machine-checkable quality gates for Mission Control artifacts.
Failed validation blocks the human Approve button in the UI.
"""
import re
from typing import Dict, Any, List, Optional


BANNED_YOUTUBE_PHRASES = [
    "deep dive",
    "must-watch",
    "iconic",
    "game-changing",
    "let's dive in",
    "here's what you need to know",
    "this video explores",
    "whether you're",
    "not just",
    "i hope this helps",
    "hilarious",
    "unforgettable",
    "ultimate",
    "journey",
    "landscape",
    "testament",
]


def validate_youtube_description(text: str) -> Dict[str, Any]:
    """
    Validates YouTube description draft against skill rules:
    - Reject em dash (—), en dash (–), double-hyphen (--)
    - Reject curly quotes (“ ” ‘ ’)
    - Verify chapters start at 00:00 and strictly ascend (if present)
    - Verify hashtags count is 2-5 (never > 15)
    - Scan for banned filler/hype phrases
    """
    errors: List[str] = []
    warnings: List[str] = []

    if not text or not text.strip():
        return {"passed": False, "errors": ["Description is empty."], "warnings": []}

    # 1. Dash checks
    if "—" in text:
        errors.append("Em dash ('—') found. Use simple hyphens, colons, or commas instead.")
    if "–" in text:
        errors.append("En dash ('–') found. Use simple hyphens, colons, or commas instead.")
    if "--" in text:
        errors.append("Double hyphen ('--') found. Use standard punctuation.")

    # 2. Curly quotes
    curly_quotes = ["“", "”", "‘", "’"]
    found_curly = [q for q in curly_quotes if q in text]
    if found_curly:
        errors.append(f"Curly quote(s) {found_curly} found. Use straight quotes only ('like this').")

    # 3. Banned phrases check
    lowered = text.lower()
    for phrase in BANNED_YOUTUBE_PHRASES:
        if phrase in lowered:
            errors.append(f"Banned AI/filler phrase detected: '{phrase}'")

    # 4. Hashtag count
    hashtags = re.findall(r"#\w+", text)
    if len(hashtags) > 15:
        errors.append(f"Too many hashtags ({len(hashtags)} found). YouTube limits to 15 max.")
    elif len(hashtags) < 2 and len(hashtags) > 0:
        warnings.append(f"Only {len(hashtags)} hashtag found. Recommended: 2-5 hashtags.")
    elif len(hashtags) > 5:
        warnings.append(f"{len(hashtags)} hashtags found. Recommended: 2-5 hashtags.")

    # 5. Timestamp / Chapters validation
    # Match patterns like 00:00 or 01:23 or 1:23:45
    ts_matches = list(re.finditer(r"(?:^|\s)(?:(\d{1,2}):)?(\d{2}):(\d{2})(?:\s+|$)", text, re.MULTILINE))
    if ts_matches:
        parsed_seconds = []
        for m in ts_matches:
            hrs = int(m.group(1)) if m.group(1) else 0
            mins = int(m.group(2))
            secs = int(m.group(3))
            total_sec = hrs * 3600 + mins * 60 + secs
            parsed_seconds.append((total_sec, m.group(0).strip()))

        if parsed_seconds:
            first_sec, first_str = parsed_seconds[0]
            if first_sec != 0:
                errors.append(f"Chapters must begin at '00:00', but first timestamp is '{first_str}'.")

            prev_sec = -1
            for sec, ts_str in parsed_seconds:
                if sec < prev_sec:
                    errors.append(f"Timestamps must strictly ascend. Timestamp '{ts_str}' appears after later time.")
                prev_sec = sec

    return {
        "passed": len(errors) == 0,
        "errors": errors,
        "warnings": warnings,
    }


def validate_credit_scroll(
    text: str,
    podcast_episode_number: Optional[int] = None
) -> Dict[str, Any]:
    """
    Validates fake credit scroll draft:
    - Four tiers appear in order
    - Fixed Tier 1 real names and roles
    - Countdown math: 461 minus podcast_episode_number
    - Disclaimers exist (MacFarlane and No [X] Were Harmed)
    - Typographical rule: No digits in the scroll body
    """
    errors: List[str] = []
    warnings: List[str] = []

    if not text or not text.strip():
        return {"passed": False, "errors": ["Credits text is empty."], "warnings": []}

    lines = text.splitlines()

    # 1. Fixed Tier 1 requirements
    t1_required_names = ["Jason Hackett", "Tyler Simpson", "Collin Brown"]
    for name in t1_required_names:
        if name not in text:
            errors.append(f"Tier 1 missing required host name: '{name}'")

    if "Produced by" not in text or "Jason Hackett" not in text:
        errors.append("Tier 1 missing 'Produced by Jason Hackett'")
    if "Edited by" not in text:
        errors.append("Tier 1 missing 'Edited by Jason Hackett'")
    if "Theme Music by" not in text:
        errors.append("Tier 1 missing 'Theme Music by Jason Hackett'")

    # 2. Disclaimer checks
    if "This Podcast Is Not Affiliated With Seth MacFarlane" not in text:
        errors.append("Missing required MacFarlane disclaimer: 'This Podcast Is Not Affiliated With Seth MacFarlane'")

    if not re.search(r"No .* Were Harmed", text, re.IGNORECASE):
        errors.append("Missing required disclaimer: 'No [X] Were Harmed During Production'")

    # 3. Typography rule: No digits in the scroll body
    # Only allowed in header: e.g. "Episode #001" or "Episode 2" or "FAMILY GUY GUYS"
    body_lines = lines[3:] if len(lines) > 3 else lines
    body_text = "\n".join(body_lines)

    digit_matches = list(re.finditer(r"\d+", body_text))
    if digit_matches:
        found_digits = [m.group(0) for m in digit_matches]
        errors.append(
            f"TYPOGRAPHY RULE VIOLATION: Numerical digits found in credit scroll body: {found_digits}. "
            "All numbers must be spelled out in letters (e.g. 'Four Hundred Fifty-Three')."
        )

    # 4. Reject proper nouns copied verbatim from the skill file instructions
    forbidden_skill_names = ["dr. raymond pubes", "raymond pubes", "tyler simpson's gut"]
    text_lower = text.lower()
    for fname in forbidden_skill_names:
        if fname in text_lower:
            warnings.append(
                f"REUSED SKILL EXAMPLE NAME: '{fname}' is copied verbatim from the instruction prompt examples. "
                "Invent fresh, episode-specific names rather than reusing instructions."
            )

    # 5. Tier item-count validation
    blocks = [b.strip() for b in re.split(r"\n\s*---\s*\n", text.strip()) if b.strip()]
    if len(blocks) >= 5:
        tier2_items = [item.strip() for item in re.split(r"\n\s*\n", blocks[2]) if item.strip()]
        tier3_items = [item.strip() for item in re.split(r"\n\s*\n", blocks[3]) if item.strip()]
        
        # Tier 4 items (excluding disclaimers if inside the block)
        tier4_raw = [item.strip() for item in re.split(r"\n\s*\n", blocks[4]) if item.strip()]
        tier4_items = [
            it for it in tier4_raw
            if not re.search(r"No .* Were Harmed", it, re.IGNORECASE)
            and "not affiliated with seth macfarlane" not in it.lower()
        ]

        if len(tier2_items) < 3 or len(tier2_items) > 5:
            warnings.append(f"Tier 2 has {len(tier2_items)} items. Recommended range: 3-5 items.")
        if len(tier3_items) < 3 or len(tier3_items) > 5:
            warnings.append(f"Tier 3 has {len(tier3_items)} items. Recommended range: 3-5 items.")
        if len(tier4_items) < 4 or len(tier4_items) > 6:
            warnings.append(f"Tier 4 has {len(tier4_items)} absurdity/financial credits. Recommended range: 4-6 items.")

    # 6. Countdown check
    if podcast_episode_number is not None:
        remaining = 461 - podcast_episode_number
        if "Episodes Remaining" not in text:
            errors.append("Missing '[X] Episodes Remaining' countdown line.")
        elif podcast_episode_number == 8 and "Four Hundred Fifty-Three Episodes Remaining" not in text:
            warnings.append("Expected countdown 'Four Hundred Fifty-Three Episodes Remaining' for episode 8.")

    return {
        "passed": len(errors) == 0,
        "errors": errors,
        "warnings": warnings,
    }


def extract_quoted_score(note: str, scale_max: float) -> Optional[float]:
    """Extracts quoted raw numeric rating from rating_source_note text for validation."""
    if not note:
        return None
    note_lower = note.lower()

    # Match ratio patterns like '95/100' or '95 out of 100'
    m_ratio = re.search(r"(\d+(?:\.\d+)?)\s*(?:/|\s*out of\s*)\s*(\d+)", note_lower)
    if m_ratio:
        return float(m_ratio.group(1))

    # Match common spelled-out numbers
    spelled_map = {
        "ninety-five": 95.0, "ninety five": 95.0,
        "ninety": 90.0, "eighty-five": 85.0, "eighty": 80.0,
        "four and a half": 4.5, "four and three quarters": 4.75,
        "four": 4.0, "three and a half": 3.5, "three": 3.0,
        "two and a half": 2.5, "two": 2.0, "one and a half": 1.5, "one": 1.0,
    }
    for phrase, val in spelled_map.items():
        if phrase in note_lower:
            return val

    # Match isolated float/integer
    m_num = re.search(r"(\d+(?:\.\d+)?)", note_lower)
    if m_num:
        val = float(m_num.group(1))
        if val != scale_max or scale_max == 5:
            return val

    return None


def validate_reviews_data(reviews_data: Dict[str, Any]) -> Dict[str, Any]:
    """
    Validates reviews dictionary:
    - Non-empty reviews array
    - Rating bounds (0.0 - 5.0)
    - Review text completeness
    - Spoken rating consistency vs rating_source_note
    - Canonical host coverage (Jason, Collin, Tyler)
    """
    errors: List[str] = []
    warnings: List[str] = []

    if not reviews_data or not isinstance(reviews_data, dict):
        return {"passed": False, "errors": ["Invalid review JSON object."], "warnings": []}

    ep_id = reviews_data.get("episode_id", "").strip()
    if not ep_id:
        errors.append("Missing 'episode_id' in reviews JSON.")

    reviews_list = reviews_data.get("reviews", [])
    if not isinstance(reviews_list, list) or len(reviews_list) == 0:
        errors.append("Reviews list is empty.")
        return {"passed": False, "errors": errors, "warnings": warnings}

    present_hosts = set()
    for idx, r in enumerate(reviews_list):
        host = r.get("host_name", f"Host {idx}")
        present_hosts.add(host)
        rating = r.get("rating")
        r_val = None
        if rating is not None:
            try:
                r_val = float(rating)
                if r_val < 0.0 or r_val > 5.0:
                    errors.append(f"Rating for {host} ({r_val}) is out of bounds (0.0 - 5.0).")
            except (ValueError, TypeError):
                errors.append(f"Invalid rating value '{rating}' for {host}.")

        if not r.get("review", "").strip():
            errors.append(f"Review text for {host} is empty.")
        if not r.get("pull_quote", "").strip():
            warnings.append(f"Pull quote for {host} is empty.")

        # Check precision drift between rating and raw stated score in rating_source_note
        scale_max = float(r.get("rating_scale_max", 5))
        note = r.get("rating_source_note", "")
        if r_val is not None and note:
            quoted_score = extract_quoted_score(note, scale_max)
            if quoted_score is not None:
                effective_score = (r_val / 5.0) * scale_max
                if abs(effective_score - quoted_score) > 1.0:
                    warnings.append(
                        f"Rating precision drift for {host}: effective score ({effective_score:.2f}/{scale_max}) "
                        f"differs from quoted score ({quoted_score}) in rating_source_note by > 1 point."
                    )

    # Canonical host coverage
    canonical_hosts = ["Jason", "Collin", "Tyler"]
    for ch in canonical_hosts:
        if ch not in present_hosts:
            warnings.append(f"Host '{ch}' is not included in the reviews.")

    return {
        "passed": len(errors) == 0,
        "errors": errors,
        "warnings": warnings,
    }
