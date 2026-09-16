"""
mission_control.py — Streamlit UI for Episode Mission Control.
Provides a single-screen per-episode publishing pipeline:
- Persistent checklist loaded from admin-tools/state/<episode_id>.json
- Single episode intake form (Riverside transcript + Final SRT)
- Run All button running steps in order (0 -> 1 -> 2 -> 3 -> 4 -> 6b -> 5 -> 6 -> 7)
- Individual Step Run / Re-run buttons
- Live machine-checkable validator banners for YouTube description, credit scroll, reviews
- Editable text areas and headings for all artifacts
- Explicit gated production publish semantics (per-step and global replay)
"""
import json
import os
import re
from pathlib import Path
from typing import Dict, Any, Optional

import streamlit as st

import config
from llm_client import get_available_models
from pipeline.state import (
    load_step_state,
    save_step_state,
    update_step_state,
    get_episodes_dir,
    is_test_episode_id,
    assert_safe_publish,
    compute_file_hash,
)
from pipeline.step0_transcript_prep import run_step0_prep
from pipeline.step1_metadata import run_step1_metadata
from pipeline.step2_reviews import run_step2_reviews
from pipeline.step3_transcript import run_step3_transcript
from pipeline.step4_thumbnails import run_step4_thumbnails
from pipeline.step6b_chapters import run_step6b_chapters
from pipeline.step5_youtube import run_step5_youtube
from pipeline.step6_credits import run_step6_credits
from pipeline.step7_feed_sync import run_step7_feed_sync
from pipeline.validators import (
    validate_youtube_description,
    validate_credit_scroll,
    validate_reviews_data,
)


def render_mission_control():
    st.markdown("## 🚀 Episode Mission Control")
    st.caption("Single-screen production publishing pipeline with persistent state tracking and gated safety approvals.")

    # 1. Top Configuration & Mode Bar
    col_mode1, col_mode2 = st.columns([2, 1])
    with col_mode1:
        st.markdown("**Publishing Safety Gate**")
        st.caption("All pipeline runs execute in Dry-Run mode by default. Production writes require explicit phrase authorization.")
    with col_mode2:
        dry_run_toggle = st.toggle("Mode: Dry Run / Live", value=True, help="Toggle between Dry Run (preview/mock) and Live Production writes. Test episodes are permanently locked to Dry Run.")
        if dry_run_toggle:
            st.info("🟢 **Mode: DRY RUN** (Database writes simulated; test IDs allowed)")
        else:
            st.error("🔴 **Mode: LIVE PRODUCTION** (Live Supabase writes enabled)")

    # 2. Episode Intake Form
    st.markdown("---")
    st.subheader("1. Episode Information & Dual-Transcript Intake")
    
    col_ep1, col_ep2, col_ep3, col_ep4 = st.columns(4)
    default_ep_id = st.session_state.get("mc_episode_id", "s02e99")
    episode_id = col_ep1.text_input("Episode ID (e.g. s02e01, s01e99)", value=default_ep_id).strip().lower()
    st.session_state["mc_episode_id"] = episode_id

    # Load persistent state immediately
    state_data = load_step_state(episode_id)
    steps_state = state_data.get("steps", {})

    season_val = col_ep2.number_input("Season", min_value=1, value=state_data.get("season", 2))
    episode_num_val = col_ep3.number_input("Episode #", min_value=1, value=state_data.get("episode", 1))
    podcast_num_val = col_ep4.number_input("Podcast Episode #", min_value=1, value=state_data.get("podcast_episode_number") or 8)

    col_meta1, col_meta2 = st.columns(2)
    episode_title = col_meta1.text_input("Episode Title (Family Guy)", value=state_data.get("episode_title") or "Peter, Peter, Caviar Eater")
    raw_guest_name = col_meta2.text_input("Guest Name (leave blank if none)", value=state_data.get("guest_name") or "")
    guest_val = raw_guest_name.strip() if raw_guest_name and raw_guest_name.strip() else None

    col_files1, col_files2 = st.columns(2)
    default_riverside = "/Volumes/RetroSSD/SSD-Family-Guy-Guys-Storage/Episode Vault/s2e1/s2e1.txt"
    default_srt = "/Users/jrhackett/models/whisper/transcripts/S2E1Final.srt"
    
    riverside_path = col_files1.text_input("Riverside Raw Transcript Path", value=state_data.get("riverside_transcript_path") or default_riverside)
    srt_path = col_files2.text_input("Final-Edit SRT File Path", value=state_data.get("srt_path") or default_srt)

    # LLM Inference Engine Selection
    st.markdown("##### 🧠 LLM Inference Engine")
    col_llm_prov, col_llm_mod, col_llm_stat = st.columns([1.2, 1.8, 1.5])

    provider_options = ["gemini", "omlx", "openai", "anthropic"]
    saved_prov = state_data.get("llm_provider") or getattr(config, "LLM_PROVIDER", "gemini")
    prov_idx = provider_options.index(saved_prov) if saved_prov in provider_options else 0
    selected_provider = col_llm_prov.selectbox("Provider", provider_options, index=prov_idx, key="mc_llm_prov")

    available_models = get_available_models(selected_provider)
    model_options = available_models + ["Custom..."]
    saved_mod = state_data.get("llm_model") or getattr(config, "DEFAULT_PROVIDER_MODELS", {}).get(selected_provider, "")

    mod_idx = 0
    if saved_mod in available_models:
        mod_idx = available_models.index(saved_mod)
    elif saved_mod:
        mod_idx = len(available_models)  # "Custom..."

    selected_model_choice = col_llm_mod.selectbox("Model", model_options, index=mod_idx, key="mc_llm_model")
    if selected_model_choice == "Custom...":
        active_model = col_llm_mod.text_input("Custom Model Name", value=saved_mod if saved_mod not in available_models else "", key="mc_custom_model").strip()
    else:
        active_model = selected_model_choice

    clean_active_model = re.sub(r"\s*\(server offline — typical local models\)", "", active_model).strip()

    with col_llm_stat:
        st.markdown("<div style='height: 28px;'></div>", unsafe_allow_html=True)
        if selected_provider == "omlx":
            is_offline = any("(server offline" in m for m in available_models)
            if not is_offline:
                st.success("🟢 oMLX Online (localhost:8000)")
            else:
                st.warning("⚠️ oMLX Offline (http://localhost:8000/v1)")
                st.caption("Generation will fail until oMLX server is started.")
        elif selected_provider == "gemini":
            if config.GEMINI_API_KEY:
                st.success("🟢 Gemini API Key Set")
            else:
                st.error("🔴 Missing GEMINI_API_KEY")
        elif selected_provider == "openai":
            if config.OPENAI_API_KEY:
                st.success("🟢 OpenAI API Key Set")
            else:
                st.error("🔴 Missing OPENAI_API_KEY")
        elif selected_provider == "anthropic":
            if config.ANTHROPIC_API_KEY:
                st.success("🟢 Anthropic API Key Set")
            else:
                st.error("🔴 Missing ANTHROPIC_API_KEY")

    # Save inputs to state
    state_data["season"] = season_val
    state_data["episode"] = episode_num_val
    state_data["podcast_episode_number"] = podcast_num_val
    state_data["episode_title"] = episode_title
    state_data["guest_name"] = guest_val or ""
    state_data["riverside_transcript_path"] = riverside_path
    state_data["srt_path"] = srt_path
    state_data["llm_provider"] = selected_provider
    state_data["llm_model"] = clean_active_model
    save_step_state(episode_id, state_data)

    # Safety check on test IDs
    is_test_id = is_test_episode_id(episode_id)
    if is_test_id:
        st.warning(f"🛡️ Episode ID '{episode_id}' is recognized as a TEST FIXTURE. Production database writes are permanently locked to Dry-Run.")

    # 3. Pipeline Checklist Overview Bar
    st.markdown("---")
    st.subheader("2. Pipeline Status Checklist")
    
    step_keys = [
        ("Step 0: Prep", "step0_transcript_prep"),
        ("Step 1: Meta", "step1_metadata"),
        ("Step 2: Reviews", "step2_reviews"),
        ("Step 3: Transcript", "step3_transcript_publish"),
        ("Step 4: Thumbnail", "step4_thumbnails"),
        ("Step 6b: Chapters", "step6b_chapters"),
        ("Step 5: YouTube", "step5_youtube"),
        ("Step 6: Credits", "step6_credits"),
        ("Step 7: Feed Sync", "step7_feed_sync"),
    ]

    cols = st.columns(len(step_keys))
    for idx, (label, key) in enumerate(step_keys):
        st_info = steps_state.get(key, {})
        status = st_info.get("status", "pending")
        with cols[idx]:
            if status == "done":
                st.success(f"**{label}**\n\n✅ Done")
            elif status == "running":
                st.warning(f"**{label}**\n\n⏳ Running")
            elif status == "error":
                st.error(f"**{label}**\n\n❌ Error")
            else:
                st.info(f"**{label}**\n\n⏸️ Pending")

    # Run All and Reset Controls
    col_btn1, col_btn2, col_btn3 = st.columns([2, 1, 1])
    if col_btn1.button("▶ Run All Pipeline Steps (0 -> 1 -> 2 -> 3 -> 4 -> 6b -> 5 -> 6 -> 7)", use_container_width=True, type="primary"):
        with st.spinner("Executing full pipeline in order..."):
            effective_dry_run = True if is_test_id else dry_run_toggle
            try:
                # Step 0
                st.toast("Running Step 0: Transcript Prep...")
                run_step0_prep(episode_id, riverside_path, srt_path, dry_run=effective_dry_run)
                # Step 1
                st.toast("Running Step 1: Metadata...")
                run_step1_metadata(episode_id, season_val, episode_num_val, dry_run=effective_dry_run)
                # Step 2
                st.toast("Running Step 2: Reviews...")
                run_step2_reviews(episode_id, guest_name=guest_val, dry_run=effective_dry_run, provider=selected_provider, model=clean_active_model)
                # Step 3
                st.toast("Running Step 3: Transcript...")
                run_step3_transcript(episode_id, publish=False, dry_run=effective_dry_run)
                # Step 4
                st.toast("Running Step 4: Thumbnails...")
                run_step4_thumbnails(episode_id, episode_title=episode_title, season=season_val, dry_run=effective_dry_run)
                # Step 6b
                st.toast("Running Step 6b: Chapters...")
                run_step6b_chapters(episode_id, dry_run=effective_dry_run, provider=selected_provider, model=clean_active_model)
                # Step 5
                st.toast("Running Step 5: YouTube Description...")
                run_step5_youtube(episode_id, guest_name=guest_val, dry_run=effective_dry_run, provider=selected_provider, model=clean_active_model)
                # Step 6
                st.toast("Running Step 6: Fake Credits...")
                run_step6_credits(episode_id, podcast_episode_number=podcast_num_val, guest_name=guest_val, dry_run=effective_dry_run, provider=selected_provider, model=clean_active_model)
                # Step 7
                st.toast("Running Step 7: Feed Sync...")
                run_step7_feed_sync(episode_id, season=season_val, episode_number=episode_num_val, dry_run=effective_dry_run)
                st.success("🎉 All pipeline steps executed successfully!")
                st.rerun()
            except Exception as e:
                st.error(f"❌ Pipeline halted on error: {e}")
                for s_name in ["step2_reviews", "step5_youtube", "step6_credits"]:
                    raw_path = ep_dir / f"llm_raw_{s_name}.txt"
                    if raw_path.exists():
                        try:
                            with open(raw_path, "r", encoding="utf-8") as rf:
                                r_txt = rf.read()
                            if r_txt.strip():
                                st.error(f"⚠️ Raw LLM Response for {s_name}:")
                                st.code(r_txt, language="text")
                        except Exception:
                            pass

    if col_btn2.button("⟳ Refresh Status", use_container_width=True):
        st.rerun()

    if col_btn3.button("🗑 Reset Episode State", use_container_width=True):
        from pipeline.state import reset_step_state
        reset_step_state(episode_id)
        st.success(f"State reset for {episode_id}")
        st.rerun()

    # 4. Detailed Step-by-Step Accordion Cards
    st.markdown("---")
    st.subheader("3. Per-Step Artifacts, Quality Gates & Actions")
    ep_dir = get_episodes_dir(episode_id)

    # --- STEP 0 ---
    with st.expander("Step 0: Dual-Transcript Intake & Alignment", expanded=False):
        s0_info = steps_state.get("step0_transcript_prep", {})
        st.write(f"**Status:** `{s0_info.get('status', 'pending')}` | **Updated:** `{s0_info.get('updated_at')}`")
        if s0_info.get("logs"):
            st.code(s0_info["logs"], language="text")
        
        alignment_file = ep_dir / "alignment.json"
        if alignment_file.exists():
            with open(alignment_file) as f:
                align_doc = json.load(f)
            sum_data = align_doc.get("summary", {})
            st.metric("Substantive Match Rate", f"{sum_data.get('match_percentage', 0)}%", f"{sum_data.get('matched_segments', 0)} matched / {sum_data.get('unmatched_segments', 0)} unmatched")

        if st.button("Re-run Step 0 (Intake & Alignment)", key="btn_s0"):
            run_step0_prep(episode_id, riverside_path, srt_path, dry_run=dry_run_toggle)
            st.rerun()

    # --- STEP 1 ---
    with st.expander("Step 1: Episode Metadata (OMDb)", expanded=False):
        s1_info = steps_state.get("step1_metadata", {})
        st.write(f"**Status:** `{s1_info.get('status', 'pending')}` | **Updated:** `{s1_info.get('updated_at')}`")
        if s1_info.get("logs"):
            st.code(s1_info["logs"], language="text")

        meta_file = ep_dir / "metadata.json"
        if meta_file.exists():
            with open(meta_file) as f:
                meta_json = json.load(f)
            st.json(meta_json)
        
        c_s1_1, c_s1_2 = st.columns(2)
        if c_s1_1.button("Fetch / Refresh Metadata (OMDb)", key="btn_s1"):
            run_step1_metadata(episode_id, season_val, episode_num_val, dry_run=dry_run_toggle)
            st.rerun()

        with c_s1_2:
            s1_phrase = st.text_input("Confirmation Phrase for Step 1 Live Write", key="phrase_s1", placeholder="PUBLISH TO PRODUCTION")
            if st.button("Push Metadata to Supabase (episodes table)", key="btn_write_s1"):
                if s1_phrase.strip() == "PUBLISH TO PRODUCTION":
                    if is_test_id:
                        st.error("BLOCKED: Test episode IDs cannot write to live database.")
                    else:
                        run_step1_metadata(episode_id, season_val, episode_num_val, dry_run=False, confirm_phrase=s1_phrase)
                        st.success("Metadata pushed to Supabase!")
                        st.rerun()
                else:
                    st.warning("Type 'PUBLISH TO PRODUCTION' exactly to authorize this single write.")

    # --- STEP 2 ---
    with st.expander("Step 2: Host Reviews & Synthesis", expanded=False):
        s2_info = steps_state.get("step2_reviews", {})
        st.write(f"**Status:** `{s2_info.get('status', 'pending')}` | **Updated:** `{s2_info.get('updated_at')}`")
        prov_s2 = s2_info.get("llm_provenance")
        if prov_s2:
            st.caption(f"🧠 **Model Provenance:** Generated with `{prov_s2.get('provider')}` / `{prov_s2.get('model')}` at {prov_s2.get('generated_at')}")

        if s2_info.get("logs"):
            st.code(s2_info["logs"], language="text")

        raw_err_file = ep_dir / "llm_raw_step2_reviews.txt"
        if raw_err_file.exists():
            with open(raw_err_file, "r", encoding="utf-8") as f:
                raw_err_text = f.read()
            if raw_err_text.strip():
                st.error("⚠️ Raw LLM Response (JSON Extraction Failed):")
                st.code(raw_err_text, language="text")

        rev_file = ep_dir / "reviews.json"
        if rev_file.exists():
            with open(rev_file) as f:
                rev_json = json.load(f)
            st.json(rev_json)
            # Run validator live
            v_rev = validate_reviews_data(rev_json, guest_name=guest_val)
            if v_rev["passed"]:
                st.success("✅ Quality Gate: Rating bounds & host coverage verified. No precision drift.")
            else:
                st.error(f"❌ Quality Gate Failed: {v_rev['errors']}")

        c_s2_1, c_s2_2 = st.columns(2)
        if c_s2_1.button("Synthesize Reviews Across 3 Chunks", key="btn_s2"):
            try:
                run_step2_reviews(episode_id, guest_name=guest_val, dry_run=dry_run_toggle, provider=selected_provider, model=clean_active_model)
                st.rerun()
            except Exception as e:
                st.error(f"❌ Step 2 Synthesis Failed: {e}")
                raw_err_file = ep_dir / "llm_raw_step2_reviews.txt"
                if raw_err_file.exists():
                    with open(raw_err_file, "r", encoding="utf-8") as f:
                        raw_err_text = f.read()
                    if raw_err_text.strip():
                        st.error("⚠️ Raw LLM Response:")
                        st.code(raw_err_text, language="text")

        with c_s2_2:
            s2_phrase = st.text_input("Confirmation Phrase for Step 2 Live Write", key="phrase_s2", placeholder="PUBLISH TO PRODUCTION")
            if st.button("Push Host Reviews to Supabase (reviews table)", key="btn_write_s2"):
                if s2_phrase.strip() == "PUBLISH TO PRODUCTION":
                    if is_test_id:
                        st.error("BLOCKED: Test episode IDs cannot write to live database.")
                    else:
                        run_step2_reviews(episode_id, guest_name=guest_val, dry_run=False, confirm_phrase=s2_phrase, provider=selected_provider, model=clean_active_model)
                        st.success("Host reviews pushed to Supabase!")
                        st.rerun()
                else:
                    st.warning("Type 'PUBLISH TO PRODUCTION' exactly to authorize this single write.")

    # --- STEP 3 ---
    with st.expander("Step 3: Transcript Reassembly & Publish", expanded=False):
        s3_info = steps_state.get("step3_transcript_publish", {})
        st.write(f"**Status:** `{s3_info.get('status', 'pending')}` | **Updated:** `{s3_info.get('updated_at')}`")
        if s3_info.get("logs"):
            st.code(s3_info["logs"], language="text")

        tr_file = ep_dir / "transcript.json"
        if tr_file.exists():
            with open(tr_file) as f:
                tr_json = json.load(f)
            st.write(f"**Total Words:** {tr_json.get('word_count'):,} | **Sections:** {len(tr_json.get('sections', []))}")
            # Editable section headings preview
            sec_headings = []
            for s_i, sec in enumerate(tr_json.get("sections", [])):
                h_val = st.text_input(f"Section {s_i+1} Heading ({sec.get('id')})", value=sec.get("heading"), key=f"head_sec_{s_i}")
                sec_headings.append(h_val)

        c_s3_1, c_s3_2 = st.columns(2)
        if c_s3_1.button("Reassemble & Validate Transcript", key="btn_s3"):
            run_step3_transcript(episode_id, publish=False, dry_run=dry_run_toggle)
            st.rerun()

        with c_s3_2:
            s3_phrase = st.text_input("Confirmation Phrase for Step 3 Live Write", key="phrase_s3", placeholder="PUBLISH TO PRODUCTION")
            if st.button("Publish Transcript to Supabase (episode_transcripts)", key="btn_write_s3"):
                if s3_phrase.strip() == "PUBLISH TO PRODUCTION":
                    if is_test_id:
                        st.error("BLOCKED: Test episode IDs cannot write to live database.")
                    else:
                        run_step3_transcript(episode_id, publish=True, dry_run=False)
                        st.success("Transcript published to Supabase!")
                        st.rerun()
                else:
                    st.warning("Type 'PUBLISH TO PRODUCTION' exactly to authorize this single write.")

    # --- STEP 4 ---
    with st.expander("Step 4: Episode Thumbnail (Fandom / Cloudinary)", expanded=False):
        s4_info = steps_state.get("step4_thumbnails", {})
        st.write(f"**Status:** `{s4_info.get('status', 'pending')}` | **Updated:** `{s4_info.get('updated_at')}`")
        if s4_info.get("logs"):
            st.code(s4_info["logs"], language="text")

        th_file = ep_dir / "thumbnail.json"
        if th_file.exists():
            with open(th_file) as f:
                th_json = json.load(f)
            st.json(th_json)
            st.caption("Convention: YouTube thumbnail retained for Episodes page; Cloudinary URL stored for Reviews section only.")

        c_s4_1, c_s4_2 = st.columns(2)
        if c_s4_1.button("Scrape Fandom & Mock Cloudinary (Dry Run)", key="btn_s4"):
            run_step4_thumbnails(episode_id, episode_title=episode_title, season=season_val, dry_run=dry_run_toggle)
            st.rerun()

        with c_s4_2:
            s4_phrase = st.text_input("Confirmation Phrase for Step 4 Live Write", key="phrase_s4", placeholder="PUBLISH TO PRODUCTION")
            if st.button("Update Thumbnail in Supabase (episodes table)", key="btn_write_s4"):
                if s4_phrase.strip() == "PUBLISH TO PRODUCTION":
                    if is_test_id:
                        st.error("BLOCKED: Test episode IDs cannot write to live database.")
                    else:
                        run_step4_thumbnails(episode_id, episode_title=episode_title, season=season_val, dry_run=False)
                        st.success("Thumbnail record updated in Supabase!")
                        st.rerun()
                else:
                    st.warning("Type 'PUBLISH TO PRODUCTION' exactly to authorize this single write.")

    # --- STEP 6b ---
    with st.expander("Step 6b: Chapter Derivation (from alignment.json)", expanded=False):
        s6b_info = steps_state.get("step6b_chapters", {})
        st.write(f"**Status:** `{s6b_info.get('status', 'pending')}` | **Updated:** `{s6b_info.get('updated_at')}`")
        prov_s6b = s6b_info.get("llm_provenance")
        if prov_s6b:
            st.caption(f"🧠 **Model Provenance:** Generated with `{prov_s6b.get('provider')}` / `{prov_s6b.get('model')}` at {prov_s6b.get('generated_at')}")
        if s6b_info.get("logs"):
            st.code(s6b_info["logs"], language="text")

        chap_file = ep_dir / "chapters.txt"
        chap_content = ""
        if chap_file.exists():
            with open(chap_file) as f:
                chap_content = f.read()
            new_chap = st.text_area("Proposed YouTube Chapters (00:00 start, strictly ascending)", value=chap_content, height=180, key="txt_chapters")
            if new_chap != chap_content:
                with open(chap_file, "w") as f:
                    f.write(new_chap)
                chap_content = new_chap

        if st.button("Derive Chapters from Alignment (Confidence >= 0.9)", key="btn_s6b"):
            run_step6b_chapters(episode_id, dry_run=dry_run_toggle, provider=selected_provider, model=clean_active_model)
            st.rerun()

    # --- STEP 5 ---
    with st.expander("Step 5: YouTube Title & Description", expanded=False):
        s5_info = steps_state.get("step5_youtube", {})
        st.write(f"**Status:** `{s5_info.get('status', 'pending')}` | **Updated:** `{s5_info.get('updated_at')}`")
        prov_s5 = s5_info.get("llm_provenance")
        if prov_s5:
            st.caption(f"🧠 **Model Provenance:** Generated with `{prov_s5.get('provider')}` / `{prov_s5.get('model')}` at {prov_s5.get('generated_at')}")

        if s5_info.get("logs"):
            st.code(s5_info["logs"], language="text")

        raw_err_file_s5 = ep_dir / "llm_raw_step5_youtube.txt"
        if raw_err_file_s5.exists():
            with open(raw_err_file_s5, "r", encoding="utf-8") as f:
                raw_err_text_s5 = f.read()
            if raw_err_text_s5.strip():
                st.error("⚠️ Raw LLM Response (Generation/Formatting Failed):")
                st.code(raw_err_text_s5, language="text")

        yt_file = ep_dir / "youtube_description.txt"
        yt_content = ""
        if yt_file.exists():
            with open(yt_file) as f:
                yt_content = f.read()
            new_desc = st.text_area("Publish-Ready YouTube Description (editable)", value=yt_content, height=260, key="txt_yt_desc")
            if new_desc != yt_content:
                with open(yt_file, "w") as f:
                    f.write(new_desc)
                yt_content = new_desc

            # Run validator live on text area content
            v_yt = validate_youtube_description(yt_content)
            if v_yt["passed"]:
                st.success("✅ Quality Gate: 0 em/en/double-hyphen dashes, straight quotes only, 2-5 hashtags, zero banned words.")
            else:
                st.error(f"❌ Quality Gate Errors: {v_yt['errors']}")
            if v_yt["warnings"]:
                st.warning(f"⚠️ Quality Gate Warnings: {v_yt['warnings']}")

        if st.button("Generate Description with Injected Chapters", key="btn_s5"):
            try:
                run_step5_youtube(episode_id, guest_name=guest_val, dry_run=dry_run_toggle, provider=selected_provider, model=clean_active_model)
                st.rerun()
            except Exception as e:
                st.error(f"❌ Step 5 Failed: {e}")
                raw_err_file_s5 = ep_dir / "llm_raw_step5_youtube.txt"
                if raw_err_file_s5.exists():
                    with open(raw_err_file_s5, "r", encoding="utf-8") as f:
                        raw_err_text_s5 = f.read()
                    if raw_err_text_s5.strip():
                        st.error("⚠️ Raw LLM Response:")
                        st.code(raw_err_text_s5, language="text")

    # --- STEP 6 ---
    with st.expander("Step 6: Fake Credit Scroll", expanded=False):
        s6_info = steps_state.get("step6_credits", {})
        st.write(f"**Status:** `{s6_info.get('status', 'pending')}` | **Updated:** `{s6_info.get('updated_at')}`")
        prov_s6 = s6_info.get("llm_provenance")
        if prov_s6:
            st.caption(f"🧠 **Model Provenance:** Generated with `{prov_s6.get('provider')}` / `{prov_s6.get('model')}` at {prov_s6.get('generated_at')}")

        if s6_info.get("logs"):
            st.code(s6_info["logs"], language="text")

        raw_err_file_s6 = ep_dir / "llm_raw_step6_credits.txt"
        if raw_err_file_s6.exists():
            with open(raw_err_file_s6, "r", encoding="utf-8") as f:
                raw_err_text_s6 = f.read()
            if raw_err_text_s6.strip():
                st.error("⚠️ Raw LLM Response (Generation/Formatting Failed):")
                st.code(raw_err_text_s6, language="text")

        cr_file = ep_dir / "credits.md"
        cr_content = ""
        if cr_file.exists():
            with open(cr_file) as f:
                cr_content = f.read()
            new_cr = st.text_area("Credits Markdown (editable)", value=cr_content, height=280, key="txt_cr_desc")
            if new_cr != cr_content:
                with open(cr_file, "w") as f:
                    f.write(new_cr)
                cr_content = new_cr

            # Run validator live on text area content
            v_cr = validate_credit_scroll(cr_content, podcast_episode_number=podcast_num_val)
            if v_cr["passed"] and not v_cr["warnings"]:
                st.success("✅ Quality Gate: 0 digits in scroll body, countdown verified, disclaimers present, tier item counts in range.")
            else:
                if v_cr["errors"]:
                    st.error(f"❌ Quality Gate Errors: {v_cr['errors']}")
                if v_cr["warnings"]:
                    st.warning(f"⚠️ Quality Gate Warnings: {v_cr['warnings']}")

        if st.button("Generate Credit Scroll (Spelled-Out Typography)", key="btn_s6"):
            try:
                run_step6_credits(episode_id, podcast_episode_number=podcast_num_val, guest_name=guest_val, dry_run=dry_run_toggle, provider=selected_provider, model=clean_active_model)
                st.rerun()
            except Exception as e:
                st.error(f"❌ Step 6 Failed: {e}")
                raw_err_file_s6 = ep_dir / "llm_raw_step6_credits.txt"
                if raw_err_file_s6.exists():
                    with open(raw_err_file_s6, "r", encoding="utf-8") as f:
                        raw_err_text_s6 = f.read()
                    if raw_err_text_s6.strip():
                        st.error("⚠️ Raw LLM Response:")
                        st.code(raw_err_text_s6, language="text")

    # --- STEP 7 ---
    with st.expander("Step 7: Podcast Feed Sync", expanded=False):
        s7_info = steps_state.get("step7_feed_sync", {})
        st.write(f"**Status:** `{s7_info.get('status', 'pending')}` | **Updated:** `{s7_info.get('updated_at')}`")
        if s7_info.get("logs"):
            st.code(s7_info["logs"], language="text")

        feed_file = ep_dir / "feed_sync.json"
        if feed_file.exists():
            with open(feed_file) as f:
                feed_json = json.load(f)
            st.json(feed_json)
            st.info("🛡️ Semantic Check: Canonical RSS.com episode page URL preserved. Player embed iframe protected.")

        if st.button("Run Feed Sync Check", key="btn_s7"):
            run_step7_feed_sync(episode_id, season=season_val, episode_number=episode_num_val, dry_run=dry_run_toggle)
            st.rerun()

    # 5. Global Production Publish Replay Modal
    st.markdown("---")
    st.subheader("4. Global Production Publish Gate")
    st.caption("Replays all approved gated writes in order behind one phrase confirmation. Lists every write before executing.")
    
    st.markdown("""
    **Writes that will be performed in sequence:**
    1. `episodes` table: Push OMDb metadata (Step 1)
    2. `reviews` table: Upsert host reviews with normalized scores & verbatim notes; exclude guest (Step 2)
    3. `episode_transcripts` table: Publish reassembled transcript with timestamp (Step 3)
    4. `episodes` table: Update review section thumbnail URL from Cloudinary (Step 4)
    5. `episodes` table: Verify podcast URL, preserving canonical player URL (Step 7)
    """)

    global_phrase = st.text_input("Type confirmation phrase to authorize ALL writes above:", placeholder="PUBLISH TO PRODUCTION", key="global_publish_phrase")
    
    if st.button("🚨 EXECUTE ALL PRODUCTION PUBLISHES IN SEQUENCE", type="primary", use_container_width=True):
        if global_phrase.strip() != "PUBLISH TO PRODUCTION":
            st.warning("Confirmation phrase mismatch. Type 'PUBLISH TO PRODUCTION' exactly to proceed.")
        elif is_test_id:
            st.error(f"BLOCKED: Episode ID '{episode_id}' is a test fixture. Live writes are permanently locked out.")
        else:
            with st.spinner("Executing full production publish replay..."):
                try:
                    # 1. Step 1 live
                    run_step1_metadata(episode_id, season_val, episode_num_val, dry_run=False, confirm_phrase=global_phrase)
                    # 2. Step 2 live
                    run_step2_reviews(episode_id, guest_name=guest_val, dry_run=False, confirm_phrase=global_phrase, provider=selected_provider, model=clean_active_model)
                    # 3. Step 3 live
                    run_step3_transcript(episode_id, publish=True, dry_run=False)
                    # 4. Step 4 live
                    run_step4_thumbnails(episode_id, episode_title=episode_title, season=season_val, dry_run=False)
                    # 5. Step 7 live
                    run_step7_feed_sync(episode_id, season=season_val, episode_number=episode_num_val, dry_run=False)
                    st.success("🏆 ALL PRODUCTION WRITES COMPLETED SUCCESSFULLY!")
                    st.rerun()
                except Exception as e:
                    st.error(f"Global publish aborted on error: {e}")
