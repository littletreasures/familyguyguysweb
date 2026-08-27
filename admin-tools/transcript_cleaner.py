"""
transcript_cleaner.py — Normalization and plain_text/word_count generation for admin tooling.
"""
import re
from typing import List, Dict, Any, Tuple


def normalize_speaker_name(raw_name: str) -> str:
    """
    Normalizes speaker names to canonical host or clean guest labels.
    """
    if not raw_name or not isinstance(raw_name, str):
        raise ValueError("Speaker name must be a non-empty string.")

    cleaned = raw_name.strip()
    if re.match(r"^speaker\s*\d+$", cleaned, re.IGNORECASE):
        raise ValueError(f"Generic speaker label '{cleaned}' is forbidden. Provide actual host/guest name.")

    lowered = cleaned.lower()
    if lowered in {"jason"}:
        return "Jason"
    if lowered in {"collin", "colin"}:
        return "Collin"
    if lowered in {"tyler"}:
        return "Tyler"

    return cleaned


def clean_speech_text(text: str) -> str:
    """
    Cleans up speech text:
    - Normalizes multiple spaces / newlines into single spaces.
    - Strips leading/trailing whitespace.
    - Preserves jokes, profanity, and host conversational tone verbatim.
    """
    if not text:
        return ""
    # Collapse multiple whitespace characters
    cleaned = re.sub(r"\s+", " ", text).strip()
    return cleaned


def calculate_plain_text(sections: List[Dict[str, Any]]) -> Tuple[str, int]:
    """
    Generates plain-text representation and counts words across all sections and entries.
    """
    parts = []
    for section in sections:
        heading = section.get("heading", "").strip()
        if heading:
            parts.append(f"## {heading}")

        entries = section.get("entries", [])
        for entry in entries:
            speaker = entry.get("speaker", "").strip()
            text = entry.get("text", "").strip()
            start_sec = float(entry.get("start_seconds", 0.0))

            mins = int(start_sec // 60)
            secs = int(start_sec % 60)
            hrs = int(start_sec // 3600)
            if hrs > 0:
                mins = int((start_sec % 3600) // 60)
                time_str = f"{hrs:02d}:{mins:02d}:{secs:02d}"
            else:
                time_str = f"{mins:02d}:{secs:02d}"

            if speaker and text:
                parts.append(f"{speaker} [{time_str}]: {text}")

    plain_text = "\n\n".join(parts)
    words_only = re.sub(r"[#:[\]]", " ", plain_text).strip()
    word_count = len(words_only.split()) if words_only else 0

    return plain_text, word_count
