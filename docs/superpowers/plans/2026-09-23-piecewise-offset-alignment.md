# Piecewise Offset Alignment & Mission Control Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement anchor-based piecewise offset alignment in `step0_transcript_prep.py` for heavy-cut episodes like `s02e03`, add chapter generation guardrails in `step6b_chapters.py`, and streamline Mission Control UI publishing authorization and workflow ordering.

**Architecture:** An initial DP alignment pass detects rupture points where dialogue diverges from final video. An expanding global re-anchor scan searches the SRT for high-confidence matches ($\text{sim} \ge 0.8$, $\text{margin} \ge 0.15$), clusters the computed offsets ($\text{srt} - \text{riverside}$), and executes a second DP pass centered around the piecewise offset. Outputs an inferred edit map, an unanchored SRT audit, and an `unmatched.txt` audit file.

**Tech Stack:** Python 3.14, Streamlit, standard library (`bisect`, `re`, `json`, `math`), `unittest`.

## Global Constraints
- Target match rate on surviving substantive content in mid-90s (like s02e01 at 95.3%).
- All unit tests must pass via `admin-tools/venv/bin/python -m unittest`.
- Preserves backward compatibility of alignment document schema (`segments`, `summary`, `source_metadata`).
- No external dependencies added; stick to Python standard library and existing repo modules.
- Commits are made only when explicitly requested per AGENTS.md rules.

---

### Task 1: Anchor-Based Piecewise Offset Alignment in `step0_transcript_prep.py`

**Files:**
- Modify: `admin-tools/pipeline/step0_transcript_prep.py`
- Test: `admin-tools/test_step0_alignment.py`

**Interfaces:**
- `detect_rupture_point(segments: List[Dict[str, Any]], srt_duration: float) -> Optional[int]`: Returns segment index of rupture point or None.
- `scan_reanchors(turns: List[Dict[str, Any]], srt_cues: List[Dict[str, Any]], start_idx: int, max_turns: int = 80) -> List[Dict[str, Any]]`: Scans entire SRT for confident anchors.
- `cluster_offsets(anchors: List[Dict[str, Any]], tolerance: float = 15.0) -> Tuple[float, List[Dict[str, Any]]]`: Returns dominant offset $L$ and cluster map.
- `detect_unanchored_srt_regions(alignment: List[Dict[str, Any]], srt_cues: List[Dict[str, Any]], min_duration: float = 60.0) -> List[Dict[str, Any]]`: Returns list of uncovered SRT regions.
- `write_unmatched_audit(ep_dir: Path, episode_id: str, srt_name: str, substantive_turns: List[Dict[str, Any]], alignment: List[Dict[str, Any]]) -> Path`: Writes `episodes/<episode_id>/unmatched.txt`.

- [ ] **Step 1: Write the failing unit tests for piecewise alignment helpers**

Create `admin-tools/test_step0_alignment.py` testing:
1. `detect_rupture_point`: Finds rupture before an 8+ turn gap; returns None for healthy transcripts (max gap 2-4).
2. `scan_reanchors`: Enforces similarity $\ge 0.8$ and margin $\ge 0.15$.
3. `cluster_offsets`: Clusters noisy offsets and returns median of dominant cluster.
4. `detect_unanchored_srt_regions`: Identifies gaps $\ge 60\text{s}$ in SRT cues not matched by raw turns.

- [ ] **Step 2: Run test to verify it fails**

Run: `admin-tools/venv/bin/python -m unittest test_step0_alignment.py`
Expected: FAIL (modules/functions not yet implemented)

- [ ] **Step 3: Implement piecewise alignment algorithm in `step0_transcript_prep.py`**

1. Implement helper functions:
   - `detect_rupture_point`
   - `scan_reanchors`
   - `cluster_offsets`
   - `detect_unanchored_srt_regions`
   - `write_unmatched_audit`
2. Update `align_transcript_with_srt`:
   - Support `target_offset_func` or piecewise offset dictionary for window centering.
3. Update `run_step0_prep`:
   - Run Pass 1 DP alignment.
   - If `known_cuts` override passed in: parse cut start and duration, compute seed offset directly.
   - Else: run `detect_rupture_point`.
   - If rupture detected: run `scan_reanchors` in batches up to 80 turns.
   - If confident anchors found: run `cluster_offsets` to find post-cut offset $L$.
   - If both manual override and auto-detection exist: assert agreement within $10\text{s}$ or emit warning.
   - Run Pass 2 DP alignment centered around $t$ before rupture and $t + L$ after rupture.
   - Detect unanchored SRT regions and record in `alignment.json` summary.
   - Generate `episodes/<episode_id>/unmatched.txt`.
   - Update `alignment.json` summary with inferred edit map and before/after match rates.

- [ ] **Step 4: Run test to verify it passes**

Run: `admin-tools/venv/bin/python -m unittest test_step0_alignment.py`
Expected: PASS

---

### Task 2: Chapters Guardrail in `step6b_chapters.py`

**Files:**
- Modify: `admin-tools/pipeline/step6b_chapters.py`
- Test: `admin-tools/test_chapters.py`

**Interfaces:**
- In `run_step6b_chapters`: checks `match_percentage < 70.0%` when `not custom_chapters`.

- [ ] **Step 1: Write failing test in `test_chapters.py`**

Add `test_refuses_auto_generation_when_match_rate_below_70`:
- Mock alignment data with `match_percentage = 48.8%`.
- Assert `run_step6b_chapters` raises `ValueError` with `"below the 70.0% guardrail (incomplete map)"`.

- [ ] **Step 2: Run test to verify it fails**

Run: `admin-tools/venv/bin/python -m unittest test_chapters.py`
Expected: FAIL

- [ ] **Step 3: Implement guardrail in `step6b_chapters.py`**

In `run_step6b_chapters`:
```python
sum_data = alignment_data.get("summary", {})
match_pct = sum_data.get("match_percentage", 0.0)
if match_pct < 70.0 and not custom_chapters:
    err_msg = (
        f"Alignment match rate ({match_pct:.1f}%) is below the 70.0% guardrail (incomplete map). "
        f"Step 6b refuses to auto-generate chapters to prevent emitting partial or distorted chapters. "
        f"Please review cut alignment in Step 0 or provide custom chapters."
    )
    update_step_state(episode_id, "step6b_chapters", "error", logs=err_msg)
    raise ValueError(err_msg)
```

- [ ] **Step 4: Run test to verify it passes**

Run: `admin-tools/venv/bin/python -m unittest test_chapters.py`
Expected: PASS

---

### Task 3: Mission Control UI Streamlining in `mission_control.py`

**Files:**
- Modify: `admin-tools/mission_control.py`

**Changes:**
1. **Remove `"PUBLISH TO PRODUCTION"` text inputs:**
   - In Steps 1, 2, 3, 4 and Global Replay, eliminate the text input box.
   - When `dry_run_toggle` is Live (`dry_run_toggle == False`), display prominent red button:
     `st.button("Push to Supabase (LIVE)", type="primary")`
     Clicking immediately triggers live write.
   - When `dry_run_toggle` is Dry Run (`dry_run_toggle == True`), button shows:
     `st.button("Simulate Push (Dry Run)")`
2. **Add "Known cuts" Field in Step 0:**
   - In Step 0 expander, add `known_cuts = st.text_input("Known Cuts (optional, e.g. '43:32, 7m10s' or '43:32, 430s')", value=state_data.get("known_cuts", ""))`.
   - Save in episode state.
   - Pass `known_cuts` to `run_step0_prep`.
3. **Credit Scroll Step Positioning & Skipping:**
   - Add toggle in top controls / intake:
     `skip_credits_in_run_all = st.checkbox("Skip Credit Scroll in Run All", value=True)`
   - In `run_all`: check `if not skip_credits_in_run_all: run_step6_credits(...)`.
   - In expanders: move Step 6 expander up to immediately follow Step 1 Metadata so it can be previewed/generated pre-render.
   - In `step6_credits.py`: gracefully proceed if `chunks/chunk_1.txt` does not exist yet (using episode title/metadata).

---

### Task 4: End-to-End Execution & Validation

**Files:**
- Run against: `episodes/s02e03`
- Regression checks: `s02e01`, `s02e02`

- [ ] **Step 1: Execute Step 0 on `s02e03`**

Run: `admin-tools/venv/bin/python -c 'from pipeline.step0_transcript_prep import run_step0_prep; res = run_step0_prep("s02e03", "/Volumes/RetroSSD/SSD-Family-Guy-Guys-Storage/Episode Vault/s02e03/s02e03.txt", "/Users/jrhackett/models/whisper/transcripts/FGG_S02E03_DaBoom_RSS_2026-09-23_v01.srt", dry_run=True); print(res["logs"])'`

Verify:
- Rupture point reported at Segment 386 (`43:32.45`).
- Post-cut offset reported at $\approx -375.0\text{s}$ to $-379.1\text{s}$.
- Match rate reported $\ge 93\%$ (target mid-90s).
- `episodes/s02e03/unmatched.txt` created with short audit list.
- Unanchored SRT regions logged if any exist.

- [ ] **Step 2: Regression test on healthy episodes (`s02e01`, `s02e02`)**

Verify no false ruptures triggered on `s02e01` and `s02e02`.

- [ ] **Step 3: Run full unit test suite**

Run: `admin-tools/venv/bin/python -m unittest test_step0_alignment.py test_chapters.py test_transcript_pipeline.py test_validation.py`
Expected: ALL PASS.
