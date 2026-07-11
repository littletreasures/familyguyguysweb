"""Central config: loads .env, exposes constants used across the pipeline."""
import os
from dotenv import load_dotenv

load_dotenv()

LLM_PROVIDER = os.getenv("LLM_PROVIDER", "gemini").lower()

GEMINI_API_KEY = os.getenv("GEMINI_API_KEY", "")
GEMINI_MODEL = os.getenv("GEMINI_MODEL", "gemini-1.5-pro")

OPENAI_API_KEY = os.getenv("OPENAI_API_KEY", "")
OPENAI_MODEL = os.getenv("OPENAI_MODEL", "gpt-4o")

ANTHROPIC_API_KEY = os.getenv("ANTHROPIC_API_KEY", "")
ANTHROPIC_MODEL = os.getenv("ANTHROPIC_MODEL", "claude-3-5-sonnet-20241022")

OMDB_API_KEY = os.getenv("OMDB_API_KEY", "")
OMDB_BASE_URL = "http://www.omdbapi.com/"
SHOW_TITLE = "Family Guy"

SUPABASE_URL = os.getenv("SUPABASE_URL", "https://tupubifayvovrzqyemee.supabase.co")
SUPABASE_SERVICE_KEY = os.getenv("SUPABASE_SERVICE_KEY", "")

# Cohost name -> UUID map (update here if hosts/UUIDs change)
COHOST_UUIDS = {
    "Jason": "01201e1a-dafd-424a-b596-ff9ece65f1aa",
    "Collin": "0a3dfd13-90b2-47db-b0af-2e0c0df21cff",
    "Tyler": "e08c8c4b-ecf5-427e-8890-fe9cef0a2c9a",
}

SKILL_FILE_PATH = os.path.join(os.path.dirname(__file__), "transcript_review_skill.md")
