# Glossary Page Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build and integrate an accessible, statically prerendered `/glossary` page on `familyguyguys.com` from structured canonical podcast data, with client-side instant search, sticky category navigation, and Schema.org structured data.

**Architecture:** A canonical TypeScript data layer (`src/data/glossary.ts`) supplies 5 ordered categories and 29 validated entries to a zero-loader React 19 component (`src/glossary/GlossaryApp.ts`). Static prerendering (`src/scripts/prerender-glossary.js`) generates `dist/glossary/index.html` via `renderToString`, while the client hydrates with `hydrateRoot` via an idempotent mounting module (`src/glossary/mount.tsx`) governed by a single-owner fragment navigation coordinator.

**Tech Stack:** TypeScript, React 19, Vite, Vitest, Vanilla CSS with custom properties, Cloudflare Workers static assets via Wrangler.

## Global Constraints

- **Theme & Styles:** Respect existing site aesthetic and supported light/dark theme behavior; reuse existing `:root` variables and design tokens; do not force dark mode or introduce unrelated design systems.
- **Dependencies:** Zero new runtime or dev dependencies; use existing `react`, `react-dom`, `vitest`, `cheerio`, `typescript`, `vite`.
- **Navigation Scope:** Category navigation and search filter only; A–Z UI is strictly out of scope for initial release; retain `getGlossaryAlphabet()` as an exported data helper.
- **Collation Consistency:** In `localeCompare`, strictly specify `'en', { sensitivity: 'base' }` for identical sorting between Node build-time and browser runtimes.
- **Change Control:** Do not deploy, commit, or create PRs without explicit approval; keep diffs minimal and task-scoped; run non-watch verification commands.

---

### Task 1: Canonical Data Module (`src/data/glossary.ts`) & Data Integrity Tests (`tests/glossaryData.test.ts`)

**Files:**
- Create: `src/data/glossary.ts`
- Create: `tests/glossaryData.test.ts`
- Modify: `tsconfig.json` (add `"src/data/**/*.ts"` and `"src/glossary/**/*.ts"` to `"include"`)

**Interfaces:**
- Consumes: `glossary-data.json` (as source data for inlining into TypeScript module)
- Produces:
  - `export type GlossaryCategoryId = 'frameworks' | 'segments' | 'personas' | 'terminology' | 'aliases';`
  - `export interface EpisodeRef { season: number; episode: number; timestamp?: string; note?: string; }`
  - `export interface GlossaryCategory { id: GlossaryCategoryId; name: string; emoji: string; }`
  - `export interface GlossaryEntry { id: string; term: string; aka?: string; categoryId: GlossaryCategoryId; definition: string; origin?: EpisodeRef | null; references: EpisodeRef[]; }`
  - `export const GLOSSARY_CATEGORIES: GlossaryCategory[];`
  - `export const GLOSSARY_ENTRIES: GlossaryEntry[];`
  - `export const GLOSSARY_ENTRY_COUNT: number;`
  - `export function getGlossarySortKey(term: string): string;`
  - `export function getEntriesByCategory(categoryId: GlossaryCategoryId): GlossaryEntry[];`
  - `export function getGlossaryAlphabet(): string[];`

- [ ] **Step 1: Write the failing data integrity test suite**

Write `tests/glossaryData.test.ts`:
```ts
import { describe, it, expect } from 'vitest';
import {
  GLOSSARY_CATEGORIES,
  GLOSSARY_ENTRIES,
  GLOSSARY_ENTRY_COUNT,
  getGlossarySortKey,
  getEntriesByCategory,
  getGlossaryAlphabet,
  GlossaryCategoryId,
} from '../src/data/glossary.js';

describe('Glossary Canonical Data Layer', () => {
  it('defines exactly 5 categories in canonical order', () => {
    expect(GLOSSARY_CATEGORIES).toHaveLength(5);
    expect(GLOSSARY_CATEGORIES.map((c) => c.id)).toEqual([
      'frameworks',
      'segments',
      'personas',
      'terminology',
      'aliases',
    ]);
  });

  it('matches baseline count of 29 entries', () => {
    expect(GLOSSARY_ENTRIES).toHaveLength(29);
    expect(GLOSSARY_ENTRY_COUNT).toBe(29);
  });

  it('enforces unique kebab-case IDs on every entry', () => {
    const idRegex = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
    const seenIds = new Set<string>();

    for (const entry of GLOSSARY_ENTRIES) {
      expect(entry.id).toMatch(idRegex);
      expect(seenIds.has(entry.id)).toBe(false);
      seenIds.add(entry.id);
    }
  });

  it('validates every categoryId maps to an exported category ID', () => {
    const validCategoryIds = new Set(GLOSSARY_CATEGORIES.map((c) => c.id));
    for (const entry of GLOSSARY_ENTRIES) {
      expect(validCategoryIds.has(entry.categoryId)).toBe(true);
    }
  });

  it('contains at least one entry in every defined category', () => {
    for (const category of GLOSSARY_CATEGORIES) {
      const entries = getEntriesByCategory(category.id);
      expect(entries.length).toBeGreaterThan(0);
    }
  });

  it('validates non-empty trimmed strings for required fields', () => {
    for (const entry of GLOSSARY_ENTRIES) {
      expect(entry.id.trim().length).toBeGreaterThan(0);
      expect(entry.term.trim().length).toBeGreaterThan(0);
      expect(entry.definition.trim().length).toBeGreaterThan(0);
      if (entry.aka !== undefined) {
        expect(entry.aka.trim().length).toBeGreaterThan(0);
      }
    }
  });

  it('validates origin structure and episode numbering when present', () => {
    for (const entry of GLOSSARY_ENTRIES) {
      if (entry.origin) {
        expect(Number.isInteger(entry.origin.season)).toBe(true);
        expect(entry.origin.season).toBeGreaterThanOrEqual(1);
        expect(Number.isInteger(entry.origin.episode)).toBe(true);
        expect(entry.origin.episode).toBeGreaterThanOrEqual(1);
        if (entry.origin.timestamp !== undefined) {
          expect(typeof entry.origin.timestamp).toBe('string');
          expect(entry.origin.timestamp.trim().length).toBeGreaterThan(0);
        }
        if (entry.origin.note !== undefined) {
          expect(typeof entry.origin.note).toBe('string');
          expect(entry.origin.note.trim().length).toBeGreaterThan(0);
        }
      }
    }
  });

  it('validates references array structure', () => {
    for (const entry of GLOSSARY_ENTRIES) {
      expect(Array.isArray(entry.references)).toBe(true);
      for (const ref of entry.references) {
        expect(Number.isInteger(ref.season)).toBe(true);
        expect(ref.season).toBeGreaterThanOrEqual(1);
        expect(Number.isInteger(ref.episode)).toBe(true);
        expect(ref.episode).toBeGreaterThanOrEqual(1);
        if (ref.note !== undefined) {
          expect(typeof ref.note).toBe('string');
          expect(ref.note.trim().length).toBeGreaterThan(0);
        }
      }
    }
  });

  it('normalizes sort keys ignoring leading "The "', () => {
    expect(getGlossarySortKey('The Blue Tent')).toBe('blue tent');
    expect(getGlossarySortKey('The Lisa Metrics')).toBe('lisa metrics');
    expect(getGlossarySortKey('Structurehead')).toBe('structurehead');
    expect(getGlossarySortKey('  The Cheesecake Factory Zone  ')).toBe('cheesecake factory zone');
  });

  it('sorts category entries alphabetically without mutating GLOSSARY_ENTRIES', () => {
    const originalFirstId = GLOSSARY_ENTRIES[0].id;
    const sortedFrameworks = getEntriesByCategory('frameworks');
    expect(sortedFrameworks.map((e) => e.term)).toEqual([
      'Gagger',
      'Hat on a Hat vs. Cherry on Top',
      'Structurehead',
      'Structurehead Head Nod',
    ]);
    expect(GLOSSARY_ENTRIES[0].id).toBe(originalFirstId);
  });

  it('derives uppercase alphabet from normalized sort keys including B and L', () => {
    const alphabet = getGlossaryAlphabet();
    expect(alphabet).toContain('B');
    expect(alphabet).toContain('L');
    expect(alphabet).toContain('S');
    // Ensure sorted order
    const sortedCopy = [...alphabet].sort((a, b) => a.localeCompare(b, 'en', { sensitivity: 'base' }));
    expect(alphabet).toEqual(sortedCopy);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm run test tests/glossaryData.test.ts`
Expected: FAIL with "Cannot find module '../src/data/glossary.js'"

- [ ] **Step 3: Implement `src/data/glossary.ts` and update `tsconfig.json`**

Update `tsconfig.json` to include `"src/data/**/*.ts"`, `"src/glossary/**/*.ts"`, `"src/glossary/**/*.tsx"`.
Write `src/data/glossary.ts` with all 29 entries mapped from `glossary-data.json`, using typed `categoryId`, normalized sorting, and derived helpers.

- [ ] **Step 4: Run test to verify it passes**

Run: `npm run test tests/glossaryData.test.ts`
Expected: PASS (all 11 tests passing)

- [ ] **Step 5: Verify TypeScript check**

Run: `npm run typecheck`
Expected: Clean pass with 0 errors.

---

### Task 2: Glossary Page Component (`src/glossary/GlossaryApp.ts`), Styles (`src/glossary/styles/glossary.css`), and Mounting Module (`src/glossary/mount.tsx`)

**Files:**
- Create: `src/glossary/styles/glossary.css`
- Create: `src/glossary/GlossaryApp.ts`
- Create: `src/glossary/mount.tsx`

**Interfaces:**
- Consumes:
  - `src/data/glossary.ts`: `GLOSSARY_CATEGORIES`, `GLOSSARY_ENTRIES`, `GLOSSARY_ENTRY_COUNT`, `getEntriesByCategory`, `getGlossarySortKey`
- Produces:
  - `src/glossary/GlossaryApp.ts`: `GlossaryApp({ onReady?: () => void })` (React 19 component written using `React.createElement` for zero-loader native Node ESM support as well as browser bundling)
  - `src/glossary/mount.tsx`: `mountGlossary(container: HTMLElement, options?: { isHydration?: boolean })`

- [ ] **Step 1: Write `src/glossary/styles/glossary.css`**

Create `src/glossary/styles/glossary.css` defining:
- CSS custom properties: `--glossary-nav-top: var(--site-header-height, 60px);`, `--glossary-nav-height: 48px;`
- Responsive anchor offset: `scroll-margin-top: calc(var(--glossary-nav-top) + var(--glossary-nav-height) + 16px);` for `.glossary-category-section` and `.glossary-card`
- Category navigation landmark: `.glossary-category-nav` with sticky positioning, horizontal touch scrolling (`overflow-x: auto`), hide scrollbar, pill buttons with active focus states
- Search bar: `.glossary-search-container`, visible `<label>`, `.glossary-search-input`, clear button, `.glossary-search-status` (`role="status"`)
- Cards & Typography: `.glossary-card`, `.glossary-term` (`h3`), `.glossary-aka`, `.glossary-definition`
- Episode chips: `.episode-chip`, `.episode-chip-link`, `.episode-chip-static`, `.episode-note`
- Reduced-motion queries: `@media (prefers-reduced-motion: reduce) { html { scroll-behavior: auto; } }`
- Responsive breakpoints for mobile viewports

- [ ] **Step 2: Write `src/glossary/GlossaryApp.ts`**

Write `src/glossary/GlossaryApp.ts` using `React.createElement`:
- Canonical verified episode catalog: Set of known published episode review paths (e.g. `s1e1`, `s1e2`, `s1e3`, `s1e4`, `s1e5`, `s1e6` matching `/reviews/s1e1`..`/reviews/s1e6`).
- Header with `h1` "Official Podcast Glossary" and exact intro copy.
- Category navigation `<nav aria-label="Glossary categories">` listing only categories with visible matching entries.
- Search input with visible label, immediate controlled input value, and 150ms debounced filter query.
- Live status region `<div role="status" aria-live="polite">Showing {count} of {GLOSSARY_ENTRY_COUNT} entries</div>`.
- Category sections with `h2` and entry cards with `h3`.
- Origin row (omitted if absent/null) and references row (omitted if empty array), rendering link if published review exists or static chip otherwise, with inline reference notes.
- Empty search state with one-click "Clear search" button.
- Calls `onReady?.()` in a post-commit `useEffect`.

- [ ] **Step 3: Write `src/glossary/mount.tsx`**

Write `src/glossary/mount.tsx`:
- Tracks singleton React root and pending mount promise.
- Uses `hydrateRoot` if container has pre-rendered HTML child nodes; otherwise `createRoot`.
- Single-owner fragment navigation coordinator:
  - Reads `window.location.hash.slice(1)` safely via `decodeURIComponent`.
  - If target entry is filtered out, triggers search clear and awaits re-render before scrolling.
  - Distinguishes initial page load (`behavior: 'auto'`) from SPA navigation (`behavior: prefersReducedMotion ? 'auto' : 'smooth'`).
  - Guards against stale route changes if user navigated away while mounting.
  - Listens to `popstate` to handle browser Back/Forward fragment navigation while `/glossary` is active.

- [ ] **Step 4: Verify typecheck passes**

Run: `npm run typecheck`
Expected: 0 errors.

---

### Task 3: Client Routing & Navigation Integration (`src/router.js`, `src/main.js`, `index.html`)

**Files:**
- Modify: `src/router.js`
- Modify: `src/main.js`
- Modify: `index.html`

**Interfaces:**
- Consumes:
  - `src/glossary/mount.tsx`: `mountGlossary`
- Produces:
  - Route `/glossary` and `/glossary/` in SPA router
  - Navigation links in header, mobile drawer, and footer

- [ ] **Step 1: Update `src/router.js`**

- In `getPages()`, add `glossary: document.getElementById('page-glossary')`.
- In `ROUTE_TITLES`, add `glossary: 'Glossary — Family Guy Guys'`.
- In `handleLocation()`:
  - Handle `path === '/glossary'` setting `activePage = 'glossary'`.
  - Handle trailing slash normalization while preserving search and hash.
  - Bypass `window.scrollTo(0, 0)` when navigating to `/glossary` with a `#hash` to let the glossary coordinator handle fragment positioning.
  - Update page-specific metadata (title, meta description, canonical link).

- [ ] **Step 2: Update `index.html`**

- Add desktop nav link: `<li><a href="/glossary" id="nav-glossary">Glossary</a></li>`.
- Add mobile nav link: `<a href="/glossary">Glossary</a>` in `#mobileNav`.
- Add footer link: `<a href="/glossary" style="color: var(--orange); text-decoration: none;">Glossary</a> &middot;`.
- Add page container:
  ```html
  <!-- ===== GLOSSARY PAGE ===== -->
  <div class="page" id="page-glossary">
    <div class="page-content halftone-bg" style="min-height:100vh;">
      <div id="glossary-app"></div>
    </div>
  </div>
  ```

- [ ] **Step 3: Update `src/main.js`**

- In `src/main.js`, add lazy loading listener for `page === 'glossary'`:
  - Retains shared in-flight promise and mounted state.
  - Awaits container existence before mounting.
  - Dynamic `import('./glossary/mount.tsx')`.
  - Handles initial direct route load on startup as well as subsequent `routechange` events.
  - Error state handling with visible retry prompt.

- [ ] **Step 4: Run existing tests and typecheck**

Run: `npm run typecheck && npm run test`
Expected: All existing tests and data tests pass.

---

### Task 4: Build Prerender Pipeline (`src/scripts/prerender-glossary.js`, `package.json`, `public/sitemap.xml`) & Prerender Tests (`tests/prerenderGlossary.test.ts`)

**Files:**
- Create: `src/scripts/prerender-glossary.js`
- Create: `tests/prerenderGlossary.test.ts`
- Modify: `package.json`
- Create/Modify: `public/sitemap.xml`

**Interfaces:**
- Consumes:
  - `src/glossary/GlossaryApp.ts`: `GlossaryApp`
  - `src/data/glossary.ts`: `GLOSSARY_CATEGORIES`, `GLOSSARY_ENTRIES`
- Produces:
  - `runGlossaryPrerender(options)`
  - `dist/glossary/index.html` at build time
  - Updated `public/sitemap.xml`

- [ ] **Step 1: Write isolated prerender test suite `tests/prerenderGlossary.test.ts`**

Write `tests/prerenderGlossary.test.ts`:
```ts
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'fs';
import path from 'path';
import os from 'os';
import * as cheerio from 'cheerio';
import { runGlossaryPrerender } from '../src/scripts/prerender-glossary.js';
import { GLOSSARY_CATEGORIES, GLOSSARY_ENTRIES } from '../src/data/glossary.js';

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
    await runGlossaryPrerender({
      templatePath: templateHtmlPath,
      outDir,
    });

    const generatedHtmlPath = path.join(outDir, 'glossary', 'index.html');
    expect(fs.existsSync(generatedHtmlPath)).toBe(true);
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

    // Assert JSON-LD DefinedTermSet
    const jsonLdScripts = $('script[type="application/ld+json"]');
    expect(jsonLdScripts.length).toBeGreaterThan(0);
    const jsonLd = JSON.parse(jsonLdScripts.first().html() || '{}');
    expect(jsonLd['@type']).toBe('DefinedTermSet');
    expect(jsonLd['@id']).toBe('https://familyguyguys.com/glossary#term-set');
    expect(jsonLd.hasDefinedTerm).toHaveLength(29);
    expect(jsonLd.hasDefinedTerm[0]['@type']).toBe('DefinedTerm');
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
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm run test tests/prerenderGlossary.test.ts`
Expected: FAIL with "Cannot find module '../src/scripts/prerender-glossary.js'"

- [ ] **Step 3: Implement `src/scripts/prerender-glossary.js`**

Implement `src/scripts/prerender-glossary.js`:
- Uses `renderToString(React.createElement(GlossaryApp))` from `react-dom/server`.
- Injects generated markup into `#glossary-app`.
- Activates `#page-glossary`, deactivates all other `.page` containers.
- Replaces `<title>`, `<meta name="description">`, `<link rel="canonical">`, Open Graph, and Twitter tags cleanly without duplicates.
- Injects Schema.org `DefinedTermSet` JSON-LD safely escaping `<` as `\u003c`.
- Accepts `{ templatePath, outDir }` arguments for test isolation; defaults to `dist/index.html` and `dist`.

- [ ] **Step 4: Update `package.json` postbuild script and `public/sitemap.xml`**

- In `package.json`, update `postbuild`:
  `"postbuild": "node src/scripts/prerender-reviews.js && node src/scripts/prerender-glossary.js"`
- In `public/sitemap.xml`, ensure `<url><loc>https://familyguyguys.com/glossary</loc></url>` is present alongside canonical routes (`/`, `/episodes`, `/reviews`, `/headers-gaggs`, `/contact`).

- [ ] **Step 5: Run tests and verify they pass**

Run: `npm run test tests/prerenderGlossary.test.ts`
Expected: PASS (all 3 tests passing)

---

### Task 5: End-to-End Verification, Performance & Quality Gate Suite

**Files:**
- Verify: Full repository build and verification suite

**Interfaces:**
- Consumes: All modules created and modified in Tasks 1–4
- Produces: Clean build artifacts in `dist/`, verified non-watch test run, and verification summary report

- [x] **Step 1: Run TypeScript typecheck**

Run: `npm run typecheck`
Expected: 0 errors.

- [x] **Step 2: Run ESLint**

Run: `npm run lint`
Expected: Clean pass with 0 errors (existing warnings only).

- [x] **Step 3: Run full Vitest test suite**

Run: `npm run test`
Expected: All test suites pass (report exact test count before: 87, and after: 87 + 14 = 101 tests; actual final suite contains 116 tests across 9 files).

- [x] **Step 4: Execute production build**

Run: `npm run build:fixture`
Expected:
1. `vite build` creates `./dist` assets.
2. `node src/scripts/prerender-reviews.js` generates static reviews.
3. `node src/scripts/prerender-glossary.js` generates `dist/glossary/index.html`.
4. Verify `dist/glossary/index.html` exists and contains all 29 terms and definitions.

- [x] **Step 5: Browser acceptance verification check**

Execute local preview with `npm run preview` and verify:
1. Direct load to `/glossary` renders static HTML immediately.
2. Hydration occurs cleanly without console warnings.
3. Search filtering matches term, aka, definition; empty state and clear button function smoothly.
4. Deep link `/glossary#dick-cam` scrolls to target with proper offset under sticky header.
5. In-app navigation from other pages to `/glossary` works seamlessly.
6. Reduced motion preference is respected.

- [x] **Step 6: Report verification results**

Assemble the final verification report with commands executed, test counts, browser checks performed, and confirmation that no production deployment was run.
