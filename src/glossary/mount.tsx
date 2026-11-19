/**
 * mount.tsx — Idempotent mounting module and single-owner fragment navigation coordinator
 * for the Official Podcast Glossary.
 */

import React, { useEffect, useState } from 'react';
import { createRoot, hydrateRoot, type Root } from 'react-dom/client';
import { GlossaryApp } from './GlossaryApp.ts';
import { type GlossaryCategoryId } from '../data/glossary.ts';
import './styles/glossary.css';

export interface MountGlossaryOptions {
  isHydration?: boolean;
}

let activeRoot: Root | null = null;
let activeContainer: HTMLElement | null = null;
let isMounted = false;
let inFlightMountPromise: Promise<void> | null = null;
let isInitialCoordinatorRun = true;
let isPopstateAttached = false;

// Search and category filter control callbacks registered by mounted wrapper
let activeSetSearchQuery: ((query: string) => void) | null = null;
let activeSearchQuery = '';
let activeSetSelectedCategory: ((category: GlossaryCategoryId | 'all') => void) | null = null;
let activeSelectedCategory: GlossaryCategoryId | 'all' = 'all';

/** Testing helper to set simulated search coordinator state */
export function _setActiveSearchForTesting(
  query: string,
  setQuery: ((q: string) => void) | null
): void {
  activeSearchQuery = query;
  activeSetSearchQuery = setQuery;
}

/** Testing helper to set simulated category filter coordinator state */
export function _setActiveCategoryForTesting(
  category: GlossaryCategoryId | 'all',
  setCategory: ((cat: GlossaryCategoryId | 'all') => void) | null
): void {
  activeSelectedCategory = category;
  activeSetSelectedCategory = setCategory;
}

let navigationCoordinatorToken = 0;

interface PendingFragmentCommitRequest {
  token: number;
  targetId: string;
  resolve: () => void;
}

let pendingCommitRequest: PendingFragmentCommitRequest | null = null;

/** Trigger commit resolution directly (used by React post-commit effect and test harnesses) */
export function _notifyCommitForTesting(): void {
  if (pendingCommitRequest) {
    const pending = pendingCommitRequest;
    pendingCommitRequest = null;
    pending.resolve();
  }
}

/** Check whether /glossary or /glossary/ is the active browser route */
export function isGlossaryRouteActive(): boolean {
  if (typeof window === 'undefined') return false;
  const path = window.location.pathname.replace(/\/$/, '') || '/';
  return path === '/glossary';
}

/** Extract and safely decode the fragment identifier from window.location.hash */
export function getSafeFragmentId(): string {
  if (typeof window === 'undefined') return '';
  const hash = window.location.hash.replace(/^#/, '');
  if (!hash) return '';
  try {
    return decodeURIComponent(hash);
  } catch {
    return hash;
  }
}

/**
 * Extract published episode slugs from prerendered container HTML (`data-published-slugs`
 * first, falling back to `.episode-chip-link` href parsing).
 */
export function extractPublishedSlugsFromContainer(
  container: HTMLElement
): Set<string> | undefined {
  const glossaryContainer = container.querySelector('.glossary-container');
  const slugsAttr = glossaryContainer?.getAttribute('data-published-slugs');
  if (slugsAttr !== null && slugsAttr !== undefined) {
    const parsed = new Set(
      slugsAttr
        .split(',')
        .map((s) => s.trim().toLowerCase())
        .filter(Boolean)
    );
    return parsed.size > 0 ? parsed : undefined;
  }

  const existingLinks = container.querySelectorAll<HTMLAnchorElement>('.episode-chip-link');
  const publishedFromPrerender = new Set<string>();
  existingLinks.forEach((link) => {
    const href = link.getAttribute('href') || '';
    const match = href.match(/^\/reviews\/([a-z0-9_-]+)$/i);
    if (match) {
      publishedFromPrerender.add(match[1].toLowerCase());
    }
  });

  return publishedFromPrerender.size > 0 ? publishedFromPrerender : undefined;
}

/**
 * Single-owner fragment navigation coordinator:
 * Handles anchor scrolling post-commit, clearing active search or category filters if target
 * is hidden, respecting prefers-reduced-motion, and discarding stale requests if user
 * navigated away.
 */
export async function coordinateFragmentNavigation(options?: {
  isInitialLoad?: boolean;
}): Promise<void> {
  if (typeof window === 'undefined') return;

  const currentToken = ++navigationCoordinatorToken;

  // 1. Guard: Verify /glossary is still the active route
  if (!isGlossaryRouteActive()) {
    return;
  }

  const targetId = getSafeFragmentId();
  if (!targetId) {
    return;
  }

  // 2. Check if target element exists in DOM or is filtered out
  let targetEl = document.getElementById(targetId);

  const needsSearchClear = activeSearchQuery !== '' && Boolean(activeSetSearchQuery);
  const needsCategoryClear = activeSelectedCategory !== 'all' && Boolean(activeSetSelectedCategory);

  // If target element is missing and search/category filter is active, clear filters and await commit
  if (!targetEl && (needsSearchClear || needsCategoryClear)) {
    const setSearch = activeSetSearchQuery;
    const setCategory = activeSetSelectedCategory;
    await new Promise<void>((resolve) => {
      if (pendingCommitRequest) {
        pendingCommitRequest.resolve();
      }
      pendingCommitRequest = {
        token: currentToken,
        targetId,
        resolve,
      };
      if (needsSearchClear && setSearch) setSearch('');
      if (needsCategoryClear && setCategory) setCategory('all');
    });

    // Guard again: Discard stale request if route or hash changed or superseded by a newer navigation
    if (
      currentToken !== navigationCoordinatorToken ||
      !isGlossaryRouteActive() ||
      getSafeFragmentId() !== targetId
    ) {
      return;
    }

    targetEl = document.getElementById(targetId);
  }

  // If target element is not in DOM (e.g. invalid fragment), do nothing
  if (!targetEl) {
    return;
  }

  // 3. Determine scroll behavior: 'auto' on initial load; 'smooth' on SPA/popstate unless reduced motion requested
  const isInitial = options?.isInitialLoad ?? isInitialCoordinatorRun;
  isInitialCoordinatorRun = false;

  const prefersReducedMotion =
    window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  const scrollBehavior: ScrollBehavior = isInitial
    ? 'auto'
    : prefersReducedMotion
      ? 'auto'
      : 'smooth';

  // 4. Programmatic scroll respecting CSS scroll-margin-top
  targetEl.scrollIntoView({
    behavior: scrollBehavior,
    block: 'start',
  });
}

function handlePopState(): void {
  if (isGlossaryRouteActive()) {
    coordinateFragmentNavigation({ isInitialLoad: false });
  }
}

function ensurePopstateListener(): void {
  if (typeof window !== 'undefined' && !isPopstateAttached) {
    window.addEventListener('popstate', handlePopState);
    window.addEventListener('hashchange', handlePopState);
    isPopstateAttached = true;
  }
}

interface GlossaryMountedRootProps {
  onReady: () => void;
  publishedEpisodes?: Set<string>;
}

function GlossaryMountedRoot({
  onReady,
  publishedEpisodes,
}: GlossaryMountedRootProps): React.ReactElement {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<GlossaryCategoryId | 'all'>('all');

  useEffect(() => {
    activeSetSearchQuery = setSearchQuery;
    activeSearchQuery = searchQuery;
    activeSetSelectedCategory = setSelectedCategory;
    activeSelectedCategory = selectedCategory;

    // React post-commit effect: fires after cleared search/category filters have committed to DOM
    if (searchQuery === '' && selectedCategory === 'all' && pendingCommitRequest) {
      const pending = pendingCommitRequest;
      pendingCommitRequest = null;
      pending.resolve();
    }

    return () => {
      if (activeSetSearchQuery === setSearchQuery) {
        activeSetSearchQuery = null;
        activeSearchQuery = '';
      }
      if (activeSetSelectedCategory === setSelectedCategory) {
        activeSetSelectedCategory = null;
        activeSelectedCategory = 'all';
      }
    };
  }, [searchQuery, selectedCategory]);

  return React.createElement(GlossaryApp, {
    searchQuery,
    setSearchQuery,
    selectedCategory,
    setSelectedCategory,
    onReady,
    publishedEpisodes,
  });
}

/**
 * Mount the Glossary application to the container element.
 * Supports hydration via hydrateRoot when container has pre-rendered HTML child nodes,
 * otherwise uses createRoot.
 */
export function mountGlossary(
  container: HTMLElement,
  options?: MountGlossaryOptions
): Promise<void> {
  // 1. If currently mounting this container, return the in-flight promise
  if (inFlightMountPromise && activeContainer === container) {
    return inFlightMountPromise;
  }

  // 2. If already mounted on this container, coordinate navigation and resolve
  if (isMounted && activeRoot && activeContainer === container) {
    return coordinateFragmentNavigation({ isInitialLoad: false });
  }

  // 3. If mounting a new container while another is active, unmount old one
  if (activeRoot && activeContainer && activeContainer !== container) {
    unmountGlossary();
  }

  activeContainer = container;
  ensurePopstateListener();

  inFlightMountPromise = new Promise<void>((resolve, reject) => {
    let resolved = false;

    const handleReady = () => {
      if (resolved) return;
      resolved = true;
      isMounted = true;
      inFlightMountPromise = null;

      // Coordinate initial fragment navigation post-commit
      coordinateFragmentNavigation({ isInitialLoad: true })
        .then(() => resolve())
        .catch(() => resolve());
    };

    try {
      const publishedEpisodes = extractPublishedSlugsFromContainer(container);

      const element = React.createElement(GlossaryMountedRoot, {
        onReady: handleReady,
        publishedEpisodes,
      });

      const shouldHydrate =
        options?.isHydration ??
        (container.firstElementChild !== null &&
          container.querySelector('.glossary-container') !== null);

      if (shouldHydrate) {
        activeRoot = hydrateRoot(container, element, {
          onRecoverableError(error) {
            console.warn('[glossary/mount] Recoverable hydration warning:', error);
          },
        });
      } else {
        activeRoot = createRoot(container);
        activeRoot.render(element);
      }
    } catch (err) {
      inFlightMountPromise = null;
      isMounted = false;
      activeRoot = null;
      activeContainer = null;
      reject(err);
    }
  });

  return inFlightMountPromise;
}

/**
 * Unmount the Glossary application and clear coordinator state.
 */
export function unmountGlossary(): void {
  if (activeRoot) {
    try {
      activeRoot.unmount();
    } catch {
      // Ignore unmount errors
    }
    activeRoot = null;
  }
  activeContainer = null;
  isMounted = false;
  inFlightMountPromise = null;
  if (pendingCommitRequest) {
    pendingCommitRequest.resolve();
    pendingCommitRequest = null;
  }
  activeSetSearchQuery = null;
  activeSearchQuery = '';
  activeSetSelectedCategory = null;
  activeSelectedCategory = 'all';
  isInitialCoordinatorRun = true;
  navigationCoordinatorToken++;
  if (typeof window !== 'undefined' && isPopstateAttached) {
    window.removeEventListener('popstate', handlePopState);
    window.removeEventListener('hashchange', handlePopState);
    isPopstateAttached = false;
  }
}
