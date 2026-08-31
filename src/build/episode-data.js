/**
 * episode-data.js — Unified data loader for build-time static page generation.
 * Requires explicit mode:
 * - PRERENDER_DATA_MODE=fixture: Loads deterministic canonical fixtures from tests/fixtures/
 * - PRERENDER_DATA_MODE=production: Loads published episodes, reviews, and published transcripts
 *   from Supabase using build-only secrets (SUPABASE_URL, SUPABASE_SECRET_KEY, or legacy SUPABASE_SERVICE_KEY).
 *
 * NOTE: Silent default fallback is strictly prohibited.
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export const MOCK_COHOSTS = [
  {
    id: 'mock-cohost-jason',
    name: 'Jason Hackett',
    role: 'Host',
    bio: '__FGG_FIXTURE__ Synthetic host bio for Jason.',
    accent: 'Host',
    is_synthetic: true,
    fixture_sentinel: '__FGG_FIXTURE__',
  },
  {
    id: 'mock-cohost-tyler',
    name: 'Tyler Simpson',
    role: 'Host',
    bio: '__FGG_FIXTURE__ Synthetic host bio for Tyler.',
    accent: 'Host',
    is_synthetic: true,
    fixture_sentinel: '__FGG_FIXTURE__',
  },
  {
    id: 'mock-cohost-collin',
    name: 'Collin Brown',
    role: 'Host',
    bio: '__FGG_FIXTURE__ Synthetic host bio for Collin.',
    accent: 'Host',
    is_synthetic: true,
    fixture_sentinel: '__FGG_FIXTURE__',
  },
];

export const DEFAULT_COHOSTS = [
  {
    id: '01201e1a-dafd-424a-b596-ff9ece65f1aa',
    name: 'Jason Hackett',
    role: 'Host',
    bio: 'Played the theme song entirely too loud on episode one. Sets the tone. Cranks the hogs.',
    accent: 'Host',
  },
  {
    id: 'e08c8c4b-ecf5-427e-8890-fe9cef0a2c9a',
    name: 'Tyler Simpson',
    role: 'Host',
    bio: 'Watched the original broadcast as an 8-year-old and loved it.',
    accent: 'Host',
  },
  {
    id: '0a3dfd13-90b2-47db-b0af-2e0c0df21cff',
    name: 'Collin Brown',
    role: 'Host',
    bio: "Longtime improv comedian, lifelong Family Guy apologist, and the guy who didn't see the pilot until middle school.",
    accent: 'Host',
  },
];

/**
 * Validates data provenance for production builds.
 * Rejects any record with synthetic flags, fixture sentinels, mock IDs, or test routes.
 *
 * @param {object} params
 * @param {Array} [params.episodes]
 * @param {Array} [params.reviews]
 * @param {Array} [params.cohosts]
 * @param {Array|object} [params.transcripts]
 */
export function assertProductionProvenance({
  episodes = [],
  reviews = [],
  cohosts = [],
  transcripts = [],
} = {}) {
  for (const ep of episodes || []) {
    if (ep.is_synthetic === true) {
      throw new Error(
        `[loadEpisodeData] Provenance validation failed: Episode "${ep.id}" has invalid production field is_synthetic=true.`
      );
    }
    if (ep.fixture_sentinel === '__FGG_FIXTURE__') {
      throw new Error(
        `[loadEpisodeData] Provenance validation failed: Episode "${ep.id}" has invalid production field fixture_sentinel="__FGG_FIXTURE__".`
      );
    }
    if (ep.id === 's99e99') {
      throw new Error(
        `[loadEpisodeData] Provenance validation failed: Episode "${ep.id}" is a test-only route (s99e99).`
      );
    }
    if (typeof ep.id === 'string' && ep.id.startsWith('mock-')) {
      throw new Error(
        `[loadEpisodeData] Provenance validation failed: Episode "${ep.id}" has mock ID prefix.`
      );
    }
  }

  for (const rev of reviews || []) {
    const epId = rev.episode_id || rev.episodeId || 'unknown';
    if (rev.is_synthetic === true) {
      throw new Error(
        `[loadEpisodeData] Provenance validation failed: Review for episode "${epId}" has invalid production field is_synthetic=true.`
      );
    }
    if (rev.fixture_sentinel === '__FGG_FIXTURE__') {
      throw new Error(
        `[loadEpisodeData] Provenance validation failed: Review for episode "${epId}" has invalid production field fixture_sentinel="__FGG_FIXTURE__".`
      );
    }
    const cohostId = rev.cohost_id || rev.cohostId;
    if (typeof cohostId === 'string' && cohostId.startsWith('mock-cohost-')) {
      throw new Error(
        `[loadEpisodeData] Provenance validation failed: Review for episode "${epId}" contains mock cohost ID "${cohostId}".`
      );
    }
  }

  for (const host of cohosts || []) {
    if (host.is_synthetic === true) {
      throw new Error(
        `[loadEpisodeData] Provenance validation failed: Cohost "${host.id}" has invalid production field is_synthetic=true.`
      );
    }
    if (host.fixture_sentinel === '__FGG_FIXTURE__') {
      throw new Error(
        `[loadEpisodeData] Provenance validation failed: Cohost "${host.id}" has invalid production field fixture_sentinel="__FGG_FIXTURE__".`
      );
    }
    if (typeof host.id === 'string' && host.id.startsWith('mock-cohost-')) {
      throw new Error(
        `[loadEpisodeData] Provenance validation failed: Cohost "${host.id}" has mock cohost ID prefix.`
      );
    }
  }

  const transcriptList = Array.isArray(transcripts)
    ? transcripts
    : Object.values(transcripts || {});
  for (const tr of transcriptList) {
    const epId = tr.episode_id || tr.episodeId || tr.id || 'unknown';
    if (tr.is_synthetic === true) {
      throw new Error(
        `[loadEpisodeData] Provenance validation failed: Transcript for episode "${epId}" has invalid production field is_synthetic=true.`
      );
    }
    if (tr.fixture_sentinel === '__FGG_FIXTURE__') {
      throw new Error(
        `[loadEpisodeData] Provenance validation failed: Transcript for episode "${epId}" has invalid production field fixture_sentinel="__FGG_FIXTURE__".`
      );
    }
  }
}

export async function loadEpisodeData({ mode = process.env.PRERENDER_DATA_MODE } = {}) {
  if (!mode) {
    throw new Error(
      "loadEpisodeData: PRERENDER_DATA_MODE environment variable is required ('fixture' or 'production'). Silent defaults are prohibited."
    );
  }

  if (mode === 'fixture') {
    const mockEpisodesPath = path.resolve(__dirname, '../../tests/fixtures/mock-episodes.json');

    if (!fs.existsSync(mockEpisodesPath)) {
      throw new Error(`Fixture file not found: ${mockEpisodesPath}`);
    }

    const rawEpisodes = JSON.parse(fs.readFileSync(mockEpisodesPath, 'utf8'));
    // Filter out any explicit test routes so fake test routes are not emitted
    const episodes = rawEpisodes.filter((ep) => ep.id !== 's99e99');
    const transcripts = {};

    return {
      episodes,
      transcripts,
      cohosts: MOCK_COHOSTS,
      mode: 'fixture',
    };
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

    const [episodesResult, transcriptsResult, reviewsResult, cohostsResult] = await Promise.all([
      supabase.from('episodes').select('*').order('season').order('episode_number'),
      supabase
        .from('episode_transcripts')
        .select('*')
        .eq('status', 'published')
        .not('published_at', 'is', null),
      supabase
        .from('reviews')
        .select(
          'episode_id, cohost_id, rating, review, pull_quote, draft_source, updated_at, rating_terminology, rating_scale_max'
        ),
      supabase.from('cohosts').select('id, name, role, bio, accent'),
    ]);

    if (episodesResult.error) {
      throw new Error(`Failed to fetch episodes from Supabase: ${episodesResult.error.message}`);
    }

    if (transcriptsResult.error) {
      throw new Error(
        `Failed to fetch published transcripts from Supabase: ${transcriptsResult.error.message}`
      );
    }

    if (reviewsResult.error) {
      console.warn(
        `[loadEpisodeData] Warning: reviews query failed: ${reviewsResult.error.message}`
      );
    }

    if (cohostsResult.error) {
      console.warn(
        `[loadEpisodeData] Warning: cohosts query failed: ${cohostsResult.error.message}`
      );
    }

    const allReviews = reviewsResult.data || [];
    const cohosts =
      cohostsResult.data && cohostsResult.data.length > 0 ? cohostsResult.data : DEFAULT_COHOSTS;

    // Strict Production Provenance Assertion Wall
    assertProductionProvenance({
      episodes: episodesResult.data || [],
      reviews: allReviews,
      cohosts,
      transcripts: transcriptsResult.data || [],
    });

    const reviewsByEpisode = new Map();
    for (const rev of allReviews) {
      if (!rev.episode_id) continue;
      if (!reviewsByEpisode.has(rev.episode_id)) {
        reviewsByEpisode.set(rev.episode_id, []);
      }
      reviewsByEpisode.get(rev.episode_id).push(rev);
    }

    // Attach reviews to each episode
    const episodes = (episodesResult.data || []).map((ep) => {
      const epReviews = reviewsByEpisode.get(ep.id) || [];
      return {
        ...ep,
        reviews: epReviews,
      };
    });

    const transcripts = {};
    for (const tr of transcriptsResult.data || []) {
      // Transcript safety checks: must have published status, published_at date, sections, and no synthetic flag
      const isValidPublished =
        tr.status === 'published' &&
        tr.published_at &&
        Array.isArray(tr.sections) &&
        tr.sections.length > 0 &&
        !tr.is_synthetic &&
        !tr._comment;

      if (isValidPublished) {
        transcripts[tr.episode_id] = tr;
      }
    }

    return {
      episodes,
      transcripts,
      cohosts,
      mode: 'production',
    };
  }

  throw new Error(
    `Unsupported PRERENDER_DATA_MODE: "${mode}". Expected 'fixture' or 'production'.`
  );
}
