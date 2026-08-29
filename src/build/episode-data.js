/**
 * episode-data.js — Unified data loader for build-time static page generation.
 * Requires explicit mode:
 * - PRERENDER_DATA_MODE=fixture: Loads deterministic synthetic fixtures from tests/fixtures/
 * - PRERENDER_DATA_MODE=production: Loads published episodes and transcripts from Supabase
 *   using build-only secrets (SUPABASE_URL, SUPABASE_SECRET_KEY, or legacy SUPABASE_SERVICE_KEY).
 *
 * NOTE: Silent default fallback is strictly prohibited.
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export async function loadEpisodeData({ mode = process.env.PRERENDER_DATA_MODE } = {}) {
  if (!mode) {
    throw new Error(
      "loadEpisodeData: PRERENDER_DATA_MODE environment variable is required ('fixture' or 'production'). Silent defaults are prohibited."
    );
  }

  if (mode === 'fixture') {
    const mockEpisodesPath = path.resolve(__dirname, '../../tests/fixtures/mock-episodes.json');
    const s1e6FixturePath = path.resolve(
      __dirname,
      '../../tests/fixtures/s1e6-transcript-fixture.json'
    );

    if (!fs.existsSync(mockEpisodesPath)) {
      throw new Error(`Fixture file not found: ${mockEpisodesPath}`);
    }

    const episodes = JSON.parse(fs.readFileSync(mockEpisodesPath, 'utf8'));
    const transcripts = {};

    if (fs.existsSync(s1e6FixturePath)) {
      const s1e6Transcript = JSON.parse(fs.readFileSync(s1e6FixturePath, 'utf8'));
      transcripts[s1e6Transcript.episode_id] = s1e6Transcript;
    }

    return { episodes, transcripts, mode: 'fixture' };
  }

  if (mode === 'production') {
    const supabaseUrl = process.env.SUPABASE_URL;
    const supabaseKey = process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_KEY;

    if (!supabaseUrl || !supabaseKey) {
      throw new Error(
        'Production prerendering failed: Required build environment variables (SUPABASE_URL and SUPABASE_SECRET_KEY or SUPABASE_SERVICE_KEY) are missing.'
      );
    }

    // Dynamic import of @supabase/supabase-js
    const { createClient } = await import('@supabase/supabase-js');
    const supabase = createClient(supabaseUrl, supabaseKey);

    const [episodesResult, transcriptsResult] = await Promise.all([
      supabase.from('episodes').select('*').order('season').order('episode_number'),
      supabase.from('episode_transcripts').select('*').eq('status', 'published'),
    ]);

    if (episodesResult.error) {
      throw new Error(`Failed to fetch episodes from Supabase: ${episodesResult.error.message}`);
    }

    if (transcriptsResult.error) {
      throw new Error(
        `Failed to fetch published transcripts from Supabase: ${transcriptsResult.error.message}`
      );
    }

    const transcripts = {};
    for (const tr of transcriptsResult.data || []) {
      transcripts[tr.episode_id] = tr;
    }

    return {
      episodes: episodesResult.data || [],
      transcripts,
      mode: 'production',
    };
  }

  throw new Error(
    `Unsupported PRERENDER_DATA_MODE: "${mode}". Expected 'fixture' or 'production'.`
  );
}
