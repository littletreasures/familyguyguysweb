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
   edit generated JSON inline, click "Push to Supabase."
7. `config.py` — Central place for API keys, Supabase credentials, cohost
   UUID map. Reads from `.env` — never hardcode secrets.
8. `.env.example` — Template for your local `.env` file.

## Setup

```bash
pip install requests supabase python-dotenv streamlit google-generativeai openai anthropic
cp .env.example .env
# fill in .env with your real keys
```

## Workflow

```bash
# 1. Backfill episode metadata (run once per episode)
python omdb_fetch.py --season 1 --episode 4 --episode-id s1e4

# 2. Generate a review draft from a transcript (repeatable, swap --provider)
python generate_review.py --transcript s1e4fagugu-end.txt --episode-id s1e4 --provider gemini --out s1e4_review.json

# 3. Review/edit the JSON output by hand if needed, then push to Supabase
python supabase_upsert.py --review-json s1e4_review.json

# OR just run the GUI and do all of the above in one place:
streamlit run app.py
```

## Switching LLM providers

Change `LLM_PROVIDER` in `.env` to `gemini`, `openai`, or `anthropic`.
`llm_client.py` handles the rest — same skill prompt, same JSON schema,
different backend. No other code changes needed.

## Cohost UUID Map (hardcoded reference, update if hosts change)

| Name   | UUID                                   |
|--------|-----------------------------------------|
| Jason  | 01201e1a-dafd-424a-b596-ff9ece65f1aa    |
| Collin | 0a3dfd13-90b2-47db-b0af-2e0c0df21cff    |
| Tyler  | e08c8c4b-ecf5-427e-8890-fe9cef0a2c9a    |
