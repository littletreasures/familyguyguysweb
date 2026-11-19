// Main entry point for familyguyguys.com SPA
import './styles/main.css';
import { initRouter } from './router.js';
import { initAudioPlayer } from './audio-player.js';
import { trackGuestEvent } from './lib/guestAnalytics.ts';

// Setup mobile nav toggling
if (typeof document !== 'undefined') {
  const mobileNav = document.getElementById('mobileNav');
  const hamburger = document.querySelector('.hamburger');

  window.toggleMobile = function toggleMobile() {
    if (mobileNav) {
      mobileNav.classList.toggle('open');
      if (hamburger) {
        hamburger.setAttribute('aria-expanded', mobileNav.classList.contains('open'));
      }
    }
  };

  if (hamburger) {
    hamburger.addEventListener('click', window.toggleMobile);
  }

  // Close mobile nav on outside click or Escape key press
  document.addEventListener('click', function (e) {
    if (!mobileNav) return;
    const isNavClick = e.target.closest('nav') || e.target.closest('#mobileNav');
    if (!isNavClick) {
      mobileNav.classList.remove('open');
      if (hamburger) {
        hamburger.setAttribute('aria-expanded', 'false');
      }
    }
  });

  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape' && mobileNav && mobileNav.classList.contains('open')) {
      mobileNav.classList.remove('open');
      if (hamburger) {
        hamburger.setAttribute('aria-expanded', 'false');
        hamburger.focus();
      }
    }
  });

  // Close mobile nav when a link inside it is clicked
  if (mobileNav) {
    mobileNav.addEventListener('click', (e) => {
      if (e.target.closest('a')) {
        mobileNav.classList.remove('open');
        if (hamburger) {
          hamburger.setAttribute('aria-expanded', 'false');
        }
      }
    });
  }
}

if (typeof window !== 'undefined' && typeof document !== 'undefined') {
  // Lazy load the React review app when visiting /reviews
  let reviewAppLoaded = false;
  window.addEventListener('routechange', async (e) => {
    const { page, _params } = e.detail;
    if (page === 'reviews' && !reviewAppLoaded) {
      reviewAppLoaded = true;
      const reviewAppContainer = document.getElementById('review-app');
      if (reviewAppContainer) {
        const loadingCard = document.createElement('div');
        loadingCard.className = 'route-loading-card';
        loadingCard.setAttribute('role', 'status');
        loadingCard.textContent = 'Loading Reviews Platform...';
        reviewAppContainer.replaceChildren(loadingCard);
        try {
          // Dynamically import the React review application entry point
          const { mountReviews } = await import('./reviews/mount.jsx');
          mountReviews(reviewAppContainer);
        } catch (err) {
          console.error('Failed to load reviews app:', err);
          const errorCard = document.createElement('div');
          errorCard.className = 'route-error-card';
          errorCard.setAttribute('role', 'alert');
          errorCard.textContent = 'Failed to load reviews platform. Please refresh and try again.';
          reviewAppContainer.replaceChildren(errorCard);
        }
      }
    }
  });

  // Lazy load the React glossary app when visiting /glossary
  let glossaryMounted = false;
  let glossaryMountPromise = null;

  const loadGlossaryApp = async () => {
    const container = document.getElementById('glossary-app');
    if (!container) return;

    if (glossaryMounted) {
      // Already mounted; coordinate fragment navigation for current hash
      try {
        const { coordinateFragmentNavigation } = await import('./glossary/mount.tsx');
        coordinateFragmentNavigation({ isInitialLoad: false });
      } catch (err) {
        console.error('Failed to coordinate glossary fragment navigation:', err);
      }
      return;
    }

    if (glossaryMountPromise) {
      return glossaryMountPromise;
    }

    const showGlossaryError = (err) => {
      console.error('Failed to load glossary app:', err);
      container.innerHTML = `
        <div style="padding: 2.5rem 1rem; text-align: center; max-width: 480px; margin: 0 auto;">
          <p style="color: #b91c1c; font-weight: 500; margin-bottom: 1rem;">Failed to load the Official Podcast Glossary.</p>
          <button id="retry-glossary-btn" class="btn-orange" style="display: inline-block; cursor: pointer; padding: 0.5rem 1.25rem;">Retry Loading</button>
        </div>
      `;
      const retryBtn = document.getElementById('retry-glossary-btn');
      if (retryBtn) {
        retryBtn.addEventListener(
          'click',
          () => {
            glossaryMountPromise = null;
            loadGlossaryApp();
          },
          { once: true }
        );
      }
    };

    glossaryMountPromise = (async () => {
      try {
        const { mountGlossary } = await import('./glossary/mount.tsx');
        await mountGlossary(container);
        glossaryMounted = true;
      } catch (err) {
        glossaryMounted = false;
        showGlossaryError(err);
      } finally {
        glossaryMountPromise = null;
      }
    })();

    return glossaryMountPromise;
  };

  window.addEventListener('routechange', (e) => {
    const { page } = e.detail;
    if (page === 'glossary') {
      loadGlossaryApp();
    }
  });

  // Direct load on initial startup if already on /glossary
  const initialPath = window.location.pathname.replace(/\/$/, '') || '/';
  if (initialPath === '/glossary') {
    loadGlossaryApp();
  }

  // Track guest page view on route change
  window.addEventListener('routechange', (e) => {
    const { page } = e.detail;
    if (page === 'guest') {
      trackGuestEvent('guest_page_view');
    }
  });

  // Track guest page view on direct startup
  if (initialPath === '/guest') {
    trackGuestEvent('guest_page_view');
  }

  // Delegate click events on #page-guest
  const guestPageContainer = document.getElementById('page-guest');
  if (guestPageContainer) {
    guestPageContainer.addEventListener('click', (e) => {
      const bookingLink = e.target.closest('.guest-cta-booking');
      if (bookingLink) {
        const location = bookingLink.dataset.analyticsLocation || 'hero';
        trackGuestEvent('guest_booking_click', { location });
        return;
      }

      const emailLink = e.target.closest('.guest-cta-email');
      if (emailLink) {
        const location = emailLink.dataset.analyticsLocation || 'hero';
        trackGuestEvent('guest_email_click', { location });
        return;
      }

      const releaseLink = e.target.closest('.guest-release-btn');
      if (releaseLink) {
        trackGuestEvent('guest_release_click', { location: 'already_booked' });
        return;
      }
    });
  }

  // Mount Headers-Gaggs Test app & homepage CTA
  let headersGaggsAppMounted = false;
  let headersGaggsCtaMounted = false;

  const initHeadersGaggs = async () => {
    const appContainer = document.getElementById('headers-gaggs-app');
    const ctaContainer = document.getElementById('headers-gaggs-cta-container');

    if ((appContainer || ctaContainer) && (!headersGaggsAppMounted || !headersGaggsCtaMounted)) {
      try {
        const { mountHeadersGaggsApp, mountHeadersGaggsCta } =
          await import('./headers-gaggs/mount.tsx');
        if (appContainer && !headersGaggsAppMounted) {
          mountHeadersGaggsApp(appContainer);
          headersGaggsAppMounted = true;
        }
        if (ctaContainer && !headersGaggsCtaMounted) {
          mountHeadersGaggsCta(ctaContainer);
          headersGaggsCtaMounted = true;
        }
      } catch (err) {
        console.error('Failed to mount Headers-Gaggs module:', err);
        const target = ctaContainer || appContainer;
        if (target) {
          const fallback = document.createElement('div');
          fallback.className = 'route-error-card';
          const copy = document.createElement('p');
          copy.textContent = 'Take the Headers-Gaggs Personality Evaluation on its dedicated page.';
          const link = document.createElement('a');
          link.href = '/headers-gaggs';
          link.className = 'btn-orange';
          link.textContent = 'Open Headers-Gaggs Test';
          fallback.appendChild(copy);
          fallback.appendChild(link);
          target.replaceChildren(fallback);
        }
      }
    }
  };

  initHeadersGaggs();

  // Mount Visitor Reviews Island
  let visitorReviewsMounted = false;
  const initVisitorReviews = async () => {
    const rootEl = document.getElementById('visitor-reviews-root');
    if (rootEl && !visitorReviewsMounted) {
      const episodeId = rootEl.dataset.episodeId;
      if (episodeId) {
        try {
          const { mountVisitorReviews } = await import('./reviews/mount-visitor-reviews.tsx');
          mountVisitorReviews(rootEl, episodeId);
          visitorReviewsMounted = true;
        } catch (err) {
          console.error('Failed to mount visitor reviews island:', err);
        }
      }
    }
  };

  initVisitorReviews();

  // Setup active link highlight and route handling - MUST run after registering event listeners
  initRouter();

  // Initialize the persistent audio player
  initAudioPlayer();

  // Auto-expand transcript <details> if navigating to a section anchor (#sec-...)
  const handleTranscriptHash = () => {
    const hash = window.location.hash;
    if (hash && hash.startsWith('#sec-')) {
      const details = document.getElementById('transcript-details');
      if (details && !details.open) {
        details.open = true;
      }
      try {
        const target = document.querySelector(hash);
        if (target) {
          setTimeout(() => {
            target.scrollIntoView({ behavior: 'smooth' });
          }, 50);
        }
      } catch {
        // ignore malformed selector
      }
    }
  };

  window.addEventListener('hashchange', handleTranscriptHash);
  if (document.readyState === 'complete') {
    handleTranscriptHash();
  } else {
    window.addEventListener('load', handleTranscriptHash);
  }
}

// Dynamic Episode Loader from Supabase
import { supabase } from './reviews/lib/supabase.ts';

// Context-aware HTML Escaping Helper for text nodes / attributes
export function escapeHTML(str) {
  if (!str) return '';
  return String(str).replace(
    /[&<>"'/`=]/g,
    (tag) =>
      ({
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        '"': '&quot;',
        "'": '&#39;',
        '/': '&#47;',
        '`': '&#96;',
        '=': '&#61;',
      })[tag] || tag
  );
}

// Strict URL Sanitizer Helper
export function sanitizeURL(rawUrl) {
  if (!rawUrl || typeof rawUrl !== 'string') return null;
  const str = rawUrl.trim();
  if (!str) return null;

  // Reject protocol-relative URLs, control characters, data:, javascript:, blob:
  if (str.startsWith('//') || /[\x00-\x1F\x7F]/.test(str)) return null;

  // Permit safe internal relative paths
  if (str.startsWith('/')) {
    if (
      str === '/' ||
      str === '/episodes' ||
      str === '/contact' ||
      str === '/reviews' ||
      str.startsWith('/reviews/') ||
      str.startsWith('/assets/')
    ) {
      return str;
    }
    return null;
  }

  // Permit only HTTPS external URLs
  try {
    const parsed = new URL(str);
    if (parsed.protocol === 'https:') {
      return parsed.href;
    }
  } catch (_e) {
    return null;
  }
  return null;
}

/**
 * Safely derives primary and fallback YouTube video thumbnail URLs from a YouTube URL.
 * Returns null for blank, malformed, or unsupported URLs without throwing.
 */
export function getYouTubeThumbnailUrls(youtubeUrl) {
  if (!youtubeUrl || typeof youtubeUrl !== 'string') return null;
  const trimmed = youtubeUrl.trim();
  if (!trimmed) return null;

  try {
    const url = new URL(trimmed);
    const hostname = url.hostname.replace(/^(www\.|m\.)/, '').toLowerCase();
    let videoId = null;

    if (hostname === 'youtu.be') {
      const pathname = url.pathname.slice(1);
      videoId = pathname.split('/')[0] || null;
    } else if (hostname === 'youtube.com') {
      if (url.pathname === '/watch') {
        videoId = url.searchParams.get('v');
      } else if (url.pathname.startsWith('/shorts/')) {
        const parts = url.pathname.split('/');
        videoId = parts[2] || null;
      } else if (url.pathname.startsWith('/embed/')) {
        const parts = url.pathname.split('/');
        videoId = parts[2] || null;
      }
    }

    if (!videoId) return null;

    const cleanId = videoId.trim();
    if (!/^[a-zA-Z0-9_-]{11}$/.test(cleanId)) {
      return null;
    }

    return {
      primary: `https://i.ytimg.com/vi/${cleanId}/maxresdefault.jpg`,
      fallback: `https://i.ytimg.com/vi/${cleanId}/hqdefault.jpg`,
    };
  } catch (_e) {
    return null;
  }
}

// DOM API-based safe episode card element builder
function createEpisodeElement(ep, isFeatured = false) {
  const safeYtUrl = sanitizeURL(ep.youtube_url);
  const safeReviewUrl = sanitizeURL(`/reviews/${encodeURIComponent(ep.id)}`);

  const hasYoutube = !!safeYtUrl;
  const hasReviews = !!(ep.reviews && ep.reviews.length > 0);
  const isBoth = hasYoutube && hasReviews;

  const cardTag = isBoth ? 'div' : 'a';
  const card = document.createElement(cardTag);

  card.className = isFeatured
    ? 'episode-card-featured'
    : isBoth
      ? 'ep-row'
      : 'ep-row ep-row-clickable';
  if (isBoth) {
    card.style.cursor = 'default';
  } else if (!isBoth) {
    if (hasYoutube) {
      card.setAttribute('href', safeYtUrl);
      card.setAttribute('target', '_blank');
      card.setAttribute('rel', 'noopener noreferrer');
    } else if (safeReviewUrl) {
      card.setAttribute('href', safeReviewUrl);
    }
  }

  const epNumStr = ep.episode_number.toString().padStart(3, '0');
  const DEFAULT_THUMBNAIL = '/assets/default-podcast-episode-thumbnail.webp';
  const ytThumbs = getYouTubeThumbnailUrls(ep.youtube_url);

  // Thumb container
  const thumbContainer = document.createElement('div');
  if (isFeatured) thumbContainer.className = 'episode-thumb-featured';

  const img = document.createElement('img');
  img.alt = `Family Guy Guys YouTube thumbnail — Episode #${epNumStr}: ${ep.title || ''}`;
  if (!isFeatured) img.className = 'ep-thumb';
  img.setAttribute('width', isFeatured ? '160' : '180');
  img.setAttribute('height', isFeatured ? '90' : '101');
  img.setAttribute('loading', 'lazy');
  img.setAttribute('decoding', 'async');

  if (ytThumbs) {
    img.src = ytThumbs.primary;
    let step = 0;
    img.onerror = () => {
      if (step === 0) {
        step = 1;
        img.src = ytThumbs.fallback;
      } else {
        img.onerror = null;
        img.src = DEFAULT_THUMBNAIL;
      }
    };
  } else {
    img.src = DEFAULT_THUMBNAIL;
  }

  thumbContainer.appendChild(img);

  // Meta container
  const metaContainer = document.createElement('div');
  metaContainer.className = isFeatured ? 'episode-meta' : 'ep-info';

  const numDiv = document.createElement('div');
  numDiv.className = isFeatured ? 'episode-number' : 'ep-num';
  numDiv.textContent = `Episode #${epNumStr}`;

  const titleDiv = document.createElement('div');
  titleDiv.className = isFeatured ? 'episode-title' : 'ep-title';
  titleDiv.textContent = ep.title || '';

  const descDiv = document.createElement('div');
  descDiv.className = isFeatured ? 'episode-desc' : 'ep-desc';
  descDiv.textContent = ep.summary || '';

  metaContainer.appendChild(numDiv);
  metaContainer.appendChild(titleDiv);
  metaContainer.appendChild(descDiv);

  if (isBoth) {
    const actionsDiv = document.createElement('div');
    actionsDiv.className = 'ep-actions';

    if (safeYtUrl) {
      const watchBtn = document.createElement('a');
      watchBtn.href = safeYtUrl;
      watchBtn.target = '_blank';
      watchBtn.rel = 'noopener noreferrer';
      watchBtn.className = 'ep-action-btn watch';
      watchBtn.textContent = 'Watch Video';
      actionsDiv.appendChild(watchBtn);
    }

    if (safeReviewUrl) {
      const reviewBtn = document.createElement('a');
      reviewBtn.href = safeReviewUrl;
      reviewBtn.className = 'ep-action-btn review';
      reviewBtn.textContent = 'Read Review';
      actionsDiv.appendChild(reviewBtn);
    }

    metaContainer.appendChild(actionsDiv);
  }

  card.appendChild(thumbContainer);
  card.appendChild(metaContainer);
  return card;
}

function renderLoadingState(container, isFeatured = false) {
  if (!container) return;
  container.replaceChildren();

  const wrapper = document.createElement('div');
  wrapper.className = 'episode-loading-state';
  wrapper.setAttribute('role', 'status');
  wrapper.setAttribute('aria-live', 'polite');
  if (isFeatured) {
    wrapper.classList.add('episode-state--compact');
  }
  wrapper.textContent = 'Loading latest episodes...';
  container.appendChild(wrapper);
}

function renderErrorState(container, message, isFeatured = false) {
  if (!container) return;
  container.replaceChildren();

  const wrapper = document.createElement('div');
  wrapper.className = isFeatured
    ? 'episode-error-state episode-state--compact'
    : 'episode-error-state';
  wrapper.setAttribute('role', 'alert');

  const icon = document.createElement('div');
  icon.className = 'episode-state-icon';
  icon.setAttribute('aria-hidden', 'true');
  icon.textContent = '⚠️';

  const title = document.createElement('div');
  title.className = 'episode-state-title';
  title.textContent = 'Could Not Load Episodes';

  const text = document.createElement('p');
  text.className = 'episode-state-copy';
  text.textContent = message || 'Unable to reach the episode archive right now.';

  const actions = document.createElement('div');
  actions.className = 'episode-state-actions';

  const retryBtn = document.createElement('button');
  retryBtn.type = 'button';
  retryBtn.className = 'ep-action-btn watch';
  retryBtn.textContent = 'Retry';
  retryBtn.addEventListener('click', () => {
    loadDynamicEpisodes();
  });

  const reviewsLink = document.createElement('a');
  reviewsLink.href = '/reviews';
  reviewsLink.className = 'ep-action-btn review';
  reviewsLink.textContent = 'Browse Reviews';

  actions.appendChild(retryBtn);
  actions.appendChild(reviewsLink);

  wrapper.appendChild(icon);
  wrapper.appendChild(title);
  wrapper.appendChild(text);
  wrapper.appendChild(actions);
  container.appendChild(wrapper);
}

function renderEmptyState(container, isFeatured = false) {
  if (!container) return;
  container.replaceChildren();

  const wrapper = document.createElement('div');
  wrapper.className = isFeatured
    ? 'episode-empty-state episode-state--compact'
    : 'episode-empty-state';

  const icon = document.createElement('div');
  icon.className = 'episode-state-icon';
  icon.setAttribute('aria-hidden', 'true');
  icon.textContent = '📭';

  const title = document.createElement('div');
  title.className = 'episode-state-title';
  title.textContent = 'No Published Episodes Yet';

  const text = document.createElement('p');
  text.className = 'episode-state-copy';
  text.textContent = 'Check back soon or browse the reviews archive.';

  const actions = document.createElement('div');
  actions.className = 'episode-state-actions';

  const reviewsLink = document.createElement('a');
  reviewsLink.href = '/reviews';
  reviewsLink.className = 'ep-action-btn review';
  reviewsLink.textContent = 'Browse Reviews';

  actions.appendChild(reviewsLink);

  wrapper.appendChild(icon);
  wrapper.appendChild(title);
  wrapper.appendChild(text);
  wrapper.appendChild(actions);
  container.appendChild(wrapper);
}

function renderEpisodeList(episodes, latestContainer, listContainer) {
  if (latestContainer && episodes.length > 0) {
    latestContainer.replaceChildren(createEpisodeElement(episodes[0], true));
  }
  if (listContainer && episodes.length > 0) {
    listContainer.replaceChildren(...episodes.map((ep) => createEpisodeElement(ep, false)));
  }
}

async function loadDynamicEpisodes() {
  if (typeof document === 'undefined') return;
  const latestEpisodeContainer = document.getElementById('latest-episode-container');
  const episodesList = document.getElementById('episodesList');

  if (!latestEpisodeContainer && !episodesList) return;

  renderLoadingState(latestEpisodeContainer, true);
  renderLoadingState(episodesList, false);

  try {
    if (!supabase) {
      const msg = 'Episodes database connection is currently unavailable.';
      renderErrorState(latestEpisodeContainer, msg, true);
      renderErrorState(episodesList, msg, false);
      return;
    }

    const { data: episodes, error } = await supabase
      .from('episodes')
      .select(
        'id, season, episode_number, title, air_date, summary, podcast_url, watch_status, youtube_url, reviews(id)'
      )
      .eq('watch_status', 'published')
      .order('season', { ascending: false })
      .order('episode_number', { ascending: false });

    if (error) {
      renderErrorState(
        latestEpisodeContainer,
        error.message || 'Unable to load latest episode.',
        true
      );
      renderErrorState(episodesList, error.message || 'Unable to load episode feed.', false);
      return;
    }

    if (!episodes || episodes.length === 0) {
      renderEmptyState(latestEpisodeContainer, true);
      renderEmptyState(episodesList, false);
      return;
    }

    renderEpisodeList(episodes, latestEpisodeContainer, episodesList);
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unable to reach the episode archive.';
    renderErrorState(latestEpisodeContainer, message, true);
    renderErrorState(episodesList, message, false);
  }
}

// Bootstrap dynamic features on load
loadDynamicEpisodes();
