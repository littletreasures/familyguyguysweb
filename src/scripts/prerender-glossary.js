/**
 * prerender-glossary.js — Static HTML prerender generator for the Official Podcast Glossary.
 * Produces dist/glossary/index.html with server-rendered React markup, metadata, and JSON-LD.
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import React from 'react';
import { renderToString } from 'react-dom/server';
import * as cheerio from 'cheerio';
import { GlossaryApp } from '../glossary/GlossaryApp.ts';
import { GLOSSARY_ENTRIES } from '../data/glossary.ts';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export const GLOSSARY_METADATA = {
  title: 'Glossary — Family Guy Guys',
  description:
    'The official Family Guy Guys glossary: Structurehead, Gagger, Stewie Gay Watch, Arbitrary Rating Units, and every bit of lore from the podcast.',
  canonicalUrl: 'https://familyguyguys.com/glossary',
  ogImage: 'https://familyguyguys.com/hero-1200w.webp',
  ogType: 'website',
  ogSiteName: 'Family Guy Guys',
  twitterCard: 'summary_large_image',
};

export function buildGlossaryJsonLd() {
  return {
    '@context': 'https://schema.org',
    '@type': 'DefinedTermSet',
    '@id': 'https://familyguyguys.com/glossary#term-set',
    url: 'https://familyguyguys.com/glossary',
    name: 'Family Guy Guys Official Podcast Glossary',
    description:
      'The official glossary of critical frameworks, segments, and lore from Family Guy Guys: The Podcast.',
    hasDefinedTerm: GLOSSARY_ENTRIES.map((entry) => ({
      '@type': 'DefinedTerm',
      '@id': `https://familyguyguys.com/glossary#${entry.id}`,
      url: `https://familyguyguys.com/glossary#${entry.id}`,
      name: entry.term,
      description: entry.definition,
      termCode: entry.id,
      inDefinedTermSet: 'https://familyguyguys.com/glossary#term-set',
    })),
  };
}

export async function runGlossaryPrerender({ templatePath, outDir } = {}) {
  const rootDir = path.resolve(__dirname, '../..');
  const resolvedTemplatePath = templatePath || path.resolve(rootDir, 'dist/index.html');
  const resolvedOutDir = outDir || path.resolve(rootDir, 'dist');

  if (!fs.existsSync(resolvedTemplatePath)) {
    throw new Error(
      `prerender-glossary: Base template not found at ${resolvedTemplatePath}. Please ensure 'vite build' runs before prerendering.`
    );
  }

  const templateHtml = fs.readFileSync(resolvedTemplatePath, 'utf8');
  const $ = cheerio.load(templateHtml);

  const $glossaryApp = $('#glossary-app');
  if ($glossaryApp.length === 0) {
    throw new Error('prerender-glossary: Target container #glossary-app not found in template.');
  }

  // 1. Derive published episodes from prerendered reviews output directory if present
  let publishedEpisodes;
  const reviewsDir = path.resolve(resolvedOutDir, 'reviews');
  if (fs.existsSync(reviewsDir)) {
    const entries = fs.readdirSync(reviewsDir, { withFileTypes: true });
    const slugs = entries
      .filter((d) => d.isDirectory() && fs.existsSync(path.join(reviewsDir, d.name, 'index.html')))
      .map((d) => d.name.toLowerCase());
    if (slugs.length > 0) {
      publishedEpisodes = new Set(slugs);
    }
  }

  // Render React static markup and inject into container
  const renderedMarkup = renderToString(React.createElement(GlossaryApp, { publishedEpisodes }));
  $glossaryApp.html(renderedMarkup);

  // 2. Activate #page-glossary and deactivate all other pages
  $('.page').removeClass('active');
  $('#page-glossary').addClass('active');

  // Synchronize nav links
  $('#nav-home').removeClass('active');
  $('#nav-glossary').addClass('active');

  // 3. Metadata updates
  $('title').text(GLOSSARY_METADATA.title);

  $('meta[name="description"]').remove();
  $('head').append(`<meta name="description" content="${GLOSSARY_METADATA.description}">`);

  $('link[rel="canonical"]').remove();
  $('head').append(`<link rel="canonical" href="${GLOSSARY_METADATA.canonicalUrl}">`);

  // Remove existing OG and Twitter tags to prevent duplicate meta tags
  $('meta[property^="og:"]').remove();
  $('meta[name^="twitter:"]').remove();
  $('meta[property^="twitter:"]').remove();

  // Inject Open Graph tags
  $('head').append(`<meta property="og:type" content="${GLOSSARY_METADATA.ogType}">`);
  $('head').append(`<meta property="og:url" content="${GLOSSARY_METADATA.canonicalUrl}">`);
  $('head').append(`<meta property="og:title" content="${GLOSSARY_METADATA.title}">`);
  $('head').append(`<meta property="og:description" content="${GLOSSARY_METADATA.description}">`);
  $('head').append(`<meta property="og:image" content="${GLOSSARY_METADATA.ogImage}">`);
  $('head').append(`<meta property="og:site_name" content="${GLOSSARY_METADATA.ogSiteName}">`);

  // Inject Twitter tags
  $('head').append(`<meta property="twitter:card" content="${GLOSSARY_METADATA.twitterCard}">`);
  $('head').append(`<meta property="twitter:url" content="${GLOSSARY_METADATA.canonicalUrl}">`);
  $('head').append(`<meta property="twitter:title" content="${GLOSSARY_METADATA.title}">`);
  $('head').append(
    `<meta property="twitter:description" content="${GLOSSARY_METADATA.description}">`
  );
  $('head').append(`<meta property="twitter:image" content="${GLOSSARY_METADATA.ogImage}">`);

  // 4. Schema.org DefinedTermSet JSON-LD
  $('script[type="application/ld+json"]').remove();
  const jsonLd = buildGlossaryJsonLd();
  const safeJsonLdString = JSON.stringify(jsonLd, null, 2).replace(/</g, '\\u003c');
  $('head').append(
    `<script type="application/ld+json" id="glossary-jsonld">\n${safeJsonLdString}\n</script>`
  );

  // 5. Write output file
  const glossaryOutputDir = path.resolve(resolvedOutDir, 'glossary');
  fs.mkdirSync(glossaryOutputDir, { recursive: true });

  const outFilePath = path.resolve(glossaryOutputDir, 'index.html');
  fs.writeFileSync(outFilePath, $.html(), 'utf8');

  console.log(
    `[prerender-glossary] ✓ Successfully generated dist/glossary/index.html with ${GLOSSARY_ENTRIES.length} entries`
  );

  return {
    outFilePath,
    termCount: GLOSSARY_ENTRIES.length,
  };
}

// Direct execution entrypoint
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  runGlossaryPrerender().catch((err) => {
    console.error('[prerender-glossary] ✗ Fatal error during prerendering:', err.message);
    process.exit(1);
  });
}
