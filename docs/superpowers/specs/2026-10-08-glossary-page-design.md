# Glossary Page Design Specification

**Feature:** Official Podcast Glossary (`/glossary`)  
**Site:** `familyguyguys.com`  
**Date:** 2026-10-08  
**Status:** Approved for Implementation  

---

## 1. Executive Summary & Goals

The `/glossary` page provides listeners of *Family Guy Guys: The Podcast* with an authoritative, searchable reference guide for the show's recurring critical frameworks, review metrics, host personas, advanced comedic analysis, and meta-lore.

All content is structured, typed, and maintained canonically in `src/data/glossary.ts`. The implementation delivers:
1. **Hydration-compatible static prerendering** (`renderToString` + `hydrateRoot`) generating `dist/glossary/index.html` for instant loading and SEO crawling.
2. **Accessible, responsive UI** honoring the existing site aesthetic and supported light/dark theme behavior (reusing existing styles and design tokens without forcing dark mode).
3. **Instant client-side search & filtering** across terms, aliases, and definitions (150ms debounce).
4. **Anchor-based fragment deep-linking** with responsive sticky navigation offset compensation, single-owner navigation coordinator, and reduced-motion compliance.
5. **SEO parity**: Canonical metadata, social sharing cards with verified image assets, Schema.org `DefinedTermSet` structured data, and updated sitemap XML.

---

## 2. Scope & Boundaries

### 2.1 In Scope for Initial Release
* Canonical data module `src/data/glossary.ts` with strict TypeScript types, 5 categories in order, all 29 entries, normalization/sorting helpers, and alphabet derivation.
* Responsive glossary page module `src/glossary/GlossaryApp.tsx` and stylesheet `src/glossary/styles/glossary.css`.
* Category navigation landmark (`<nav aria-label="Glossary categories">`) with 5 category jump links.
* Client-side search and filtering across terms, aliases, and definitions (150ms debounce) with live `role="status"` result count and immediate clear button.
* Entry card rendering with semantic heading hierarchy (`h1` → `h2` per category → `h3` per term), visible reference notes, and episode chips resolving against verified podcast episode review routes (or static chips when unreleased).
* Routing integration (`/glossary`, `/glossary/`) with idempotent lazy mounting, single-owner fragment navigation coordinator, and site navigation links (desktop nav, mobile drawer, footer).
* Postbuild static HTML prerendering (`src/scripts/prerender-glossary.js`) generating `dist/glossary/index.html` with full content, SEO metadata, and `DefinedTermSet` JSON-LD.
* Sitemap maintenance in `public/sitemap.xml` preserving existing canonical routes.
* Vitest test suites for data integrity (`tests/glossaryData.test.ts`) and isolated prerender HTML generation (`tests/prerenderGlossary.test.ts`).

### 2.2 Explicitly Out of Scope for Initial Release
* Global A–Z quick-jump / alphabet filter bar in the UI (retained only as an exported data helper `getGlossaryAlphabet()` for potential future release).
* Arbitrary third-party dependencies or external routing libraries.
* Direct production deployment (`wrangler deploy` remains unauthorized).

---

## 3. Data Architecture (`src/data/glossary.ts`)

### 3.1 Types and Union
```ts
export type GlossaryCategoryId =
  | 'frameworks'
  | 'segments'
  | 'personas'
  | 'terminology'
  | 'aliases';

export interface EpisodeRef {
  season: number;
  episode: number;
  timestamp?: string; // display-only string; never parsed as numeric or used for arithmetic/sorting
  note?: string;
}

export interface GlossaryCategory {
  id: GlossaryCategoryId;
  name: string;
  emoji: string;
}

export interface GlossaryEntry {
  id: string; // kebab-case slug: /^[a-z0-9]+(?:-[a-z0-9]+)*$/
  term: string;
  aka?: string;
  categoryId: GlossaryCategoryId;
  definition: string;
  origin?: EpisodeRef | null;
  references: EpisodeRef[];
}
```

### 3.2 Categories & Order
Strictly ordered array of 5 categories:
1. `frameworks`: `Critical & Comedic Frameworks` (`🎭`)
2. `segments`: `Recurring Segments & Review Metrics` (`📺`)
3. `personas`: `Host Personas, Inside Jokes & Production Slang` (`🎙️`)
4. `terminology`: `Advanced Comedic Terminology` (`📐`)
5. `aliases`: `Host Aliases & Meta-Lore` (`🎩`)

### 3.3 Normalization, Consistent Sorting, and Alphabet Helpers
* **Normalization helper**:
  ```ts
  export function getGlossarySortKey(term: string): string {
    const trimmed = term.trim().toLowerCase();
    return trimmed.startsWith('the ') ? trimmed.slice(4).trim() : trimmed;
  }
  ```
  Ensures terms such as "The Blue Tent" sort under "B" and "The Lisa Metrics" sort under "L".
* **Category entry helper**:
  ```ts
  export function getEntriesByCategory(categoryId: GlossaryCategoryId): GlossaryEntry[] {
    return GLOSSARY_ENTRIES
      .filter((entry) => entry.categoryId === categoryId)
      .slice()
      .sort((a, b) =>
        getGlossarySortKey(a.term).localeCompare(
          getGlossarySortKey(b.term),
          'en',
          { sensitivity: 'base' }
        )
      );
  }
  ```
  Specifying `'en', { sensitivity: 'base' }` ensures deterministic, identical collation across Node build-time and browser runtime. Does not mutate `GLOSSARY_ENTRIES`.
* **Alphabet derivation**:
  ```ts
  export function getGlossaryAlphabet(): string[] {
    const letters = new Set<string>();
    for (const entry of GLOSSARY_ENTRIES) {
      const key = getGlossarySortKey(entry.term);
      if (key.length > 0) {
        letters.add(key[0].toUpperCase());
      }
    }
    return Array.from(letters).sort((a, b) => a.localeCompare(b, 'en', { sensitivity: 'base' }));
  }
  ```
* **Constants**:
  * `GLOSSARY_ENTRIES`: Canonical typed array of all 29 entries defined directly in `src/data/glossary.ts` with `satisfies GlossaryEntry[]`.
  * `export const GLOSSARY_ENTRY_COUNT = GLOSSARY_ENTRIES.length;` (currently 29 as content baseline).

---

## 4. UI Component Architecture (`src/glossary/GlossaryApp.tsx`)

### 4.1 Layout & Visual Design
* Container uses existing `.page-content` and `.halftone-bg` styles.
* Typography and colors inherit from `:root` variables (`--font-display`, `--font-accent`, `--orange`, `--teal`, `--maroon`, `--black`, `--off-white`) preserving supported light/dark theme behavior.
* Semantic heading structure:
  * Single `h1`: `Official Podcast Glossary`
  * Introductory paragraph:
    > "Welcome to the official glossary for *Family Guy Guys: The Podcast*. Whether you are a first-time listener or a seasoned 'Family Guy Guys Guy,' use this guide to navigate our critical frameworks, recurring review segments, and production lore."

### 4.2 Category Navigation Landmark
* Rendered as:
  ```tsx
  <nav aria-label="Glossary categories" className="glossary-category-nav">
    {visibleCategories.map((cat) => (
      <a key={cat.id} href={`#category-${cat.id}`} className="glossary-cat-pill">
        <span>{cat.emoji}</span> {cat.name}
      </a>
    ))}
  </nav>
  ```
* Responsive sticky positioning below site navigation using CSS custom properties:
  `--glossary-nav-top: var(--site-header-height, 60px);`
* Mobile horizontal scrolling with touch momentum.
* Only displays links for categories that currently contain visible results during active filtering.

### 4.3 Instant Search & Filtering
* **Input Element**:
  * Visibly labeled: `<label htmlFor="glossary-search-input">Search glossary</label>`.
  * Input value reflects keystrokes immediately.
  * Debounces filter evaluation by 150ms without dropping input focus.
  * Searches `term`, `aka`, and `definition` case-insensitively.
* **Results Count**:
  * Hosted in a persistent live region: `<div role="status" aria-live="polite" className="glossary-search-status">Showing {visibleCount} of {GLOSSARY_ENTRY_COUNT} entries</div>`.
  * Immediate "Clear search" button resets the query and restores all entries without page scroll.
* **Empty State**:
  * Friendly message: "No glossary terms match your search. Try another keyword."

### 4.4 Entry Cards & Semantic Anchors
* Each entry rendered as:
  ```tsx
  <article id={entry.id} className="glossary-card">
    <div className="glossary-card-header">
      <h3 className="glossary-term">{entry.term}</h3>
      {entry.aka && <span className="glossary-aka">Also known as: {entry.aka}</span>}
    </div>
    <p className="glossary-definition">{entry.definition}</p>
    {/* Origin & References metadata rows */}
  </article>
  ```
* **Category Anchors**: Each section has `<section id={`category-${cat.id}`} className="glossary-category-section">` with an `h2` heading (`{cat.emoji} {cat.name}`).
* **Responsive Offset**:
  * Both `category-*` sections and entry `article` elements apply:
    `scroll-margin-top: calc(var(--site-header-height, 60px) + var(--glossary-nav-height, 50px) + 16px);`

### 4.5 Episode Chips & Linking Resolution
* Chips format episodes as `S{season}E{episode}` (e.g. `S1E7`, `S2E6`).
* **Origin Row**: Rendered only when `entry.origin` is present and non-null.
* **References Row**: Rendered only when `entry.references.length > 0`.
* **Resolution**:
  * Resolves against verified podcast episode review routes (`/reviews/s1e1`..`/reviews/s1e6`).
  * If destination page exists, render `<a href={url} className="episode-chip episode-chip-link">`.
  * If unreleased or nonexistent, render static `<span className="episode-chip episode-chip-static">`.
* **Notes**: Displayed inline in subdued text adjacent to the chip (e.g., `(Amish horse spontaneously exploding example)`).

---

## 5. Routing, Mounting & Navigation Coordinator

### 5.1 Route Handling (`src/router.js`)
* Matches `/glossary` and `/glossary/` (preserving query parameters and hash fragments).
* Sets `document.title = 'Glossary — Family Guy Guys'`.
* Synchronizes `.active` class on `#nav-glossary` and mobile drawer link.
* Does NOT call general `window.scrollTo(0, 0)` if navigating with a fragment identifier to `/glossary#...`.
* Updates and restores page-specific metadata (title, meta description, canonical, and JSON-LD) during client-side route transitions.

### 5.2 Idempotent, Retry-Safe Lazy Mounting (`src/main.js` & `src/glossary/mount.tsx`)
* Covers initial direct loading (even if first router event occurred before listener registration) as well as SPA navigation.
* Tracks:
  * `let glossaryMountPromise: Promise<void> | null = null;`
  * `let glossaryMounted = false;`
* On route change to `glossary`:
  1. Checks for `#glossary-app` container existence.
  2. If already mounted, delegates to navigation coordinator to resolve current hash.
  3. If currently loading, awaits the existing promise.
  4. On load failure, clears pending promise, displays retry UI, and logs error.
* Hydration logic:
  * If container has pre-rendered HTML matching React structure, uses `hydrateRoot(container, <GlossaryApp onReady={...} />)`.
  * Otherwise, uses `createRoot(container).render(<GlossaryApp onReady={...} />)`.

### 5.3 Single-Owner Fragment Navigation Coordinator
* Coordinates fragment scrolling post-commit:
  1. Distinguishes initial page load from later SPA navigation using navigation coordinator context.
  2. Verifies `/glossary` is still the active route.
  3. Reads and safely decodes `window.location.hash.slice(1)`.
  4. If the target entry is currently hidden by active search filters, clears the search filter and waits for the state update to commit before scrolling.
  5. Finds element via `document.getElementById(targetId)`.
  6. Performs at most one programmatic scroll:
     * For initial direct deep-link load: `target.scrollIntoView({ behavior: 'auto' })`.
     * For user-initiated in-page or SPA navigation: `target.scrollIntoView({ behavior: prefersReducedMotion ? 'auto' : 'smooth' })`.
  7. Discards stale navigation requests if the user navigated away during asynchronous mounting or search clearing.
  8. Preserves browser Back/Forward history navigation.

---

## 6. Build Prerendering, SEO & Sitemap (`src/scripts/prerender-glossary.js`)

### 6.1 Static Pre-rendering
* **Script**: `src/scripts/prerender-glossary.js`, executed during `npm run postbuild`.
* Uses `renderToString(React.createElement(GlossaryApp))` with standard initial state (search empty, all 29 entries rendered).
* Reuses existing build pipeline conventions for loading/bundling TSX components.
* Accepts configurable input/output paths for isolated test runner execution without polluting `dist/`.
* Outputs to `dist/glossary/index.html`.
* HTML Assembly:
  * Fails clearly if expected container `#glossary-app` is missing or ambiguous.
  * Injects pre-rendered HTML into `#glossary-app`.
  * Activates `#page-glossary` (`class="page active"`).
  * Deactivates all other page containers (`#page-home`, `#page-episodes`, `#page-reviews`, `#page-headers-gaggs`, `#page-contact`, `#page-404`).
  * Preserves built asset references and verifies they resolve from `/glossary` and `/glossary/`.

### 6.2 Metadata & Open Graph
* `<title>Glossary — Family Guy Guys</title>`
* `<meta name="description" content="The official Family Guy Guys glossary: Structurehead, Gagger, Stewie Gay Watch, Arbitrary Rating Units, and every bit of lore from the podcast.">`
* `<link rel="canonical" href="https://familyguyguys.com/glossary">`
* Social cards reuse verified existing assets:
  * Image: `https://familyguyguys.com/hero-1200w.webp` (existing verified public sharing image from `index.html`).
  * Twitter card: `summary_large_image`.

### 6.3 JSON-LD Structured Data (`DefinedTermSet`)
* Emits a valid Schema.org `DefinedTermSet`:
  ```json
  {
    "@context": "https://schema.org",
    "@type": "DefinedTermSet",
    "@id": "https://familyguyguys.com/glossary#term-set",
    "url": "https://familyguyguys.com/glossary",
    "name": "Family Guy Guys Official Podcast Glossary",
    "description": "The official glossary of critical frameworks, segments, and lore from Family Guy Guys: The Podcast.",
    "hasDefinedTerm": [
      {
        "@type": "DefinedTerm",
        "@id": "https://familyguyguys.com/glossary#structurehead",
        "url": "https://familyguyguys.com/glossary#structurehead",
        "name": "Structurehead",
        "description": "A listener, host, or comedian who evaluates television comedy through the lens of classical story architecture, joke mechanics, setups, payoffs, rule of thirds, and narrative logic.",
        "termCode": "structurehead",
        "inDefinedTermSet": "https://familyguyguys.com/glossary#term-set"
      }
    ]
  }
  ```
* Serialized safely for inline `<script type="application/ld+json">`, escaping `<` as `\u003c`.

### 6.4 Sitemap Update
* Updates `public/sitemap.xml` (or `dist/sitemap.xml`) including:
  * `https://familyguyguys.com/`
  * `https://familyguyguys.com/episodes`
  * `https://familyguyguys.com/reviews`
  * `https://familyguyguys.com/headers-gaggs`
  * `https://familyguyguys.com/contact`
  * `https://familyguyguys.com/glossary`
  * Plus any existing canonical review routes already present.
* Uses clean `<loc>` tags without unsupported priority/changefreq tags.

---

## 7. Testing & Quality Gates

### 7.1 Data Integrity Tests (`tests/glossaryData.test.ts`)
* Asserts `GLOSSARY_CATEGORIES` has exactly 5 categories matching `GlossaryCategoryId` union in exact order.
* Asserts `GLOSSARY_ENTRIES.length === 29` (baseline count).
* Asserts all entry IDs match `/^[a-z0-9]+(?:-[a-z0-9]+)*$/` and are strictly unique.
* Asserts every `categoryId` maps to an existing category ID at runtime.
* Asserts every category contains $\ge 1$ entry.
* Asserts required fields (`id`, `term`, `definition`) are non-empty trimmed strings (`.trim().length > 0`).
* Asserts timestamps and notes (when present) are non-empty strings.
* Asserts `season` and `episode` are positive integers ($\ge 1$).
* Asserts `getEntriesByCategory` does not mutate `GLOSSARY_ENTRIES`.
* Asserts `getGlossarySortKey("The Blue Tent") === "blue tent"` and `"The Lisa Metrics" === "lisa metrics"`.
* Asserts `getGlossaryAlphabet()` contains derived letters (including `B` and `L`).

### 7.2 Prerender Isolation Tests (`tests/prerenderGlossary.test.ts`)
* Uses isolated temporary directories (`node:os` or temp fixtures) to avoid touching shared `dist/`.
* Uses HTML parser to verify DOM nodes:
  * Exactly 1 `h1` in glossary container.
  * Exactly 5 category `h2` headings.
  * Exactly 29 entry `h3` terms and matching definition text inside `<article id="...">`.
  * Exactly 1 active page wrapper (`#page-glossary`).
  * Unique category jump link targets matching category section IDs.
  * SEO metadata and social sharing tags present once without duplicates.
  * JSON-LD parses and contains 29 `DefinedTerm` entries matching dataset.
  * Safe JSON-LD serialization escapes HTML tags (`<`, `</script>`).

### 7.3 Browser Acceptance Verification & Reporting
* Manual/preview browser checks:
  1. Direct load `/glossary` and `/glossary/`.
  2. Hydration without warnings; search and filtering work smoothly afterward.
  3. Direct load `/glossary#dick-cam`.
  4. Cross-page navigation to entry fragment.
  5. Leaving and returning to already-mounted glossary with different fragment.
  6. Browser Back/Forward navigation.
  7. Rapid navigation away during loading without scrolling destination page.
  8. Failed lazy loading followed by successful retry.
  9. Search matching terms, aliases, and definitions; empty state; clear button; retained focus.
  10. Keyboard navigation, visible focus outlines, mobile sticky offsets, and reduced-motion behavior.
* Final verification report detailing:
  * Typecheck command and results (`npm run typecheck`).
  * Lint command and results (`npm run lint`).
  * Test execution in non-watch mode (`npm run test`) with exact before-and-after test counts.
  * Clean production build command (`npm run build`).
  * Verification summary of browser acceptance checks.
