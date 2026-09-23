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
from collections import defaultdict
import json
import os
import re
import statistics
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


def format_seconds_to_timestamp(sec: float) -> str:
    """Formats float seconds into 'MM:SS' or 'HH:MM:SS'."""
    hrs = int(sec // 3600)
    mins = int((sec % 3600) // 60)
    secs = int(sec % 60)
    if hrs > 0:
        return f"{hrs:02d}:{mins:02d}:{secs:02d}"
    return f"{mins:02d}:{secs:02d}"


def parse_known_cuts(known_cuts_str: Optional[str]) -> Optional[Tuple[float, float]]:
    """
    Parses optional manual cut parameter into (cut_start_seconds, cut_duration_seconds).
    Formats supported:
    - '43:32, 7m10s'
    - '43:32, 430s'
    - '43:32, 420'
    - '43:32, 07:10'
    - '43:32, 7m'
    """
    if not known_cuts_str or not isinstance(known_cuts_str, str):
        return None
    cleaned = known_cuts_str.strip()
    if not cleaned or "," not in cleaned:
        return None

    parts = [p.strip() for p in cleaned.split(",", 1)]
    if len(parts) < 2 or not parts[0] or not parts[1]:
        return None

    start_str = parts[0]
    dur_str = parts[1]

    try:
        start_sec = parse_riverside_timestamp(start_str)
    except Exception:
        try:
            start_sec = parse_srt_timestamp(start_str)
        except Exception:
            return None

    m_min_sec = re.match(r"^(\d+)\s*m(?:in)?(?:\s*(\d+(?:\.\d+)?)\s*s(?:ec)?)?$", dur_str, re.IGNORECASE)
    if m_min_sec:
        mins = float(m_min_sec.group(1))
        secs = float(m_min_sec.group(2)) if m_min_sec.group(2) else 0.0
        return round(start_sec, 3), round(mins * 60.0 + secs, 3)

    m_sec = re.match(r"^(\d+(?:\.\d+)?)\s*(?:s|sec|seconds)?$", dur_str, re.IGNORECASE)
    if m_sec:
        secs = float(m_sec.group(1))
        return round(start_sec, 3), round(secs, 3)

    try:
        dur_sec = parse_riverside_timestamp(dur_str)
        return round(start_sec, 3), round(dur_sec, 3)
    except Exception:
        pass

    return None


def detect_rupture_point(
    segments: List[Dict[str, Any]],
    srt_duration: float,
    gap_threshold: int = 8
) -> Optional[int]:
    """
    Finds rupture before an 8+ turn gap in segments before srt_duration.
    Returns segment index (0-based) of the rupture point, or None if healthy.
    Ignores the audio tail extending past SRT end.
    """
    current_gap = 0
    gap_start_idx = -1

    for idx, seg in enumerate(segments):
        t_sec = seg.get("riverside_start_seconds", 0.0)
        # Tail filter: if segment start is at or beyond srt_duration, break
        if t_sec >= srt_duration:
            break

        is_unmatched = seg.get("unmatched", False) or not seg.get("matched", False)
        if is_unmatched:
            if current_gap == 0:
                gap_start_idx = idx
            current_gap += 1
            if current_gap >= gap_threshold:
                return max(0, gap_start_idx - 1)
        else:
            current_gap = 0
            gap_start_idx = -1

    return None


def scan_reanchors(
    turns: List[Dict[str, Any]],
    srt_cues: List[Dict[str, Any]],
    start_idx: int,
    max_turns: int = 80,
    target_anchors: int = 5
) -> List[Dict[str, Any]]:
    """
    Scans unmatched substantive turns after the rupture across entire SRT in expanding batches
    (up to max_turns) with similarity >= 0.8 and margin >= 0.15 over the second-best
    non-overlapping cue candidate.
    """
    if not turns or not srt_cues:
        return []

    # Ensure srt_cues have tokens
    for c in srt_cues:
        if "tokens" not in c:
            c["tokens"] = [w for w in re.findall(r"\w+", c["text"].lower()) if len(w) > 1]

    # Inverted index for fast candidate cue lookup
    word_to_cues: Dict[str, List[int]] = defaultdict(list)
    for c_idx, c in enumerate(srt_cues):
        for tok in set(c["tokens"]):
            word_to_cues[tok].append(c_idx)

    anchors: List[Dict[str, Any]] = []
    total_turns = len(turns)
    end_limit = min(total_turns, start_idx + max_turns)

    # Expanding batches of 20 turns
    batch_size = 20
    curr_batch_end = min(end_limit, start_idx + batch_size)

    t_idx = start_idx
    while t_idx < end_limit:
        turn = turns[t_idx]
        t_idx += 1

        # If turn already matched (in pass 1), skip
        if turn.get("matched", False):
            continue

        toks = turn.get("tokens")
        if not toks and "text" in turn:
            toks = [w for w in re.findall(r"\w+", turn["text"].lower()) if len(w) > 1]

        if not toks:
            continue

        set_t = set(toks)
        len_t = len(set_t)
        if len_t < 3:
            continue

        # Find candidate starting cue positions
        candidate_cues = set()
        for tok in set_t:
            for c_i in word_to_cues.get(tok, []):
                for start_i in range(max(0, c_i - 7), c_i + 1):
                    candidate_cues.add(start_i)

        candidates: List[Tuple[int, int, float]] = []
        for i in candidate_cues:
            # First cue should contain at least one token from turn
            if not (set(srt_cues[i]["tokens"]) & set_t):
                continue
            accum: List[str] = []
            for j in range(i, min(len(srt_cues), i + 8)):
                if j > i:
                    # Cues must be temporally contiguous (max 3s gap, max 25s total span)
                    if (srt_cues[j]["start_seconds"] - srt_cues[j - 1]["end_seconds"] > 3.0 or
                            srt_cues[j]["end_seconds"] - srt_cues[i]["start_seconds"] > 25.0):
                        break
                accum.extend(srt_cues[j]["tokens"])
                score = len(set_t & set(accum)) / len_t
                if score >= 0.70:
                    candidates.append((i, j, score))
                    if score >= 0.95:
                        break

        if not candidates:
            continue

        candidates.sort(key=lambda x: x[2], reverse=True)
        best = candidates[0]

        # Find second-best non-overlapping candidate
        second = None
        for cand in candidates[1:]:
            # Non-overlapping condition: cand cue range does not intersect best cue range
            if cand[1] < best[0] or cand[0] > best[1]:
                second = cand
                break

        second_score = second[2] if second else 0.0
        margin = best[2] - second_score

        if best[2] >= 0.80 and margin >= 0.15:
            srt_t = srt_cues[best[0]]["start_seconds"]
            rs_t = turn.get("start_seconds", turn.get("riverside_start_seconds", 0.0))
            offset = round(srt_t - rs_t, 3)

            anchors.append({
                "turn_idx": t_idx - 1,
                "riverside_seconds": rs_t,
                "riverside_start_seconds": rs_t,
                "srt_seconds": srt_t,
                "srt_start_seconds": srt_t,
                "offset": offset,
                "similarity": round(best[2], 3),
                "score": round(best[2], 3),
                "margin": round(margin, 3),
                "srt_cue_start_index": srt_cues[best[0]]["index"],
                "srt_cue_end_index": srt_cues[best[1]]["index"],
                "text": turn.get("text", ""),
            })

        # Check if batch boundary reached
        if t_idx >= curr_batch_end:
            if len(anchors) >= target_anchors:
                break
            curr_batch_end = min(end_limit, curr_batch_end + batch_size)

    return anchors


def cluster_offsets(
    anchors: List[Dict[str, Any]],
    tolerance: float = 15.0
) -> Tuple[float, List[Dict[str, Any]]]:
    """
    Clusters noisy offsets (tolerance +/- 15s) and returns median offset L of dominant cluster
    along with dominant cluster anchors.
    """
    if not anchors:
        return 0.0, []

    def get_offset(a: Dict[str, Any]) -> float:
        if "offset" in a and a["offset"] is not None:
            return float(a["offset"])
        s_sec = a.get("srt_start_seconds", a.get("srt_seconds", 0.0))
        r_sec = a.get("riverside_start_seconds", a.get("riverside_seconds", 0.0))
        return float(s_sec - r_sec)

    sorted_anchors = sorted(anchors, key=get_offset)

    clusters: List[List[Dict[str, Any]]] = []
    for a in sorted_anchors:
        a_off = get_offset(a)
        if not clusters:
            clusters.append([a])
        else:
            prev_a = clusters[-1][-1]
            prev_off = get_offset(prev_a)
            if abs(a_off - prev_off) <= tolerance:
                clusters[-1].append(a)
            else:
                clusters.append([a])

    dominant_cluster = max(clusters, key=len)
    dom_offsets = [get_offset(a) for a in dominant_cluster]
    median_l = round(float(statistics.median(dom_offsets)), 3)

    return median_l, dominant_cluster


def detect_unanchored_srt_regions(
    alignment: List[Dict[str, Any]],
    srt_cues: List[Dict[str, Any]],
    min_duration: float = 60.0
) -> List[Dict[str, Any]]:
    """
    Detects contiguous intervals in SRT cues >= min_duration (default 60s) with zero matched raw turns,
    indicating video retakes or inserted footage.
    """
    matched_cue_indices = set()
    for seg in alignment:
        if not seg.get("matched", False):
            continue
        c_start = seg.get("srt_cue_start_index")
        c_end = seg.get("srt_cue_end_index")
        if c_start is not None and c_end is not None:
            for idx in range(c_start, c_end + 1):
                matched_cue_indices.add(idx)
        elif seg.get("srt_start_seconds") is not None and seg.get("srt_end_seconds") is not None:
            s_start = seg["srt_start_seconds"]
            s_end = seg["srt_end_seconds"]
            for cue in srt_cues:
                if not (cue["end_seconds"] < s_start or cue["start_seconds"] > s_end):
                    matched_cue_indices.add(cue["index"])

    unanchored_regions: List[Dict[str, Any]] = []
    curr_run: List[Dict[str, Any]] = []

    def flush_run(run: List[Dict[str, Any]]):
        if not run:
            return
        dur = run[-1]["end_seconds"] - run[0]["start_seconds"]
        if dur >= min_duration:
            sample = " ".join(c.get("text", "") for c in run[:3])
            if len(run) > 3:
                sample += "..."
            unanchored_regions.append({
                "start_seconds": round(run[0]["start_seconds"], 2),
                "end_seconds": round(run[-1]["end_seconds"], 2),
                "duration": round(dur, 2),
                "start_cue_index": run[0]["index"],
                "end_cue_index": run[-1]["index"],
                "start_timestamp": run[0].get("start_timestamp", ""),
                "end_timestamp": run[-1].get("end_timestamp", ""),
                "cue_count": len(run),
                "sample_text": sample,
            })

    for cue in srt_cues:
        if cue["index"] not in matched_cue_indices:
            curr_run.append(cue)
        else:
            flush_run(curr_run)
            curr_run = []
    flush_run(curr_run)

    return unanchored_regions


def write_unmatched_audit(
    ep_dir: Path,
    episode_id: str,
    srt_name: str,
    substantive_turns: List[Dict[str, Any]],
    alignment: List[Dict[str, Any]]
) -> Path:
    """
    Writes episodes/<episode_id>/unmatched.txt listing all genuinely trimmed or unmatched substantive segments.
    Format:
    Segment ID | Riverside Time | Speaker | Text
    """
    ep_path = Path(ep_dir)
    ep_path.mkdir(parents=True, exist_ok=True)
    out_file = ep_path / "unmatched.txt"

    unmatched_segments = [
        s for s in alignment
        if s.get("unmatched", False) or not s.get("matched", False)
    ]

    lines = [
        f"# Unmatched Substantive Segments Audit — {episode_id}",
        f"# Source SRT: {srt_name}",
        f"# Total Unmatched Segments: {len(unmatched_segments)} (of {len(alignment)} substantive segments)",
        f"# Format: Segment ID | Riverside Time | Speaker | Text",
        "Segment ID | Riverside Time | Speaker | Text",
    ]

    for seg in unmatched_segments:
        seg_id = seg.get("segment_id", "")
        r_time = seg.get("riverside_time", "")
        speaker = seg.get("speaker", "")
        text = seg.get("text", "").replace("\n", " ").strip()
        lines.append(f"{seg_id} | {r_time} | {speaker} | {text}")

    lines.append("")
    out_file.write_text("\n".join(lines), encoding="utf-8")
    return out_file


def align_transcript_with_srt(
    turns: List[Dict[str, Any]],
    srt_cues: List[Dict[str, Any]],
    target_offset_func: Optional[Any] = None,
    piecewise_offsets: Optional[Dict[str, Any]] = None,
) -> List[Dict[str, Any]]:
    """
    Globally aligns substantive Riverside turns to SRT cues using dynamic programming with temporal windowing.
    Sets 'unmatched': True/False and 'matched': True/False.
    Supports piecewise offset centering via target_offset_func or piecewise_offsets dict.
    """
    if not srt_cues:
        return [
            {
                "segment_id": idx + 1,
                "speaker": t["speaker"],
                "riverside_time": t.get("time_str", t.get("riverside_time", "")),
                "riverside_start_seconds": t.get("start_seconds", t.get("riverside_start_seconds", 0.0)),
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

    # 1. Candidate match generation in a +/- 90s temporal window around target center
    for t_idx, turn in enumerate(turns):
        toks = turn.get("tokens")
        if not toks:
            continue

        t_sec = turn.get("start_seconds", turn.get("riverside_start_seconds", 0.0))

        offset = 0.0
        if target_offset_func is not None and callable(target_offset_func):
            offset = target_offset_func(t_sec)
        elif piecewise_offsets is not None and isinstance(piecewise_offsets, dict):
            rupture_time = piecewise_offsets.get("rupture_time", float("inf"))
            post_cut = piecewise_offsets.get("post_cut_offset", piecewise_offsets.get("offset", piecewise_offsets.get("L", 0.0)))
            pre_cut = piecewise_offsets.get("pre_cut_offset", 0.0)
            offset = post_cut if t_sec > rupture_time else pre_cut

        center = t_sec + offset
        w_start = max(0, center - 90)
        w_end = center + 90

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
        t_time = turn.get("time_str", turn.get("riverside_time", ""))
        t_sec = turn.get("start_seconds", turn.get("riverside_start_seconds", 0.0))
        if idx in best_match_for_turn:
            c_start_idx, c_end_idx, score = best_match_for_turn[idx]
            cue_start = srt_cues[c_start_idx]
            cue_end = srt_cues[c_end_idx]

            alignment.append({
                "segment_id": seg_id,
                "speaker": turn["speaker"],
                "riverside_time": t_time,
                "riverside_start_seconds": t_sec,
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
                "riverside_time": t_time,
                "riverside_start_seconds": t_sec,
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
    dry_run: bool = True,
    known_cuts: Optional[str] = None
) -> Dict[str, Any]:
    """
    Executes Step 0:
    1. Ingests raw Riverside transcript and splits into 3 chunks.
    2. Parses SRT file.
    3. Merges short/filler turns into substantive units.
    4. Runs Pass 1 DP alignment.
    5. Detects rupture points or incorporates known cuts override.
    6. If rupture detected, runs global re-anchor scan and offset clustering.
    7. Runs Pass 2 centered DP alignment if piecewise offset identified.
    8. Detects unanchored SRT regions and generates unmatched audit artifact.
    9. Writes local artifacts into episodes/<episode_id>/.
    10. Updates state.
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
    srt_duration = srt_cues[-1]["end_seconds"] if srt_cues else 0.0

    # 3. Chunk raw turns into 3 sections (retaining full turn fidelity for downstream review / reading)
    c1_turns, c2_turns, c3_turns = chunk_riverside_transcript(raw_turns)
    c1_text = format_turns_to_riverside_text(c1_turns)
    c2_text = format_turns_to_riverside_text(c2_turns)
    c3_text = format_turns_to_riverside_text(c3_turns)

    # 4. Merge non-substantive turns for alignment matching
    substantive_turns = merge_short_and_filler_turns(raw_turns, min_substantive=3)

    # 5. Pass 1: Global dynamic programming alignment on substantive turns
    alignment_pass1 = align_transcript_with_srt(substantive_turns, srt_cues)
    pass1_matched = sum(1 for a in alignment_pass1 if a["matched"])
    pass1_pct = round(pass1_matched / max(1, len(substantive_turns)) * 100, 1)

    # 6. Rupture point detection and known cuts handling
    manual_cut = parse_known_cuts(known_cuts)
    rupture_idx = detect_rupture_point(alignment_pass1, srt_duration)

    L: Optional[float] = None
    rupture_time: Optional[float] = None
    rupture_info: Optional[Dict[str, Any]] = None
    inferred_edit_map: Optional[str] = None
    cut_warnings: List[str] = []
    confident_anchors: List[Dict[str, Any]] = []

    if rupture_idx is not None:
        rupture_seg = alignment_pass1[rupture_idx]
        rupture_time = rupture_seg["riverside_start_seconds"]
        pre_cut_srt = rupture_seg.get("srt_start_seconds")
        pre_cut_offset = (pre_cut_srt - rupture_time) if pre_cut_srt is not None else 0.0

        rupture_info = {
            "segment_id": rupture_seg["segment_id"],
            "segment_index": rupture_idx,
            "riverside_time": rupture_seg.get("riverside_time", format_seconds_to_timestamp(rupture_time)),
            "riverside_seconds": rupture_time,
            "srt_seconds": pre_cut_srt,
            "pre_cut_offset": round(pre_cut_offset, 3),
        }

        # Scan for re-anchors starting right after rupture
        confident_anchors = scan_reanchors(substantive_turns, srt_cues, start_idx=rupture_idx + 1, max_turns=80)
        auto_cut_duration: Optional[float] = None
        auto_L: Optional[float] = None

        if confident_anchors:
            auto_L, dom_cluster = cluster_offsets(confident_anchors, tolerance=15.0)
            auto_cut_duration = pre_cut_offset - auto_L

        if manual_cut is not None:
            man_start, man_dur = manual_cut
            man_L = pre_cut_offset - man_dur
            if auto_cut_duration is not None:
                diff = abs(man_dur - auto_cut_duration)
                if diff > 10.0:
                    warn_msg = (
                        f"WARNING: Manual cut duration ({man_dur:.1f}s) differs from "
                        f"auto-detected cut ({auto_cut_duration:.1f}s) by > 10s. Using manual override."
                    )
                    cut_warnings.append(warn_msg)
                    L = man_L
                    rupture_time = man_start
                else:
                    L = auto_L
            else:
                L = man_L
                rupture_time = man_start
        else:
            L = auto_L

    elif manual_cut is not None:
        man_start, man_dur = manual_cut
        rupture_time = man_start
        pre_segs = [s for s in alignment_pass1 if s.get("matched") and s.get("riverside_start_seconds", 0.0) <= man_start]
        pre_cut_offset = (pre_segs[-1]["srt_start_seconds"] - pre_segs[-1]["riverside_start_seconds"]) if pre_segs else 0.0
        L = pre_cut_offset - man_dur
        rupture_info = {
            "segment_id": pre_segs[-1]["segment_id"] if pre_segs else 1,
            "segment_index": None,
            "riverside_time": format_seconds_to_timestamp(man_start),
            "riverside_seconds": man_start,
            "srt_seconds": pre_segs[-1].get("srt_start_seconds") if pre_segs else None,
            "pre_cut_offset": round(pre_cut_offset, 3),
            "manual_override": True,
        }

    # 7. Pass 2 (Centered DP Re-Run) if rupture / cut offset established
    if L is not None and rupture_time is not None:
        target_offset_func = lambda t: 0.0 if t <= rupture_time else L
        alignment = align_transcript_with_srt(substantive_turns, srt_cues, target_offset_func=target_offset_func)

        cut_duration_sec = (rupture_info["pre_cut_offset"] if rupture_info else 0.0) - L
        cut_mins = round(cut_duration_sec / 60.0, 1)
        r_time_str = rupture_info.get("riverside_time") if rupture_info else format_seconds_to_timestamp(rupture_time)

        # Find first matched segment after rupture to get video resume time
        post_cut_matched = [
            s for s in alignment
            if s.get("matched") and s.get("riverside_start_seconds", 0.0) > rupture_time and s.get("srt_start_seconds") is not None
        ]
        if post_cut_matched:
            resume_srt_sec = post_cut_matched[0]["srt_start_seconds"]
            resume_srt_str = format_seconds_to_timestamp(resume_srt_sec)
        else:
            resume_srt_sec = max(0.0, rupture_time + L)
            resume_srt_str = format_seconds_to_timestamp(resume_srt_sec)

        inferred_edit_map = f"Cut of ~{cut_mins:.1f} minutes at raw ~{r_time_str}; content resumes at video ~{resume_srt_str} (offset: {L:.1f}s)"
    else:
        alignment = alignment_pass1
        inferred_edit_map = "No significant cuts detected."

    matched_count = sum(1 for a in alignment if a["matched"])
    unmatched_count = sum(1 for a in alignment if a["unmatched"])
    match_pct = round(matched_count / max(1, len(substantive_turns)) * 100, 1)

    # 8. Unanchored SRT regions and unmatched audit
    unanchored_regions = detect_unanchored_srt_regions(alignment, srt_cues, min_duration=60.0)

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

    # Write unmatched audit
    srt_name = Path(srt_path).name
    unmatched_file = write_unmatched_audit(ep_dir, episode_id, srt_name, substantive_turns, alignment)

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
            "pass1_match_percentage": pass1_pct,
            "rupture_point": rupture_info,
            "post_cut_offset": L,
            "inferred_edit_map": inferred_edit_map,
            "unanchored_srt_regions": unanchored_regions,
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
        "unmatched": str(unmatched_file),
    }

    log_lines = [
        "Step 0 Complete:",
        f"- Total raw turns: {len(raw_turns)}",
        f"- Chunk 1: {len(c1_turns)} turns ({sum(t['word_count'] for t in c1_turns)} words)",
        f"- Chunk 2: {len(c2_turns)} turns ({sum(t['word_count'] for t in c2_turns)} words)",
        f"- Chunk 3: {len(c3_turns)} turns ({sum(t['word_count'] for t in c3_turns)} words)",
        f"- Substantive alignment turns: {len(substantive_turns)}",
        f"- Parsed SRT cues: {len(srt_cues)}",
    ]
    if rupture_info and L is not None:
        r_seg_id = rupture_info.get("segment_id", "")
        r_time = rupture_info.get("riverside_time", "")
        log_lines.append(f"- Rupture point reported at Segment {r_seg_id} ({r_time})")
        log_lines.append(f"- Post-cut offset reported at {L:.1f}s")
        log_lines.append(f"- Inferred edit map: {inferred_edit_map}")
        log_lines.append(f"- Alignment: {pass1_pct}% (Pass 1) -> {matched_count} matched, {unmatched_count} unmatched segments ({match_pct}% match rate)")
    else:
        log_lines.append(f"- Alignment: {matched_count} matched, {unmatched_count} unmatched segments ({match_pct}% match rate)")

    if unanchored_regions:
        log_lines.append(f"- Unanchored SRT regions (>=60s): {len(unanchored_regions)} region(s) detected (possible video retakes)")
        for reg in unanchored_regions:
            log_lines.append(f"  * {reg['start_timestamp']} -> {reg['end_timestamp']} ({reg['duration']}s, {reg['cue_count']} cues)")
    else:
        log_lines.append("- Unanchored SRT regions: None")

    for w in cut_warnings:
        log_lines.append(f"- {w}")

    log_lines.append(f"- Riverside SHA-256: {riverside_hash[:16]}...")
    log_lines.append(f"- SRT SHA-256: {srt_hash[:16]}...")
    log_lines.append(f"- Unmatched audit written to {unmatched_file}")
    log_lines.append(f"- Artifacts written to {ep_dir}")

    log_msg = "\n".join(log_lines)

    update_step_state(
        episode_id,
        "step0_transcript_prep",
        "done",
        logs=log_msg,
        artifacts=artifacts,
        validation={"passed": True, "errors": [], "warnings": cut_warnings},
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
            "pass1_match_percentage": pass1_pct,
            "inferred_edit_map": inferred_edit_map,
        }
    }
