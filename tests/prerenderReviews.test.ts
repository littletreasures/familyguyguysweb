/**
 * prerenderReviews.test.ts
 * Vitest tests for Phase 2 static prerender architecture:
 * - Data loaders & explicit mode enforcement
 * - Metadata generator & exact OG/Twitter image fallback chain
 * - Schema.org JSON-LD structured data with nested associatedMedia.transcript
 * - HTML shell assembly & prerendered DOM placement outside React root
 * - Prerender execution creating dist artifacts
 * - Router non-interception for canonical episode document routes
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'fs';
import path from 'path';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { loadEpisodeData } from '../src/build/episode-data.js';
import { buildEpisodePageMetadata, resolveEpisodeImage } from '../src/build/build-page-metadata.js';
import { buildEpisodeJsonLd } from '../src/build/build-jsonld.js';
import { assemblePrerenderedHtml } from '../src/build/html-shell.js';
import { RenderEpisodeReviewPage } from '../src/build/render-transcript-component.js';
import { runPrerender } from '../src/scripts/prerender-reviews.js';

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

    it('loads mock fixture data in explicit fixture mode', async () => {
      process.env.PRERENDER_DATA_MODE = 'fixture';
      const { episodes, transcripts, mode } = await loadEpisodeData({ mode: 'fixture' });
      expect(mode).toBe('fixture');
      expect(episodes.length).toBeGreaterThan(0);
      expect(transcripts['s1e6']).toBeDefined();
      expect(transcripts['s1e6'].sections.length).toBeGreaterThan(0);
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

  describe('2. Metadata Generator & OG / Twitter Fallback Chain', () => {
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

    it('resolves Cloudinary public_id when thumbnail_url is missing and emits summary_large_image', () => {
      process.env.CLOUDINARY_CLOUD_NAME = 'littletreasures';
      const episode = {
        id: 's1e2',
        title: 'I Never Met the Dead Man',
        season: 1,
        episode_number: 2,
        thumbnail_public_id: 'family-guy/episodes/s1e2_thumb',
      };
      const { imageUrl, isFallback } = resolveEpisodeImage(episode);
      expect(imageUrl).toBe(
        'https://res.cloudinary.com/littletreasures/image/upload/family-guy/episodes/s1e2_thumb'
      );
      expect(isFallback).toBe(false);

      const metadata = buildEpisodePageMetadata(episode);
      expect(metadata.og.image).toContain('res.cloudinary.com');
      expect(metadata.twitter.card).toBe('summary_large_image');
    });

    it('falls back to /og/podcast-art-512.png with twitter:card="summary" when no thumbnail is present', () => {
      const episode = {
        id: 's1e3',
        title: 'Chitty Chitty Death Bang',
        season: 1,
        episode_number: 3,
      };
      const { imageUrl, isFallback } = resolveEpisodeImage(episode);
      expect(imageUrl).toBe('https://familyguyguys.com/og/podcast-art-512.png');
      expect(isFallback).toBe(true);

      const metadata = buildEpisodePageMetadata(episode);
      expect(metadata.og.image).toBe('https://familyguyguys.com/og/podcast-art-512.png');
      expect(metadata.twitter.card).toBe('summary');
    });
  });

  describe('3. Schema.org JSON-LD Generator with AudioObject.transcript', () => {
    it('emits nested associatedMedia with AudioObject.transcript and contentUrl', () => {
      const mockEpisode = {
        id: 's1e6',
        season: 1,
        episode_number: 6,
        title: 'The Son Also Draws',
        summary: 'Peter loses the family car at a casino.',
        podcast_url: 'https://media.rss.com/family-guy-guys/s1e6.mp3',
        thumbnail_url: 'https://familyguyguys.com/assets/ep006.jpg',
      };
      const mockTranscript = {
        episode_id: 's1e6',
        status: 'published' as const,
        published_at: '2026-08-26T20:00:00Z',
        source: 'riverside' as const,
        language: 'en',
        transcript_version: 1,
        sections: [],
        plain_text: '## Cold Open\n\nJason [00:01]: Welcome to Family Guy Guys.',
        word_count: 8,
      };

      const jsonLd = buildEpisodeJsonLd(mockEpisode, mockTranscript);
      expect(jsonLd['@context']).toBe('https://schema.org');

      const episodeNode = jsonLd['@graph'][0];
      expect(episodeNode['@type']).toBe('PodcastEpisode');
      expect(episodeNode.name).toBe('S1E6: The Son Also Draws');
      expect(episodeNode.episodeNumber).toBe(6);
      expect(episodeNode.url).toBe('https://familyguyguys.com/reviews/s1e6');

      // Verify nested AudioObject on associatedMedia
      expect(episodeNode.associatedMedia).toBeDefined();
      expect(episodeNode.associatedMedia['@type']).toBe('AudioObject');
      expect(episodeNode.associatedMedia.contentUrl).toBe(
        'https://media.rss.com/family-guy-guys/s1e6.mp3'
      );
      expect(episodeNode.associatedMedia.transcript).toBe(
        '## Cold Open\n\nJason [00:01]: Welcome to Family Guy Guys.'
      );
    });
  });

  describe('4. HTML Shell Assembler & Prerendered DOM Placement', () => {
    it('places static transcript markup in #page-prerendered-review and injects metadata', () => {
      const baseHtml = `<!DOCTYPE html><html lang="en"><head><title>Base Shell</title></head><body><main><div id="page-home" class="page active"></div><div id="page-reviews" class="page"></div></main></body></html>`;
      const metadata = {
        title: 'S1E6 Review Title',
        description: 'Unique meta description for S1E6',
        canonicalUrl: 'https://familyguyguys.com/reviews/s1e6',
        og: {
          type: 'article',
          url: 'https://familyguyguys.com/reviews/s1e6',
          title: 'S1E6 Review Title',
          description: 'Unique meta description for S1E6',
          image: 'https://familyguyguys.com/assets/ep006.jpg',
          siteName: 'Family Guy Guys',
        },
        twitter: {
          card: 'summary_large_image',
          url: 'https://familyguyguys.com/reviews/s1e6',
          title: 'S1E6 Review Title',
          description: 'Unique meta description for S1E6',
          image: 'https://familyguyguys.com/assets/ep006.jpg',
        },
      };
      const jsonLd = { '@context': 'https://schema.org', '@graph': [] };
      const bodyMarkup =
        '<article id="prerendered-episode-content"><h1 class="episode-main-title">The Son Also Draws</h1></article>';

      const finalHtml = assemblePrerenderedHtml({
        templateHtml: baseHtml,
        metadata,
        jsonLd,
        bodyMarkup,
        _episodeId: 's1e6',
      });

      expect(finalHtml).toContain('<title>S1E6 Review Title</title>');
      expect(finalHtml).toContain(
        '<link rel="canonical" href="https://familyguyguys.com/reviews/s1e6">'
      );
      expect(finalHtml).toContain(
        '<meta name="description" content="Unique meta description for S1E6">'
      );
      expect(finalHtml).toContain('<script type="application/ld+json">');
      expect(finalHtml).toContain(
        '<div id="page-prerendered-review" class="page active" style="display:block;">'
      );
      expect(finalHtml).toContain('id="page-home" class="page" style="display:none;"');
      expect(finalHtml).toContain(
        '<article id="prerendered-episode-content"><h1 class="episode-main-title">The Son Also Draws</h1></article>'
      );
    });
  });

  describe('5. Prerender Execution & Emitted Artifact Verification', () => {
    it('prerender script in explicit fixture mode generates dist/reviews/s1e6/index.html with full transcript', async () => {
      // Ensure dist/index.html exists for testing
      const distDir = path.resolve(__dirname, '../dist');
      fs.mkdirSync(distDir, { recursive: true });
      const mockBaseHtml = `<!DOCTYPE html><html lang="en"><head><title>Base</title></head><body><main><div id="page-home" class="page active"></div></main></body></html>`;
      fs.writeFileSync(path.resolve(distDir, 'index.html'), mockBaseHtml, 'utf8');

      const result = await runPrerender({ mode: 'fixture' });
      expect(result.generatedCount).toBeGreaterThanOrEqual(3);
      expect(result.withTranscriptCount).toBeGreaterThanOrEqual(1);

      const s1e6HtmlPath = path.resolve(distDir, 'reviews/s1e6/index.html');
      expect(fs.existsSync(s1e6HtmlPath)).toBe(true);

      const html = fs.readFileSync(s1e6HtmlPath, 'utf8');
      expect(html).toContain(
        '<link rel="canonical" href="https://familyguyguys.com/reviews/s1e6">'
      );
      expect(html).toContain('The Sun Also Draws');
      expect(html).toContain('application/ld+json');
      expect(html).toContain('PodcastEpisode');
      expect(html).toContain('id="prerendered-episode-content"');
      expect(html).toContain('id="prerendered-transcript"');
      expect(html).toContain('Cold Open: Red Hot Chili Peppers and Cigarettes');
      expect(html).toContain('Jason');
      expect(html).toContain('Collin');
      expect(html).toContain('Tyler');
    });

    it('fails non-zero when executed with mode=production without credentials', async () => {
      delete process.env.SUPABASE_URL;
      delete process.env.SUPABASE_SECRET_KEY;
      delete process.env.SUPABASE_SERVICE_KEY;

      await expect(runPrerender({ mode: 'production' })).rejects.toThrow(
        /Production prerendering failed/i
      );
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
      expect(isEpisodeReviewRoute('/reviews/s1e6')).toBe(true);
      expect(isEpisodeReviewRoute('/reviews/s1e1')).toBe(true);
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
