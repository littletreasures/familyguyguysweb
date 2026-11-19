# Impeccable Critique Remediation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Unify `familyguyguys.com` (Home/Shell, React Reviews, and Prerendered Glossary) onto the Halftone Zine Archive system in `DESIGN.md`, eliminate the P0 unreadable empty/error states and all WCAG AA contrast/a11y blockers, repair broken episode/rating/audio data flows, and wire the discovery-to-listener loop defined in `PRODUCT.md`.

**Architecture:** Half of the issues across the three `.impeccable/critique/` snapshots share four cross-cutting root causes: (1) retired fonts (`Homemade Apple` / `Special Elite`), inverted heading tokens (`--font-display`), off-brand ink/accents, and failing `#ffffff`-on-`#e8841a` (`2.71:1`) contrast; (2) nested `<main>` landmarks, skipped headings, unguarded scroll/entry animations, sub-`44px` touch targets, and missing fixed audio-dock bottom clearance; (3) silent fake-data fallback masking Supabase failures; and (4) missing Listen/Watch payoffs and cross-links between Home, Reviews, Glossary, and `/headers-gaggs`. Fixing shared tokens and global chrome first (Phase 0) and P0 Reviews recovery next (Phase 1) prevents rework across route-specific tasks (Phases 2–4).

**Tech Stack:** Vite 7, Vanilla JS SPA shell (`src/main.js`, `src/router.js`, `src/audio-player.js`), React 19 + TypeScript + Tailwind CSS v4 (`src/reviews/`, `src/glossary/`, `src/headers-gaggs/`), static prerender scripts (`src/scripts/prerender-reviews.js`, `src/scripts/prerender-glossary.js`), Vitest + Cheerio.

## Global Constraints

- **Design Tokens (`DESIGN.md`):** Warm Newsprint `#f5f4f0`, Paper White `#ffffff`, Single Ink `#1a1a1a` (never `#000000`, `#222222`, `#333333`, or `#666666`), Broadcast Tangerine `#e8841a`, Burnt Sienna `#7a2b0f`, Studio Pink `#ff72c7` (never `#e87dbf` or `#f472b6`), Host Triad locked (`#1a6b6b` Collin, `#5c1a1a` Tyler, `#aa6200` Jason).
- **Hybrid Heading Rule:** Reserve `Hit and Run` strictly for top-level `h1` and major section `h2` banners; set `h3`, nav, buttons, labels, chips, and prose in `Neue Montreal` (`line-height: 1.55–1.65` for body prose). Zero `Homemade Apple` or `Special Elite` anywhere.
- **Accessibility Floor:** WCAG AA `>= 4.5:1` normal text, `>= 44px × 44px` mobile touch targets, single `<main>` landmark per rendered view, strict heading hierarchy (`h1 -> h2 -> h3`, zero skipped levels), visible focus outlines, `prefers-reduced-motion: reduce` guards on all motion.
- **Static/Hydration & Security Safety:** Keep zero-loader React ESM compatibility in `src/glossary/GlossaryApp.ts` (no JSX), preserve SSR-to-client hydration parity in `src/glossary/mount.tsx`, keep frontend anon-key-only, never invent listener quotes or episode facts, and add zero new npm dependencies.
- **Change Control:** Do not deploy, run migrations, commit, or create PRs without explicit approval; run non-watch verification commands.

## Locked Product & Design Decisions

1. **Primary Button Contrast (`DESIGN.md` Amendment):** Amend `button-primary` in `DESIGN.md` to Zine Ink `#1a1a1a` text on Broadcast Tangerine `#e8841a` (`6.42:1` WCAG AA pass), shifting to Paper White `#ffffff` text on Burnt Sienna `#7a2b0f` (`9.63:1` WCAG AAA pass) on `:hover`.
2. **Audio Dock vs. RSS.com Embeds:** Keep `deriveRssEmbed(episode.podcastUrl)` + external Listen/Watch CTAs on `EpisodePage` (Supabase `podcast_url` stores RSS.com web episode pages like `https://rss.com/podcasts/family-guy-guys/<id>/`, not direct `.mp3` streams); remove dead `#audio-prev`/`#audio-next` buttons from `#persistent-audio-player`, fix the latent `ReferenceError: audioElement is not defined` inside `setupVisualizer()` in `src/audio-player.js:180-196`, replace click-only `#audio-progress-bar-bg` with an accessible `<input type="range">`, toggle `body.has-audio-player` for dynamic bottom clearance, and retain `window.playEpisode` for direct audio URLs only.
3. **`/guest` Visibility & `/contact` Social Links:**
   - **Keep `/guest` unlisted (invite-only via direct URL) for now** until a separate copy de-slop pass is done — do **not** add inbound links to `/guest` in `<nav>`, `#mobileNav`, `/contact`, or `<footer>`. (Still migrate `/guest`'s retired CSS font rules in `src/styles/main.css` and differentiate `.guest-cta-email` as a secondary Paper White + `#1a1a1a` ink button so `/guest` remains visually consistent when visited directly.)
   - **Update `/contact` socials (`index.html:250-266`):** Remove Facebook and Twitter/X (`TODO` links) because the show does not have them. Set Instagram to `https://www.instagram.com/familyguyguys/` (keep IG SVG with `aria-hidden="true"`), and add TikTok at `https://www.tiktok.com/@familyguyguyspod` (with an inline TikTok SVG with `aria-hidden="true"` in `.social-icon-link`). Remove the dead hidden `.newsletter-block` (`index.html:268-275`) and its listener (`src/main.js:280-296`).
4. **Reviews Catalog Default View:** Default `/reviews` to `statusFilter = 'published'` and `sortOrder = 'newest'` with one-click filter/sort controls for `All Statuses` and `Chronological`, synced to URL query parameters (`?q=&season=&status=&sort=`) so pressing Back from static prerendered `/reviews/<slug>` pages preserves filters.
5. **Glossary Card Surfaces & Sticky Category Nav:** Transition all 5 glossary card bodies to `#ffffff` Paper White with a bold `8px` category-colored top accent stripe (`border-top: 8px solid var(--glossary-color-<cat>)`) and accessible Frameworks pill (`#ffffff` on `#6429b8` or `#1a1a1a` on `#d8bef8`, `>= 4.5:1`), shorten sticky pill labels (`Frameworks`, `Segments`, `Host Lore`, `Terminology`, `Aliases`), add mobile right-edge scroll fade, active `IntersectionObserver` scroll-spy, and optional category filtering with an `All` pill (updating `coordinateFragmentNavigation` in `src/glossary/mount.tsx` to also clear any active category filter when navigating to `#entry-id` so fragment deep-links always succeed).

## Source Snapshots & Cross-Audit Deduplication Map

- `.impeccable/critique/2026-11-18T01-42-30Z__index-html.md` — Score `17/40` (`0 P0`, `4 P1`, `1 P2`)
- `.impeccable/critique/2026-11-18T01-43-09Z__src-reviews-reviewapp-tsx.md` — Score `17/40` (`1 P0`, `3 P1`, `1 P2`)
- `.impeccable/critique/2026-11-18T01-43-13Z__src-glossary-glossaryapp-ts.md` — Score `21/40` (`0 P0`, `3 P1`, `2 P2`)

| Shared Root Cause | `index.html` (17/40) | `ReviewApp.tsx` (17/40) | `GlossaryApp.ts` (21/40) | Fixed In |
|---|---|---|---|---|
| Retired fonts (`Homemade Apple` / `Special Elite`) & inverted `--font-display` | P1-1, Minor #5 | P1-3 | P1-2 | Task 0.1, 2.1, 3.1, 4.1 |
| `#ffffff` on `#e8841a` (`2.71:1`) & secondary contrast failures | P1-1 | P1-3, P0-1 | P1-1 | Task 0.1, 1.1, 2.1, 2.3, 4.1 |
| `#000`/`#222`/`#666`, `#e87dbf`/`#f472b6`/`#fbbf24`, pill-button drift | P1-1 | P1-3 | P1-2 | Task 0.1, 2.1, 2.3, 4.1 |
| Nested `<main>`, missing/skipped headings (`h1→h3`, `h2→h4`) | P1-2 | P1-4 *(+ nested `<main>` at L577)* | P1-2 | Task 0.2, 2.2, 2.3, 3.1, 4.1 |
| Fixed bottom audio-dock overlap & unguarded motion | P1-4, P2-5 | P1-4 | P1-3 | Task 0.1, 0.2, 2.1, 2.2, 4.2 |
| Sub-`44px` mobile touch targets & broken mobile chrome | P1-3 | P2-5 | P1-3 | Task 0.2, 2.3, 3.1, 4.2 |
| Silent fake-data fallback masking Supabase errors | P1-4 | P0-1 | — | Task 1.1, 3.2 |
| Missing Listen/Watch payoff & Glossary/Headers-Gaggs cross-links | P1-2, P2-5 | P1-2, P2-5 | P2-5 | Task 1.2, 2.3, 3.1, 4.3 |

---

## Phase 0: Shared Design System Tokens, Typography & Global Chrome

### Task 0.1: Amend `DESIGN.md` & Unify Global Tokens, Fonts, Buttons, Focus Rings, and Motion Guard

**Files:**
- Modify: `DESIGN.md:67-75, 228-230`
- Modify: `index.html:33-36, 490-499`
- Modify: `src/styles/main.css:1-80, 125-141, 291-322, 901-1012, 1907, 2489-2499`
- Modify: `src/router.js:269-285`
- Modify: `tests/glossaryRouting.test.ts:46-54`

**Interfaces:**
- Produces CSS custom properties on `:root` in `src/styles/main.css`:
  - `--font-display: 'Hit and Run', 'Neue Montreal', 'Helvetica Neue', sans-serif;`
  - `--font-sans: 'Neue Montreal', 'Helvetica Neue', sans-serif;`
  - `--pink: #ff72c7;`
  - `.btn-orange`, `.btn-teal`, `.nav-listen-btn`, `.ep-action-btn.watch`, `.ep-action-btn.review`, `.site-footer`

- [ ] **Step 1: Update `tests/glossaryRouting.test.ts` footer assertion to prepare for CSS class styling**

In `tests/glossaryRouting.test.ts:46-54`, replace the inline `style` attribute check with a semantic `.site-footer` check so moving footer styles out of `index.html` inline `style` attributes does not fail the test suite:

```ts
    it('contains footer link to Glossary', () => {
      const $footer = $('footer.site-footer');
      expect($footer.length).toBe(1);
      const $footerLinks = $footer.find('a');
      const hrefs = $footerLinks.map((_, el) => $(el).attr('href')).get();
      expect(hrefs).toContain('/glossary');

      const $glossaryFooter = $('footer a[href="/glossary"]');
      expect($glossaryFooter.text().trim()).toBe('Glossary');
      expect($glossaryFooter.hasClass('site-footer-link')).toBe(true);
    });
```

- [ ] **Step 2: Run the routing test to confirm it fails against current `index.html` inline styles**

Run: `npx vitest run tests/glossaryRouting.test.ts`
Expected: FAIL on `contains footer link to Glossary` (`expected 0 to be 1`).

- [ ] **Step 3: Amend `DESIGN.md` primary button contrast tokens and prose**

In `DESIGN.md:67-75`, update `button-primary.textColor`:

```yaml
  button-primary:
    backgroundColor: "{colors.broadcast-tangerine}"
    textColor: "{colors.zine-ink}"
    typography: "{typography.label}"
    rounded: "{rounded.sm}"
    padding: "10px 22px"
  button-primary-hover:
    backgroundColor: "{colors.burnt-sienna}"
    textColor: "{colors.paper-white}"
```

And in `DESIGN.md:228`:
`- **Primary:** Broadcast Tangerine (`#e8841a`) fill, Zine Ink (`#1a1a1a`) uppercase `Neue Montreal` (`700` weight, `0.85rem`, `letter-spacing: 0.06em`), `0.65rem 1.4rem` padding; shifts to Burnt Sienna (`#7a2b0f`) fill with Paper White (`#ffffff`) text on hover.`

- [ ] **Step 4: Remove retired Google Fonts from `index.html` and move footer styling to CSS**

In `index.html:33-36`, remove the `fonts.googleapis.com` / `fonts.gstatic.com` `preconnect` links and the `<link>` loading `Homemade+Apple&family=Special+Elite`, keeping only Fontshare `Neue Montreal`.

In `index.html:490-499`, replace inline styles on `<footer>` with `.site-footer` and `.site-footer-link` classes (note: `/guest` remains intentionally omitted per Decision Gate #3):

```html
  <!-- FOOTER -->
  <footer class="site-footer">
    <p class="site-footer-copy">&copy; 2026 Family Guy Guys. All rights reserved.</p>
    <p class="site-footer-links">
      <a href="/contact" class="site-footer-link">Contact</a> &middot;
      <a href="/reviews" class="site-footer-link">Reviews</a> &middot;
      <a href="/episodes" class="site-footer-link">Episodes</a> &middot;
      <a href="/glossary" class="site-footer-link">Glossary</a> &middot;
      <a href="/headers-gaggs" class="site-footer-link">Headers-Gaggs</a>
    </p>
  </footer>
```

- [ ] **Step 5: Update `src/styles/main.css` tokens, `@font-face`, buttons, focus ring, footer, and reduced-motion guard**

1. Move `@font-face` for `'Hit and Run'` from `src/styles/main.css:2489-2498` to lines `1-10` of `src/styles/main.css`.
2. Update `:root` (`src/styles/main.css:66-79`):
   ```css
   :root {
     --font-display: 'Hit and Run', 'Neue Montreal', 'Helvetica Neue', sans-serif;
     --font-sans: 'Neue Montreal', 'Helvetica Neue', sans-serif;
     --orange: #e8841a;
     --orange-dark: #7a2b0f;
     --teal: #1a6b6b;
     --teal-dark: #0f3f3f;
     --maroon: #5c1a1a;
     --amber: #aa6200;
     --sky-blue: #8ecfdb;
     --black: #1a1a1a;
     --off-white: #f5f4f0;
     --pink: #ff72c7;
   }
   ```
   Ensure `body` sets `font-family: var(--font-sans);`, and update `.nav-links a`, `.mobile-nav a`, `.headers-gaggs-*` rules that relied on `--font-display` meaning `Neue Montreal` to reference `var(--font-sans)` (while `.headers-gaggs-cta-title` and `.headers-gaggs-title` keep `var(--font-display)` for `Hit and Run`). Replace all remaining `'Homemade Apple'` and `'Special Elite'` declarations in `src/styles/main.css` (`L206, 244, 271, 279, 295, 311, 350, 389, 402, 415, 444, 451, 459, 520, 528, 558, 572, 616, 625, 789, 797, 835, 861, 977, 2514, 2523, 2532, 2558, 2608, 2617, 2666, 2722, 2788, 2794, 2843, 2851, 2879, 2911`) with `var(--font-display)` (for `h1`/`h2` display headings) or `var(--font-sans)` (for UI, body, labels, buttons, metadata).
3. Update `focus-visible` (`src/styles/main.css:36-43`) and `#000` (`L1907`):
   ```css
   a:focus-visible,
   button:focus-visible,
   input:focus-visible,
   select:focus-visible,
   textarea:focus-visible {
     outline: 2px solid var(--black);
     outline-offset: 2px;
     box-shadow: 0 0 0 4px var(--off-white);
   }
   ```
   And replace `color: #000;` at `src/styles/main.css:1907` with `color: var(--black);`.
4. Standardize `.nav-listen-btn`, `.btn-orange`, `.btn-teal`, and `.ep-action-btn` (`src/styles/main.css:125-141, 291-322, 970-1005`):
   ```css
   .nav-listen-btn,
   .btn-orange,
   .ep-action-btn.watch {
     display: inline-flex;
     align-items: center;
     justify-content: center;
     gap: 0.4rem;
     min-height: 44px;
     background: var(--orange);
     color: var(--black);
     font-family: var(--font-sans);
     font-weight: 700;
     font-size: 0.85rem;
     letter-spacing: 0.06em;
     text-transform: uppercase;
     padding: 0.65rem 1.4rem;
     border-radius: 6px;
     border: 2px solid var(--black);
     box-shadow: 3px 3px 0 var(--black);
     transition: transform 0.1s ease, box-shadow 0.1s ease, background-color 0.15s ease, color 0.15s ease;
     cursor: pointer;
     white-space: nowrap;
   }
   .nav-listen-btn {
     border-radius: 999px;
     padding: 0.45rem 1.1rem;
     font-size: 0.8rem;
   }
   .btn-orange,
   .btn-teal {
     margin-top: 1.5rem;
   }
   .btn-teal,
   .ep-action-btn.review {
     display: inline-flex;
     align-items: center;
     justify-content: center;
     gap: 0.4rem;
     min-height: 44px;
     background: var(--teal);
     color: #ffffff;
     font-family: var(--font-sans);
     font-weight: 700;
     font-size: 0.85rem;
     letter-spacing: 0.06em;
     text-transform: uppercase;
     padding: 0.65rem 1.4rem;
     border-radius: 6px;
     border: 2px solid var(--black);
     box-shadow: 3px 3px 0 var(--black);
     transition: transform 0.1s ease, box-shadow 0.1s ease, background-color 0.15s ease;
     cursor: pointer;
   }
   .nav-listen-btn:hover,
   .btn-orange:hover,
   .ep-action-btn.watch:hover {
     background: var(--orange-dark);
     color: #ffffff;
     transform: translate(-1px, -1px);
     box-shadow: 4px 4px 0 var(--black);
   }
   .btn-teal:hover,
   .ep-action-btn.review:hover {
     background: var(--teal-dark);
     transform: translate(-1px, -1px);
     box-shadow: 4px 4px 0 var(--black);
   }
   .nav-listen-btn:active,
   .btn-orange:active,
   .btn-teal:active,
   .ep-action-btn:active {
     transform: translate(2px, 2px);
     box-shadow: none;
   }
   ```
5. Wrap `@supports (animation-timeline: view())` (`src/styles/main.css:902-962`) inside `@media (prefers-reduced-motion: no-preference) { ... }`.
6. Add `.site-footer` styles to `src/styles/main.css`:
   ```css
   .site-footer {
     background: var(--black);
     color: #d4d1c9;
     text-align: center;
     padding: 2rem 1rem;
     font-family: var(--font-sans);
     font-size: 0.75rem;
     font-weight: 700;
     letter-spacing: 0.08em;
     text-transform: uppercase;
   }
   .site-footer-links {
     margin-top: 0.5rem;
   }
   .site-footer-link {
     color: var(--orange);
     text-decoration: underline;
     text-underline-offset: 3px;
   }
   .site-footer-link:hover {
     color: #ffca36;
   }
   ```
7. In `src/router.js:270-272`, update the 404 heading inline style from `'Special Elite', monospace` to `var(--font-display)` (`Hit and Run`).

- [ ] **Step 6: Verify tests and lint pass**

Run: `npx vitest run tests/glossaryRouting.test.ts tests/routerSecurity.test.ts && npm run lint`
Expected: PASS.

---

### Task 0.2: Harden Persistent Audio Dock, Fix `skipped-heading`, Chunk Mobile Nav, & Add Dynamic Bottom Clearance

**Files:**
- Modify: `index.html:68-80, 501-531`
- Modify: `src/audio-player.js:1-240`
- Modify: `src/styles/main.css:649-678, 762-899`
- Modify: `tests/glossaryRouting.test.ts:32-44` *(verify link order stays compatible)*
- Create: `tests/audioPlayer.test.js`

**Interfaces:**
- `#persistent-audio-player` exports `window.playEpisode(title, url)` and toggles `document.body.classList.toggle('has-audio-player', isOpen)`
- `#audio-progress-slider` (`<input type="range" min="0" max="100" step="0.1" value="0">`)

- [ ] **Step 1: Write failing unit tests in `tests/audioPlayer.test.js`**

Create `tests/audioPlayer.test.js` testing:
1. `initAudioPlayer()` attaches range `input` seek handler and updates `audioElement.currentTime` without throwing when `duration` is `0`/`NaN` or finite (`120`).
2. `window.playEpisode('S01E01', 'https://example.com/ep1.mp3')` opens `#persistent-audio-player`, adds `has-audio-player` class to `document.body`, updates `#audio-play` `aria-label` to `'Pause'`, and calls `setupVisualizer()` without `ReferenceError: audioElement is not defined`.
3. Clicking `#audio-close` hides the player, pauses audio, clears `localStorage`, and removes `has-audio-player` from `document.body`.
4. `startVisualizer()` skips starting the `requestAnimationFrame` loop when `prefers-reduced-motion: reduce` matches.

```js
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { initAudioPlayer } from '../src/audio-player.js';

function createAudioDom({ reducedMotion = false } = {}) {
  const listeners = new Map();
  const bodyClasses = new Set();

  const makeEl = (tag, extra = {}) => {
    const elListeners = new Map();
    return {
      tagName: tag,
      style: {},
      textContent: '',
      value: '0',
      disabled: false,
      attributes: new Map(),
      setAttribute(k, v) {
        this.attributes.set(k, String(v));
      },
      getAttribute(k) {
        return this.attributes.get(k) ?? null;
      },
      addEventListener(evt, fn) {
        if (!elListeners.has(evt)) elListeners.set(evt, []);
        elListeners.get(evt).push(fn);
      },
      dispatch(evt, eventObj = {}) {
        for (const fn of elListeners.get(evt) || []) fn({ target: this, ...eventObj });
      },
      ...extra,
    };
  };

  const elements = {
    'persistent-audio-player': makeEl('DIV', { style: { display: 'none' } }),
    'main-audio-element': makeEl('AUDIO', {
      paused: true,
      duration: 120,
      currentTime: 0,
      playbackRate: 1,
      src: '',
      play: vi.fn().mockResolvedValue(undefined),
      pause: vi.fn(),
    }),
    'audio-play': makeEl('BUTTON'),
    'audio-title': makeEl('P'),
    'audio-current-time': makeEl('SPAN'),
    'audio-duration': makeEl('SPAN'),
    'audio-progress-slider': makeEl('INPUT', { value: '0', min: '0', max: '100' }),
    'audio-speed': makeEl('SELECT', { value: '1' }),
    'audio-close': makeEl('BUTTON'),
  };

  globalThis.document = {
    body: {
      classList: {
        add: (c) => bodyClasses.add(c),
        remove: (c) => bodyClasses.delete(c),
        toggle: (c, force) => (force ? bodyClasses.add(c) : bodyClasses.delete(c)),
        contains: (c) => bodyClasses.has(c),
      },
    },
    documentElement: { style: { setProperty: vi.fn() } },
    getElementById: (id) => elements[id] || null,
  };

  globalThis.window = {
    matchMedia: vi.fn().mockReturnValue({ matches: reducedMotion }),
    AudioContext: vi.fn(function MockAudioContext() {
      return {
        state: 'running',
        resume: vi.fn(),
        destination: {},
        createAnalyser: () => ({
          fftSize: 64,
          frequencyBinCount: 32,
          connect: vi.fn(),
          getByteFrequencyData: vi.fn(),
        }),
        createMediaElementSource: vi.fn(() => ({ connect: vi.fn() })),
      };
    }),
  };

  globalThis.localStorage = {
    store: new Map(),
    getItem(k) {
      return this.store.get(k) ?? null;
    },
    setItem(k, v) {
      this.store.set(k, v);
    },
    removeItem(k) {
      this.store.delete(k);
    },
  };

  globalThis.requestAnimationFrame = vi.fn();

  return { elements, listeners };
}

describe('Persistent Audio Player', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('seeks audio via #audio-progress-slider and manages body.has-audio-player class', () => {
    const { elements } = createAudioDom();
    initAudioPlayer();

    globalThis.window.playEpisode('S01E01 — Death Has a Shadow', 'https://example.com/ep1.mp3');
    expect(elements['persistent-audio-player'].style.display).toBe('block');
    expect(document.body.classList.contains('has-audio-player')).toBe(true);
    expect(elements['audio-play'].getAttribute('aria-label')).toBe('Pause');

    elements['audio-progress-slider'].value = '50';
    elements['audio-progress-slider'].dispatch('input');
    expect(elements['main-audio-element'].currentTime).toBe(60);

    elements['audio-close'].dispatch('click');
    expect(elements['persistent-audio-player'].style.display).toBe('none');
    expect(document.body.classList.contains('has-audio-player')).toBe(false);
  });

  it('does not start visualizer RAF loop under prefers-reduced-motion: reduce', () => {
    createAudioDom({ reducedMotion: true });
    initAudioPlayer();

    globalThis.window.playEpisode('S01E01 — Death Has a Shadow', 'https://example.com/ep1.mp3');
    expect(globalThis.requestAnimationFrame).not.toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: Run the test to confirm it fails against current `src/audio-player.js`**

Run: `npx vitest run tests/audioPlayer.test.js`
Expected: FAIL (`progressBg` is null because `audio-progress-slider` is not wired yet, and `audioElement is not defined` inside `setupVisualizer`).

- [ ] **Step 3: Update `#mobileNav` and `#persistent-audio-player` markup in `index.html`**

1. In `index.html:69-79`, group `#mobileNav` links under two non-link headings (`Explore` and `Listen`) and add `/headers-gaggs` after `/contact` (keeping `/reviews`, `/glossary`, `/contact` in exact sequence so `tests/glossaryRouting.test.ts:32-44` stays green):

```html
  <!-- MOBILE NAV DRAWER -->
  <div class="mobile-nav" id="mobileNav" role="navigation" aria-label="Mobile navigation">
    <p class="mobile-nav-group-label">Explore</p>
    <a href="/">Home</a>
    <a href="/episodes">Episodes</a>
    <a href="/reviews">Reviews</a>
    <a href="/glossary">Glossary</a>
    <a href="/contact">Contact</a>
    <a href="/headers-gaggs">Headers-Gaggs Test</a>
    <p class="mobile-nav-group-label">Listen</p>
    <a href="https://open.spotify.com/show/033Z7yYNKcNhJok71mZjUc" target="_blank" rel="noopener">Listen on Spotify</a>
    <a href="https://podcasts.apple.com/podcast/id6796769827" target="_blank" rel="noopener">Apple Podcasts</a>
    <a href="https://www.youtube.com/@FamilyGuyGuysPod" target="_blank" rel="noopener">YouTube</a>
    <a href="https://media.rss.com/family-guy-guys/feed.xml" target="_blank" rel="noopener">RSS Feed</a>
  </div>
```

2. In `index.html:501-531`, change `<h4 id="audio-title">` to `<p class="audio-player-title" id="audio-title">`, remove dead `#audio-prev` and `#audio-next`, and replace `#audio-progress-bar-bg` with `#audio-progress-slider`:

```html
  <!-- ===== PERSISTENT AUDIO PLAYER ===== -->
  <div id="persistent-audio-player" class="audio-player-container" style="display: none;" role="region" aria-label="Audio player">
    <div class="audio-player-content">
      <div class="audio-player-info">
        <span class="audio-player-tag">Now Playing</span>
        <p class="audio-player-title" id="audio-title">Episode Title</p>
      </div>
      <div class="audio-player-controls">
        <button id="audio-play" type="button" aria-label="Play">▶</button>
      </div>
      <div class="audio-player-progress-container">
        <span id="audio-current-time">0:00</span>
        <input
          id="audio-progress-slider"
          type="range"
          min="0"
          max="100"
          step="0.1"
          value="0"
          class="audio-progress-slider"
          aria-label="Seek episode audio"
          aria-valuetext="0:00 of 0:00"
        >
        <span id="audio-duration">0:00</span>
      </div>
      <div class="audio-player-extra">
        <select id="audio-speed" aria-label="Playback Speed">
          <option value="1">1.0x</option>
          <option value="1.25">1.25x</option>
          <option value="1.5">1.5x</option>
          <option value="2">2.0x</option>
        </select>
        <button id="audio-close" type="button" aria-label="Close Player">✕</button>
      </div>
    </div>
    <audio id="main-audio-element" src=""></audio>
  </div>
```

- [ ] **Step 4: Update `src/audio-player.js` to wire range scrubbing, fix `setupVisualizer(audioElement)`, guard reduced motion, and toggle `body.has-audio-player`**

Update `src/audio-player.js`:
1. In `getElements()`, replace `progressBar`/`progressBg` with `progressSlider: document.getElementById('audio-progress-slider')`.
2. In `initAudioPlayer()`:
   - Require `audioElement`, `playBtn`, `progressSlider`, `closeBtn`.
   - Bind `progressSlider.addEventListener('input', () => { const dur = audioElement.duration; if (!Number.isFinite(dur) || dur <= 0) return; audioElement.currentTime = (Number(progressSlider.value) / 100) * dur; updateProgress(); });`.
   - In `closeBtn` click listener, call `document.body?.classList?.toggle('has-audio-player', false);`.
3. In `loadEpisode(title, url, shouldPlay = true)`:
   - Toggle `document.body?.classList?.toggle('has-audio-player', true);`.
   - Set `playBtn.setAttribute('aria-label', shouldPlay ? 'Pause' : 'Play');` alongside `playBtn.textContent`.
4. In `togglePlay()`:
   - Sync `playBtn.setAttribute('aria-label', ...)` whenever play/pause flips.
5. In `updateProgress()`:
   - Set `progressSlider.value` and `progressSlider.setAttribute('aria-valuetext', `${formatTime(current)} of ${formatTime(duration)}`)`.
6. Pass `audioElement` into `setupVisualizer(audioElement)` (fixing `ReferenceError: audioElement is not defined` at line 190) and return early from `startVisualizer()` when `window.matchMedia?.('(prefers-reduced-motion: reduce)')?.matches` is true.

- [ ] **Step 5: Style `.mobile-nav-group-label`, `.audio-progress-slider`, `44px` close/play buttons, and `body.has-audio-player` in `src/styles/main.css`**

In `src/styles/main.css`:
- Add `.mobile-nav-group-label { font-family: var(--font-sans); font-size: 0.75rem; font-weight: 700; text-transform: uppercase; letter-spacing: 0.08em; color: var(--orange-dark); margin-top: 0.5rem; }`.
- Replace `.audio-progress-bg` / `.audio-progress-fill` with `.audio-progress-slider { flex: 1; accent-color: var(--pink); cursor: pointer; min-height: 24px; }` and ensure `.audio-player-controls button` and `#audio-close` are `min-width: 44px; min-height: 44px;`.
- Update hover on `.audio-player-controls button:hover` to `background: var(--orange); color: var(--black); border-color: var(--black);`.
- Add dynamic dock clearance:
  ```css
  body.has-audio-player {
    padding-bottom: 96px;
  }
  @media (max-width: 768px) {
    body.has-audio-player {
      padding-bottom: 168px;
    }
  }
  ```

- [ ] **Step 6: Run tests to verify Phase 0 passes**

Run: `npx vitest run tests/audioPlayer.test.js tests/glossaryRouting.test.ts`
Expected: PASS.

---

## Phase 1: Reviews P0 Recovery & Data Integrity (`src/reviews/`)

### Task 1.1: Unify Reviews Data Fetching & Re-Skin `loading`, `loadError`, and `EmptyState`

**Files:**
- Modify: `src/reviews/ReviewApp.tsx:265-570, 711-714, 811-814, 1196-1201, 1216-1222, 1612-1619`

**Interfaces:**
- `EmptyState({ title, copy, actionLabel, onAction }: { title: string; copy: string; actionLabel?: string; onAction?: () => void })`

- [ ] **Step 1: Consolidate initial + retry Supabase effects and eliminate silent `demoDataset` fallback**

In `src/reviews/ReviewApp.tsx:265-474`:
1. Change `dataset` state initialization from `demoDataset` to `useState<PodcastDataset | null>(null)`.
2. Merge the two duplicated `useEffect` blocks (`L277-362` and `L388-473`) into one `useEffect` keyed on `[retryCount]` with `let cancelled = false;`.
3. When `!supabase`, `hasCriticalError` is true, or `catch (error)` triggers:
   - Set `setLoadError(message)` and `setLoading(false)` instead of `setDataset(demoDataset)` so developer placeholder strings never appear to users when Supabase fails or env vars are missing.
   - If Supabase succeeds and returns empty `episodes`, set `setDataset(buildDataset(cohosts ?? [], [], reviews ?? [], config))` and `setLoading(false)` (letting `EmptyState` explain cleanly).

- [ ] **Step 2: Re-skin `loading`, `loadError`, and `EmptyState` as Halftone Zine Paper White cards**

1. Replace the dark-slate `loading` JSX (`L501-534`) and `loadError` JSX (`L536-570`) with Halftone Zine panels:
   - Wrapper: `<div id="review-app" className="min-h-screen text-[#1a1a1a] reviews-halftone-bg p-6 md:p-10 flex items-center justify-center">`
   - Card: `<div className="max-w-lg w-full bg-white border-2 border-[#1a1a1a] rounded-lg shadow-[4px_4px_0_#1a1a1a] p-8 text-center" role={loadError ? 'alert' : 'status'} aria-live="polite">`
   - On `loadError`: remove `window.location.reload()` from `Retry`; use `onClick={() => setRetryCount((prev) => prev + 1)}` only (`Retry` uses `.primary-button`).
2. Re-skin `EmptyState` (`L1612-1619`) and add recovery CTA support:
   ```tsx
   function EmptyState({
     title,
     copy,
     actionLabel,
     onAction,
   }: {
     title: string;
     copy: string;
     actionLabel?: string;
     onAction?: () => void;
   }) {
     return (
       <div className="mt-8 rounded-lg border-2 border-[#1a1a1a] bg-white p-8 text-center text-[#1a1a1a] shadow-[3px_3px_0_#1a1a1a]">
         <h3 className="text-2xl font-black uppercase text-[#1a1a1a]">{title}</h3>
         <p className="mt-2 text-sm font-medium text-[#4a4a4a]">{copy}</p>
         {actionLabel && onAction ? (
           <button type="button" onClick={onAction} className="primary-button mt-5">
             {actionLabel}
           </button>
         ) : null}
       </div>
     );
   }
   ```
3. Pass `actionLabel="Reset filters"` / `onAction={resetFilters}` in `CatalogPage` (`L711-714`) and `actionLabel="Back to catalog"` / `onAction={() => onNavigate({ page: 'catalog' })}` in `EpisodePage` (`L811-814`), `SeasonPage` (`L1196-1201`), and `HostPage` (`L1216-1222`).

- [ ] **Step 3: Verify TypeScript compiles cleanly**

Run: `npm run typecheck`
Expected: PASS (0 errors).

---

### Task 1.2: Fix Data Mapping, Listen/Watch Payoff, Rating Math, Season Counts, & Slug Matching

**Files:**
- Create: `src/reviews/lib/reviewHelpers.ts`
- Create: `tests/reviewHelpers.test.ts`
- Modify: `src/reviews/ReviewApp.tsx:33-55, 189-213, 305-312, 810-824, 888-938, 1053-1128, 1152-1185, 1215-1315`

**Interfaces (`src/reviews/lib/reviewHelpers.ts`):**
- `export type WatchStatus = 'backlog' | 'watched' | 'recorded' | 'published';`
- `export function normalizeRatingToFive(rating: number | null | undefined, scaleMax?: number): number | null;`
- `export function getNativeRatingDisplay(review: { rating: number | null; ratingScaleMax?: number; ratingTerminology?: string }, fallbackLabel: string): { value: number | null; scaleMax: number; terminology: string; formatted: string; normalizedFive: number | null };`
- `export function computeNormalizedAverage(reviews: Array<{ rating: number | null; ratingScaleMax?: number }>): number | null;`
- `export function countSeasonStatuses(episodes: Array<{ season: number; watchStatus: WatchStatus }>, season: number): Record<WatchStatus, number>;`
- `export function findEpisodeByRouteId<T extends { id: string; season: number; episodeNumber: number }>(episodes: T[], routeId: string): T | undefined;`
- `export function findHostByRouteId<T extends { id: string; name: string }>(cohosts: T[], routeId: string, aliasMap?: Record<string, { name: string }>): T | undefined;`

- [ ] **Step 1: Write failing unit tests in `tests/reviewHelpers.test.ts`**

Write `tests/reviewHelpers.test.ts` covering:
1. `getNativeRatingDisplay` formats `scaleMax: 100` (`4.25` canonical -> `85/100 Vibes`) vs `scaleMax: 5` (`4` -> `4/5 Quahogs`), and handles `rating: null`.
2. `computeNormalizedAverage` averages canonical `0..5` ratings (and defensively divides `> 5` ratings on `scaleMax === 100` by `20`) without mixing unnormalized `0..100` values into `0..5`.
3. `countSeasonStatuses` counts `backlog`, `watched`, `recorded`, and `published` across all episodes in `season` even before filtering published cards.
4. `findEpisodeByRouteId` resolves exact UUIDs, canonical `s1e1`, zero-padded `s01e01`, and full slug `s01e01-death-has-a-shadow` against episodes whose `id` is a Supabase UUID.
5. `findHostByRouteId` resolves `collin`, `tyler`, `jason`, UUIDs, or lowercased first names against live cohost rows.

- [ ] **Step 2: Run the new helper tests to confirm failure before implementation**

Run: `npx vitest run tests/reviewHelpers.test.ts`
Expected: FAIL (`Cannot find module '../src/reviews/lib/reviewHelpers'`).

- [ ] **Step 3: Implement `src/reviews/lib/reviewHelpers.ts`**

Create `src/reviews/lib/reviewHelpers.ts` exporting the 6 functions and `WatchStatus` type with full TypeScript annotations:
- `normalizeRatingToFive`: returns `null` if `rating == null || Number.isNaN(rating)`; if `scaleMax === 100 && rating > 5`, returns `rating / 20`; otherwise returns `rating`.
- `getNativeRatingDisplay`: computes `scaleMax = review.ratingScaleMax || 5`; `normalizedFive = normalizeRatingToFive(review.rating, scaleMax)`; `value = normalizedFive === null ? null : scaleMax === 100 ? (normalizedFive / 5) * 100 : normalizedFive`; `terminology = review.ratingTerminology || fallbackLabel`.
- `countSeasonStatuses`: iterates all episodes with `ep.season === season` and tallies all 4 `WatchStatus` keys (`backlog`, `watched`, `recorded`, `published`).
- `findEpisodeByRouteId`: matches `ep.id.toLowerCase() === target` first, then parses `/^s0*(\d+)e0*(\d+)(?:-|$)/i` and matches `(ep.season, ep.episodeNumber)`.
- `findHostByRouteId`: matches `host.id.toLowerCase() === target`, mapped first name / full name (`collin` -> `Collin Brown`), or `host.name.toLowerCase().startsWith(target)`.

- [ ] **Step 4: Run helper tests to confirm they pass**

Run: `npx vitest run tests/reviewHelpers.test.ts`
Expected: PASS.

- [ ] **Step 5: Wire helpers, `podcast_url`/`transcript_notes`/`youtube_url`, and Listen/Watch CTAs into `ReviewApp.tsx`**

1. In `Episode` type (`L33-55`), add `youtubeUrl: string;`.
2. In Supabase `.select(...)` (`L308`), include `youtube_url`.
3. In `episodeFromRow` (`L189-213`), fix:
   ```ts
   podcastUrl: row.podcast_url ?? row.podcasturl ?? '',
   transcriptNotes: row.transcript_notes ?? row.transcriptnotes ?? '',
   youtubeUrl: row.youtube_url ?? '',
   ```
4. Import `deriveRssEmbed` from `'../build/rss-embed.js'` and `sanitizeURL` from `'../main.js'` (or validate HTTPS URLs with a local helper if cleaner for `tsc`; check `tsconfig.json` `allowJs: true` compatibility). Inside `EpisodePage` header card (`L888-938`):
   - Resolve `safePodcastUrl = sanitizeURL(episode.podcastUrl)` and `safeYoutubeUrl = sanitizeURL(episode.youtubeUrl)` plus `rssEmbed = safePodcastUrl ? deriveRssEmbed(safePodcastUrl) : null`.
   - Render a Broadcast Tangerine `.primary-button` (`Listen to Episode` -> `rssEmbed?.pageUrl ?? safePodcastUrl`, `target="_blank" rel="noopener noreferrer"`) and/or Collin Teal secondary button (`Watch on YouTube` -> `safeYoutubeUrl`), plus the embedded RSS player `<iframe>` (`rssEmbed.embedUrl`, `title="Family Guy Guys podcast player: ..."`, `loading="lazy"`) inside a `#1a1a1a`-bordered wrapper.
5. Replace raw rating/average calculations in `EpisodePage` (`L823, 912-920`), `HostReviewRow` (`L1053-1128`), `HostPage` (`L1231-1266, L1306-1311`), and `EpisodePoster` (`L1334, 1385, 1451`) with `computeNormalizedAverage` and `getNativeRatingDisplay`:
   - `EpisodePage` score box: label `"Normalized Avg"`, value `X.X / 5`, plus a small link to `/glossary#arbitrary-rating-units` (`"Why the scales? → Glossary"`).
   - `HostPage`: show `X.X / 5` on host average card and each row's native `value/scaleMax terminology` (`getNativeRatingDisplay`).
6. In `SeasonPage` (`L1152-1185`), compute `statusCounts = countSeasonStatuses(dataset.episodes, season)` before filtering `publishedEpisodes` for the card grid.
7. In `EpisodePage` (`L810`) and `HostPage` (`L1215`), look up via `findEpisodeByRouteId(dataset.episodes, episodeId)` and `findHostByRouteId(dataset.cohosts, hostId, COHOST_NAME_MAP)`.

- [ ] **Step 6: Verify tests and typecheck pass**

Run: `npx vitest run tests/reviewHelpers.test.ts && npm run typecheck`
Expected: PASS.

---

## Phase 2: Reviews Design System Alignment, IA Distillation & Visitor Reviews A11y

### Task 2.1: Align `reviews.css` & `ReviewApp.tsx` Visual System with `DESIGN.md` & Clean Dead Code

**Files:**
- Modify: `src/reviews/styles/reviews.css:1-266`
- Modify: `src/reviews/ReviewApp.tsx`

- [ ] **Step 1: Fix `reviews.css` typography, line-height, single ink, tangerine primary button, studio pink range, and reduced motion**

In `src/reviews/styles/reviews.css`:
1. Remove `line-height: 1.2;` from `#review-app * { ... }` (`L8-11`), leaving only `box-sizing: border-box;`.
2. Update `#review-app` (`L13-28`): set `color: var(--black, #1a1a1a); font-family: var(--font-sans, 'Neue Montreal', sans-serif);`, set `#review-app h1, #review-app h2` to `font-family: var(--font-display); font-weight: 400; letter-spacing: 0.02em;`, and `#review-app h3, #review-app h4` to `font-family: var(--font-sans); font-weight: 700;`.
3. Replace every `#000000` / `#000` in `reviews.css` (`L14, 25, 70, 78, 79, 86, 100, 108, 109, 117, 130, 133, 146, 159, 161, 167, 174, 176, 192, 196, 198, 205, 232, 247, 248, 253, 257, 261, 265`) with `var(--black, #1a1a1a)` (and update the inline `select.field` SVG chevron stroke from `%23000000` to `%231a1a1a`).
4. Re-theme `.primary-button` (`L65-93`) to Broadcast Tangerine: `background: var(--orange, #e8841a); color: var(--black, #1a1a1a); border: 2px solid var(--black, #1a1a1a); box-shadow: 3px 3px 0 var(--black, #1a1a1a);` and `:hover { background: var(--orange-dark, #7a2b0f); color: #ffffff; transform: translate(-1px, -1px); box-shadow: 4px 4px 0 var(--black, #1a1a1a); }`.
5. Update `input[type='range']` (`L210-212`) `accent-color: var(--pink, #ff72c7) !important;`.
6. Wrap `.animate-rise` (`L226-228`) with `@media (prefers-reduced-motion: reduce) { #review-app .animate-rise { animation: none; } }`.

- [ ] **Step 2: Clean `ReviewApp.tsx` arbitrary colors, sub-`12px` labels, poster blobs, and dead symbols**

In `src/reviews/ReviewApp.tsx`:
1. Replace `bg-[#F99F1B]` (`L965`) with `bg-[#e8841a] text-[#1a1a1a]`, replace `#000` / `#000000` shadow and border utilities (`L757, 841, 858, 912, 965, 1003, 1018, 1172, 1277`) with `#1a1a1a`, and darken `text-gray-500` (`L696, 734, 762, 900, 919, 931, 955, 1295, 1309, 1466, 1487, 1505`) to `text-[#4a4a4a]` (`>= 7:1` contrast).
2. Replace all 8 sub-`12px` text classes (`text-[8px]`, `text-[9px]`, `text-[10px]`, `text-[11px]` at `L1082, 1098, 1109, 1123, 1352, 1379, 1383, 1466`) with `text-xs` (`12px`), and widen `EpisodePoster size="mini"` (`L1347`) from `w-[90px]` to `w-[116px]` to fill `HostPage`'s `120px` track (`L1287`).
3. Remove `PALETTE` pastel radial blobs (`L88, L1401`) and redundant `sizeClass` ternary (`L1392-1393`) from `EpisodePoster`; render clean `#ffffff` paper cards with `border-2 border-[#1a1a1a] shadow-[3px_3px_0_#1a1a1a]`.
4. Delete dead/unused symbols (`selectedCohostId`/`selectedCohost` at `L270, 476-477`, `metrics` at `L489`, `StatusBadge` at `L1459`, `SectionIntro` at `L1472`, `ReviewRow` at `L1517`, `isRecord` at `L1936`, unused `average` in `SeasonPage` at `L1156`, `STATUS_TONE`, `PALETTE`, `posterColors`, `createDemoDataset`).

- [ ] **Step 3: Verify typecheck and lint pass**

Run: `npm run typecheck && npm run lint`
Expected: PASS.

---

### Task 2.2: Fix Landmarks, Heading Tree, `EpisodePage` Deduplication, & URL-Synced Catalog Filters

**Files:**
- Modify: `src/reviews/ReviewApp.tsx:270-275, 478-497, 572-772, 825-1035, 1158-1320`
- Create: `tests/reviewCatalogState.test.ts`

- [ ] **Step 1: Write failing unit tests for URL-synced catalog state & `EpisodePage` markup cleanup**

Create `tests/reviewCatalogState.test.ts` testing:
1. Default catalog filters read from `?q=...&season=...&status=...&sort=...` and default to `status = 'published'`, `sort = 'newest'` when query params are absent.
2. Serializing filter updates preserves `/reviews` path and omits default empty `q`/`season=all`.

- [ ] **Step 2: Run the test to confirm failure before helper extraction**

Run: `npx vitest run tests/reviewCatalogState.test.ts`
Expected: FAIL.

- [ ] **Step 3: Add URL filter state helpers to `src/reviews/lib/reviewHelpers.ts` and update `ReviewApp.tsx`**

1. Add `parseCatalogQueryParams(searchStr: string)` and `buildCatalogQueryString(state)` to `src/reviews/lib/reviewHelpers.ts` (defaults: `search: ''`, `seasonFilter: 'all'`, `statusFilter: 'published'`, `sortOrder: 'newest'`).
2. In `ReviewApp.tsx`:
   - **Fix nested `<main>` & dock clearance (`L577`):** Replace `<main className="mx-auto max-w-7xl px-5 pb-16 pt-2 sm:px-6 lg:px-8">` with `<div className="mx-auto max-w-7xl px-5 pb-28 pt-2 sm:px-6 lg:px-8">` (inside `index.html`'s single `<main>`).
   - **Fix heading tree across all 4 pages:**
     - `CatalogPage`: static `<h1>Episode Reviews</h1>` (remove `onClick` on `<h1>`); `<h2>` on `SidePanel` titles (`Season Shelves`, `Host Profiles`) and `<h2>` (`sr-only` or styled section bar `"Episodes"`) above the grid so `EpisodePoster` `<h3>` cards sit under `<h2>`.
     - `SeasonPage`: promote `<h1>Season {season}</h1>` with `← Back to catalog` button above; add `<h2>` section headings for status counts and episode cards.
     - `HostPage`: promote `<h1>{Name}'s Reviews</h1>`; use `<h2>` for `{name}` in the sidebar profile and review feed.
     - `EpisodePage`: single `<h1>{formatEpisodeCode(episode)}: {episode.title}</h1>` inside the main header card; remove duplicate `Back to catalog` (`L893-899`), duplicate `<h2>{episode.title}</h2>` (`L910`), and redundant sidebar `Watch status` card (`L881-885`); promote `HOST RATINGS FOR THIS EPISODE` (`L966`) and `USER COMMUNITY FEED` to `<h2>`.
   - **Progressive disclosure on `EpisodePage`:** Wrap Cast, Guest Stars, Writers, Director, and Metadata (`facts`) inside a single bordered `<details className="bg-white border-2 border-[#1a1a1a] rounded-lg p-5">` (`<summary className="cursor-pointer font-bold uppercase tracking-wider text-sm">Episode Credits &amp; Production Facts</summary>`), filtering out placeholder strings like `'Guest cast to be imported'`.
   - **Sync filters to URL query params & add sort toggle:** Wire `search`, `seasonFilter`, `statusFilter` (default `'published'`), and `sortOrder` (`'newest' | 'oldest'`, default `'newest'`) to `window.history.replaceState` when on `route.page === 'catalog'`, and add a `Published only` / `All statuses` toggle chip alongside `Newest first` / `Chronological` sorting.

- [ ] **Step 4: Run tests and fixture build**

Run: `npx vitest run tests/reviewCatalogState.test.ts tests/reviewHelpers.test.ts && npm run typecheck`
Expected: PASS.

---

### Task 2.3: Harden `VisitorReviewsSection.tsx` (Touch Targets, Labels, Focus, Honest Storage Feedback)

**Files:**
- Modify: `src/reviews/VisitorReviewsSection.tsx:21-378`

- [ ] **Step 1: Upgrade `VisitorReviewsSection.tsx` state, validation, a11y, and `DESIGN.md` alignment**

In `src/reviews/VisitorReviewsSection.tsx`:
1. **React state for likes & submit feedback:**
   - Replace per-render `localStorage.getItem(likedKey)` inside `.map()` (`L166`) with `likedIds: Set<string>` initialized when `reviews` load and updated inside `handleToggleLike`.
   - Add `submitFeedback: { tone: 'success' | 'local' | 'error'; message: string } | null` rendered inside a `role="status" aria-live="polite"` status banner above the submit button:
     - Empty/whitespace author or content (`L69`): show inline error `"Please add both your alias and a comment before posting."`.
     - Supabase insert success: `"Review posted live!"`.
     - `localStorage` fallback (`L93-103`): `"Saved on this device only — couldn't reach the server right now."`.
2. **Labels, focus outlines, & `>= 44px` touch targets:**
   - Associate every `<label>` with its control via `htmlFor`/`id` (`visitor-author`, `visitor-terminology`, `visitor-score-range`, `visitor-comments`) and `role="group" aria-labelledby` on the scale toggle and star rating button group.
   - Remove `focus:outline-none` (`L263, L307, L363`) and use `focus-visible:outline-2 focus-visible:outline-[#1a1a1a] focus-visible:outline-offset-2`.
   - Enforce `min-h-[44px]` on `Helpful` (`L228`), `5-Star`/`100-Point` toggles (`L272-293`), inputs, submit button, and `min-h-[44px] min-w-[44px]` on each star button (`L322-334`) with `aria-label={`Rate ${num} out of 5`}` and `aria-pressed={num === formRating}`.
   - Add `aria-label="Score out of 100"` to the range slider (`L338`).
3. **Design tokens, sub-`12px` removal, & glossary link:**
   - Change `bg-[#F472B6]` (`L247`) to `bg-[#ff72c7]` (Studio Pink), `#000000` borders/shadows to `#1a1a1a`, and lift all `text-[8px]` / `text-[10px]` classes (`L184, 189, 230, 256, 268, 275, 286, 298, 313, 346, 356`) to `text-xs` (`12px`).
   - Add an inline link `(What's this? -> Glossary)` to `/glossary#arbitrary-rating-units` next to `Scale Terminology` (`L298`).
   - Promote `USER COMMUNITY FEED` (`L146`) to `<h2>` and `WRITE A REVIEW` (`L249`) to `<h3>`.

- [ ] **Step 2: Verify typecheck and lint pass**

Run: `npm run typecheck && npm run lint`
Expected: PASS.

---

## Phase 3: Home, Episodes, Contact & Guest Polish (`index.html`, `src/main.js`, `src/styles/main.css`)

### Task 3.1: Home Hero `<h1>`, Positioning, Semantic Section Headings, Mobile Layout Fixes, & Asset Rename

**Files:**
- Modify: `index.html:84-201`
- Modify: `src/styles/main.css:178-466, 680-760`
- Modify: `src/headers-gaggs/HeadersGaggsHomeCta.tsx:16-28`
- Rename: `public/assets/I’m A Gagger.{png,webp,avif}` -> `public/assets/im-a-gagger.{png,webp,avif}`
- Modify: `src/scripts/optimize-images.js:15`

- [ ] **Step 1: Add Home Hero `<h1>`, positioning subhead, primary actions, & semantic `<h2>` headings in `index.html`**

1. Inside `.hero` (`index.html:88-112`):
   - Add a crisp zine hero intro header above the artwork:
     - `<h1 class="hero-title">Family Guy Guys</h1>`
     - `<p class="hero-premise">Three comedians watching every episode of <em>Family Guy</em> in chronological order — with host ratings, reaction logs, and questionable critical frameworks.</p>`
     - Primary action row: `<a href="/reviews" class="btn-orange">Browse Reviews</a>` and `<a href="/episodes" class="btn-teal">Latest Episodes</a>`.
   - Add `aria-hidden="true"` to all 4 platform icon `<svg>` tags (`L90-101`) and add descriptive `title` attributes (`Spotify`, `YouTube`, `Apple Podcasts`, `RSS Feed`).
2. Convert `.section-label` (`L117`), `.hosts-label` (`L130`), and `.merch-title` (`L167`) from `<div>` to `<h2>` set in `var(--font-display)` (`Hit and Run`).

- [ ] **Step 2: Fix mobile Hosts gutter, double hero top padding, `44px` hero icon targets, & platform icon contrast in `src/styles/main.css`**

1. Style `.hero-intro`, `.hero-title` (`font-family: var(--font-display); font-size: clamp(2.2rem, 5.5vw, 4rem); line-height: 1.1;`), `.hero-premise` (`font-family: var(--font-sans); max-width: 60ch; line-height: 1.55;`), and `.hero-actions`.
2. Fix `.hero-platform-icons` desktop positioning (`top: 1rem;` instead of `calc(60px + 1rem)` since `.page-content` already offsets `60px`) and icon contrast (`background: var(--orange-dark); color: #ffffff; border: 2px solid var(--black); box-shadow: 2px 2px 0 var(--black); width: 44px; height: 44px;`).
3. Inside `@media (max-width: 768px)` (`src/styles/main.css:680-750`):
   - Add `.hosts-section { padding: 0; }` (eliminates the `80px` left blank gutter!).
   - Restyle `.hosts-label` as a horizontal centered `<h2>` banner (`position: static; transform: none; display: block; padding: 1.5rem 1rem 1rem; text-align: center;`) instead of `display: none;`.
   - Change `.hero { padding-top: 1.5rem; }` and `.hero-platform-icons { position: static; justify-content: center; margin-bottom: 1rem; }` (removing double `60px` padding and keeping `.hero-platform-icons a` at `44px × 44px`).

- [ ] **Step 3: Wire Home-to-Glossary bridges and rename `I’m A Gagger` assets**

1. Add a Glossary bridge link (`<a href="/glossary" class="text-link">New to the lore? Explore the Official Glossary &rarr;</a>`) inside `src/headers-gaggs/HeadersGaggsHomeCta.tsx` and beneath the Home Merch section (`index.html`).
2. Rename `public/assets/I’m A Gagger.{png,webp,avif}` to `public/assets/im-a-gagger.{png,webp,avif}`.
3. Update `index.html:181-183` to `/assets/im-a-gagger.{avif,webp,png}` and `src/scripts/optimize-images.js:15` to `{ file: 'im-a-gagger.png', path: ASSETS_DIR, widths: [300], name: 'im-a-gagger' }`.

- [ ] **Step 4: Run test suite and fixture build**

Run: `npm test && npm run build:fixture`
Expected: PASS.

---

### Task 3.2: Honest Dynamic Episode States, Featured Card Classes, `/contact` Socials (IG + TikTok), & Unlisted `/guest` Alignment

**Files:**
- Modify: `index.html:166-198, 250-281`
- Modify: `src/main.js:65-82, 200-220, 280-296, 501-684`
- Modify: `src/styles/main.css:421-466, 2564-2592`

- [ ] **Step 1: Fix `createEpisodeElement` featured classes and `loadDynamicEpisodes` loading/error recovery in `src/main.js`**

1. In `createEpisodeElement(ep, isFeatured)` (`src/main.js:501-507`):
   ```js
   titleDiv.className = isFeatured ? 'episode-title' : 'ep-title';
   descDiv.className = isFeatured ? 'episode-desc' : 'ep-desc';
   ```
2. Update `renderErrorState` and `renderEmptyState` (`src/main.js:543-597`) to use Halftone Zine styling (`#ffffff` background, `2px solid var(--black)`, `3px 3px 0 var(--black)`, `var(--font-sans)`), `aria-hidden="true"` on icons, `#4a4a4a` message text, and a `Retry` button + `/reviews` link (`renderErrorState` invokes `loadDynamicEpisodes()` on retry).
3. Update `loadDynamicEpisodes` (`src/main.js:644-684`) to show an accessible `role="status"` loading indicator before fetching, call `renderErrorState` when `!supabase` or Supabase errors/throws (instead of silently displaying 1999 Ep #001 `DEFAULT_FALLBACK_EPISODES` as "Latest Episode"), and call `renderEmptyState` when `episodes.length === 0`.
4. Replace unstyled Tailwind classes on pre-mount `#review-app` (`src/main.js:70, 78`) with `.route-loading-card` / `.route-error-card` defined in `src/styles/main.css`, and render a fallback card with a direct link to `/headers-gaggs` inside `initHeadersGaggs`'s `catch` block (`src/main.js:216-218`).

- [ ] **Step 2: Clean Merch, update `/contact` socials (Instagram + TikTok only), remove dead newsletter, & keep `/guest` unlisted**

1. **Merch (`index.html:169-194`, `src/styles/main.css:421-449`):**
   - Remove the fake `"Coming Soon"` `$12.00` card (`L188-192`).
   - Wrap the 2 real merch items (`Structure Head Shirt` and `I'm A Gagger Shirt`) in clickable `<a href="https://family-guy-guys.myspreadshop.com" target="_blank" rel="noopener" class="merch-card">` cards.
   - Update `.merch-grid` to `grid-template-columns: repeat(2, minmax(0, 280px)); justify-content: center;` (`1fr` on mobile) and update `.merch-card` to `border: 2px solid var(--black); box-shadow: 3px 3px 0 var(--black);` with hover lift.
2. **Contact socials (`index.html:250-275`, `src/main.js:280-296`):**
   - Remove the `TODO` Facebook and Twitter/X links (`index.html:253-260`).
   - Update Instagram to `https://www.instagram.com/familyguyguys/` (adding `aria-hidden="true"` to its `<svg>`).
   - Add TikTok as `<a href="https://www.tiktok.com/@familyguyguyspod" target="_blank" rel="noopener" class="social-icon-link" aria-label="TikTok">` with an inline TikTok `<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">`.
   - Remove the hidden `.newsletter-block` (`index.html:268-275`) and its dead submit handler (`src/main.js:280-296`).
3. **Unlisted `/guest` policy (Decision Gate #3):**
   - Keep `/guest` **unlisted** — add **no** links to `/guest` in `<nav>`, `#mobileNav`, `/contact`, or `<footer>`.
   - Differentiate `.guest-cta-email` from `.guest-cta-booking` (`src/styles/main.css:2564-2592`) as a secondary Paper White + `#1a1a1a` ink button (`background: #ffffff; color: var(--black) !important; border: 2px solid var(--black); border-radius: 6px; box-shadow: 3px 3px 0 var(--black);`) so `/guest` maintains visual hierarchy and retired-font compliance when accessed directly.

- [ ] **Step 3: Verify tests and lint pass**

Run: `npm test && npm run lint`
Expected: PASS.

---

## Phase 4: Glossary Contrast, Typography, Mobile Ergonomics & Discovery (`src/glossary/`)

### Task 4.1: Fix Nested `<main>`, Typography, Ink, WCAG AA Contrast, & Chip Distinction

**Files:**
- Modify: `src/glossary/GlossaryApp.ts:85-110, 372-385`
- Modify: `src/glossary/styles/glossary.css:22-782`

- [ ] **Step 1: Replace nested `<main>` in `GlossaryApp.ts` and label static episode chips**

1. In `src/glossary/GlossaryApp.ts:383`, replace `e('main', { className: 'glossary-content' }, sectionsContent)` with `e('div', { className: 'glossary-content' }, sectionsContent)`.
2. In `renderEpisodeRef` (`src/glossary/GlossaryApp.ts:95`), add `title: 'Episode review not published yet'` to `.episode-chip-static`.

- [ ] **Step 2: Align `glossary.css` typography, Single-Ink colors, Paper White card surfaces, & WCAG AA contrast**

In `src/glossary/styles/glossary.css`:
1. Set `.glossary-title` (`h1`) and `.glossary-category-title` (`h2`) to `font-family: var(--font-display); font-weight: 400; letter-spacing: 0.02em;`.
2. Replace all 8 `var(--font-accent, 'Special Elite', monospace)` declarations (`L87, 125, 200, 262, 271, 300, 330, 396`) with `var(--font-sans, 'Neue Montreal', sans-serif)`.
3. Replace `#222222`, `#333333`, `#555555`, `#666666` (`L52, 202, 281, 305, 361, 367`) with `var(--black, #1a1a1a)` for primary copy and `#4a4a4a` for secondary metadata/notes.
4. Move all 5 category `#category-*.glossary-card` surfaces (`L466-740`) to `#ffffff` Paper White with `color: #1a1a1a`, `border: 2px solid #1a1a1a`, `border-top: 8px solid var(--glossary-color-<cat>)`, and `box-shadow: 3px 3px 0 #1a1a1a`, keeping category-specific `.glossary-aka` dark ink colors (`#5624a3` Frameworks, `#0b3954` Segments, `#5c3b00` Personas, `#6e1830` Terminology, `#6b2800` Aliases — all `>= 7:1` on `#ffffff`).
5. Fix Frameworks category pill contrast (`L743-750`): `.glossary-cat-pill[href='#category-frameworks'] { background: #6429b8; color: #ffffff; }` (`7.5:1` AA/AAA pass; hover `#4f1d96`).
6. Fix Broadcast Tangerine button/hover contrast (`L190-191, 348-349, 394-395`): `#1a1a1a` ink text on `#e8841a` (`6.42:1` pass), shifting to `#ffffff` on `#7a2b0f` (`9.63:1`) for `.glossary-clear-btn:hover`.
7. Differentiate `.episode-chip-static` (`background: #f0efe9; color: #4a4a4a; border: 1.5px dashed rgba(26, 26, 26, 0.45); box-shadow: none;`) vs. `.episode-chip-link` (`background: var(--sky-blue, #8ecfdb); color: #1a1a1a; border: 1.5px solid #1a1a1a; box-shadow: 1.5px 1.5px 0 #1a1a1a;`).
8. Update `.glossary-cards-grid` (`L228-233`) to `grid-template-columns: repeat(auto-fill, minmax(280px, 1fr)); align-items: start;`.

- [ ] **Step 3: Verify existing Glossary tests pass**

Run: `npx vitest run tests/glossaryComponent.test.ts tests/prerenderGlossary.test.ts`
Expected: PASS.

---

### Task 4.2: Mobile Touch Targets, Sticky Category Nav, Search Upgrades, Permalinks, Chip Collapse & Hydration Safety

**Files:**
- Modify: `src/data/glossary.ts:10-52` *(add optional `shortName` to `GlossaryCategory`)*
- Modify: `src/glossary/GlossaryApp.ts`
- Modify: `src/glossary/mount.tsx:78-150, 170-201, 245-319`
- Modify: `src/scripts/prerender-glossary.js:68-85`
- Modify: `src/glossary/styles/glossary.css`

- [ ] **Step 1: Add `shortName` to `GlossaryCategory` in `src/data/glossary.ts` & improve sticky nav + touch targets in `glossary.css`**

1. Add `shortName?: string` on `GlossaryCategory` (`Frameworks`, `Segments`, `Host Lore`, `Terminology`, `Aliases`) while preserving `name` for `<h2>` headings and `glossaryData.test.ts`.
2. In `src/glossary/styles/glossary.css`:
   - Suppress native browser search clear icon on `.glossary-search-input`: `&::-webkit-search-cancel-button { -webkit-appearance: none; appearance: none; }`.
   - Expand `.glossary-search-clear` to a `44px × 44px` interactive hit target (`right: 0.25rem; width: 44px; height: 44px;`), add `min-height: 44px` on `.glossary-cat-pill` and mobile `.episode-chip-link`, add a subtle right-edge fade mask on `.glossary-category-nav`, and raise mobile `.glossary-container` bottom padding (`L448`) from `3.5rem` to `6rem`.

- [ ] **Step 2: Upgrade search matching, `/` & `Cmd/Ctrl+K` shortcut, scroll-spy/filter pills, `#` permalinks, & chip collapse with hydration parity**

1. **Search matching (`GlossaryApp.ts:189-194`):** Match `entry.term`, `entry.aka`, `entry.definition`, formatted episode codes (`S${ref.season}E${ref.episode}` and zero-padded `S${pad(ref.season)}E${pad(ref.episode)}`), and `origin?.note` / `references[].note`.
2. **Keyboard shortcut (`GlossaryApp.ts`):** Register a `keydown` listener focusing `#glossary-search-input` on `/` or `(e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k'` (ignoring when focus is inside `INPUT`/`TEXTAREA`/`SELECT`), and blurring/clearing on `Escape`.
3. **Sticky nav scroll-spy & category filter (`GlossaryApp.ts`):**
   - Add an `All` pill (`aria-pressed`) plus per-category filter/jump pills (`shortName`) and an `IntersectionObserver` tracking the visible `#category-*` section (`is-active` / `aria-current="location"`).
   - Lift `selectedCategory` filter clearing into `mount.tsx` alongside `activeSetSearchQuery` so `coordinateFragmentNavigation` clears both active search and active category filters before scrolling to `#entry-id`.
4. **Card `#` copy-permalink action (`GlossaryApp.ts`):** Add `<button type="button" className="glossary-permalink-btn" aria-label={`Copy link to ${entry.term}`}>#</button>` inside `.glossary-card-header`, writing `https://familyguyguys.com/glossary#${entry.id}` to `navigator.clipboard?.writeText` and updating an `aria-live="polite"` status message.
5. **Chip deduplication & `+N more` collapse with hydration safety:**
   - Deduplicate `entry.references` entries that duplicate `entry.origin` `(season, episode)` without distinct `note` or `timestamp`.
   - When `dedupedRefs.length > 4`, show the first 4 chips and an inline `<button type="button" className="glossary-refs-toggle">` (`+${remaining} more` / `Show fewer`).
   - Serialize sorted published slugs onto `.glossary-container` via `data-published-slugs={Array.from(publishedSet).join(',')}`.
   - In `src/glossary/mount.tsx:247-258`, read `container.querySelector('.glossary-container')?.getAttribute('data-published-slugs')` **first** before falling back to `.episode-chip-link` DOM scraping so collapsed chips never cause SSR/client hydration mismatches.
6. **Fix `hashchange` listener leak (`src/glossary/mount.tsx:315-318`):** Call `window.removeEventListener('hashchange', handlePopState);` inside `unmountGlossary()`.

---

### Task 4.3: Show Voice Copy, `/headers-gaggs` Cross-Links, Bottom CTA, & Test Suite Updates

**Files:**
- Modify: `src/glossary/GlossaryApp.ts:207-214, 285-303, 325-385`
- Modify: `tests/glossaryComponent.test.ts:23-75, 227-241`
- Modify: `tests/prerenderGlossary.test.ts`

- [ ] **Step 1: Update Glossary editorial copy, `/headers-gaggs` card links, & bottom conversion CTA**

1. Rewrite `.glossary-intro` in `src/glossary/GlossaryApp.ts:207-213` in Collin, Tyler, and Jason's comedy voice, and add a brief chip legend (`Linked blue chips open published episode reviews; dashed chips mark episodes not yet reviewed.`).
2. Enhance `.glossary-empty-state` (`L285-302`) to echo `filterQuery` (`No lore matches "${filterQuery}" — even Peter couldn't invent that bit.`) and offer 3 clickable quick-starter chips (`Structurehead`, `Gagger`, `Stewie Gay Watch`) alongside `Clear search`.
3. On `#structurehead` and `#gagger` cards, render an inline CTA link `<a href="/headers-gaggs" className="glossary-quiz-link">Find out which one you are &rarr; Take the Headers-Gaggs Test</a>`.
4. Render a bottom Halftone Zine conversion banner inside `.glossary-container` (`Ready to put this lore to work?` -> `Take the Headers-Gaggs Test` `/headers-gaggs`, `Browse Episode Reviews` `/reviews`, and `Listen on Spotify`).

- [ ] **Step 2: Update & expand tests in `tests/glossaryComponent.test.ts` and `tests/prerenderGlossary.test.ts`**

1. Update exact-copy, pill-label (`shortName` + `All` pill), and empty-state expectations in `tests/glossaryComponent.test.ts:23-75, 227-241` and `tests/prerenderGlossary.test.ts`.
2. Add targeted unit tests verifying:
   - Zero nested `<main>` inside `GlossaryApp`.
   - Searching `"S1E7"` and `"Danny"` returns matching entries via episode code and `.note` matching.
   - Reference deduplication removes duplicate origin chips without distinct notes, `+N more` collapses `> 4` chips, and `data-published-slugs` round-trips cleanly during hydration.
   - `#structurehead` and `#gagger` render `/headers-gaggs` links.
   - `unmountGlossary()` removes both `popstate` and `hashchange` listeners.

- [ ] **Step 3: Run the full glossary test suite**

Run: `npx vitest run tests/glossaryData.test.ts tests/glossaryComponent.test.ts tests/glossaryRouting.test.ts tests/prerenderGlossary.test.ts`
Expected: PASS.

---

## Phase 5: Final Verification & Re-Critique Gate

- [ ] **Step 1: Run automated test, typecheck, lint, format, and fixture build suites**

```bash
npm test
npm run typecheck
npm run lint
npm run format:check
npm run build:fixture
```

Expected: All 100% passing (0 test failures, 0 TS errors, 0 ESLint errors, clean Prettier check, clean `dist/glossary/index.html` and `dist/reviews/*/index.html` generation).

- [ ] **Step 2: Run deterministic Impeccable checks across all audited targets**

```bash
/Users/jrhackett/.gemini/config/skills/impeccable/scripts/impeccable detect --json index.html
/Users/jrhackett/.gemini/config/skills/impeccable/scripts/impeccable detect --json src/reviews/ReviewApp.tsx
/Users/jrhackett/.gemini/config/skills/impeccable/scripts/impeccable detect --json src/glossary
/Users/jrhackett/.gemini/config/skills/impeccable/scripts/impeccable detect --json dist/glossary/index.html
```

Expected: Zero retired-font warnings (`Homemade Apple` / `Special Elite`), zero `skipped-heading` warnings, zero WCAG AA contrast failures (`#ffffff` on `#e8841a`, Lavender cards, `EmptyState`, `"Found X episodes"`), and zero sub-`12px` UI text advisories.

- [ ] **Step 3: Visual & keyboard verification via `npm run preview`**

Start `npm run preview` and inspect `/`, `/episodes`, `/reviews`, `/reviews/season/1`, `/reviews/host/collin`, `/reviews/s1e1`, `/glossary`, `/contact`, and `/guest` (direct URL) at `375×812`, `768×1024`, and `1280×800`:
- Confirm Home above-the-fold `<h1>`, mobile Hosts column layout (zero `80px` gutter), `/contact` Instagram + TikTok icons (zero Facebook/Twitter, zero `/guest` links), keyboard Tab / `/` shortcut / range audio scrubbing, active audio dock clearance over footer, and `prefers-reduced-motion: reduce` behavior.
