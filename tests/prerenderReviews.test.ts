/**
 * prerenderReviews.test.ts
 * Vitest tests for Phase 2 static prerender architecture and regression safety gates:
 * - Explicit mode enforcement & build-time data joining (episodes + host reviews + cohosts)
 * - Host reviews rendered into static HTML with host names, ratings, terminology, pull quotes
 * - Layout consistency across all canonical episodes (s1e1..s1e6)
 * - Safe audio URL validation (allowing public media.rss.com enclosures while rejecting signed/private CloudFront URLs)
 * - Missing/invalid audio URL cleanly omitting the listen button
 * - Metadata generator & exact OG/Twitter image fallback chain (fail-closed)
 * - Schema.org JSON-LD structured data with nested associatedMedia.transcript
 * - HTML shell assembly & prerendered DOM placement outside React root
 * - Prerender execution creating dist artifacts for all canonical episodes (and no synthetic routes)
 * - Router non-interception for canonical episode document routes
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import fs from 'fs';
import path from 'path';
import { loadEpisodeData, assertProductionProvenance } from '../src/build/episode-data.js';
import { buildEpisodePageMetadata, resolveEpisodeImage } from '../src/build/build-page-metadata.js';
import { buildEpisodeJsonLd } from '../src/build/build-jsonld.js';
import { assemblePrerenderedHtml } from '../src/build/html-shell.js';
import { RenderEpisodeReviewPage } from '../src/build/render-transcript-component.js';
import { validateAudioUrlShape, smokeCheckAudioEndpoint } from '../src/build/validate-audio.js';
import { deriveRssEmbed } from '../src/build/rss-embed.js';
import { runPrerender, SYNTHETIC_FIXTURE_MARKERS } from '../src/scripts/prerender-reviews.js';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';

describe('Phase 2 Prerendering Modules & Safety Gates', () => {
  const envBackup = { ...process.env };

  beforeEach(() => {
    process.env = { ...envBackup };
  });

  afterEach(() => {
    process.env = { ...envBackup };
  });

  describe('0. RSS.com Embed Player URL Derivation', () => {
    it('derives valid embed and page URLs from canonical page URLs with trailing slash', () => {
      const result = deriveRssEmbed('https://rss.com/podcasts/family-guy-guys/3038733/');
      expect(result).toEqual({
        embedUrl: 'https://player.rss.com/family-guy-guys/3038733?theme=dark&v=2',
        pageUrl: 'https://rss.com/podcasts/family-guy-guys/3038733/',
      });
    });

    it('derives valid embed and page URLs from page URLs without trailing slash', () => {
      const result = deriveRssEmbed('https://rss.com/podcasts/family-guy-guys/3078652');
      expect(result).toEqual({
        embedUrl: 'https://player.rss.com/family-guy-guys/3078652?theme=dark&v=2',
        pageUrl: 'https://rss.com/podcasts/family-guy-guys/3078652/',
      });
    });

    it('derives valid embed and page URLs for synthetic fixture URLs', () => {
      const result = deriveRssEmbed('https://rss.com/podcasts/fgg-fixture/900001/');
      expect(result).toEqual({
        embedUrl: 'https://player.rss.com/fgg-fixture/900001?theme=dark&v=2',
        pageUrl: 'https://rss.com/podcasts/fgg-fixture/900001/',
      });
    });

    it('rejects MP3 enclosure URLs, returning null', () => {
      expect(deriveRssEmbed('https://media.rss.com/family-guy-guys/2026_01_31_s1e1.mp3')).toBeNull();
    });

    it('rejects player.rss.com URLs as inputs, returning null', () => {
      expect(
        deriveRssEmbed('https://player.rss.com/family-guy-guys/3038733?theme=dark&v=2')
      ).toBeNull();
    });

    it('rejects non-HTTPS URLs, returning null', () => {
      expect(deriveRssEmbed('http://rss.com/podcasts/family-guy-guys/3038733/')).toBeNull();
    });

    it('rejects URLs with query parameters or hash fragments, returning null', () => {
      expect(
        deriveRssEmbed('https://rss.com/podcasts/family-guy-guys/3038733/?tab=transcript')
      ).toBeNull();
      expect(deriveRssEmbed('https://rss.com/podcasts/family-guy-guys/3038733/#about')).toBeNull();
    });

    it('rejects other hosts, subdomains, and extra path segments, returning null', () => {
      expect(deriveRssEmbed('https://otherpodcast.com/podcasts/family-guy-guys/3038733/')).toBeNull();
      expect(deriveRssEmbed('https://content.rss.com/podcasts/family-guy-guys/3038733/')).toBeNull();
      expect(
        deriveRssEmbed('https://rss.com/podcasts/family-guy-guys/3038733/extra/segment')
      ).toBeNull();
    });

    it('rejects empty, null, undefined, or non-string inputs safely without throwing', () => {
      expect(deriveRssEmbed('')).toBeNull();
      expect(deriveRssEmbed('   ')).toBeNull();
      expect(deriveRssEmbed(null as any)).toBeNull();
      expect(deriveRssEmbed(undefined as any)).toBeNull();
      expect(deriveRssEmbed(12345 as any)).toBeNull();
    });
  });

  describe('1. Explicit Mode Enforcement & Data Loader', () => {
    it('fails loudly when PRERENDER_DATA_MODE is missing', async () => {
      delete process.env.PRERENDER_DATA_MODE;
      await expect(loadEpisodeData({})).rejects.toThrow(
        /PRERENDER_DATA_MODE environment variable is required/i
      );
    });

    it('loads canonical fixture episodes (s1e1..s1e6) with joined host reviews in fixture mode', async () => {
      process.env.PRERENDER_DATA_MODE = 'fixture';
      const { episodes, transcripts, cohosts, mode } = await loadEpisodeData({ mode: 'fixture' });
      expect(mode).toBe('fixture');
      expect(episodes.length).toBe(6);
      expect(cohosts.length).toBe(3);

      // Verify canonical episode IDs exist
      const episodeIds = episodes.map((e) => e.id);
      expect(episodeIds).toEqual(['s1e1', 's1e2', 's1e3', 's1e4', 's1e5', 's1e6']);

      // Synthetic test route s99e99 must NOT be in emitted episodes
      expect(episodeIds).not.toContain('s99e99');

      // Real episodes must NOT have fake synthetic transcripts
      expect(transcripts['s1e1']).toBeUndefined();
      expect(transcripts['s1e2']).toBeUndefined();
      expect(transcripts['s1e6']).toBeUndefined();

      // Verify each episode has host reviews attached for Jason, Tyler, Collin
      const s1e1 = episodes.find((e) => e.id === 's1e1');
      expect(s1e1).toBeDefined();
      expect(s1e1?.reviews?.length).toBe(3);

      const reviewCohostIds = s1e1?.reviews.map((r: any) => r.cohost_id);
      expect(reviewCohostIds).toContain('mock-cohost-jason'); // Jason
      expect(reviewCohostIds).toContain('mock-cohost-tyler'); // Tyler
      expect(reviewCohostIds).toContain('mock-cohost-collin'); // Collin
    });

    it('fails loudly in production mode when build-only secrets are missing', async () => {
      delete process.env.SUPABASE_URL;
      delete process.env.SUPABASE_SECRET_KEY;
      delete process.env.SUPABASE_SERVICE_KEY;
      // Even if anon key exists in browser config, production prerender must reject it
      process.env.VITE_SUPABASE_ANON_KEY = 'anon-browser-key';

      await expect(loadEpisodeData({ mode: 'production' })).rejects.toThrow(
        /Production prerendering failed: Required build environment variables.*are missing/i
      );
    });

    it('rejects unsupported mode strings', async () => {
      await expect(loadEpisodeData({ mode: 'invalid_mode' })).rejects.toThrow(
        /Unsupported PRERENDER_DATA_MODE: "invalid_mode"/i
      );
    });

    describe('Provenance Wall Validation (assertProductionProvenance)', () => {
      it('rejects episode with is_synthetic=true, identifying episode ID and field', () => {
        expect(() =>
          assertProductionProvenance({
            episodes: [{ id: 's1e1', is_synthetic: true }],
          })
        ).toThrow(
          /\[loadEpisodeData\] Provenance validation failed: Episode "s1e1" has invalid production field is_synthetic=true/
        );
      });

      it('rejects episode with fixture_sentinel="__FGG_FIXTURE__", identifying episode ID and field', () => {
        expect(() =>
          assertProductionProvenance({
            episodes: [{ id: 's1e2', fixture_sentinel: '__FGG_FIXTURE__' }],
          })
        ).toThrow(
          /\[loadEpisodeData\] Provenance validation failed: Episode "s1e2" has invalid production field fixture_sentinel="__FGG_FIXTURE__"/
        );
      });

      it('rejects test-only route s99e99', () => {
        expect(() =>
          assertProductionProvenance({
            episodes: [{ id: 's99e99' }],
          })
        ).toThrow(
          /\[loadEpisodeData\] Provenance validation failed: Episode "s99e99" is a test-only route \(s99e99\)/
        );
      });

      it('rejects episode with mock ID prefix', () => {
        expect(() =>
          assertProductionProvenance({
            episodes: [{ id: 'mock-episode-1' }],
          })
        ).toThrow(
          /\[loadEpisodeData\] Provenance validation failed: Episode "mock-episode-1" has mock ID prefix/
        );
      });

      it('rejects review with mock-cohost ID, identifying episode ID and cohost ID', () => {
        expect(() =>
          assertProductionProvenance({
            reviews: [{ episode_id: 's1e1', cohost_id: 'mock-cohost-jason' }],
          })
        ).toThrow(
          /\[loadEpisodeData\] Provenance validation failed: Review for episode "s1e1" contains mock cohost ID "mock-cohost-jason"/
        );
      });

      it('rejects cohost with mock-cohost ID prefix or synthetic flag', () => {
        expect(() =>
          assertProductionProvenance({
            cohosts: [{ id: 'mock-cohost-tyler', name: 'Tyler' }],
          })
        ).toThrow(
          /\[loadEpisodeData\] Provenance validation failed: Cohost "mock-cohost-tyler" has mock cohost ID prefix/
        );
      });

      it('rejects transcript with is_synthetic=true or fixture sentinel', () => {
        expect(() =>
          assertProductionProvenance({
            transcripts: [{ episode_id: 's1e6', is_synthetic: true }],
          })
        ).toThrow(
          /\[loadEpisodeData\] Provenance validation failed: Transcript for episode "s1e6" has invalid production field is_synthetic=true/
        );

        expect(() =>
          assertProductionProvenance({
            transcripts: [{ episode_id: 's1e6', fixture_sentinel: '__FGG_FIXTURE__' }],
          })
        ).toThrow(
          /\[loadEpisodeData\] Provenance validation failed: Transcript for episode "s1e6" has invalid production field fixture_sentinel="__FGG_FIXTURE__"/
        );
      });

      it('passes clean production data with valid UUIDs and fields', () => {
        expect(() =>
          assertProductionProvenance({
            episodes: [{ id: 's1e1', title: 'Death Has a Shadow' }],
            reviews: [
              {
                episode_id: 's1e1',
                cohost_id: '01201e1a-dafd-424a-b596-ff9ece65f1aa',
                rating: 4,
              },
            ],
            cohosts: [
              {
                id: '01201e1a-dafd-424a-b596-ff9ece65f1aa',
                name: 'Jason Hackett',
              },
            ],
            transcripts: [{ episode_id: 's1e1', status: 'published' }],
          })
        ).not.toThrow();
      });
    });
  });

  describe('2. Audio URL Validation & Policy Enforcement', () => {
    it('accepts valid public media.rss.com podcast enclosure URLs', () => {
      const result = validateAudioUrlShape(
        'https://media.rss.com/family-guy-guys/2026_03_05_s1e6.mp3'
      );
      expect(result.valid).toBe(true);
    });

    it('accepts valid public podcast audio URLs from other standard hosts', () => {
      const result1 = validateAudioUrlShape('https://rss.com/podcasts/family-guy-guys/3038733/');
      expect(result1.valid).toBe(true);

      const result2 = validateAudioUrlShape(
        'https://content.rss.com/episodes/396644/3038733/family-guy-guys/2026_08_01_05_33_06_d80e59ee-77ec-4d3b-ab6f-7bef1b3837ce.mp3'
      );
      expect(result2.valid).toBe(true);
    });

    it('rejects signed/private CloudFront URLs containing signature query parameters', () => {
      const cfSigned =
        'https://media.rss.com/family-guy-guys/2026_03_05_s1e6.mp3?Key-Pair-Id=APKAIEXAMPLE&Signature=abcdef123456&Expires=1700000000';
      const result = validateAudioUrlShape(cfSigned);
      expect(result.valid).toBe(false);
      expect(result.reason).toContain('Forbidden signed/private CloudFront URL');
    });

    it('rejects AWS SigV4 signed URLs containing X-Amz-Signature parameters', () => {
      const awsSigned =
        'https://s3.amazonaws.com/family-guy-guys/audio.mp3?X-Amz-Signature=abcdef&X-Amz-Expires=3600';
      const result = validateAudioUrlShape(awsSigned);
      expect(result.valid).toBe(false);
      expect(result.reason).toContain('Forbidden signed/private CloudFront URL');
    });

    it('rejects non-HTTPS URLs, credential-bearing URLs, and malformed strings', () => {
      expect(validateAudioUrlShape('http://media.rss.com/audio.mp3').valid).toBe(false);
      expect(validateAudioUrlShape('https://user:pass@media.rss.com/audio.mp3').valid).toBe(false);
      expect(validateAudioUrlShape('not-a-url').valid).toBe(false);
      expect(validateAudioUrlShape('').valid).toBe(false);
      expect(validateAudioUrlShape(null as any).valid).toBe(false);
    });

    it('smokeCheckAudioEndpoint succeeds for 200/302 responses with mocked fetch without network dependencies', async () => {
      const mockFetch = vi.fn().mockResolvedValue({
        status: 200,
        headers: new Headers({ 'content-type': 'audio/mpeg' }),
        url: 'https://media.rss.com/family-guy-guys/2026_03_05_s1e6.mp3',
      });

      const res = await smokeCheckAudioEndpoint(
        'https://media.rss.com/family-guy-guys/2026_03_05_s1e6.mp3',
        {
          fetchImpl: mockFetch as any,
        }
      );

      expect(res.ok).toBe(true);
      expect(res.status).toBe(200);
      expect(res.contentType).toBe('audio/mpeg');
    });

    it('smokeCheckAudioEndpoint reports failure for 403 responses with mocked fetch', async () => {
      const mockFetch = vi.fn().mockResolvedValue({
        status: 403,
        statusText: 'Forbidden',
        headers: new Headers({ 'content-type': 'text/xml' }),
        url: 'https://media.rss.com/family-guy-guys/2026_03_05_s1e6.mp3',
      });

      const res = await smokeCheckAudioEndpoint(
        'https://media.rss.com/family-guy-guys/2026_03_05_s1e6.mp3',
        {
          fetchImpl: mockFetch as any,
        }
      );

      expect(res.ok).toBe(false);
      expect(res.status).toBe(403);
      expect(res.error).toContain('403');
    });

    it('smokeCheckAudioEndpoint handles timeout abort gracefully', async () => {
      const mockFetch = vi.fn().mockImplementation(() => {
        const error = new Error('The operation was aborted');
        error.name = 'AbortError';
        return Promise.reject(error);
      });

      const res = await smokeCheckAudioEndpoint(
        'https://media.rss.com/family-guy-guys/2026_03_05_s1e6.mp3',
        {
          timeoutMs: 10,
          fetchImpl: mockFetch as any,
        }
      );

      expect(res.ok).toBe(false);
      expect(res.error).toContain('timed out');
    });
  });

  describe('3. Static Component Host Reviews & Embed Player / Audio Fallback', () => {
    it('renders host reviews section with Jason, Tyler, and Collin ratings, quotes, and metrics', () => {
      const episode = {
        id: 's1e1',
        title: '__FGG_FIXTURE__ Episode S1E1',
        season: 1,
        episode_number: 1,
        summary: '__FGG_FIXTURE__ Synthetic episode summary.',
        podcast_url: 'https://rss.com/podcasts/fgg-fixture/900001/',
        reviews: [
          {
            cohost_id: '01201e1a-dafd-424a-b596-ff9ece65f1aa',
            rating: 4,
            review: '__FGG_FIXTURE__ Review text for Jason.',
            pullQuote: '__FGG_FIXTURE__ Pull quote for Jason.',
            rating_terminology: 'Quahogs',
          },
          {
            cohost_id: 'e08c8c4b-ecf5-427e-8890-fe9cef0a2c9a',
            rating: 4.5,
            review: '__FGG_FIXTURE__ Review text for Tyler.',
            pullQuote: '__FGG_FIXTURE__ Pull quote for Tyler.',
            rating_terminology: 'Quahogs',
          },
          {
            cohost_id: '0a3dfd13-90b2-47db-b0af-2e0c0df21cff',
            rating: 3.5,
            review: '__FGG_FIXTURE__ Review text for Collin.',
            pullQuote: '__FGG_FIXTURE__ Pull quote for Collin.',
            rating_terminology: 'Quahogs',
          },
        ],
      };

      const markup = renderToStaticMarkup(
        React.createElement(RenderEpisodeReviewPage, { episode, transcript: null })
      );

      // Section header
      expect(markup).toContain('Host Ratings for This Episode');

      // Host names & metrics
      expect(markup).toMatch(/JASON(&#x27;|')S METRIC/);
      expect(markup).toMatch(/TYLER(&#x27;|')S METRIC/);
      expect(markup).toMatch(/COLLIN(&#x27;|')S METRIC/);

      // Ratings & terminology
      expect(markup).toContain('4.0/5 Quahogs');
      expect(markup).toContain('4.5/5 Quahogs');
      expect(markup).toContain('3.5/5 Quahogs');

      // Pull quotes
      expect(markup).toContain('&quot;__FGG_FIXTURE__ Pull quote for Jason.&quot;');
      expect(markup).toContain('&quot;__FGG_FIXTURE__ Pull quote for Tyler.&quot;');
      expect(markup).toContain('&quot;__FGG_FIXTURE__ Pull quote for Collin.&quot;');

      // Review text
      expect(markup).toContain('__FGG_FIXTURE__ Review text for Jason.');

      // No-transcript fallback
      expect(markup).toContain(
        'The full transcribed conversation for this episode is currently being curated.'
      );
    });

    it('renders RSS.com embed player iframe card and secondary link when podcast_url is an RSS page URL', () => {
      const episodeWithPageUrl = {
        id: 's1e1',
        title: '__FGG_FIXTURE__ Episode S1E1',
        season: 1,
        episode_number: 1,
        podcast_url: 'https://rss.com/podcasts/fgg-fixture/900001/',
        reviews: [],
      };

      const markup = renderToStaticMarkup(
        React.createElement(RenderEpisodeReviewPage, {
          episode: episodeWithPageUrl,
          transcript: null,
        })
      );

      // Embed wrapper card
      expect(markup).toContain('class="rss-embed-wrapper"');

      // Iframe attributes
      expect(markup).toContain(
        '<iframe src="https://player.rss.com/fgg-fixture/900001?theme=dark&amp;v=2"'
      );
      expect(markup).toContain(
        'title="Family Guy Guys podcast player: __FGG_FIXTURE__ Episode S1E1"'
      );
      expect(markup).toContain('loading="lazy"');
      expect(markup).toContain('scrolling="no"');
      expect(markup).toMatch(/frameborder="0"/i);
      expect(markup).toContain(
        'allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"'
      );
      expect(markup).toMatch(/allowfullscreen/i);

      // Inner fallback link inside iframe
      expect(markup).toContain(
        '<a href="https://rss.com/podcasts/fgg-fixture/900001/">__FGG_FIXTURE__ Episode S1E1 | RSS.com</a>'
      );

      // Secondary external link
      expect(markup).toContain('class="rss-embed-external-link"');
      expect(markup).toContain('href="https://rss.com/podcasts/fgg-fixture/900001/"');
      expect(markup).toContain('target="_blank"');
      expect(markup).toContain('rel="noopener noreferrer"');
      expect(markup).toContain('Open on RSS.com ↗');

      // Legacy button should NOT be rendered when embed succeeds
      expect(markup).not.toContain('class="listen-podcast-btn"');
      expect(markup).not.toContain('▶ Listen to Full Episode Audio');
    });

    it('renders legacy listen button when podcast_url is an MP3 enclosure URL', () => {
      const episodeWithMp3 = {
        id: 's1e1',
        title: '__FGG_FIXTURE__ Episode S1E1',
        season: 1,
        episode_number: 1,
        podcast_url: 'https://media.rss.com/family-guy-guys/2026_01_31_s1e1.mp3',
        reviews: [],
      };

      const markup = renderToStaticMarkup(
        React.createElement(RenderEpisodeReviewPage, {
          episode: episodeWithMp3,
          transcript: null,
        })
      );

      // Valid legacy audio button
      expect(markup).toContain('▶ Listen to Full Episode Audio');
      expect(markup).toContain('https://media.rss.com/family-guy-guys/2026_01_31_s1e1.mp3');
      expect(markup).toContain('class="listen-podcast-btn"');

      // Should NOT render iframe embed card
      expect(markup).not.toContain('class="rss-embed-wrapper"');
      expect(markup).not.toContain('<iframe');
    });

    it('omits the Listen button cleanly when podcast_url is missing or signed/invalid', () => {
      const episodeWithoutAudio = {
        id: 's1e2',
        title: 'I Never Met the Dead Man',
        season: 1,
        episode_number: 2,
        podcast_url: '',
        reviews: [],
      };

      const markup1 = renderToStaticMarkup(
        React.createElement(RenderEpisodeReviewPage, {
          episode: episodeWithoutAudio,
          transcript: null,
        })
      );
      expect(markup1).not.toContain('▶ Listen to Full Episode Audio');

      const episodeWithSignedAudio = {
        id: 's1e2',
        title: 'I Never Met the Dead Man',
        season: 1,
        episode_number: 2,
        podcast_url: 'https://media.rss.com/family-guy-guys/s1e2.mp3?Signature=12345',
        reviews: [],
      };

      const markup2 = renderToStaticMarkup(
        React.createElement(RenderEpisodeReviewPage, {
          episode: episodeWithSignedAudio,
          transcript: null,
        })
      );
      expect(markup2).not.toContain('▶ Listen to Full Episode Audio');
    });

    it('renders breadcrumb list without ordered numeric markers', () => {
      const episode = {
        id: 's1e1',
        title: 'Death Has a Shadow',
        season: 1,
        episode_number: 1,
        reviews: [],
      };
      const markup = renderToStaticMarkup(
        React.createElement(RenderEpisodeReviewPage, { episode, transcript: null })
      );
      expect(markup).toContain('<ol class="breadcrumb-list">');
      expect(markup).toContain('class="breadcrumb-separator"');
      expect(markup).toContain('aria-hidden="true"');
    });

    it('renders visitor reviews island mount container with data-episode-id and noscript fallback', () => {
      const episode = {
        id: 's1e5',
        title: 'A Hero Sits Next Door',
        season: 1,
        episode_number: 5,
        reviews: [],
      };
      const markup = renderToStaticMarkup(
        React.createElement(RenderEpisodeReviewPage, { episode, transcript: null })
      );
      expect(markup).toContain('id="visitor-reviews-root"');
      expect(markup).toContain('data-episode-id="s1e5"');
      expect(markup).toContain('<noscript>');
      expect(markup).toContain('class="visitor-reviews-nojs"');
      expect(markup).toContain('Community Reviews &amp; Ratings');
      expect(markup).toContain(
        'Visitor reviews require JavaScript to load and submit. Please enable JavaScript in your browser to view community ratings or leave your own review!'
      );
    });
  });

  describe('4. Metadata & Schema.org JSON-LD Generators', () => {
    it('resolves explicit episode thumbnail_url and emits summary_large_image', () => {
      const episode = {
        id: 's1e1',
        title: 'Death Has a Shadow',
        season: 1,
        episode_number: 1,
        thumbnail_url: 'https://cdn.example.com/ep001.webp',
      };
      const { imageUrl, isFallback } = resolveEpisodeImage(episode);
      expect(imageUrl).toBe('https://cdn.example.com/ep001.webp');
      expect(isFallback).toBe(false);

      const metadata = buildEpisodePageMetadata(episode);
      expect(metadata.og.image).toBe('https://cdn.example.com/ep001.webp');
      expect(metadata.twitter.card).toBe('summary_large_image');
      expect(metadata.canonicalUrl).toBe('https://familyguyguys.com/reviews/s1e1');
    });

    it('emits nested associatedMedia with AudioObject.contentUrl', () => {
      const mockEpisode = {
        id: 's1e6',
        season: 1,
        episode_number: 6,
        title: 'The Son Also Draws',
        summary: 'Peter loses the family car at a casino.',
        podcast_url: 'https://media.rss.com/family-guy-guys/2026_05_09_s1e6.mp3',
      };

      const jsonLd = buildEpisodeJsonLd(mockEpisode, null);
      expect(jsonLd['@context']).toBe('https://schema.org');

      const episodeNode = jsonLd['@graph'][0];
      expect(episodeNode['@type']).toBe('PodcastEpisode');
      expect(episodeNode.name).toBe('S1E6: The Son Also Draws');
      expect(episodeNode.associatedMedia).toBeDefined();
      expect(episodeNode.associatedMedia.contentUrl).toBe(
        'https://media.rss.com/family-guy-guys/2026_05_09_s1e6.mp3'
      );
    });

    it('ensures JSON-LD structured data contains only podcast episode schema with zero visitor review leaks', () => {
      const mockEpisode = {
        id: 's1e1',
        season: 1,
        episode_number: 1,
        title: 'Death Has a Shadow',
        summary: 'Peter loses his job after drinking too much at a stag party.',
        podcast_url: 'https://media.rss.com/family-guy-guys/2026_01_31_s1e1.mp3',
        reviews: [
          {
            cohost_id: 'mock-cohost-jason',
            rating: 4,
            review: 'The pilot that started it all.',
          },
        ],
      };

      const jsonLd = buildEpisodeJsonLd(mockEpisode, null);
      const jsonStr = JSON.stringify(jsonLd);

      expect(jsonLd['@context']).toBe('https://schema.org');
      expect(jsonLd['@graph'][0]['@type']).toBe('PodcastEpisode');

      // Zero visitor reviews or synthetic user review content leak into JSON-LD
      expect(jsonStr).not.toContain('visitor');
      expect(jsonStr).not.toContain('reviewBody');
      expect(jsonStr).not.toContain('UserReview');
      expect(jsonStr).not.toContain('Comment');
      expect(jsonStr).not.toContain('synthetic');
    });
  });

  describe('5. Prerender Execution & Emitted Artifact Verification', () => {
    it('prerender script in fixture mode generates clean static pages for all 6 canonical episodes', async () => {
      const distDir = path.resolve(__dirname, '../dist');
      fs.rmSync(path.resolve(distDir, 'reviews'), { recursive: true, force: true });
      fs.mkdirSync(distDir, { recursive: true });
      const mockBaseHtml = `<!DOCTYPE html><html lang="en"><head><title>Base</title></head><body><main><div id="page-home" class="page active"></div><div id="page-reviews" class="page"></div></main></body></html>`;
      fs.writeFileSync(path.resolve(distDir, 'index.html'), mockBaseHtml, 'utf8');

      const result = await runPrerender({ mode: 'fixture' });
      expect(result.generatedCount).toBe(6);
      expect(result.withTranscriptCount).toBe(0);

      // Verify every canonical episode static file exists
      const episodes = ['s1e1', 's1e2', 's1e3', 's1e4', 's1e5', 's1e6'];
      for (const epId of episodes) {
        const filePath = path.resolve(distDir, `reviews/${epId}/index.html`);
        expect(fs.existsSync(filePath)).toBe(true);

        const html = fs.readFileSync(filePath, 'utf8');
        expect(html).toContain(`https://familyguyguys.com/reviews/${epId}`);
        expect(html).toContain('id="page-prerendered-review"');
        expect(html).toContain('<!-- __FGG_FIXTURE__ -->');
        expect(html).toContain('Host Ratings for This Episode');
        expect(html).toMatch(/JASON(&#x27;|')S METRIC/);
        expect(html).toMatch(/TYLER(&#x27;|')S METRIC/);
        expect(html).toMatch(/COLLIN(&#x27;|')S METRIC/);
        expect(html).toContain('no-transcript-fallback');

        // Verify RSS.com embed player iframe in fixture static pages
        expect(html).toContain('class="rss-embed-wrapper"');
        expect(html).toContain('https://player.rss.com/fgg-fixture/90000');
        expect(html).toContain('loading="lazy"');
        expect(html).toContain('Open on RSS.com ↗');

        // Verify visitor reviews island mount point & noscript progressive enhancement fallback
        expect(html).toContain(`<div id="visitor-reviews-root" data-episode-id="${epId}">`);
        expect(html).toContain('<noscript>');
        expect(html).toContain('class="visitor-reviews-nojs"');
        expect(html).toContain('Visitor reviews require JavaScript to load and submit');
      }

      // Verify s1e1 specific synthetic host review content
      const s1e1Html = fs.readFileSync(path.resolve(distDir, 'reviews/s1e1/index.html'), 'utf8');
      expect(s1e1Html).toContain('__FGG_FIXTURE__ Episode S1E1');
      expect(s1e1Html).toContain(
        '__FGG_FIXTURE__ Synthetic review text for Jason host review card.'
      );
      expect(s1e1Html).toContain('&quot;__FGG_FIXTURE__ Synthetic pull quote for Jason.&quot;');

      // Verify synthetic test route s99e99 was NOT generated
      expect(fs.existsSync(path.resolve(distDir, 'reviews/s99e99/index.html'))).toBe(false);
    });

    it('verifies zero fixture visitor reviews or synthetic user review content leak into static HTML or JSON-LD', async () => {
      const distDir = path.resolve(__dirname, '../dist');
      if (!fs.existsSync(path.resolve(distDir, 'reviews/s1e1/index.html'))) {
        fs.mkdirSync(distDir, { recursive: true });
        const mockBaseHtml = `<!DOCTYPE html><html lang="en"><head><title>Base</title></head><body><main><div id="page-home" class="page active"></div><div id="page-reviews" class="page"></div></main></body></html>`;
        fs.writeFileSync(path.resolve(distDir, 'index.html'), mockBaseHtml, 'utf8');
        await runPrerender({ mode: 'fixture' });
      }

      const episodes = ['s1e1', 's1e2', 's1e3', 's1e4', 's1e5', 's1e6'];
      for (const epId of episodes) {
        const filePath = path.resolve(distDir, `reviews/${epId}/index.html`);
        const html = fs.readFileSync(filePath, 'utf8');

        // Extract JSON-LD from HTML
        const jsonLdMatch = html.match(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/);
        expect(jsonLdMatch).not.toBeNull();
        if (jsonLdMatch) {
          const jsonLdContent = jsonLdMatch[1];
          expect(jsonLdContent).not.toContain('visitor');
          expect(jsonLdContent).not.toContain('reviewBody');
          expect(jsonLdContent).not.toContain('UserReview');
          expect(jsonLdContent).not.toContain('Comment');
          expect(jsonLdContent).not.toContain('mock-user');
        }

        // Static markup should contain the mount container, but NO pre-rendered user review cards or comments
        expect(html).toContain(`<div id="visitor-reviews-root" data-episode-id="${epId}">`);
        expect(html).not.toContain('visitor-review-card');
        expect(html).not.toContain('visitor-review-item');
        expect(html).not.toContain('mock-visitor');
        expect(html).not.toContain('synthetic-user');
      }
    });

    it('fails non-zero when executed with mode=production without credentials', async () => {
      delete process.env.SUPABASE_URL;
      delete process.env.SUPABASE_SECRET_KEY;
      delete process.env.SUPABASE_SERVICE_KEY;

      await expect(runPrerender({ mode: 'production' })).rejects.toThrow(
        /Production prerendering failed/i
      );
    });

    it('enforces machine-token-only tripwires in SYNTHETIC_FIXTURE_MARKERS without natural language lore', () => {
      expect(SYNTHETIC_FIXTURE_MARKERS).toContain('__FGG_FIXTURE__');
      expect(SYNTHETIC_FIXTURE_MARKERS).toContain('mock-cohost-');
      expect(SYNTHETIC_FIXTURE_MARKERS).toContain('"is_synthetic":true');
      expect(SYNTHETIC_FIXTURE_MARKERS).toContain('s99e99');

      // Natural language lore markers must NOT be present
      expect(SYNTHETIC_FIXTURE_MARKERS).not.toContain('The vanishing blender alert');
      expect(SYNTHETIC_FIXTURE_MARKERS).not.toContain("Tyler's math meltdown");
      expect(SYNTHETIC_FIXTURE_MARKERS).not.toContain('We cranked our hogs pretty hard');
      expect(SYNTHETIC_FIXTURE_MARKERS).not.toContain('A legendary kickoff');
      expect(SYNTHETIC_FIXTURE_MARKERS).not.toContain('Still finding the formula');
      expect(SYNTHETIC_FIXTURE_MARKERS).not.toContain('Red Hot Chili Peppers and Cigarettes');
      expect(SYNTHETIC_FIXTURE_MARKERS).not.toContain('Mock Test Episode');
    });
  });

  describe('6. Router Episode Navigation Rules', () => {
    const isEpisodeReviewRoute = (href: string) => {
      const trimmedHref = href.trim();
      return (
        /^\/reviews\/[a-zA-Z0-9_-]+(?:\/)?$/i.test(trimmedHref) &&
        !trimmedHref.startsWith('/reviews/season/') &&
        !trimmedHref.startsWith('/reviews/host/') &&
        trimmedHref !== '/reviews' &&
        trimmedHref !== '/reviews/'
      );
    };

    it('identifies canonical episode routes to allow native document navigation without SPA interception', () => {
      expect(isEpisodeReviewRoute('/reviews/s1e1')).toBe(true);
      expect(isEpisodeReviewRoute('/reviews/s1e2')).toBe(true);
      expect(isEpisodeReviewRoute('/reviews/s1e3')).toBe(true);
      expect(isEpisodeReviewRoute('/reviews/s1e6')).toBe(true);
      expect(isEpisodeReviewRoute('/reviews/s1e4/')).toBe(true);

      // SPA index/aggregate routes MUST remain intercepted by SPA
      expect(isEpisodeReviewRoute('/reviews')).toBe(false);
      expect(isEpisodeReviewRoute('/reviews/')).toBe(false);
      expect(isEpisodeReviewRoute('/reviews/season/1')).toBe(false);
      expect(isEpisodeReviewRoute('/reviews/host/jason')).toBe(false);
      expect(isEpisodeReviewRoute('/episodes')).toBe(false);
    });
  });
});
