# Family Guy Guys — Review Pipeline

Automated, repeatable pipeline to turn Riverside transcripts into published
Letterboxd-style episode reviews in your Supabase database.

## Components

1. `omdb_fetch.py` — Pulls episode metadata (title, air date, runtime,
   director, writers, cast, IMDb rating, plot) from OMDb and upserts into
   the `episodes` table.
2. `transcript_review_skill.md` — Provider-agnostic prompt + JSON schema.
   Paste into ANY LLM (Gemini, GPT, Claude, Perplexity) along with a
   transcript to get back structured review JSON. This is the portable
   "skill file" — no code dependency, works in any chat UI or API call.
3. `llm_client.py` — Thin adapter so `app.py` / `generate_review.py` can
   call Gemini, OpenAI, or Anthropic interchangeably by changing one
   config value.
4. `generate_review.py` — CLI: feed it a transcript file + episode id,
   it calls the skill prompt via your chosen LLM provider and prints/saves
   the resulting JSON.
5. `supabase_upsert.py` — Takes the review JSON (from `generate_review.py`
   or hand-edited) and upserts rows into `reviews`, tagging
   `draft_source='transcript'`.
6. `app.py` — Local Streamlit GUI: upload transcript, pick episode, preview/
   edit generated JSON inline, fetch episode thumbnails, and push to Supabase.
7. `thumbnail_service.py` — Service for querying Fandom Wiki for lead images,
   uploading them to Cloudinary, and updating episode thumbnail records.
8. `scrape-thumbnails.mjs` — Node.js script: batches scraping of Fandom Wiki
   thumbnails across all Family Guy episodes, uploads to Cloudinary, and outputs
   `episode-manifest.json` & `scrape-errors.json`.
9. `upsert-thumbnails.mjs` — Node.js script: reads `episode-manifest.json` and
   upserts thumbnail URLs directly into Supabase `episodes`.
10. `config.py` — Central place for API keys, Supabase credentials, Cloudinary
    settings, and cohost UUID map. Reads from `.env`.
11. `.env.example` — Template for your local `.env` file.

## Setup

```bash
# Python Environment
python3 -m venv venv
source venv/bin/activate
pip install -r requirements.txt

# Node Environment (for .mjs scripts)
npm install

cp .env.example .env
# fill in .env with your real Supabase, LLM, OMDb, and Cloudinary keys
```

## Workflow

```bash
# 1. Backfill episode metadata (run once per episode)
python omdb_fetch.py --season 1 --episode 4 --episode-id s1e4

# 2. Episode Thumbnails (Fandom Wiki -> Cloudinary -> Supabase)
# Option A: Batch scrape and upload via Node script
node scrape-thumbnails.mjs
node upsert-thumbnails.mjs

# Option B: Database-driven batch importer (from repo root)
node scripts/import-episode-thumbnails.mjs

# 3. Generate a review draft from a transcript (repeatable, swap --provider)
python generate_review.py --transcript s1e4fagugu-end.txt --episode-id s1e4 --provider gemini --out s1e4_review.json

# 4. Review/edit the JSON output by hand if needed, then push to Supabase
python supabase_upsert.py --review-json s1e4_review.json

# OR run the GUI to manage Metadata, Reviews, and Thumbnails all in one place:
./run-admin.sh
```

## Episode Mission Control

Episode Mission Control is a unified, single-screen dashboard embedded as the primary tab (`🚀 Episode Mission Control`) in the Streamlit application. It coordinates the entire per-episode publishing pipeline from one place:

- **Dual-Transcript Intake & Alignment (Step 0)**: Ingests raw Riverside transcript and final-edit DaVinci Whisper SRT, splits into 3 speaker-aligned sections, and runs monotonic dynamic programming alignment with `unmatched` tracking.
- **OMDb Metadata Backfill (Step 1)**: Pulls official show data, runtime, director, cast, and IMDb ratings.
- **Host Reviews Extraction (Step 2)**: Extracts host scores and review quotes across transcript chunks with guest isolation.
- **Structured Transcript Publishing (Step 3)**: Reassembles 3 sections, reconciles boundary timestamps, and validates against `EpisodeTranscriptModel`.
- **Review Thumbnail Sync (Step 4)**: Queries Fandom Wiki MediaWiki API and uploads to Cloudinary for the review card.
- **Chapters & Description (Steps 6b & 5)**: Derives 5–10 strictly ascending chapters anchored to published SRT timecodes, then generates YouTube description with hashtags and metadata.
- **Fake Credit Scroll (Step 6)**: Generates 4-tier fake credits with spelled-out numbers (0 digits in body) and show banter.
- **RSS Feed Sync (Step 7)**: Validates and updates episode feed details while preserving canonical player audio URLs.

### Launching Mission Control

```bash
cd admin-tools
./run-admin.sh
```
Or directly via Streamlit:
```bash
cd admin-tools
PYTHONPATH=. ./venv/bin/streamlit run app.py
```

### Safety & Change Control

1. **Dry-Run-First Architecture**:
   - The UI defaults to **Mode: DRY RUN**. All API generations, diffs, and artifacts are created locally under `episodes/<episode_id>/` without altering Supabase.
   - Test fixtures (`s02e99`, `s01e99`, or IDs matching `*_test`) are permanently locked to dry-run mode via `assert_safe_publish`.
2. **`PUBLISH TO PRODUCTION` Confirmation Gate**:
   - Live database writes cannot be executed accidentally.
   - Each step write and the global publish replay modal require explicitly typing the confirmation phrase `PUBLISH TO PRODUCTION`.
3. **Automated Machine Quality Gates**:
   - Built-in validators (`pipeline/validators.py`) enforce typography (zero digits in credit scroll bodies), YouTube description format (valid timestamps, hashtag count, no em-dashes), and host score integrity before publishing.

## Streamlit GUI Tabs

- **Tab 0: 🚀 Episode Mission Control**: Unified pipeline checklist, dual transcript intake, "Run All" pipeline execution, and gated publishing.
- **Tab 1: Episode Metadata (OMDb)**: Look up season/episode on OMDb and push metadata to `episodes`.
- **Tab 2: Generate & Push Review**: Ingest Riverside transcripts, call LLM (`gemini-3.7-flash`, `openai`, or `anthropic`), edit review JSON, and upsert to `reviews`.
- **Tab 3: Episode Thumbnails**: Fetch lead images from Fandom Wiki, preview them live, upload to Cloudinary, and sync to Supabase (single episode or batch `episode-manifest.json`).

## Switching LLM providers

Change `LLM_PROVIDER` in `.env` to `gemini`, `openai`, or `anthropic`.
`llm_client.py` handles the rest — same skill prompt, same JSON schema,
different backend. Default model is `gemini-3.7-flash`.

## Cohost UUID Map (hardcoded reference, update if hosts change)

| Name   | UUID                                   |
|--------|-----------------------------------------|
| Jason  | 01201e1a-dafd-424a-b596-ff9ece65f1aa    |
| Collin | 0a3dfd13-90b2-47db-b0af-2e0c0df21cff    |
| Tyler  | e08c8c4b-ecf5-427e-8890-fe9cef0a2c9a    |
