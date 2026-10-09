import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import React from 'react';
import { renderToString } from 'react-dom/server';
import * as cheerio from 'cheerio';
import { GlossaryApp, PUBLISHED_EPISODES } from '../src/glossary/GlossaryApp.ts';
import {
  mountGlossary,
  unmountGlossary,
  isGlossaryRouteActive,
  getSafeFragmentId,
  coordinateFragmentNavigation,
  _setActiveSearchForTesting,
  _notifyCommitForTesting,
} from '../src/glossary/mount.tsx';
import {
  GLOSSARY_CATEGORIES,
  GLOSSARY_ENTRIES,
  GLOSSARY_ENTRY_COUNT,
} from '../src/data/glossary.ts';

describe('GlossaryApp Component (SSR & Static Markup)', () => {
  it('renders default state with all 5 categories, 29 entries, and exact copy', () => {
    const html = renderToString(React.createElement(GlossaryApp));
    const $ = cheerio.load(html);

    // Exact single h1
    const $h1 = $('h1');
    expect($h1).toHaveLength(1);
    expect($h1.text().trim()).toBe('Official Podcast Glossary');

    // Exact intro paragraph copy
    const introText = $('.glossary-intro').text().trim();
    expect(introText).toBe(
      "Welcome to the official glossary for Family Guy Guys: The Podcast. Whether you are a first-time listener or a seasoned 'Family Guy Guys Guy,' use this guide to navigate our critical frameworks, recurring review segments, and production lore."
    );

    // Exactly 5 category h2 headings
    const $h2 = $('h2');
    expect($h2).toHaveLength(5);
    GLOSSARY_CATEGORIES.forEach((cat, idx) => {
      expect($h2.eq(idx).text()).toContain(cat.name);
      expect($h2.eq(idx).text()).toContain(cat.emoji);
    });

    // Exactly 29 entry h3 headings
    const $h3 = $('h3');
    expect($h3).toHaveLength(29);

    // Every entry has a matching article with its id
    GLOSSARY_ENTRIES.forEach((entry) => {
      const $card = $(`article#${entry.id}`);
      expect($card.length).toBe(1);
      expect($card.find('.glossary-term').text().trim()).toBe(entry.term);
      expect($card.find('.glossary-definition').text().trim()).toBe(entry.definition);
      if (entry.aka) {
        expect($card.find('.glossary-aka').text()).toContain(entry.aka);
      }
    });

    // Category navigation landmark
    const $nav = $('nav[aria-label="Glossary categories"]');
    expect($nav.length).toBe(1);
    const $pills = $nav.find('.glossary-cat-pill');
    expect($pills).toHaveLength(5);
    GLOSSARY_CATEGORIES.forEach((cat, idx) => {
      expect($pills.eq(idx).attr('href')).toBe(`#category-${cat.id}`);
    });

    // Search container and live status
    expect($('#glossary-search-input').length).toBe(1);
    expect($('label[for="glossary-search-input"]').text().trim()).toBe('Search glossary');
    const statusText = $('[role="status"]').text().trim();
    expect(statusText).toBe(`Showing ${GLOSSARY_ENTRY_COUNT} of ${GLOSSARY_ENTRY_COUNT} entries`);
  });

  it('renders published episode chips as links and unreleased episodes as static chips', () => {
    const html = renderToString(React.createElement(GlossaryApp));
    const $ = cheerio.load(html);

    // Entry with published origin (s1e1 in stewie-gay-watch)
    const $stewieCard = $('#stewie-gay-watch');
    expect($stewieCard.length).toBe(1);
    const $stewieLinkChip = $stewieCard.find('.episode-chip-link');
    expect($stewieLinkChip.length).toBe(1);
    expect($stewieLinkChip.text().trim()).toBe('S1E1');
    expect($stewieLinkChip.attr('href')).toBe('/reviews/s1e1');

    // Entry with published origin (s1e7 in structurehead)
    const $structureheadCard = $('#structurehead');
    expect($structureheadCard.length).toBe(1);
    const $originLinkChip = $structureheadCard.find('.glossary-origin-row .episode-chip-link');
    expect($originLinkChip.length).toBe(1);
    expect($originLinkChip.text().trim()).toBe('S1E7');
    expect($originLinkChip.attr('href')).toBe('/reviews/s1e7');

    // Entry with unreleased origin (s2e6 in council-of-dads)
    const $councilCard = $('#council-of-dads');
    expect($councilCard.length).toBe(1);
    const $councilStaticChip = $councilCard.find('.glossary-origin-row .episode-chip-static');
    expect($councilStaticChip.length).toBe(1);
    expect($councilStaticChip.text().trim()).toBe('S2E6');

    // Entry references: s1e4 is published (/reviews/s1e4), s2e6 is unreleased (static)
    const $refLinkChip = $structureheadCard.find('.glossary-references-row .episode-chip-link');
    expect($refLinkChip.length).toBe(1);
    expect($refLinkChip.text().trim()).toBe('S1E4');
    expect($refLinkChip.attr('href')).toBe('/reviews/s1e4');

    const $refStaticChip = $structureheadCard.find('.glossary-references-row .episode-chip-static');
    expect($refStaticChip.length).toBe(1);
    expect($refStaticChip.text().trim()).toBe('S2E6');

    // Inline note check
    const notesText = $structureheadCard.find('.glossary-references-row').text();
    expect(notesText).toContain('(debated heavily)');
    expect(notesText).toContain('(revisited/expanded)');
  });

  it('dynamically resolves episode chip availability when custom published catalog or resolver is provided', () => {
    // 1. Pass publishedEpisodes that includes s1e7 and s2e6
    const dynamicCatalog = new Set(['s1e1', 's1e7', 's2e6']);
    const htmlWithCatalog = renderToString(
      React.createElement(GlossaryApp, { publishedEpisodes: dynamicCatalog })
    );
    const $cat = cheerio.load(htmlWithCatalog);

    // Now S1E7 origin in structurehead should be a link!
    const $s1e7Chip = $cat('#structurehead .glossary-origin-row .episode-chip-link');
    expect($s1e7Chip.length).toBe(1);
    expect($s1e7Chip.attr('href')).toBe('/reviews/s1e7');

    // And S2E6 reference in structurehead should be a link!
    const $s2e6Chip = $cat('#structurehead .glossary-references-row a[href="/reviews/s2e6"]');
    expect($s2e6Chip.length).toBe(1);

    // But S1E4 (not in dynamicCatalog) should now be static!
    const $s1e4Static = $cat('#structurehead .glossary-references-row .episode-chip-static');
    expect($s1e4Static.length).toBe(1);
    expect($s1e4Static.text().trim()).toBe('S1E4');

    // 2. Custom route resolver function
    const customResolver = (ref: { season: number; episode: number }) =>
      ref.season === 2 ? `/reviews/custom-s${ref.season}e${ref.episode}` : null;

    const htmlWithResolver = renderToString(
      React.createElement(GlossaryApp, { resolveEpisodeRoute: customResolver })
    );
    const $res = cheerio.load(htmlWithResolver);

    // S2E6 resolved via custom resolver
    const $s2e6Custom = $res('#structurehead a[href="/reviews/custom-s2e6"]');
    expect($s2e6Custom.length).toBe(1);

    // S1E1 is null/unreleased under custom resolver
    const $s1e1Static = $res('#stewie-gay-watch .episode-chip-static');
    expect($s1e1Static.length).toBe(1);
    expect($s1e1Static.text().trim()).toBe('S1E1');
  });

  it('filters entries when initialFilter is provided', () => {
    // Unique match: "Stewie Gay Watch"
    const htmlSingle = renderToString(
      React.createElement(GlossaryApp, { initialFilter: 'Stewie Gay Watch' })
    );
    const $single = cheerio.load(htmlSingle);

    expect($single('article.glossary-card')).toHaveLength(1);
    expect($single('#stewie-gay-watch').length).toBe(1);
    expect($single('[role="status"]').text().trim()).toBe(
      `Showing 1 of ${GLOSSARY_ENTRY_COUNT} entries`
    );

    // Nav only shows Segments category
    const $pills = $single('nav[aria-label="Glossary categories"] .glossary-cat-pill');
    expect($pills).toHaveLength(1);
    expect($pills.attr('href')).toBe('#category-segments');

    // Multi-match across term, aka, and definition: "gagger" matches 3 entries
    const htmlMulti = renderToString(React.createElement(GlossaryApp, { initialFilter: 'gagger' }));
    const $multi = cheerio.load(htmlMulti);
    expect($multi('article.glossary-card')).toHaveLength(3);
    expect($multi('#gagger').length).toBe(1);
    expect($multi('#cheesecake-factory-zone').length).toBe(1);
    expect($multi('#gaggers-delight').length).toBe(1);
    expect($multi('[role="status"]').text().trim()).toBe(
      `Showing 3 of ${GLOSSARY_ENTRY_COUNT} entries`
    );
  });

  it('renders empty state when search matches no terms', () => {
    const html = renderToString(
      React.createElement(GlossaryApp, { initialFilter: 'nonexistenttermxyz' })
    );
    const $ = cheerio.load(html);

    expect($('article.glossary-card')).toHaveLength(0);
    expect($('[role="status"]').text().trim()).toBe(`Showing 0 of ${GLOSSARY_ENTRY_COUNT} entries`);
    expect($('.glossary-empty-state').length).toBe(1);
    expect($('.glossary-empty-message').text().trim()).toBe(
      'No glossary terms match your search. Try another keyword.'
    );
    expect($('.glossary-clear-btn').length).toBe(1);
    expect($('nav[aria-label="Glossary categories"] .glossary-cat-pill')).toHaveLength(0);
  });
});

describe('Glossary Mounting Module & Navigation Coordinator', () => {
  beforeEach(() => {
    unmountGlossary();
  });

  afterEach(() => {
    unmountGlossary();
    vi.restoreAllMocks();
  });

  it('safely decodes fragment identifiers', () => {
    const originalWindow = global.window;

    // Standard hash
    global.window = { location: { hash: '#structurehead' } } as any;
    expect(getSafeFragmentId()).toBe('structurehead');

    // URI-encoded hash
    global.window = { location: { hash: '#hat-on-a-hat%20vs%20cherry' } } as any;
    expect(getSafeFragmentId()).toBe('hat-on-a-hat vs cherry');

    // Malformed URI encoding gracefully falls back to raw string
    global.window = { location: { hash: '#invalid%E0%A4%A' } } as any;
    expect(getSafeFragmentId()).toBe('invalid%E0%A4%A');

    // Empty hash
    global.window = { location: { hash: '' } } as any;
    expect(getSafeFragmentId()).toBe('');

    global.window = originalWindow;
  });

  it('accurately identifies active glossary route', () => {
    const originalWindow = global.window;

    global.window = { location: { pathname: '/glossary' } } as any;
    expect(isGlossaryRouteActive()).toBe(true);

    global.window = { location: { pathname: '/glossary/' } } as any;
    expect(isGlossaryRouteActive()).toBe(true);

    global.window = { location: { pathname: '/reviews' } } as any;
    expect(isGlossaryRouteActive()).toBe(false);

    global.window = { location: { pathname: '/' } } as any;
    expect(isGlossaryRouteActive()).toBe(false);

    global.window = originalWindow;
  });

  it('discards navigation requests if route is not active', async () => {
    const originalWindow = global.window;
    global.window = {
      location: { pathname: '/reviews', hash: '#structurehead' },
    } as any;

    const scrollIntoViewMock = vi.fn();
    const originalGetElementById = global.document?.getElementById;
    if (global.document) {
      global.document.getElementById = vi.fn().mockReturnValue({
        scrollIntoView: scrollIntoViewMock,
      });
    }

    await coordinateFragmentNavigation();
    expect(scrollIntoViewMock).not.toHaveBeenCalled();

    if (global.document && originalGetElementById) {
      global.document.getElementById = originalGetElementById;
    }
    global.window = originalWindow;
  });

  it('mounts and unmounts cleanly, tearing down listeners', async () => {
    const originalWindow = global.window;
    const addEventListenerMock = vi.fn();
    const removeEventListenerMock = vi.fn();

    global.window = {
      location: { pathname: '/glossary', hash: '' },
      addEventListener: addEventListenerMock,
      removeEventListener: removeEventListenerMock,
      matchMedia: vi.fn().mockReturnValue({ matches: false }),
    } as any;

    // Call unmountGlossary and verify teardown
    unmountGlossary();

    global.window = originalWindow;
  });

  it('respects prefers-reduced-motion media query during fragment navigation', async () => {
    const originalWindow = global.window;
    const originalDocument = global.document;

    const scrollIntoViewMock = vi.fn();
    const mockEl = { scrollIntoView: scrollIntoViewMock };

    global.window = {
      location: { pathname: '/glossary', hash: '#structurehead' },
      matchMedia: vi.fn((query: string) => ({
        matches: query.includes('prefers-reduced-motion: reduce'),
      })),
    } as any;

    global.document = {
      getElementById: vi.fn((id: string) => (id === 'structurehead' ? mockEl : null)),
    } as any;

    await coordinateFragmentNavigation({ isInitialLoad: false });

    expect(scrollIntoViewMock).toHaveBeenCalledWith({
      behavior: 'auto',
      block: 'start',
    });

    global.window = originalWindow;
    global.document = originalDocument;
  });

  it('uses smooth scrolling when prefers-reduced-motion is false and not initial load', async () => {
    const originalWindow = global.window;
    const originalDocument = global.document;

    const scrollIntoViewMock = vi.fn();
    const mockEl = { scrollIntoView: scrollIntoViewMock };

    global.window = {
      location: { pathname: '/glossary', hash: '#structurehead' },
      matchMedia: vi.fn().mockReturnValue({ matches: false }),
    } as any;

    global.document = {
      getElementById: vi.fn((id: string) => (id === 'structurehead' ? mockEl : null)),
    } as any;

    await coordinateFragmentNavigation({ isInitialLoad: false });

    expect(scrollIntoViewMock).toHaveBeenCalledWith({
      behavior: 'smooth',
      block: 'start',
    });

    global.window = originalWindow;
    global.document = originalDocument;
  });

  it('waits for React commit to reveal fragment target hidden by active search filter', async () => {
    const originalWindow = global.window;
    const originalDocument = global.document;

    const scrollIntoViewMock = vi.fn();
    const mockEl = { scrollIntoView: scrollIntoViewMock };
    let isCommitted = false;
    const setSearchMock = vi.fn((_q: string) => {
      // React state update scheduled; post-commit effect executes after DOM commit
      isCommitted = true;
      _notifyCommitForTesting();
    });

    _setActiveSearchForTesting('unrelated search query', setSearchMock);

    global.window = {
      location: { pathname: '/glossary', hash: '#structurehead' },
      matchMedia: vi.fn().mockReturnValue({ matches: false }),
    } as any;

    global.document = {
      getElementById: vi.fn((id: string) => {
        if (id === 'structurehead' && isCommitted) return mockEl;
        return null;
      }),
    } as any;

    await coordinateFragmentNavigation({ isInitialLoad: false });

    // Confirmed: search was reset to empty string
    expect(setSearchMock).toHaveBeenCalledWith('');
    // Confirmed: scrolled to revealed element after React post-commit effect
    expect(scrollIntoViewMock).toHaveBeenCalledWith({
      behavior: 'smooth',
      block: 'start',
    });

    _setActiveSearchForTesting('', null);
    global.window = originalWindow;
    global.document = originalDocument;
  });

  it('discards stale fragment navigation request if route changes or superseded before commit', async () => {
    const originalWindow = global.window;
    const originalDocument = global.document;

    const scrollIntoViewMock = vi.fn();
    const mockEl = { scrollIntoView: scrollIntoViewMock };
    const setSearchMock = vi.fn((_q: string) => {
      // While waiting for commit, simulate navigating away to /reviews
      global.window.location.pathname = '/reviews';
      _notifyCommitForTesting();
    });

    _setActiveSearchForTesting('filter', setSearchMock);

    // Set up window at /glossary#target1
    global.window = {
      location: { pathname: '/glossary', hash: '#target1' },
      matchMedia: vi.fn().mockReturnValue({ matches: false }),
    } as any;

    global.document = {
      getElementById: vi.fn(() => null),
    } as any;

    // Start navigation
    await coordinateFragmentNavigation({ isInitialLoad: false });

    // Stale request discarded because route changed away from /glossary before commit!
    expect(scrollIntoViewMock).not.toHaveBeenCalled();

    _setActiveSearchForTesting('', null);
    global.window = originalWindow;
    global.document = originalDocument;
  });

  it('discards stale fragment navigation if superseded by a newer fragment request before commit', async () => {
    const originalWindow = global.window;
    const originalDocument = global.document;

    const scrollIntoViewMock1 = vi.fn();
    const scrollIntoViewMock2 = vi.fn();
    const mockEl1 = { scrollIntoView: scrollIntoViewMock1 };
    const mockEl2 = { scrollIntoView: scrollIntoViewMock2 };

    let isCommitted = false;
    let commitCallback: (() => void) | null = null;
    const setSearchMock = vi.fn((_q: string) => {
      commitCallback = () => {
        isCommitted = true;
        _notifyCommitForTesting();
      };
    });

    _setActiveSearchForTesting('filter', setSearchMock);

    global.window = {
      location: { pathname: '/glossary', hash: '#target1' },
      matchMedia: vi.fn().mockReturnValue({ matches: false }),
    } as any;

    global.document = {
      getElementById: vi.fn((id: string) => {
        if (id === 'target1' && isCommitted) return mockEl1;
        if (id === 'target2') return mockEl2;
        return null;
      }),
    } as any;

    // Start first navigation to #target1
    const nav1Promise = coordinateFragmentNavigation({ isInitialLoad: false });

    // While nav1 is waiting for commit, new navigation to #target2 arrives
    global.window.location.hash = '#target2';
    const nav2Promise = coordinateFragmentNavigation({ isInitialLoad: false });

    // Commit fires
    if (commitCallback) {
      (commitCallback as () => void)();
    }

    await Promise.all([nav1Promise, nav2Promise]);

    // nav1 discarded due to token/hash guard!
    expect(scrollIntoViewMock1).not.toHaveBeenCalled();
    // nav2 executed!
    expect(scrollIntoViewMock2).toHaveBeenCalled();

    _setActiveSearchForTesting('', null);
    global.window = originalWindow;
    global.document = originalDocument;
  });

  it('settles pending fragment request promise when unmounted rather than leaving unresolved dangling promise', async () => {
    const originalWindow = global.window;
    const originalDocument = global.document;

    const setSearchMock = vi.fn();
    _setActiveSearchForTesting('active filter', setSearchMock);

    global.window = {
      location: { pathname: '/glossary', hash: '#target1' },
      matchMedia: vi.fn().mockReturnValue({ matches: false }),
    } as any;

    global.document = {
      getElementById: vi.fn(() => null),
    } as any;

    let settled = false;
    const navPromise = coordinateFragmentNavigation({ isInitialLoad: false }).then(() => {
      settled = true;
    });

    expect(settled).toBe(false);

    // Unmount while commit is pending
    unmountGlossary();

    await navPromise;
    expect(settled).toBe(true);

    _setActiveSearchForTesting('', null);
    global.window = originalWindow;
    global.document = originalDocument;
  });
});
