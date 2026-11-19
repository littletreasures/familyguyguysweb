/**
 * GlossaryApp.ts — Zero-loader React 19 component for the Official Podcast Glossary.
 * Written using React.createElement (no JSX) to run natively in Node ESM for prerendering
 * and in Vite for client bundling.
 */

import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  GLOSSARY_CATEGORIES,
  GLOSSARY_ENTRY_COUNT,
  getEntriesByCategory,
  type EpisodeRef,
  type GlossaryCategoryId,
  type GlossaryEntry,
} from '../data/glossary.ts';
import { PUBLISHED_EPISODE_SLUGS } from '../data/publishedEpisodes.ts';

export type EpisodeRouteResolver = (ref: EpisodeRef) => string | null;

export interface GlossaryAppProps {
  onReady?: () => void;
  initialFilter?: string;
  onFilterChange?: (query: string) => void;
  searchQuery?: string;
  setSearchQuery?: (query: string) => void;
  selectedCategory?: GlossaryCategoryId | 'all';
  setSelectedCategory?: (category: GlossaryCategoryId | 'all') => void;
  publishedEpisodes?: Set<string> | Iterable<string>;
  resolveEpisodeRoute?: EpisodeRouteResolver;
}

/**
 * Canonical published episode reviews catalog.
 * Generated at build time from Supabase by src/scripts/generate-feed.js
 * (see src/data/publishedEpisodes.ts). Slugs follow the site format: unpadded for
 * Season 1 (e.g. s1e7) and zero-padded for Season 2+ (e.g. s02e07); the resolver
 * below checks both forms.
 */
export const CANONICAL_PUBLISHED_EPISODES = new Set<string>(
  PUBLISHED_EPISODE_SLUGS.map((slug) => slug.toLowerCase())
);

// Keep backward-compatible export
export const PUBLISHED_EPISODES = CANONICAL_PUBLISHED_EPISODES;

const MAX_COLLAPSED_REFS = 4;

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

/**
 * Removes reference chips that repeat the origin (season, episode) without adding
 * a distinct note or timestamp.
 */
export function deduplicateReferences(
  references: EpisodeRef[],
  origin?: EpisodeRef | null
): EpisodeRef[] {
  if (!references || references.length === 0) return [];
  if (!origin) return references;

  return references.filter((ref) => {
    const sameEpisode = ref.season === origin.season && ref.episode === origin.episode;
    if (!sameEpisode) return true;
    const hasDistinctNote = Boolean(ref.note && ref.note !== origin.note);
    const hasDistinctTimestamp = Boolean(ref.timestamp && ref.timestamp !== origin.timestamp);
    return hasDistinctNote || hasDistinctTimestamp;
  });
}

function episodeRefSearchTokens(ref: EpisodeRef): string {
  const raw = `s${ref.season}e${ref.episode}`;
  const padded = `s${String(ref.season).padStart(2, '0')}e${String(ref.episode).padStart(2, '0')}`;
  return [raw, padded, ref.note ?? '', ref.timestamp ?? ''].join(' ').toLowerCase();
}

export function matchesGlossaryFilter(entry: GlossaryEntry, normalizedFilter: string): boolean {
  if (!normalizedFilter) return true;
  if (entry.term.toLowerCase().includes(normalizedFilter)) return true;
  if (entry.aka && entry.aka.toLowerCase().includes(normalizedFilter)) return true;
  if (entry.definition.toLowerCase().includes(normalizedFilter)) return true;
  if (entry.origin && episodeRefSearchTokens(entry.origin).includes(normalizedFilter)) {
    return true;
  }
  return entry.references.some((ref) => episodeRefSearchTokens(ref).includes(normalizedFilter));
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
    : e(
        'span',
        {
          className: 'episode-chip episode-chip-static',
          title: 'Episode review not published yet',
        },
        chipText
      );

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
  const isControlledSearch = typeof props.searchQuery === 'string';
  const isControlledCategory = typeof props.selectedCategory === 'string';
  const initialValue = props.searchQuery ?? props.initialFilter ?? '';

  const inputRef = useRef<HTMLInputElement>(null);
  const ignoreNextSlashInputRef = useRef(false);
  const [rawInput, setRawInput] = useState(initialValue);
  const [filterQuery, setFilterQuery] = useState(initialValue);
  const [internalCategory, setInternalCategory] = useState<GlossaryCategoryId | 'all'>('all');
  const [activeScrollCategory, setActiveScrollCategory] = useState<GlossaryCategoryId | null>(null);
  const [expandedRefs, setExpandedRefs] = useState<Record<string, boolean>>({});
  const [copiedEntryId, setCopiedEntryId] = useState<string | null>(null);
  const [copyAnnouncement, setCopyAnnouncement] = useState('');
  const [livePublishedSlugs, setLivePublishedSlugs] = useState<string[] | null>(null);

  const selectedCategory = isControlledCategory
    ? (props.selectedCategory as GlossaryCategoryId | 'all')
    : internalCategory;

  const updateSelectedCategory = (next: GlossaryCategoryId | 'all') => {
    if (!isControlledCategory) {
      setInternalCategory(next);
    }
    props.setSelectedCategory?.(next);
  };

  useEffect(() => {
    if (typeof window === 'undefined' || props.publishedEpisodes) return;
    let cancelled = false;

    async function syncPublishedEpisodes() {
      try {
        const { supabase } = await import('../reviews/lib/supabase.ts');
        if (!supabase || cancelled) return;
        const { data, error } = await supabase
          .from('episodes')
          .select('id')
          .eq('watch_status', 'published');
        if (cancelled || error || !Array.isArray(data)) return;
        const fetchedSlugs = data
          .map((row: { id?: unknown }) => (typeof row.id === 'string' ? row.id.toLowerCase() : ''))
          .filter(Boolean);
        if (fetchedSlugs.length > 0) {
          setLivePublishedSlugs(fetchedSlugs);
        }
      } catch {
        // Retain build-time published catalog if live sync is unavailable
      }
    }

    syncPublishedEpisodes();
    return () => {
      cancelled = true;
    };
  }, [props.publishedEpisodes]);

  const activePublishedSet = useMemo(() => {
    if (props.publishedEpisodes) {
      return props.publishedEpisodes instanceof Set
        ? new Set(Array.from(props.publishedEpisodes).map((s) => s.toLowerCase()))
        : new Set(Array.from(props.publishedEpisodes, (s) => s.toLowerCase()));
    }
    if (livePublishedSlugs && livePublishedSlugs.length > 0) {
      return new Set([...CANONICAL_PUBLISHED_EPISODES, ...livePublishedSlugs]);
    }
    return CANONICAL_PUBLISHED_EPISODES;
  }, [props.publishedEpisodes, livePublishedSlugs]);

  const publishedSlugsAttr = useMemo(
    () => Array.from(activePublishedSet).sort().join(','),
    [activePublishedSet]
  );

  const episodeResolver = useMemo(() => {
    if (props.resolveEpisodeRoute) {
      return props.resolveEpisodeRoute;
    }
    return (ref: EpisodeRef) => defaultEpisodeRouteResolver(ref, activePublishedSet);
  }, [props.resolveEpisodeRoute, activePublishedSet]);

  // Synchronize when controlled searchQuery changes externally
  useEffect(() => {
    if (isControlledSearch && props.searchQuery !== undefined) {
      setRawInput(props.searchQuery);
      setFilterQuery(props.searchQuery);
    }
  }, [isControlledSearch, props.searchQuery]);

  // Debounce search filtering by 150ms
  useEffect(() => {
    if (filterQuery === rawInput) {
      return;
    }

    const timer = setTimeout(() => {
      setFilterQuery(rawInput);
      if (isControlledSearch && props.setSearchQuery) {
        props.setSearchQuery(rawInput);
      }
      props.onFilterChange?.(rawInput);
    }, 150);

    return () => {
      clearTimeout(timer);
    };
  }, [rawInput, filterQuery, isControlledSearch, props.setSearchQuery, props.onFilterChange]);

  // Fire onReady callback on initial mount
  useEffect(() => {
    props.onReady?.();
  }, [props.onReady]);

  // Global / and Cmd/Ctrl+K search shortcut
  useEffect(() => {
    if (typeof document === 'undefined') return;

    const handleKeyDown = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      const tagName = target?.tagName?.toUpperCase() || '';
      const isEditing =
        tagName === 'INPUT' ||
        tagName === 'TEXTAREA' ||
        tagName === 'SELECT' ||
        Boolean(target?.isContentEditable);

      if (event.key === '/' && !isEditing) {
        event.preventDefault();
        event.stopPropagation();
        ignoreNextSlashInputRef.current = true;
        window.setTimeout(() => {
          ignoreNextSlashInputRef.current = false;
        }, 150);
        inputRef.current?.focus();
        return;
      }

      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') {
        event.preventDefault();
        event.stopPropagation();
        inputRef.current?.focus();
        return;
      }

      if (event.key === 'Escape' && document.activeElement === inputRef.current) {
        if (rawInput.length > 0) {
          setRawInput('');
          setFilterQuery('');
          if (isControlledSearch && props.setSearchQuery) {
            props.setSearchQuery('');
          }
          props.onFilterChange?.('');
        } else {
          inputRef.current?.blur();
        }
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [rawInput, isControlledSearch, props.setSearchQuery, props.onFilterChange]);

  // Scroll-spy for visible glossary category sections
  useEffect(() => {
    if (
      typeof document === 'undefined' ||
      typeof IntersectionObserver === 'undefined' ||
      selectedCategory !== 'all'
    ) {
      return;
    }

    const sections = Array.from(
      document.querySelectorAll<HTMLElement>('.glossary-category-section')
    );
    if (sections.length === 0) return;

    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries
          .filter((entry) => entry.isIntersecting)
          .sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top);
        if (visible.length > 0) {
          const id = visible[0].target.id.replace(/^category-/, '') as GlossaryCategoryId;
          setActiveScrollCategory(id);
        }
      },
      { rootMargin: '-120px 0px -65% 0px', threshold: 0.05 }
    );

    sections.forEach((sec) => observer.observe(sec));
    return () => observer.disconnect();
  }, [filterQuery, selectedCategory]);

  const handleInputChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const nextVal = event.target.value;
    if (ignoreNextSlashInputRef.current) {
      ignoreNextSlashInputRef.current = false;
      if (nextVal === `${rawInput}/`) {
        return;
      }
    }
    setRawInput(nextVal);
  };

  const applyStarterSearch = (term: string) => {
    setRawInput(term);
    setFilterQuery(term);
    updateSelectedCategory('all');
    if (isControlledSearch && props.setSearchQuery) {
      props.setSearchQuery(term);
    }
    props.onFilterChange?.(term);
  };

  const handleClear = () => {
    setRawInput('');
    setFilterQuery('');
    updateSelectedCategory('all');
    if (isControlledSearch && props.setSearchQuery) {
      props.setSearchQuery('');
    }
    props.onFilterChange?.('');
    inputRef.current?.focus();
  };

  const handleCopyPermalink = (entry: GlossaryEntry) => {
    const url = `https://familyguyguys.com/glossary#${entry.id}`;
    if (typeof navigator !== 'undefined' && navigator.clipboard?.writeText) {
      navigator.clipboard.writeText(url).catch(() => {});
    }
    setCopiedEntryId(entry.id);
    setCopyAnnouncement(`Copied link to ${entry.term}`);
    setTimeout(() => {
      setCopiedEntryId((current) => (current === entry.id ? null : current));
    }, 2200);
  };

  const toggleRefsExpanded = (entryId: string) => {
    setExpandedRefs((prev) => ({
      ...prev,
      [entryId]: !prev[entryId],
    }));
  };

  const normalizedFilter = filterQuery.trim().toLowerCase();

  const categoriesWithSearchMatches = useMemo(() => {
    return GLOSSARY_CATEGORIES.map((cat) => {
      const categoryEntries = getEntriesByCategory(cat.id);
      const matchingEntries = normalizedFilter
        ? categoryEntries.filter((entry) => matchesGlossaryFilter(entry, normalizedFilter))
        : categoryEntries;

      return {
        category: cat,
        entries: matchingEntries,
      };
    }).filter((item) => item.entries.length > 0);
  }, [normalizedFilter]);

  const visibleCategories = useMemo(() => {
    if (selectedCategory === 'all') return categoriesWithSearchMatches;
    return categoriesWithSearchMatches.filter((item) => item.category.id === selectedCategory);
  }, [categoriesWithSearchMatches, selectedCategory]);

  const totalVisibleCount = visibleCategories.reduce((acc, item) => acc + item.entries.length, 0);

  const introElement = e(
    'p',
    { className: 'glossary-intro' },
    'The official field manual for ',
    e('em', null, 'Family Guy Guys'),
    ' — decoding every baffling rating scale, Structurehead vs. Gagger argument, and studio tangent Collin, Tyler, and Jason have turned into canon.'
  );

  const legendElement = e(
    'p',
    { className: 'glossary-chip-legend' },
    'Linked blue chips open published episode reviews; dashed chips mark episodes not yet reviewed.'
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
        placeholder: 'Search terms, aliases, notes, or S1E7... (Press /)',
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
    ),
    copyAnnouncement
      ? e('span', { className: 'sr-only', 'aria-live': 'polite' }, copyAnnouncement)
      : null
  );

  const categoryNav = e(
    'nav',
    {
      'aria-label': 'Glossary categories',
      className: 'glossary-category-nav',
    },
    categoriesWithSearchMatches.length > 0
      ? e(
          'button',
          {
            type: 'button',
            className: 'glossary-cat-all-btn',
            'aria-pressed': selectedCategory === 'all',
            onClick: () => updateSelectedCategory('all'),
          },
          'All'
        )
      : null,
    categoriesWithSearchMatches.map((item) => {
      const isActive =
        selectedCategory === item.category.id ||
        (selectedCategory === 'all' && activeScrollCategory === item.category.id);
      return e(
        'a',
        {
          key: item.category.id,
          href: `#category-${item.category.id}`,
          className: `glossary-cat-pill${isActive ? ' is-active' : ''}`,
          'aria-current': isActive ? 'location' : undefined,
          onClick: (event: React.MouseEvent<HTMLAnchorElement>) => {
            event.preventDefault();
            updateSelectedCategory(
              selectedCategory === item.category.id ? 'all' : item.category.id
            );
          },
        },
        e('span', { className: 'glossary-cat-emoji', 'aria-hidden': 'true' }, item.category.emoji),
        ' ',
        item.category.shortName ?? item.category.name
      );
    })
  );

  const emptyState = e(
    'div',
    { className: 'glossary-empty-state' },
    e(
      'p',
      { className: 'glossary-empty-message' },
      filterQuery.trim()
        ? `No lore matches "${filterQuery.trim()}" — even Peter couldn't invent that bit.`
        : 'No glossary terms match your current filter.'
    ),
    e(
      'div',
      { className: 'glossary-starter-chips' },
      ['Structurehead', 'Gagger', 'Stewie Gay Watch'].map((starter) =>
        e(
          'button',
          {
            key: starter,
            type: 'button',
            className: 'glossary-starter-chip',
            onClick: () => applyStarterSearch(starter),
          },
          starter
        )
      )
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
              e(
                'span',
                { className: 'glossary-cat-emoji', 'aria-hidden': 'true' },
                item.category.emoji
              ),
              ' ',
              item.category.name
            ),
            e(
              'div',
              { className: 'glossary-cards-grid' },
              item.entries.map((entry) => {
                const dedupedRefs = deduplicateReferences(entry.references, entry.origin);
                const isExpanded = Boolean(expandedRefs[entry.id]);
                const hasHiddenRefs = dedupedRefs.length > MAX_COLLAPSED_REFS;
                const displayedRefs =
                  hasHiddenRefs && !isExpanded
                    ? dedupedRefs.slice(0, MAX_COLLAPSED_REFS)
                    : dedupedRefs;
                const remainingCount = dedupedRefs.length - MAX_COLLAPSED_REFS;
                const showQuizLink = entry.id === 'structurehead' || entry.id === 'gagger';

                return e(
                  'article',
                  {
                    key: entry.id,
                    id: entry.id,
                    className: 'glossary-card',
                  },
                  e(
                    'div',
                    { className: 'glossary-card-header' },
                    e(
                      'div',
                      { className: 'glossary-card-title-row' },
                      e('h3', { className: 'glossary-term' }, entry.term),
                      e(
                        'button',
                        {
                          type: 'button',
                          className: 'glossary-permalink-btn',
                          'aria-label': `Copy link to ${entry.term}`,
                          onClick: () => handleCopyPermalink(entry),
                        },
                        copiedEntryId === entry.id ? '✓' : '#'
                      )
                    ),
                    entry.aka
                      ? e('span', { className: 'glossary-aka' }, `Also known as: ${entry.aka}`)
                      : null
                  ),
                  e('p', { className: 'glossary-definition' }, entry.definition),
                  showQuizLink
                    ? e(
                        'a',
                        { href: '/headers-gaggs', className: 'glossary-quiz-link' },
                        'Find out which one you are → Take the Headers-Gaggs Test'
                      )
                    : null,
                  entry.origin
                    ? e(
                        'div',
                        { className: 'glossary-origin-row' },
                        e('span', { className: 'glossary-meta-label' }, 'First appearance:'),
                        ' ',
                        renderEpisodeRef(entry.origin, `${entry.id}-origin`, episodeResolver)
                      )
                    : null,
                  dedupedRefs.length > 0
                    ? e(
                        'div',
                        { className: 'glossary-references-row' },
                        e('span', { className: 'glossary-meta-label' }, 'Referenced in:'),
                        ' ',
                        e(
                          'span',
                          { className: 'glossary-refs-list' },
                          displayedRefs.map((ref, idx) =>
                            renderEpisodeRef(ref, `${entry.id}-ref-${idx}`, episodeResolver)
                          ),
                          hasHiddenRefs
                            ? e(
                                'button',
                                {
                                  type: 'button',
                                  className: 'glossary-refs-toggle',
                                  'aria-expanded': isExpanded,
                                  onClick: () => toggleRefsExpanded(entry.id),
                                },
                                isExpanded ? 'Show fewer' : `+${remainingCount} more`
                              )
                            : null
                        )
                      )
                    : null
                );
              })
            )
          )
        );

  const bottomCta = e(
    'section',
    { className: 'glossary-bottom-cta', 'aria-label': 'Explore more from Family Guy Guys' },
    e('p', { className: 'glossary-cta-title' }, 'Ready to put this lore to work?'),
    e(
      'p',
      { className: 'glossary-cta-copy' },
      'Find out where you land on the Structurehead–Gagger spectrum, dive into episode scorecards, or listen to the guys argue it out in real time.'
    ),
    e(
      'div',
      { className: 'glossary-cta-actions' },
      e('a', { href: '/headers-gaggs', className: 'btn-orange' }, 'Take the Headers-Gaggs Test'),
      e('a', { href: '/reviews', className: 'btn-teal' }, 'Browse Episode Reviews'),
      e(
        'a',
        {
          href: 'https://open.spotify.com/show/033Z7yYNKcNhJok71mZjUc',
          target: '_blank',
          rel: 'noopener',
          className: 'glossary-cta-secondary',
        },
        'Listen on Spotify'
      )
    )
  );

  return e(
    'div',
    {
      className: 'glossary-container',
      'data-published-slugs': publishedSlugsAttr,
    },
    e(
      'header',
      { className: 'glossary-header' },
      e('h1', { className: 'glossary-title' }, 'Official Podcast Glossary'),
      introElement,
      legendElement,
      searchContainer
    ),
    categoryNav,
    e('div', { className: 'glossary-content' }, sectionsContent),
    bottomCta
  );
};

export default GlossaryApp;
