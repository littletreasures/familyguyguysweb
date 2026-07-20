"""
app.py — Local Streamlit GUI for the Family Guy Guys review pipeline.

Run safely via:
    ./run-admin.sh
    OR: streamlit run app.py --server.address 127.0.0.1
"""
import json
import streamlit as st

import config
from omdb_fetch import fetch_episode_metadata, map_to_episodes_row, upsert_episode
from llm_client import generate_review_json
from supabase_upsert import build_review_rows, upsert_reviews
from validation import validate_episode_dict, log_audit_event

st.set_page_config(page_title="Family Guy Guys — Review Pipeline", layout="wide")
st.title("🐔 Family Guy Guys — Review Pipeline")

# Target Environment Indicator
env_name = config.ENVIRONMENT.upper()
if config.ENVIRONMENT == "production":
    st.error(f"🔴 TARGET ENVIRONMENT: {env_name} (PRODUCTION DATABASE WBITES ENABLED)")
else:
    st.info(f"🟢 TARGET ENVIRONMENT: {env_name} (DEVELOPMENT / LOCAL STAGING)")

# Credential Status Notice
if not config.SUPABASE_URL or not config.SUPABASE_SERVICE_KEY:
    st.warning("⚠️ SUPABASE_URL or SUPABASE_SERVICE_KEY missing in admin-tools/.env. Database write actions will fail closed.")

tab1, tab2 = st.tabs(["1. Episode Metadata (OMDb)", "2. Generate & Push Review"])

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

