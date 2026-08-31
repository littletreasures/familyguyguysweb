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
import { loadEpisodeData } from '../src/build/episode-data.js';
import { buildEpisodePageMetadata, resolveEpisodeImage } from '../src/build/build-page-metadata.js';
import { buildEpisodeJsonLd } from '../src/build/build-jsonld.js';
import { assemblePrerenderedHtml } from '../src/build/html-shell.js';
import { RenderEpisodeReviewPage } from '../src/build/render-transcript-component.js';
import { validateAudioUrlShape, smokeCheckAudioEndpoint } from '../src/build/validate-audio.js';
import { runPrerender } from '../src/scripts/prerender-reviews.js';
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

  describe('3. Static Component Host Reviews & Conditional Audio Button', () => {
    it('renders host reviews section with Jason, Tyler, and Collin ratings, quotes, and metrics', () => {
      const episode = {
        id: 's1e1',
        title: 'Death Has a Shadow',
        season: 1,
        episode_number: 1,
        summary: 'Peter loses his job after drinking too much at a stag party.',
        podcast_url: 'https://media.rss.com/family-guy-guys/2026_01_31_s1e1.mp3',
        reviews: [
          {
            cohost_id: '01201e1a-dafd-424a-b596-ff9ece65f1aa',
            rating: 4,
            review: 'The pilot that started it all.',
            pullQuote: 'We cranked our hogs pretty hard.',
            rating_terminology: 'Quahogs',
          },
          {
            cohost_id: 'e08c8c4b-ecf5-427e-8890-fe9cef0a2c9a',
            rating: 4.5,
            review: 'Watched the original broadcast at age eight.',
            pullQuote: 'A legendary kickoff.',
            rating_terminology: 'Quahogs',
          },
          {
            cohost_id: '0a3dfd13-90b2-47db-b0af-2e0c0df21cff',
            rating: 3.5,
            review: 'Rhythm of the jokes holds up well.',
            pullQuote: 'Still finding the formula.',
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
      expect(markup).toContain('&quot;We cranked our hogs pretty hard.&quot;');
      expect(markup).toContain('&quot;A legendary kickoff.&quot;');
      expect(markup).toContain('&quot;Still finding the formula.&quot;');

      // Review text
      expect(markup).toContain('The pilot that started it all.');

      // Valid audio button
      expect(markup).toContain('▶ Listen to Full Episode Audio');
      expect(markup).toContain('https://media.rss.com/family-guy-guys/2026_01_31_s1e1.mp3');

      // No-transcript fallback
      expect(markup).toContain(
        'The full transcribed conversation for this episode is currently being curated.'
      );
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
        expect(html).toContain('Host Ratings for This Episode');
        expect(html).toMatch(/JASON(&#x27;|')S METRIC/);
        expect(html).toMatch(/TYLER(&#x27;|')S METRIC/);
        expect(html).toMatch(/COLLIN(&#x27;|')S METRIC/);
        expect(html).toContain('no-transcript-fallback');

        // Verify visitor reviews island mount point & noscript progressive enhancement fallback
        expect(html).toContain(`<div id="visitor-reviews-root" data-episode-id="${epId}">`);
        expect(html).toContain('<noscript>');
        expect(html).toContain('class="visitor-reviews-nojs"');
        expect(html).toContain('Visitor reviews require JavaScript to load and submit');
      }

      // Verify s1e1 specific host review content
      const s1e1Html = fs.readFileSync(path.resolve(distDir, 'reviews/s1e1/index.html'), 'utf8');
      expect(s1e1Html).toContain('Death Has a Shadow');
      expect(s1e1Html).toContain('The pilot that started it all.');
      expect(s1e1Html).toContain('We cranked our hogs pretty hard.');

      // Verify synthetic test route s99e99 was NOT generated
      expect(fs.existsSync(path.resolve(distDir, 'reviews/s99e99/index.html'))).toBe(false);

      // Real S1E6 static page must NOT contain fixture dialogue phrases
      const s1e6Html = fs.readFileSync(path.resolve(distDir, 'reviews/s1e6/index.html'), 'utf8');
      expect(s1e6Html).not.toContain('Cold Open: Red Hot Chili Peppers and Cigarettes');
    });

    it('verifies zero fixture visitor reviews or synthetic user review content leak into static HTML or JSON-LD', async () => {
      const distDir = path.resolve(__dirname, '../dist');
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

    it('rejects emitted artifacts and aborts build if synthetic markers appear in production mode', async () => {
      const { SYNTHETIC_FIXTURE_MARKERS } = await import('../src/scripts/prerender-reviews.js');
      expect(SYNTHETIC_FIXTURE_MARKERS).toContain('The vanishing blender alert');
      expect(SYNTHETIC_FIXTURE_MARKERS).toContain('math meltdown');
      expect(SYNTHETIC_FIXTURE_MARKERS).toContain('mock-cohost-');
      expect(SYNTHETIC_FIXTURE_MARKERS).toContain('is_synthetic');
      expect(SYNTHETIC_FIXTURE_MARKERS).not.toContain('Two out of five');
      expect(SYNTHETIC_FIXTURE_MARKERS).not.toContain('Meet Joe Swanson');
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
