/**
 * prerender-reviews.js — Deterministic build-time static HTML generator for episode reviews & transcripts.
 * Executed as a postbuild script to produce static HTML pages at dist/reviews/:episodeId/index.html.
 *
 * NOTE: PRERENDER_DATA_MODE ('fixture' or 'production') is mandatory.
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';

import { loadEpisodeData } from '../build/episode-data.js';
import { buildEpisodePageMetadata } from '../build/build-page-metadata.js';
import { buildEpisodeJsonLd } from '../build/build-jsonld.js';
import { RenderEpisodeReviewPage } from '../build/render-transcript-component.js';
import { assemblePrerenderedHtml } from '../build/html-shell.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export async function runPrerender({ mode = process.env.PRERENDER_DATA_MODE } = {}) {
  if (!mode) {
    throw new Error(
      "prerender-reviews: PRERENDER_DATA_MODE environment variable must be explicitly set ('fixture' or 'production'). Silent fallback is disabled."
    );
  }

  const rootDir = path.resolve(__dirname, '../..');
  const distDir = path.resolve(rootDir, 'dist');
  const baseHtmlPath = path.resolve(distDir, 'index.html');

  if (!fs.existsSync(baseHtmlPath)) {
    throw new Error(
      `prerender-reviews: Base template not found at ${baseHtmlPath}. Please ensure 'vite build' runs before prerendering.`
    );
  }

  const templateHtml = fs.readFileSync(baseHtmlPath, 'utf8');
  console.log(`[prerender] Starting static review prerender (mode=${mode})...`);

  const { episodes, transcripts } = await loadEpisodeData({ mode });
  console.log(
    `[prerender] Loaded ${episodes.length} episodes and ${Object.keys(transcripts).length} transcripts.`
  );

  let generatedCount = 0;
  let withTranscriptCount = 0;

  for (const episode of episodes) {
    const transcript = transcripts[episode.id] || null;
    const hasTranscript = Boolean(
      transcript && transcript.sections && transcript.sections.length > 0
    );

    if (hasTranscript) {
      withTranscriptCount++;
    }

    const metadata = buildEpisodePageMetadata(episode, transcript);
    const jsonLd = buildEpisodeJsonLd(episode, transcript);

    const bodyMarkup = renderToStaticMarkup(
      React.createElement(RenderEpisodeReviewPage, { episode, transcript })
    );

    const finalHtml = assemblePrerenderedHtml({
      templateHtml,
      metadata,
      jsonLd,
      bodyMarkup,
      _episodeId: episode.id,
    });

    const episodeOutDir = path.resolve(distDir, 'reviews', episode.id);
    fs.mkdirSync(episodeOutDir, { recursive: true });

    const outFilePath = path.resolve(episodeOutDir, 'index.html');
    fs.writeFileSync(outFilePath, finalHtml, 'utf8');
    generatedCount++;
  }

  console.log(
    `[prerender] ✓ Successfully generated ${generatedCount} static review pages (${withTranscriptCount} with full transcripts) in dist/reviews/`
  );

  return { generatedCount, withTranscriptCount };
}

// Direct execution entrypoint
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  runPrerender().catch((err) => {
    console.error('[prerender] ✗ Fatal error during prerendering:', err.message);
    process.exit(1);
  });
}
