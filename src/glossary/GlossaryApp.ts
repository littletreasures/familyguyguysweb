/**
 * GlossaryApp.ts — Zero-loader React 19 component for the Official Podcast Glossary.
 * Written using React.createElement (no JSX) to run natively in Node ESM for prerendering
 * and in Vite for client bundling.
 */

import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  GLOSSARY_CATEGORIES,
  GLOSSARY_ENTRIES,
  GLOSSARY_ENTRY_COUNT,
  getEntriesByCategory,
  type EpisodeRef,
  type GlossaryCategory,
  type GlossaryEntry,
} from '../data/glossary.ts';

export type EpisodeRouteResolver = (ref: EpisodeRef) => string | null;

export interface GlossaryAppProps {
  onReady?: () => void;
  initialFilter?: string;
  onFilterChange?: (query: string) => void;
  searchQuery?: string;
  setSearchQuery?: (query: string) => void;
  publishedEpisodes?: Set<string> | Iterable<string>;
  resolveEpisodeRoute?: EpisodeRouteResolver;
}

/** Verified canonical published episode reviews catalog */
export const CANONICAL_PUBLISHED_EPISODES = new Set<string>([
  // Season 1 (unpadded slug format used on site & feed)
  's1e1',
  's1e2',
  's1e3',
  's1e4',
  's1e5',
  's1e6',
  's1e7',
  // Season 2 (zero-padded slug format used on site & feed)
  's02e01',
  's02e02',
  's02e03',
  's02e04',
  's02e05',
  // Non-padded aliases
  's2e1',
  's2e2',
  's2e3',
  's2e4',
  's2e5',
]);

// Keep backward-compatible export
export const PUBLISHED_EPISODES = CANONICAL_PUBLISHED_EPISODES;

/** Canonical route path helper for an episode */
export function formatEpisodeReviewPath(season: number, episode: number): string {
  if (season >= 2) {
    const s = season.toString().padStart(2, '0');
    const ep = episode.toString().padStart(2, '0');
    return `/reviews/s${s}e${ep}`.toLowerCase();
  }
  return `/reviews/s${season}e${episode}`.toLowerCase();
}

/**
 * Resolves an episode reference against the canonical route format and published catalog.
 * Returns the canonical URL path if published, or null if unreleased.
 */
export function defaultEpisodeRouteResolver(
  ref: EpisodeRef,
  publishedCatalog?: Set<string> | Iterable<string>
): string | null {
  const catalog =
    publishedCatalog instanceof Set
      ? publishedCatalog
      : publishedCatalog
        ? new Set(publishedCatalog)
        : CANONICAL_PUBLISHED_EPISODES;

  const rawSlug = `s${ref.season}e${ref.episode}`.toLowerCase();
  const paddedSlug =
    `s${ref.season.toString().padStart(2, '0')}e${ref.episode.toString().padStart(2, '0')}`.toLowerCase();

  if (catalog.has(paddedSlug)) {
    return `/reviews/${paddedSlug}`;
  }
  if (catalog.has(rawSlug)) {
    return `/reviews/${rawSlug}`;
  }
  return null;
}

const e = React.createElement;

function renderEpisodeRef(
  ref: EpisodeRef,
  key?: string | number,
  routeResolver?: (ref: EpisodeRef) => string | null
): React.ReactElement {
  const chipText = `S${ref.season}E${ref.episode}`;
  const reviewUrl = routeResolver ? routeResolver(ref) : defaultEpisodeRouteResolver(ref);

  const chip = reviewUrl
    ? e('a', { href: reviewUrl, className: 'episode-chip episode-chip-link' }, chipText)
    : e('span', { className: 'episode-chip episode-chip-static' }, chipText);

  let noteText = '';
  if (ref.timestamp && ref.note) {
    noteText = `(${ref.timestamp} — ${ref.note})`;
  } else if (ref.note) {
    noteText = `(${ref.note})`;
  } else if (ref.timestamp) {
    noteText = `(${ref.timestamp})`;
  }

  const noteNode = noteText ? e('span', { className: 'episode-note' }, ` ${noteText}`) : null;
  const slug = `s${ref.season}e${ref.episode}`.toLowerCase();

  return e('span', { key: key ?? slug, className: 'glossary-ref-item' }, chip, noteNode);
}

export const GlossaryApp: React.FC<GlossaryAppProps> = function GlossaryApp(
  props: GlossaryAppProps = {}
): React.ReactElement {
  const isControlled = typeof props.searchQuery === 'string';
  const initialValue = props.searchQuery ?? props.initialFilter ?? '';

  const inputRef = useRef<HTMLInputElement>(null);
  const [rawInput, setRawInput] = useState(initialValue);
  const [filterQuery, setFilterQuery] = useState(initialValue);

  const episodeResolver = useMemo(() => {
    if (props.resolveEpisodeRoute) {
      return props.resolveEpisodeRoute;
    }
    if (props.publishedEpisodes) {
      const set =
        props.publishedEpisodes instanceof Set
          ? props.publishedEpisodes
          : new Set(props.publishedEpisodes);
      return (ref: EpisodeRef) => defaultEpisodeRouteResolver(ref, set);
    }
    return defaultEpisodeRouteResolver;
  }, [props.resolveEpisodeRoute, props.publishedEpisodes]);

  // Synchronize when controlled searchQuery changes externally
  useEffect(() => {
    if (isControlled && props.searchQuery !== undefined) {
      setRawInput(props.searchQuery);
      setFilterQuery(props.searchQuery);
    }
  }, [isControlled, props.searchQuery]);

  // Debounce search filtering by 150ms
  useEffect(() => {
    if (filterQuery === rawInput) {
      return;
    }

    const timer = setTimeout(() => {
      setFilterQuery(rawInput);
      if (isControlled && props.setSearchQuery) {
        props.setSearchQuery(rawInput);
      }
      props.onFilterChange?.(rawInput);
    }, 150);

    return () => {
      clearTimeout(timer);
    };
  }, [rawInput, filterQuery, isControlled, props.setSearchQuery, props.onFilterChange]);

  // Fire onReady callback on initial mount
  useEffect(() => {
    props.onReady?.();
  }, [props.onReady]);

  const handleInputChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const nextVal = event.target.value;
    setRawInput(nextVal);
  };

  const handleClear = () => {
    setRawInput('');
    setFilterQuery('');
    if (isControlled && props.setSearchQuery) {
      props.setSearchQuery('');
    }
    props.onFilterChange?.('');
    inputRef.current?.focus();
  };

  const normalizedFilter = filterQuery.trim().toLowerCase();

  const categoriesWithMatches = useMemo(() => {
    return GLOSSARY_CATEGORIES.map((cat) => {
      const categoryEntries = getEntriesByCategory(cat.id);
      const matchingEntries = normalizedFilter
        ? categoryEntries.filter((entry) => {
            const matchTerm = entry.term.toLowerCase().includes(normalizedFilter);
            const matchAka = entry.aka ? entry.aka.toLowerCase().includes(normalizedFilter) : false;
            const matchDef = entry.definition.toLowerCase().includes(normalizedFilter);
            return matchTerm || matchAka || matchDef;
          })
        : categoryEntries;

      return {
        category: cat,
        entries: matchingEntries,
      };
    });
  }, [normalizedFilter]);

  const visibleCategories = categoriesWithMatches.filter((item) => item.entries.length > 0);
  const totalVisibleCount = visibleCategories.reduce((acc, item) => acc + item.entries.length, 0);

  const introElement = e(
    'p',
    { className: 'glossary-intro' },
    'Welcome to the official glossary for ',
    e('em', null, 'Family Guy Guys: The Podcast'),
    ". Whether you are a first-time listener or a seasoned 'Family Guy Guys Guy,' use this guide to navigate our critical frameworks, recurring review segments, and production lore."
  );

  const searchContainer = e(
    'div',
    { className: 'glossary-search-container' },
    e(
      'label',
      {
        htmlFor: 'glossary-search-input',
        className: 'glossary-search-label',
      },
      'Search glossary'
    ),
    e(
      'div',
      { className: 'glossary-search-input-wrapper' },
      e('input', {
        ref: inputRef,
        id: 'glossary-search-input',
        type: 'search',
        className: 'glossary-search-input',
        placeholder: 'Search terms, aliases, or definitions...',
        value: rawInput,
        onChange: handleInputChange,
        autoComplete: 'off',
        spellCheck: 'false',
      }),
      rawInput.length > 0
        ? e(
            'button',
            {
              type: 'button',
              className: 'glossary-search-clear',
              'aria-label': 'Clear search',
              onClick: handleClear,
            },
            '✕'
          )
        : null
    ),
    e(
      'div',
      {
        role: 'status',
        'aria-live': 'polite',
        className: 'glossary-search-status',
      },
      `Showing ${totalVisibleCount} of ${GLOSSARY_ENTRY_COUNT} entries`
    )
  );

  const categoryNav = e(
    'nav',
    {
      'aria-label': 'Glossary categories',
      className: 'glossary-category-nav',
    },
    visibleCategories.map((item) =>
      e(
        'a',
        {
          key: item.category.id,
          href: `#category-${item.category.id}`,
          className: 'glossary-cat-pill',
        },
        e('span', { className: 'glossary-cat-emoji' }, item.category.emoji),
        ' ',
        item.category.name
      )
    )
  );

  const emptyState = e(
    'div',
    { className: 'glossary-empty-state' },
    e(
      'p',
      { className: 'glossary-empty-message' },
      'No glossary terms match your search. Try another keyword.'
    ),
    e(
      'button',
      {
        type: 'button',
        className: 'glossary-clear-btn',
        onClick: handleClear,
      },
      'Clear search'
    )
  );

  const sectionsContent =
    totalVisibleCount === 0
      ? emptyState
      : visibleCategories.map((item) =>
          e(
            'section',
            {
              key: item.category.id,
              id: `category-${item.category.id}`,
              className: 'glossary-category-section',
            },
            e(
              'h2',
              { className: 'glossary-category-title' },
              e('span', { className: 'glossary-cat-emoji' }, item.category.emoji),
              ' ',
              item.category.name
            ),
            e(
              'div',
              { className: 'glossary-cards-grid' },
              item.entries.map((entry) =>
                e(
                  'article',
                  {
                    key: entry.id,
                    id: entry.id,
                    className: 'glossary-card',
                  },
                  e(
                    'div',
                    { className: 'glossary-card-header' },
                    e('h3', { className: 'glossary-term' }, entry.term),
                    entry.aka
                      ? e('span', { className: 'glossary-aka' }, `Also known as: ${entry.aka}`)
                      : null
                  ),
                  e('p', { className: 'glossary-definition' }, entry.definition),
                  entry.origin
                    ? e(
                        'div',
                        { className: 'glossary-origin-row' },
                        e('span', { className: 'glossary-meta-label' }, 'First appearance:'),
                        ' ',
                        renderEpisodeRef(entry.origin, `${entry.id}-origin`, episodeResolver)
                      )
                    : null,
                  entry.references && entry.references.length > 0
                    ? e(
                        'div',
                        { className: 'glossary-references-row' },
                        e('span', { className: 'glossary-meta-label' }, 'Referenced in:'),
                        ' ',
                        e(
                          'span',
                          { className: 'glossary-refs-list' },
                          entry.references.map((ref, idx) =>
                            renderEpisodeRef(ref, `${entry.id}-ref-${idx}`, episodeResolver)
                          )
                        )
                      )
                    : null
                )
              )
            )
          )
        );

  return e(
    'div',
    { className: 'glossary-container' },
    e(
      'header',
      { className: 'glossary-header' },
      e('h1', { className: 'glossary-title' }, 'Official Podcast Glossary'),
      introElement,
      searchContainer
    ),
    categoryNav,
    e('main', { className: 'glossary-content' }, sectionsContent)
  );
};

export default GlossaryApp;
