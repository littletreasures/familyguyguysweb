-- Migration DDL: Create public.episode_transcripts table for structured, human-reviewed podcast transcripts
-- Linked to canonical public.episodes table via episode_id foreign key.

CREATE TABLE IF NOT EXISTS public.episode_transcripts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  episode_id text NOT NULL UNIQUE REFERENCES public.episodes(id) ON DELETE CASCADE,
  status text NOT NULL DEFAULT 'draft'
    CHECK (status IN ('draft', 'published', 'archived')),
  source text NOT NULL DEFAULT 'riverside',
  language text NOT NULL DEFAULT 'en',
  transcript_version integer NOT NULL DEFAULT 1,
  intro text,
  seo_description text,
  sections jsonb NOT NULL DEFAULT '[]'::jsonb,
  plain_text text NOT NULL DEFAULT '',
  word_count integer NOT NULL DEFAULT 0,
  published_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT episode_transcripts_published_at_required
    CHECK (status <> 'published' OR published_at IS NOT NULL)
);

-- Index on (status, episode_id) for efficient public build queries and lookups
CREATE INDEX IF NOT EXISTS episode_transcripts_status_episode_id_idx
  ON public.episode_transcripts (status, episode_id);

-- Uniquely-scoped trigger function to avoid altering project-wide trigger functions
CREATE OR REPLACE FUNCTION public.set_episode_transcripts_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Apply trigger exclusively to episode_transcripts
DROP TRIGGER IF EXISTS trg_set_episode_transcripts_updated_at ON public.episode_transcripts;
CREATE TRIGGER trg_set_episode_transcripts_updated_at
  BEFORE UPDATE ON public.episode_transcripts
  FOR EACH ROW
  EXECUTE FUNCTION public.set_episode_transcripts_updated_at();

-- Enable Row Level Security (RLS)
ALTER TABLE public.episode_transcripts ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if any
DROP POLICY IF EXISTS "Allow public read access for published transcripts" ON public.episode_transcripts;
DROP POLICY IF EXISTS "Allow public insert access" ON public.episode_transcripts;
DROP POLICY IF EXISTS "Allow public update access" ON public.episode_transcripts;
DROP POLICY IF EXISTS "Allow public delete access" ON public.episode_transcripts;

-- RLS Policy: Allow public read access strictly for published transcripts
CREATE POLICY "Allow public read access for published transcripts"
  ON public.episode_transcripts
  FOR SELECT
  USING (status = 'published');

-- Note: No public INSERT/UPDATE/DELETE policies are granted.
-- Administrative write operations use the server service-role key (SUPABASE_SECRET_KEY / SUPABASE_SERVICE_KEY),
-- which bypasses RLS securely on the backend.
