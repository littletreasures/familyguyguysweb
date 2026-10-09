import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'fs';
import path from 'path';
import os from 'os';
import * as cheerio from 'cheerio';
import { runGlossaryPrerender } from '../src/scripts/prerender-glossary.js';
import { GLOSSARY_CATEGORIES, GLOSSARY_ENTRIES } from '../src/data/glossary.ts';

describe('Glossary Static Prerendering Pipeline', () => {
  let tempDir: string;
  let templateHtmlPath: string;

  beforeEach(() => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'glossary-prerender-test-'));
    templateHtmlPath = path.join(tempDir, 'index.html');
    const mockBaseHtml = `<!DOCTYPE html><html><head>
      <title>Base Title</title>
      <meta name="description" content="Base description">
    </head><body>
      <main>
        <div id="page-home" class="page active">Home</div>
        <div id="page-reviews" class="page">Reviews</div>
        <div id="page-glossary" class="page">
          <div id="glossary-app"></div>
        </div>
      </main>
    </body></html>`;
    fs.writeFileSync(templateHtmlPath, mockBaseHtml, 'utf8');
  });

  afterEach(() => {
    fs.rmSync(tempDir, { recursive: true, force: true });
  });

  it('generates dist/glossary/index.html with full static content', async () => {
    const outDir = path.join(tempDir, 'dist');
    const result = await runGlossaryPrerender({
      templatePath: templateHtmlPath,
      outDir,
    });

    const generatedHtmlPath = path.join(outDir, 'glossary', 'index.html');
    expect(fs.existsSync(generatedHtmlPath)).toBe(true);
    expect(result?.outFilePath).toBe(generatedHtmlPath);

    const html = fs.readFileSync(generatedHtmlPath, 'utf8');
    const $ = cheerio.load(html);

    // Exact heading counts within glossary container
    const $app = $('#glossary-app');
    expect($app.find('h1')).toHaveLength(1);
    expect($app.find('h1').text().trim()).toBe('Official Podcast Glossary');
    expect($app.find('h2')).toHaveLength(5);
    expect($app.find('h3')).toHaveLength(29);

    // Assert only glossary page is active
    expect($('#page-glossary').hasClass('active')).toBe(true);
    expect($('#page-home').hasClass('active')).toBe(false);
    expect($('#page-reviews').hasClass('active')).toBe(false);

    // Assert SEO tags
    expect($('title').text().trim()).toBe('Glossary — Family Guy Guys');
    expect($('meta[name="description"]').attr('content')).toBe(
      'The official Family Guy Guys glossary: Structurehead, Gagger, Stewie Gay Watch, Arbitrary Rating Units, and every bit of lore from the podcast.'
    );
    expect($('link[rel="canonical"]').attr('href')).toBe('https://familyguyguys.com/glossary');
    expect($('meta[property="og:image"]').attr('content')).toBe('https://familyguyguys.com/hero-1200w.webp');
    expect($('meta[property="og:title"]').attr('content')).toBe('Glossary — Family Guy Guys');
    expect($('meta[property="og:url"]').attr('content')).toBe('https://familyguyguys.com/glossary');
    expect($('meta[property="og:type"]').attr('content')).toBe('website');
    expect($('meta[property="twitter:card"]').attr('content')).toBe('summary_large_image');
    expect($('meta[property="twitter:title"]').attr('content')).toBe('Glossary — Family Guy Guys');
    expect($('meta[property="twitter:image"]').attr('content')).toBe('https://familyguyguys.com/hero-1200w.webp');

    // Assert JSON-LD DefinedTermSet
    const jsonLdScripts = $('script[type="application/ld+json"]');
    expect(jsonLdScripts.length).toBeGreaterThan(0);
    const jsonLd = JSON.parse(jsonLdScripts.first().html() || '{}');
    expect(jsonLd['@context']).toBe('https://schema.org');
    expect(jsonLd['@type']).toBe('DefinedTermSet');
    expect(jsonLd['@id']).toBe('https://familyguyguys.com/glossary#term-set');
    expect(jsonLd.url).toBe('https://familyguyguys.com/glossary');
    expect(jsonLd.name).toBe('Family Guy Guys Official Podcast Glossary');
    expect(jsonLd.hasDefinedTerm).toHaveLength(29);
    expect(jsonLd.hasDefinedTerm[0]['@type']).toBe('DefinedTerm');
    expect(jsonLd.hasDefinedTerm[0]['@id']).toBe(`https://familyguyguys.com/glossary#${GLOSSARY_ENTRIES[0].id}`);
    expect(jsonLd.hasDefinedTerm[0].url).toBe(`https://familyguyguys.com/glossary#${GLOSSARY_ENTRIES[0].id}`);
    expect(jsonLd.hasDefinedTerm[0].name).toBe(GLOSSARY_ENTRIES[0].term);
    expect(jsonLd.hasDefinedTerm[0].description).toBe(GLOSSARY_ENTRIES[0].definition);
    expect(jsonLd.hasDefinedTerm[0].termCode).toBe(GLOSSARY_ENTRIES[0].id);
    expect(jsonLd.hasDefinedTerm[0].inDefinedTermSet).toBe('https://familyguyguys.com/glossary#term-set');
  });

  it('safely escapes HTML tags in JSON-LD script', async () => {
    const outDir = path.join(tempDir, 'dist');
    await runGlossaryPrerender({
      templatePath: templateHtmlPath,
      outDir,
    });

    const generatedHtmlPath = path.join(outDir, 'glossary', 'index.html');
    const rawHtml = fs.readFileSync(generatedHtmlPath, 'utf8');
    expect(rawHtml).not.toContain('</script><script>');
  });

  it('fails clearly when #glossary-app container is missing', async () => {
    const badTemplatePath = path.join(tempDir, 'bad-index.html');
    fs.writeFileSync(badTemplatePath, '<html><head></head><body>No glossary</body></html>', 'utf8');

    await expect(
      runGlossaryPrerender({
        templatePath: badTemplatePath,
        outDir: path.join(tempDir, 'dist'),
      })
    ).rejects.toThrow(/glossary-app/);
  });

  it('fails clearly when template file does not exist', async () => {
    const nonexistentTemplatePath = path.join(tempDir, 'nonexistent.html');

    await expect(
      runGlossaryPrerender({
        templatePath: nonexistentTemplatePath,
        outDir: path.join(tempDir, 'dist'),
      })
    ).rejects.toThrow(/Base template not found/);
  });
});
