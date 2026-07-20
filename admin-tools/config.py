"""Central config: loads server environment variables, exposes constants used across the admin pipeline."""
import os
import sys
from pathlib import Path
from dotenv import load_dotenv

# Load server-only environment: current directory .env or admin-tools/.env only
load_dotenv(Path(__file__).parent / ".env")

ENVIRONMENT = os.getenv("ENVIRONMENT", "development").lower()
LLM_PROVIDER = os.getenv("LLM_PROVIDER", "gemini").lower()

GEMINI_API_KEY = os.getenv("GEMINI_API_KEY", "")
GEMINI_MODEL = os.getenv("GEMINI_MODEL", "gemini-1.5-pro")

OPENAI_API_KEY = os.getenv("OPENAI_API_KEY", "")
OPENAI_MODEL = os.getenv("OPENAI_MODEL", "gpt-4o")

ANTHROPIC_API_KEY = os.getenv("ANTHROPIC_API_KEY", "")
ANTHROPIC_MODEL = os.getenv("ANTHROPIC_MODEL", "claude-3-5-sonnet-20241022")

# OMDb configuration (HTTPS enforced)
OMDB_API_KEY = os.getenv("OMDB_API_KEY", "")
OMDB_BASE_URL = "https://www.omdbapi.com/"
SHOW_TITLE = "Family Guy"

# Supabase Server Credentials (strict server-only, no fallback to client VITE_* or anon keys)
SUPABASE_URL = os.getenv("SUPABASE_URL", "").strip()
SUPABASE_SERVICE_KEY = (os.getenv("SUPABASE_SECRET_KEY", "").strip() or os.getenv("SUPABASE_SERVICE_KEY", "").strip())

def require_supabase_credentials():
    """Fail-closed assertion function before any Supabase write operation."""
    if not SUPABASE_URL or not SUPABASE_SERVICE_KEY:
        sys.stderr.write(
            "CRITICAL SECURITY ERROR: Missing required server credentials SUPABASE_URL and SUPABASE_SECRET_KEY (or SUPABASE_SERVICE_KEY).\n"
            "Admin operations require dedicated server credentials in admin-tools/.env.\n"
            "Client VITE_* variables and anon keys are strictly forbidden for server operations.\n"
        )
        sys.exit(1)

# Cohost name -> UUID map (derived from Supabase database hosts schema)
COHOST_UUIDS = {
    "Jason": "01201e1a-dafd-424a-b596-ff9ece65f1aa",
    "Collin": "0a3dfd13-90b2-47db-b0af-2e0c0df21cff",
    "Tyler": "e08c8c4b-ecf5-427e-8890-fe9cef0a2c9a",
}

SKILL_FILE_PATH = os.path.join(os.path.dirname(__file__), "transcript_review_skill.md")

