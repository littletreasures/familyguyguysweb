"""
app.py — Local Streamlit GUI for the Family Guy Guys review pipeline.

Run safely via:
    ./run-admin.sh
    OR: streamlit run app.py --server.address 127.0.0.1
"""
import json
import os
import streamlit as st

import config
from omdb_fetch import fetch_episode_metadata, map_to_episodes_row, upsert_episode
from llm_client import generate_review_json
from supabase_upsert import build_review_rows, upsert_reviews
from validation import validate_episode_dict, log_audit_event
from thumbnail_service import (
    fetch_fandom_thumbnail,
    upload_thumbnail_to_cloudinary,
    update_episode_thumbnail_record,
    load_manifest_data,
    sync_manifest_to_supabase,
)

from mission_control import render_mission_control

st.set_page_config(page_title="Family Guy Guys — Mission Control", layout="wide")
st.title("🐔 Family Guy Guys — Production Admin Tools")

# Credential Status Notice
if not config.SUPABASE_URL or not config.SUPABASE_SERVICE_KEY:
    st.warning("⚠️ SUPABASE_URL or SUPABASE_SERVICE_KEY missing in admin-tools/.env. Database write actions will fail closed.")

tab0, tab1, tab2, tab3 = st.tabs([
    "🚀 Episode Mission Control",
    "1. Episode Metadata (OMDb)",
    "2. Generate & Push Review",
    "3. Episode Thumbnails"
])

with tab0:
    render_mission_control()

with tab1:
    st.header("Backfill episode metadata from OMDb")
    col1, col2, col3 = st.columns(3)
    season = col1.number_input("Season", min_value=1, value=1)
    episode = col2.number_input("Episode", min_value=1, value=1)
    episode_id = col3.text_input("Episode ID (e.g. s1e4)", value="")
    youtube_url = st.text_input("YouTube URL (optional)", value="")

    if st.button("Fetch from OMDb"):
        try:
            data = fetch_episode_metadata(season, episode)
            row = map_to_episodes_row(episode_id, season, episode, data, youtube_url=youtube_url)
            st.session_state["episode_row"] = row
            st.json(row)
            log_audit_event("GUI_FETCH_OMDB", episode_id, "SUCCESS")
        except Exception as e:
            st.error(str(e))
            log_audit_event("GUI_FETCH_OMDB", episode_id or "UNKNOWN", "FAILED", str(e))

    if "episode_row" in st.session_state:
        st.subheader("Human Review & Target Confirmation")
        st.warning("Production database writes require explicit confirmation.")
        confirm_text = st.text_input("Type 'PUBLISH TO PRODUCTION' to confirm write action:", value="", key="confirm_ep")
        
        is_dry_run = st.checkbox("Dry Run (Preview without writing to database)", value=False, key="dry_run_ep")

        if st.button("Push episode metadata to Supabase"):
            if not is_dry_run and confirm_text.strip() != "PUBLISH TO PRODUCTION":
                st.error("Operation rejected: You must type 'PUBLISH TO PRODUCTION' to authorize database updates.")
            else:
                try:
                    validated_row = validate_episode_dict(st.session_state["episode_row"])
                    upsert_episode(validated_row, dry_run=is_dry_run)
                    if is_dry_run:
                        st.info("Dry run complete. No database changes were made.")
                    else:
                        st.success("Episode metadata successfully pushed to Supabase.")
                except Exception as e:
                    st.error(f"Validation / Write Error: {e}")

with tab2:
    st.header("Generate review from transcript")
    provider = st.selectbox("LLM Provider", ["gemini", "openai", "anthropic"],
                             index=["gemini", "openai", "anthropic"].index(config.LLM_PROVIDER))
    ep_id = st.text_input("Episode ID for review", value="")
    ep_title = st.text_input("Episode title (optional)", value="")
    uploaded = st.file_uploader("Upload transcript (.txt)", type=["txt"])

    if uploaded and st.button("Generate review JSON"):
        config.LLM_PROVIDER = provider
        transcript_text = uploaded.read().decode("utf-8")
        with st.spinner("Calling LLM..."):
            try:
                result = generate_review_json(ep_id, ep_title, transcript_text)
                st.session_state["review_json"] = result
                log_audit_event("GUI_GENERATE_LLM", ep_id, "SUCCESS", f"Provider={provider}")
            except Exception as e:
                st.error(str(e))
                log_audit_event("GUI_GENERATE_LLM", ep_id or "UNKNOWN", "FAILED", str(e))

    if "review_json" in st.session_state:
        st.subheader("Human Review & JSON Schema Validation")
        edited = st.text_area("Review JSON (editable draft)",
                               value=json.dumps(st.session_state["review_json"], indent=2),
                               height=400)
        
        confirm_review_text = st.text_input("Type 'PUBLISH TO PRODUCTION' to confirm review write action:", value="", key="confirm_rev")
        is_dry_run_rev = st.checkbox("Dry Run (Preview review rows without writing)", value=False, key="dry_run_rev")

        if st.button("Push review to Supabase"):
            if not is_dry_run_rev and confirm_review_text.strip() != "PUBLISH TO PRODUCTION":
                st.error("Operation rejected: You must type 'PUBLISH TO PRODUCTION' to authorize database updates.")
            else:
                try:
                    review_data = json.loads(edited)
                    rows = build_review_rows(review_data)
                    upsert_reviews(rows, dry_run=is_dry_run_rev)
                    if is_dry_run_rev:
                        st.info("Dry run complete. No review rows were written.")
                    else:
                        st.success(f"Pushed {len(rows)} validated review row(s) to Supabase.")
                except Exception as e:
                    st.error(f"Validation / Write Error: {e}")

with tab3:
    st.header("Fetch & Upload Episode Thumbnails (Fandom / Cloudinary)")

    c_name = getattr(config, "CLOUDINARY_CLOUD_NAME", os.getenv("CLOUDINARY_CLOUD_NAME", "")).strip()
    c_key = getattr(config, "CLOUDINARY_API_KEY", os.getenv("CLOUDINARY_API_KEY", "")).strip()
    c_secret = getattr(config, "CLOUDINARY_API_SECRET", os.getenv("CLOUDINARY_API_SECRET", "")).strip()

    if not c_name or not c_key or not c_secret:
        st.warning("⚠️ CLOUDINARY credentials not fully configured in admin-tools/.env. Uploads to Cloudinary require CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY, and CLOUDINARY_API_SECRET.")

    st.subheader("A. Single Episode Thumbnail Scrape & Upload")
    st.markdown("Scrapes the lead image from the Family Guy Fandom Wiki, uploads to Cloudinary, and updates Supabase.")
    col1, col2 = st.columns(2)
    thumb_ep_id = col1.text_input("Episode ID (e.g. s1e7)", value="", key="thumb_ep_id")
    thumb_ep_title = col2.text_input("Episode Title (e.g. Brian: Portrait of a Dog)", value="", key="thumb_ep_title")

    if st.button("Fetch Thumbnail from Fandom Wiki"):
        if not thumb_ep_title.strip():
            st.error("Please provide an episode title to search the Fandom Wiki.")
        else:
            try:
                with st.spinner("Querying Fandom Wiki API..."):
                    thumb_data = fetch_fandom_thumbnail(thumb_ep_title)
                    st.session_state["fandom_thumbnail"] = thumb_data
                    st.success(f"Found lead image for '{thumb_data['fandom_page']}'")
            except Exception as e:
                st.error(str(e))

    if "fandom_thumbnail" in st.session_state:
        f_thumb = st.session_state["fandom_thumbnail"]
        st.markdown(f"**Fandom Page Title:** `{f_thumb.get('fandom_page')}`")
        if f_thumb.get("source_url"):
            st.image(f_thumb.get("source_url"), caption=f"Fandom Lead Image: {f_thumb.get('fandom_page')}", width=400)
            st.code(f_thumb.get("source_url"), language="text")

        st.subheader("Upload to Cloudinary & Save to Supabase")
        confirm_thumb_text = st.text_input("Type 'PUBLISH TO PRODUCTION' to confirm write action:", value="", key="confirm_thumb")
        is_dry_run_thumb = st.checkbox("Dry Run (Preview upload & update without database write)", value=False, key="dry_run_thumb")

        if st.button("Upload to Cloudinary & Update Supabase"):
            if not is_dry_run_thumb and confirm_thumb_text.strip() != "PUBLISH TO PRODUCTION":
                st.error("Operation rejected: You must type 'PUBLISH TO PRODUCTION' to authorize database updates.")
            elif not thumb_ep_id.strip():
                st.error("Episode ID is required to bind the thumbnail.")
            else:
                try:
                    with st.spinner("Uploading to Cloudinary and updating Supabase..."):
                        if is_dry_run_thumb:
                            res = update_episode_thumbnail_record(
                                episode_id=thumb_ep_id,
                                thumbnail_url=f_thumb["source_url"],
                                thumbnail_source_url=f_thumb["source_url"],
                                dry_run=True,
                            )
                            st.info(f"Dry run preview: {res}")
                        else:
                            c_res = upload_thumbnail_to_cloudinary(
                                source_url=f_thumb["source_url"],
                                episode_id=thumb_ep_id,
                                title=thumb_ep_title,
                            )
                            st.success(f"Uploaded to Cloudinary: {c_res['secure_url']}")
                            db_res = update_episode_thumbnail_record(
                                episode_id=thumb_ep_id,
                                thumbnail_url=c_res["secure_url"],
                                thumbnail_public_id=c_res["public_id"],
                                thumbnail_source_url=f_thumb["source_url"],
                                dry_run=False,
                            )
                            st.success(f"Successfully updated Supabase episode '{thumb_ep_id}' with thumbnail.")
                except Exception as e:
                    st.error(f"Upload / Update Error: {e}")

    st.markdown("---")
    st.subheader("B. Batch Thumbnail Manifest (`episode-manifest.json`)")
    st.markdown("Load and sync manifest files produced by `scrape-thumbnails.mjs`.")

    if st.button("Load Local Manifest File"):
        try:
            m_data = load_manifest_data()
            st.session_state["manifest_data"] = m_data
            st.info(f"Loaded manifest with {len(m_data)} episodes.")
        except Exception as e:
            st.error(str(e))

    if "manifest_data" in st.session_state:
        m_data = st.session_state["manifest_data"]
        sample_items = dict(list(m_data.items())[:5])
        st.json(sample_items)
        st.caption(f"Showing preview of first 5 out of {len(m_data)} total items.")

        confirm_manifest = st.text_input("Type 'PUBLISH TO PRODUCTION' to confirm batch manifest sync:", value="", key="confirm_manifest")
        is_dry_run_manifest = st.checkbox("Dry Run (Preview manifest sync without writing)", value=False, key="dry_run_manifest")

        if st.button("Sync Manifest to Supabase"):
            if not is_dry_run_manifest and confirm_manifest.strip() != "PUBLISH TO PRODUCTION":
                st.error("Operation rejected: You must type 'PUBLISH TO PRODUCTION' to authorize database updates.")
            else:
                try:
                    with st.spinner("Syncing manifest to Supabase..."):
                        res = sync_manifest_to_supabase(m_data, dry_run=is_dry_run_manifest)
                        if is_dry_run_manifest:
                            st.info(f"Dry run complete: {res}")
                        else:
                            st.success(f"Successfully synced {res['updated']} episode thumbnail(s). Errors: {len(res['errors'])}")
                except Exception as e:
                    st.error(f"Manifest Sync Error: {e}")


