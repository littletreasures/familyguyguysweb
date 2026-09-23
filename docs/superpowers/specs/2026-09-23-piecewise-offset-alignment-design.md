# Design Spec: Anchor-Based Piecewise Offset Alignment & Pipeline Usability

**Date:** 2026-09-23  
**Status:** Validated  
**Module:** `admin-tools` (`step0_transcript_prep.py`, `step6b_chapters.py`, `mission_control.py`)

---

## 1. Problem Statement & Motivation
During episodes with heavy mid-episode cuts (e.g., technical difficulties or audio dropouts cut in final video), such as `s02e03`, the raw Riverside audio diverges significantly from the final edited video.
Because the existing dynamic programming (DP) alignment operates inside a $\pm 90\text{s}$ temporal window around the raw Riverside timestamp:
- Everything after the cut sits permanently outside the window of its true SRT counterpart.
- On `s02e03`, the front half (segs 1–386) aligns at 98% with an offset of $\approx +44.3\text{s}$.
- A cut of $\approx 7.2\text{ minutes}$ (segs 387–446) shifts the post-cut offset to $\approx -375.0\text{s}$.
- Without piecewise offset alignment, the overall substantive match rate drops to 48.8% with 644 unmatched segments, falsely classifying surviving content as cut and producing corrupted or partial chapter anchors.

Additionally:
- `step6b_chapters.py` lacks a guardrail to refuse chapter auto-generation when alignment fails or is incomplete (< 70% match rate).
- Video retakes / re-recorded footage (SRT regions without raw counterpart) need to be detected and logged for manual chapter review.
- The Credit Scroll step (Step 6) is positioned late in the pipeline and required by `Run All`, despite often being run pre-render or out-of-band.
- The UI requires repeatedly typing `"PUBLISH TO PRODUCTION"` for every single step write instead of relying directly on the Live Mode switch.

---

## 2. Core Architecture & Workflow

### 2.1 Step 0: Piecewise Offset Alignment Algorithm (`step0_transcript_prep.py`)

1. **Pass 1 (Initial DP Alignment):**
   - Run the existing global DP alignment with the $\pm 90\text{s}$ window and existing thresholds (`min_score = 0.75` for $\le 2$ tokens, `0.45` otherwise).
   - If `known_cuts` override is provided in intake, compute seed offset directly and skip to Step 4 (or cross-validate within $10\text{s}$).

2. **Rupture Detection:**
   - Filter out the trailing tail of raw audio that extends past $\text{srt\_end\_seconds} + 90\text{s}$ (where audio continued after the video ended).
   - Scan for the rupture point: defined as the last matched segment before the first significant run of consecutive unmatched substantive turns ($\ge 8$ turns, as normal uncut episodes have max runs of 2–4).
   - For `s02e03`, this identifies Segment 386 (`43:32.45`, `2612.4s`).

3. **Expanding Re-Anchor Scan:**
   - Starting immediately after the rupture, inspect the subsequent unmatched substantive turns.
   - To avoid stalling inside the cut material itself (e.g. 60 turns of deleted chatter), scan unmatched turns in expanding batches of 20 (up to 80 turns) across the **entire SRT** with no temporal window.
   - **Candidate Acceptance Gate:**
     $$\text{similarity} \ge 0.80 \quad \text{AND} \quad \text{margin} = (\text{best\_score} - \text{second\_best\_non\_overlapping\_score}) \ge 0.15$$
   - Stop scanning once $\ge 5$ confident anchors are collected (or batch limit reached).

4. **Offset Consensus & Clustering:**
   - For each confident anchor, compute $\text{offset}_i = \text{srt\_start\_seconds}_i - \text{riverside\_start\_seconds}_i$.
   - Apply 1D clustering ($\pm 15\text{s}$ tolerance window).
   - Dominant cluster median defines post-cut offset $L$ (on `s02e03`, $L \approx -375.0\text{s}$ to $-379.1\text{s}$).
   - If multiple distinct clusters exist separated by $> 30\text{s}$ with $\ge 3$ anchors each, store cluster map and handle piecewise.

5. **Pass 2 (Centered DP Re-Run):**
   - Re-run the global DP alignment with identical scoring thresholds, but with the window center adjusted:
     $$\text{center}(t) = \begin{cases} t & \text{if } t \le \text{rupture\_time} \\ t + L & \text{if } t > \text{rupture\_time} \end{cases}$$
   - Candidate search window: $[\max(0, \text{center}(t) - 90), \text{center}(t) + 90]$.
   - Merge short/filler turns (< 3 substantive words) remains identical.

6. **Audit Artifact & Report Generation:**
   - Generate `episodes/<episode_id>/unmatched.txt` listing all genuinely trimmed or unmatched substantive segments with format:
     `Segment ID | Riverside Time | Speaker | Text`
   - Include inferred edit map in logs and `alignment.json`:
     `"Cut of ~7.2 minutes at raw ~43:32; content resumes at video ~44:42 (offset: -379.1s)"`
   - Detect unanchored SRT regions: any contiguous interval in the SRT cues $\ge 60\text{s}$ with zero matched raw turns (indicating video retakes / re-recorded footage). Log them under `unanchored_srt_regions` in `alignment.json` and in Step 0 logs.

---

### 2.2 Guardrail for Chapters (`step6b_chapters.py`)

- Before auto-generating chapters from `alignment.json`:
  ```python
  match_percentage = alignment_data.get("summary", {}).get("match_percentage", 0.0)
  if match_percentage < 70.0 and not custom_chapters:
      msg = (
          f"Alignment match rate ({match_percentage:.1f}%) is below the 70.0% guardrail (incomplete map). "
          f"Step 6b refuses to auto-generate chapters to prevent emitting partial or distorted chapters. "
          f"Please review cut alignment in Step 0 or provide custom chapters."
      )
      update_step_state(episode_id, "step6b_chapters", "error", logs=msg)
      raise ValueError(msg)
  ```

---

### 2.3 Mission Control UI & Publishing Streamlining (`mission_control.py`)

1. **Known Cuts Field:**
   - In Step 0 expander, provide an optional text input `Known Cuts (optional: 'MM:SS, duration_sec' or 'MM:SS, MM:SS' e.g. '43:32, 420s')`.
   - Stored in persistent episode state.
   - If both manual input and auto-detection exist, verify agreement within $10\text{s}$; if differing, log/warn:
     `"WARNING: Manual cut duration (...s) differs from auto-detected cut (...s) by > 10s. Using manual override."`

2. **Credit Scroll Positioning & Skipping:**
   - Add a toggle in the top settings / Run All controls: `Skip Credit Scroll in Run All` (defaulting to True if usually run externally).
   - In the UI expanders, reposition Step 6 (Credit Scroll) earlier (right after Step 1 Metadata) so it can be generated or previewed pre-render before full SRT intake.
   - Ensure Step 6 works with metadata alone without requiring transcript chunks.
   - Downstream steps continue to function independently whether Step 6 was run or skipped.

3. **Streamlined Live Production Authorization:**
   - Remove repetitive per-step text input boxes requiring `"PUBLISH TO PRODUCTION"`.
   - The top Mode switch (`dry_run_toggle: Dry Run / Live Production`) serves as the master authority.
   - When set to Live Production:
     - Clear red indicators display `"🔴 LIVE PRODUCTION MODE ACTIVE"`.
     - Step write buttons become immediately actionable: `"Push to Supabase (LIVE)"`.
     - Test episode IDs remain protected by `assert_safe_publish(episode_id, dry_run)`.
   - When set to Dry Run:
     - Step write buttons display `"Simulate Push (Dry Run)"`.

---

## 3. Verification & Acceptance Criteria
1. **s02e03 Re-run:**
   - Rupture correctly detected at Segment 386 (`43:32.45`).
   - Consensus offset identified at $\approx -375.0\text{s}$ to $-379.1\text{s}$.
   - Match rate increases from **48.8%** to **$\ge 93\%$** (target: mid-90s).
   - `episodes/s02e03/unmatched.txt` is created, short, and primarily consists of the deleted technical difficulties discussion (segments 387–446) and scattered small cut lines.
2. **Regression Check on Healthy Episodes:**
   - `s02e01` and `s02e02` maintain their high match rates ($\ge 95\%$) with no false ruptures triggered.
3. **Guardrail Check:**
   - Triggering Step 6b on an alignment with $< 70\%$ match rate halts and reports incomplete map error.
4. **UI Usability:**
   - Single switch enables live writes without repeated typing.
   - Credit scroll can be run pre-render or skipped in Run All.
