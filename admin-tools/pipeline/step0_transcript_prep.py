"""
step0_transcript_prep.py — Dual-transcript intake, 3-way chunking, SRT parsing, and dynamic-programming fuzzy alignment.
Takes Riverside raw transcript + final-edit SRT and outputs:
- episodes/<episode_id>/chunks/chunk_1.txt
- episodes/<episode_id>/chunks/chunk_2.txt
- episodes/<episode_id>/chunks/chunk_3.txt
- episodes/<episode_id>/transcript_srt_parsed.json
- episodes/<episode_id>/alignment.json
"""
import bisect
import json
import os
import re
from pathlib import Path
from typing import Dict, Any, List, Tuple, Optional

from pipeline.state import get_episodes_dir, update_step_state, compute_file_hash
from transcript_cleaner import clean_speech_text, normalize_speaker_name


def parse_srt_timestamp(ts_str: str) -> float:
    """Parses 'HH:MM:SS,mmm' or 'HH:MM:SS.mmm' into float seconds."""
    clean = ts_str.strip().replace(",", ".")
    parts = clean.split(":")
    if len(parts) == 3:
        hrs = int(parts[0])
        mins = int(parts[1])
        secs = float(parts[2])
        return round(hrs * 3600 + mins * 60 + secs, 3)
    elif len(parts) == 2:
        mins = int(parts[0])
        secs = float(parts[1])
        return round(mins * 60 + secs, 3)
    raise ValueError(f"Unrecognized SRT timestamp format: '{ts_str}'")


def parse_srt_content(content: str) -> List[Dict[str, Any]]:
    """Parses SRT format content into structured cues."""
    cues: List[Dict[str, Any]] = []
    blocks = re.split(r"\n\s*\n", content.strip())
    
    cue_idx = 1
    for block in blocks:
        lines = [line.strip() for line in block.splitlines() if line.strip()]
        if len(lines) < 2:
            continue
        
        time_line_idx = 1 if re.match(r"^\d+$", lines[0]) else 0
        if time_line_idx >= len(lines):
            continue

        time_line = lines[time_line_idx]
        time_match = re.search(
            r"(\d{1,2}:\d{2}:\d{2}[,\.]\d{3})\s*-->\s*(\d{1,2}:\d{2}:\d{2}[,\.]\d{3})",
            time_line
        )
        if not time_match:
            continue

        start_ts = time_match.group(1)
        end_ts = time_match.group(2)
        text_lines = lines[time_line_idx + 1:]
        cue_text = clean_speech_text(" ".join(text_lines))

        try:
            start_sec = parse_srt_timestamp(start_ts)
            end_sec = parse_srt_timestamp(end_ts)
        except Exception:
            continue

        tokens = [w for w in re.findall(r"\w+", cue_text.lower()) if len(w) > 1]

        cues.append({
            "index": cue_idx,
            "start_seconds": start_sec,
            "end_seconds": end_sec,
            "start_timestamp": start_ts,
            "end_timestamp": end_ts,
            "text": cue_text,
            "tokens": tokens,
        })
        cue_idx += 1

    return cues


def parse_riverside_timestamp(ts: str) -> float:
    """Parses 'MM:SS.mmm' or 'HH:MM:SS.mmm' into float seconds."""
    clean = ts.strip().strip("()")
    parts = clean.split(":")
    if len(parts) == 2:
        minutes = int(parts[0])
        seconds = float(parts[1])
        return round(minutes * 60 + seconds, 3)
    if len(parts) == 3:
        hours = int(parts[0])
        minutes = int(parts[1])
        seconds = float(parts[2])
        return round(hours * 3600 + minutes * 60 + seconds, 3)
    raise ValueError(f"Unrecognized Riverside timestamp: '{ts}'")


def parse_riverside_transcript(content: str) -> List[Dict[str, Any]]:
    """
    Parses Riverside transcript into speaker-turn units.
    Header pattern: Speaker (MM:SS.mmm) or Speaker (HH:MM:SS.mmm)
    """
    header_pattern = re.compile(r"^([A-Za-z0-9 _.'\"-]+?)\s*\(((\d{1,2}:)?\d{1,2}:\d{2}(?:\.\d+)?)\)\s*$")
    lines = content.splitlines()
    turns: List[Dict[str, Any]] = []

    current_speaker = None
    current_time_str = None
    current_lines: List[str] = []

    def flush():
        nonlocal current_speaker, current_time_str, current_lines
        if current_speaker and current_time_str:
            turn_text = clean_speech_text(" ".join(current_lines))
            if turn_text:
                try:
                    start_sec = parse_riverside_timestamp(current_time_str)
                except Exception:
                    start_sec = 0.0
                
                canon_speaker = normalize_speaker_name(current_speaker)
                tokens = [w for w in re.findall(r"\w+", turn_text.lower()) if len(w) > 1]
                word_count = len(turn_text.split())

                turns.append({
                    "speaker": canon_speaker,
                    "time_str": current_time_str,
                    "start_seconds": start_sec,
                    "text": turn_text,
                    "word_count": word_count,
                    "tokens": tokens,
                })
        current_speaker = None
        current_time_str = None
        current_lines = []

    for line in lines:
        trimmed = line.strip()
        if not trimmed:
            continue
        m = header_pattern.match(trimmed)
        if m:
            flush()
            current_speaker = m.group(1).strip()
            current_time_str = m.group(2).strip()
        elif current_speaker:
            current_lines.append(trimmed)

    flush()

    if not turns:
        raise ValueError(
            "Input does not contain recognized Riverside speaker-tagged lines (e.g. 'Jason (00:01.9)')."
        )

    return turns


def chunk_riverside_transcript(
    turns: List[Dict[str, Any]]
) -> Tuple[List[Dict[str, Any]], List[Dict[str, Any]], List[Dict[str, Any]]]:
    """
    Splits Riverside turns into 3 roughly equal chunks by word count.
    Guarantees splitting only on turn boundaries, never mid-sentence.
    """
    if len(turns) < 3:
        return turns[:1], turns[1:2], turns[2:]

    total_words = sum(t["word_count"] for t in turns)
    target_1 = total_words / 3.0
    target_2 = 2.0 * total_words / 3.0

    best_split_1 = 0
    best_diff_1 = float("inf")
    best_split_2 = 1
    best_diff_2 = float("inf")

    cum_words = 0
    for idx in range(len(turns) - 2):
        cum_words += turns[idx]["word_count"]
        diff_1 = abs(cum_words - target_1)
        if diff_1 < best_diff_1:
            best_diff_1 = diff_1
            best_split_1 = idx

    cum_words = 0
    for idx in range(len(turns) - 1):
        cum_words += turns[idx]["word_count"]
        if idx > best_split_1:
            diff_2 = abs(cum_words - target_2)
            if diff_2 < best_diff_2:
                best_diff_2 = diff_2
                best_split_2 = idx

    chunk1 = turns[:best_split_1 + 1]
    chunk2 = turns[best_split_1 + 1:best_split_2 + 1]
    chunk3 = turns[best_split_2 + 1:]

    return chunk1, chunk2, chunk3


def format_turns_to_riverside_text(turns: List[Dict[str, Any]]) -> str:
    """
    Serializes turn dictionaries back into standard Riverside speaker-tagged text format.
    Preserves exact 'Speaker (MM:SS.mmm)' syntax required by downstream parsers.
    """
    blocks = []
    for t in turns:
        blocks.append(f"{t['speaker']} ({t['time_str']})\n{t['text']}")
    return "\n\n".join(blocks) + "\n"


FILLER_WORDS = {"ha", "hah", "haha", "hahaha", "mm", "hmm", "uh", "um", "yeah", "no", "oh", "ok", "okay"}


def is_substantive_text(text: str, min_substantive: int = 3) -> bool:
    """Checks if text contains at least min_substantive words that are not laughs or filler words."""
    words = re.findall(r"\w+", text.lower())
    substantive = [w for w in words if w not in FILLER_WORDS and len(w) > 1]
    return len(substantive) >= min_substantive


def merge_short_and_filler_turns(turns: List[Dict[str, Any]], min_substantive: int = 3) -> List[Dict[str, Any]]:
    """
    Merges non-substantive turns (fewer than min_substantive words, or purely laugh/filler sounds)
    into adjacent turns before alignment. Same speaker preferred, else previous turn.
    Prevents Whisper absorption false negatives in alignment.
    """
    items = [dict(t) for t in turns]
    idx = 0
    while idx < len(items):
        if not is_substantive_text(items[idx]["text"], min_substantive=min_substantive):
            curr = items[idx]
            # Same speaker preferred: previous turn
            if idx > 0 and items[idx - 1]["speaker"] == curr["speaker"]:
                items[idx - 1]["text"] = clean_speech_text(items[idx - 1]["text"] + " " + curr["text"])
                items[idx - 1]["word_count"] = len(items[idx - 1]["text"].split())
                items[idx - 1]["tokens"] = [w for w in re.findall(r"\w+", items[idx - 1]["text"].lower()) if len(w) > 1]
                items.pop(idx)
                continue
            # Same speaker preferred: next turn
            elif idx < len(items) - 1 and items[idx + 1]["speaker"] == curr["speaker"]:
                items[idx + 1]["text"] = clean_speech_text(curr["text"] + " " + items[idx + 1]["text"])
                items[idx + 1]["word_count"] = len(items[idx + 1]["text"].split())
                items[idx + 1]["tokens"] = [w for w in re.findall(r"\w+", items[idx + 1]["text"].lower()) if len(w) > 1]
                items.pop(idx)
                continue
            # Else merge into previous turn
            elif idx > 0:
                items[idx - 1]["text"] = clean_speech_text(items[idx - 1]["text"] + " " + curr["text"])
                items[idx - 1]["word_count"] = len(items[idx - 1]["text"].split())
                items[idx - 1]["tokens"] = [w for w in re.findall(r"\w+", items[idx - 1]["text"].lower()) if len(w) > 1]
                items.pop(idx)
                continue
            # Else merge into next turn (index 0)
            elif idx < len(items) - 1:
                items[idx + 1]["text"] = clean_speech_text(curr["text"] + " " + items[idx + 1]["text"])
                items[idx + 1]["word_count"] = len(items[idx + 1]["text"].split())
                items[idx + 1]["tokens"] = [w for w in re.findall(r"\w+", items[idx + 1]["text"].lower()) if len(w) > 1]
                items.pop(idx)
                continue
        idx += 1
    return items


def align_transcript_with_srt(
    turns: List[Dict[str, Any]],
    srt_cues: List[Dict[str, Any]]
) -> List[Dict[str, Any]]:
    """
    Globally aligns substantive Riverside turns to SRT cues using dynamic programming with temporal windowing.
    Sets 'unmatched': True/False and 'matched': True/False.
    """
    if not srt_cues:
        return [
            {
                "segment_id": idx + 1,
                "speaker": t["speaker"],
                "riverside_time": t["time_str"],
                "riverside_start_seconds": t["start_seconds"],
                "text": t["text"],
                "matched": False,
                "unmatched": True,
                "cut": True,  # Backwards compatibility
                "srt_start_seconds": None,
                "srt_end_seconds": None,
                "confidence": 0.0,
            }
            for idx, t in enumerate(turns)
        ]

    cue_times = [c["start_seconds"] for c in srt_cues]
    candidates_by_turn: Dict[int, List[Tuple[int, int, float]]] = {}

    # 1. Candidate match generation in a +/- 90s temporal window around Riverside timestamp
    for t_idx, turn in enumerate(turns):
        toks = turn["tokens"]
        if not toks:
            continue

        t_sec = turn["start_seconds"]
        w_start = max(0, t_sec - 90)
        w_end = t_sec + 90

        c_start = bisect.bisect_left(cue_times, w_start)
        c_end = min(len(srt_cues), bisect.bisect_right(cue_times, w_end))
        if c_start >= c_end:
            continue

        set_t = set(toks)
        len_t = len(set_t)
        min_score = 0.75 if len_t <= 2 else 0.45

        for i in range(c_start, c_end):
            accum: List[str] = []
            for j in range(i, min(c_end, i + 8)):
                accum.extend(srt_cues[j]["tokens"])
                overlap = len(set_t & set(accum))
                score = overlap / len_t
                if score >= min_score:
                    candidates_by_turn.setdefault(t_idx, []).append((i, j, score))
                    if score >= 0.85:
                        break

    # 2. Dynamic programming to find the globally optimal monotonic path
    turn_indices = sorted(candidates_by_turn.keys())
    prefix_max = [0.0] * (len(srt_cues) + 1)
    prefix_argmax = [-1] * (len(srt_cues) + 1)
    best_match_for_turn: Dict[int, Tuple[int, int, float]] = {}

    for t_idx in turn_indices:
        cands = candidates_by_turn[t_idx]
        best_cand_total = 0.0
        best_cand = None

        for (i, j, score) in cands:
            prev_best = prefix_max[i]
            total = prev_best + score
            if total > best_cand_total:
                best_cand_total = total
                best_cand = (i, j, score)

        if best_cand:
            i, j, score = best_cand
            new_score = prefix_max[i] + score
            for k in range(j, len(srt_cues) + 1):
                if new_score > prefix_max[k]:
                    prefix_max[k] = new_score
                    prefix_argmax[k] = i
                else:
                    break
            best_match_for_turn[t_idx] = (i, j, score)

    # 3. Assemble full alignment results
    alignment: List[Dict[str, Any]] = []
    for idx, turn in enumerate(turns):
        seg_id = idx + 1
        if idx in best_match_for_turn:
            c_start_idx, c_end_idx, score = best_match_for_turn[idx]
            cue_start = srt_cues[c_start_idx]
            cue_end = srt_cues[c_end_idx]

            alignment.append({
                "segment_id": seg_id,
                "speaker": turn["speaker"],
                "riverside_time": turn["time_str"],
                "riverside_start_seconds": turn["start_seconds"],
                "text": turn["text"],
                "matched": True,
                "unmatched": False,
                "cut": False,  # Backwards compatibility
                "srt_start_seconds": cue_start["start_seconds"],
                "srt_end_seconds": cue_end["end_seconds"],
                "srt_cue_start_index": cue_start["index"],
                "srt_cue_end_index": cue_end["index"],
                "confidence": round(score, 2),
            })
        else:
            alignment.append({
                "segment_id": seg_id,
                "speaker": turn["speaker"],
                "riverside_time": turn["time_str"],
                "riverside_start_seconds": turn["start_seconds"],
                "text": turn["text"],
                "matched": False,
                "unmatched": True,
                "cut": True,  # Backwards compatibility
                "srt_start_seconds": None,
                "srt_end_seconds": None,
                "confidence": 0.0,
            })

    return alignment


def run_step0_prep(
    episode_id: str,
    riverside_path: str,
    srt_path: str,
    dry_run: bool = True
) -> Dict[str, Any]:
    """
    Executes Step 0:
    1. Ingests raw Riverside transcript and splits into 3 chunks.
    2. Parses SRT file.
    3. Merges short/filler turns into substantive units.
    4. Aligns substantive turns using DP alignment and marks unmatched segments.
    5. Writes local artifacts into episodes/<episode_id>/.
    6. Updates state.
    """
    update_step_state(episode_id, "step0_transcript_prep", "running", logs="Starting Step 0: Transcript Prep...")

    if not os.path.exists(riverside_path):
        err = f"Riverside transcript file not found: {riverside_path}"
        update_step_state(episode_id, "step0_transcript_prep", "error", logs=err)
        raise FileNotFoundError(err)

    if not os.path.exists(srt_path):
        err = f"SRT file not found: {srt_path}"
        update_step_state(episode_id, "step0_transcript_prep", "error", logs=err)
        raise FileNotFoundError(err)

    # 1. Read files
    with open(riverside_path, "r", encoding="utf-8", errors="replace") as f:
        riverside_content = f.read()

    with open(srt_path, "r", encoding="utf-8", errors="replace") as f:
        srt_content = f.read()

    # 2. Parse raw turns and cues
    raw_turns = parse_riverside_transcript(riverside_content)
    srt_cues = parse_srt_content(srt_content)

    # 3. Chunk raw turns into 3 sections (retaining full turn fidelity for downstream review / reading)
    c1_turns, c2_turns, c3_turns = chunk_riverside_transcript(raw_turns)
    c1_text = format_turns_to_riverside_text(c1_turns)
    c2_text = format_turns_to_riverside_text(c2_turns)
    c3_text = format_turns_to_riverside_text(c3_turns)

    # 4. Merge non-substantive turns for alignment matching
    substantive_turns = merge_short_and_filler_turns(raw_turns, min_substantive=3)

    # 5. Global dynamic programming alignment on substantive turns
    alignment = align_transcript_with_srt(substantive_turns, srt_cues)
    matched_count = sum(1 for a in alignment if a["matched"])
    unmatched_count = sum(1 for a in alignment if a["unmatched"])
    match_pct = round(matched_count / max(1, len(substantive_turns)) * 100, 1)

    # 6. Write artifacts to episodes/<episode_id>/
    ep_dir = get_episodes_dir(episode_id)
    chunks_dir = ep_dir / "chunks"
    chunks_dir.mkdir(parents=True, exist_ok=True)

    c1_path = chunks_dir / "chunk_1.txt"
    c2_path = chunks_dir / "chunk_2.txt"
    c3_path = chunks_dir / "chunk_3.txt"
    srt_parsed_path = ep_dir / "transcript_srt_parsed.json"
    alignment_path = ep_dir / "alignment.json"

    with open(c1_path, "w", encoding="utf-8") as f:
        f.write(c1_text)
    with open(c2_path, "w", encoding="utf-8") as f:
        f.write(c2_text)
    with open(c3_path, "w", encoding="utf-8") as f:
        f.write(c3_text)

    # Save parsed SRT (strip internal tokens helper)
    clean_cues = [
        {k: v for k, v in cue.items() if k != "tokens"}
        for cue in srt_cues
    ]
    with open(srt_parsed_path, "w", encoding="utf-8") as f:
        json.dump(clean_cues, f, indent=2)

    # Compute source file hashes for auditability
    riverside_hash = compute_file_hash(riverside_path)
    srt_hash = compute_file_hash(srt_path)

    source_meta = {
        "riverside": {
            "path": str(Path(riverside_path).resolve()),
            "sha256": riverside_hash,
            "size_bytes": os.path.getsize(riverside_path),
        },
        "srt": {
            "path": str(Path(srt_path).resolve()),
            "sha256": srt_hash,
            "size_bytes": os.path.getsize(srt_path),
        }
    }

    alignment_document = {
        "source_metadata": source_meta,
        "summary": {
            "total_raw_turns": len(raw_turns),
            "total_substantive_segments": len(alignment),
            "matched_segments": matched_count,
            "unmatched_segments": unmatched_count,
            "match_percentage": match_pct,
        },
        "segments": alignment,
    }

    with open(alignment_path, "w", encoding="utf-8") as f:
        json.dump(alignment_document, f, indent=2)

    artifacts = {
        "chunk_1": str(c1_path),
        "chunk_2": str(c2_path),
        "chunk_3": str(c3_path),
        "transcript_srt_parsed": str(srt_parsed_path),
        "alignment": str(alignment_path),
    }

    log_msg = (
        f"Step 0 Complete:\n"
        f"- Total raw turns: {len(raw_turns)}\n"
        f"- Chunk 1: {len(c1_turns)} turns ({sum(t['word_count'] for t in c1_turns)} words)\n"
        f"- Chunk 2: {len(c2_turns)} turns ({sum(t['word_count'] for t in c2_turns)} words)\n"
        f"- Chunk 3: {len(c3_turns)} turns ({sum(t['word_count'] for t in c3_turns)} words)\n"
        f"- Substantive alignment turns: {len(substantive_turns)}\n"
        f"- Parsed SRT cues: {len(srt_cues)}\n"
        f"- Alignment: {matched_count} matched, {unmatched_count} unmatched segments ({match_pct}% match rate)\n"
        f"- Riverside SHA-256: {riverside_hash[:16]}...\n"
        f"- SRT SHA-256: {srt_hash[:16]}...\n"
        f"- Artifacts written to {ep_dir}"
    )

    update_step_state(
        episode_id,
        "step0_transcript_prep",
        "done",
        logs=log_msg,
        artifacts=artifacts,
        validation={"passed": True, "errors": [], "warnings": []},
        approved=True,
        source_metadata=source_meta,
    )

    return {
        "status": "done",
        "artifacts": artifacts,
        "logs": log_msg,
        "alignment_summary": {
            "total_substantive_segments": len(alignment),
            "matched_segments": matched_count,
            "unmatched_segments": unmatched_count,
            "match_percentage": match_pct,
        }
    }
