"""
app.py — Local Streamlit GUI for the Family Guy Guys review pipeline.

Run:
    streamlit run app.py
"""
import json
import streamlit as st

import config
from omdb_fetch import fetch_episode_metadata, map_to_episodes_row, upsert_episode
from llm_client import generate_review_json
from supabase_upsert import build_review_rows, upsert_reviews

st.set_page_config(page_title="Family Guy Guys — Review Pipeline", layout="wide")
st.title("🐔 Family Guy Guys — Review Pipeline")

tab1, tab2 = st.tabs(["1. Episode Metadata (OMDb)", "2. Generate & Push Review"])

with tab1:
    st.header("Backfill episode metadata from OMDb")
    col1, col2, col3 = st.columns(3)
    season = col1.number_input("Season", min_value=1, value=1)
    episode = col2.number_input("Episode", min_value=1, value=1)
    episode_id = col3.text_input("Episode ID (e.g. s1e4)", value="")

    if st.button("Fetch from OMDb"):
        try:
            data = fetch_episode_metadata(season, episode)
            row = map_to_episodes_row(episode_id, season, episode, data)
            st.session_state["episode_row"] = row
            st.json(row)
        except Exception as e:
            st.error(str(e))

    if "episode_row" in st.session_state:
        if st.button("Push episode metadata to Supabase"):
            upsert_episode(st.session_state["episode_row"])
            st.success("Episode metadata pushed to Supabase.")

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
            except Exception as e:
                st.error(str(e))

    if "review_json" in st.session_state:
        st.subheader("Preview / Edit")
        edited = st.text_area("Review JSON (editable)",
                               value=json.dumps(st.session_state["review_json"], indent=2),
                               height=400)
        if st.button("Push review to Supabase"):
            try:
                review_data = json.loads(edited)
                rows = build_review_rows(review_data)
                upsert_reviews(rows)
                st.success(f"Pushed {len(rows)} review row(s) to Supabase.")
            except Exception as e:
                st.error(str(e))
