// Main entry point for familyguyguys.com SPA
import './styles/main.css';
import { initRouter } from './router.js';
import { initAudioPlayer } from './audio-player.js';

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
        reviewAppContainer.textContent = 'Loading Reviews Platform...';
        reviewAppContainer.className = 'p-8 text-center text-slate-800';
        try {
          // Dynamically import the React review application entry point
          const { mountReviews } = await import('./reviews/mount.jsx');
          mountReviews(reviewAppContainer);
        } catch (err) {
          console.error('Failed to load reviews app:', err);
          reviewAppContainer.textContent = 'Failed to load reviews platform. Please try again.';
          reviewAppContainer.className = 'p-8 text-center text-red-600';
        }
      }
    }
  });

  // Mount Headers-Gaggs Test app & homepage CTA
  let headersGaggsAppMounted = false;
  let headersGaggsCtaMounted = false;

  const initHeadersGaggs = async () => {
    const appContainer = document.getElementById('headers-gaggs-app');
    const ctaContainer = document.getElementById('headers-gaggs-cta-container');

    if ((appContainer || ctaContainer) && (!headersGaggsAppMounted || !headersGaggsCtaMounted)) {
      try {
        const { mountHeadersGaggsApp, mountHeadersGaggsCta } = await import('./headers-gaggs/mount.tsx');
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
      }
    }
  };

  initHeadersGaggs();

  // Setup active link highlight and route handling - MUST run after registering event listeners
  initRouter();

  // Initialize the persistent audio player
  initAudioPlayer();

  // Spreadshirt Shop Integration (Spreadshop ID: 401265528) - Loaded on demand
  if (document.getElementById('merchShopContainer')) {
    window.spread_shop_config = {
      shopName: '401265528',
      locale: 'us_US',
      prefix: 'https://familyguyguys.com/merch',
      baseId: 'merchShopContainer',
    };

    const loadMerchScript = () => {
      if (document.getElementById('spreadshirt-script')) return;
      const script = document.createElement('script');
      script.id = 'spreadshirt-script';
      script.type = 'text/javascript';
      script.src = 'https://shop.spreadshirt.com/shopfiles/shopclient.nocache.js';
      script.async = true;
      script.onerror = () => {
        console.warn('Failed to load Spreadshirt shop widget.');
      };
      document.body.appendChild(script);
    };

    // Defer merch script until main content render
    if (document.readyState === 'complete') {
      loadMerchScript();
    } else {
      window.addEventListener('load', loadMerchScript);
    }
  }

  // Newsletter Signup Integration (Honest Coming Soon state)
  const newsletterForm = document.getElementById('newsletter-form');
  const newsletterEmail = document.getElementById('newsletter-email');
  const newsletterStatus = document.getElementById('newsletter-status');

  if (newsletterForm) {
    newsletterForm.addEventListener('submit', (e) => {
      e.preventDefault();
      if (!newsletterStatus) return;

      newsletterStatus.style.display = 'block';
      newsletterStatus.style.color = 'var(--teal)';
      newsletterStatus.textContent =
        'Newsletter signup is coming soon! Email feedback@familyguyguys.com to connect.';
      if (newsletterEmail) newsletterEmail.value = '';
    });
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
  const thumbPrefix = `/assets/ep${epNumStr}-thumb`;

  // Thumb container with Picture element
  const thumbContainer = document.createElement('div');
  if (isFeatured) thumbContainer.className = 'episode-thumb-featured';

  const picture = document.createElement('picture');

  const sourceAvif = document.createElement('source');
  sourceAvif.srcset = `${thumbPrefix}-180w.avif 180w, ${thumbPrefix}-360w.avif 360w`;
  sourceAvif.type = 'image/avif';
  sourceAvif.sizes = isFeatured ? '160px' : '180px';

  const sourceWebp = document.createElement('source');
  sourceWebp.srcset = `${thumbPrefix}-180w.webp 180w, ${thumbPrefix}-360w.webp 360w`;
  sourceWebp.type = 'image/webp';
  sourceWebp.sizes = isFeatured ? '160px' : '180px';

  const img = document.createElement('img');
  img.src = `${thumbPrefix}-360w.webp`;
  img.alt = `Episode ${epNumStr} thumbnail`;
  if (!isFeatured) img.className = 'ep-thumb';
  img.setAttribute('width', isFeatured ? '160' : '180');
  img.setAttribute('height', isFeatured ? '90' : '101');
  img.setAttribute('loading', 'lazy');
  img.setAttribute('decoding', 'async');
  img.onerror = () => {
    img.onerror = null;
    img.src = '/tv-watching-480w.webp';
    img.alt = 'Family Guy Guys default thumbnail';
  };

  picture.appendChild(sourceAvif);
  picture.appendChild(sourceWebp);
  picture.appendChild(img);
  thumbContainer.appendChild(picture);

  // Meta container
  const metaContainer = document.createElement('div');
  metaContainer.className = isFeatured ? 'episode-meta' : 'ep-info';

  const numDiv = document.createElement('div');
  numDiv.className = isFeatured ? 'episode-number' : 'ep-num';
  numDiv.textContent = `Episode #${epNumStr}`;

  const titleDiv = document.createElement('div');
  titleDiv.className = 'ep-title';
  titleDiv.textContent = ep.title || '';

  const descDiv = document.createElement('div');
  descDiv.className = 'ep-desc';
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

function renderErrorState(container, message, isFeatured = false) {
  if (!container) return;
  container.replaceChildren();

  const wrapper = document.createElement('div');
  wrapper.className = 'episode-error-state';
  wrapper.style.cssText = `padding: ${isFeatured ? '1.5rem' : '3rem'}; text-align: center; border: 2px dashed var(--maroon); border-radius: 8px; color: var(--maroon); font-family: 'Special Elite', monospace;`;

  const icon = document.createElement('div');
  icon.style.fontSize = '1.5rem';
  icon.style.marginBottom = '0.5rem';
  icon.textContent = '⚠️';

  const title = document.createElement('div');
  title.style.cssText = 'font-weight: bold; text-transform: uppercase; font-size: 0.9rem;';
  title.textContent = 'Database Connection Failed';

  const text = document.createElement('p');
  text.style.cssText =
    'margin-top: 0.5rem; font-size: 0.8rem; color: #666; font-family: sans-serif; line-height: 1.4;';
  text.textContent = message || '';

  wrapper.appendChild(icon);
  wrapper.appendChild(title);
  wrapper.appendChild(text);
  container.appendChild(wrapper);
}

function renderEmptyState(container, isFeatured = false) {
  if (!container) return;
  container.replaceChildren();

  const wrapper = document.createElement('div');
  wrapper.className = 'episode-empty-state';
  wrapper.style.cssText = `padding: ${isFeatured ? '1.5rem' : '3rem'}; text-align: center; border: 2px dashed var(--orange); border-radius: 8px; color: var(--orange-dark); font-family: 'Special Elite', monospace;`;

  const icon = document.createElement('div');
  icon.style.fontSize = '1.5rem';
  icon.style.marginBottom = '0.5rem';
  icon.textContent = '📭';

  const title = document.createElement('div');
  title.style.cssText = 'font-weight: bold; text-transform: uppercase; font-size: 0.9rem;';
  title.textContent = 'No Published Episodes';

  const text = document.createElement('p');
  text.style.cssText =
    'margin-top: 0.5rem; font-size: 0.8rem; color: #666; font-family: sans-serif; line-height: 1.4;';
  text.textContent = 'Check back later for new episodes of Family Guy Guys!';

  wrapper.appendChild(icon);
  wrapper.appendChild(title);
  wrapper.appendChild(text);
  container.appendChild(wrapper);
}

const DEFAULT_FALLBACK_EPISODES = [
  {
    id: 's01e01-death-has-a-shadow',
    season: 1,
    episode_number: 1,
    title: 'Death Has a Shadow',
    air_date: 'Jan 31, 1999',
    summary:
      'Peter loses his job after drinking too much at a bachelor party and accidentally collects $150,000 in welfare checks.',
    youtube_url: null,
    reviews: [{ id: 'rev-1' }],
  },
  {
    id: 's01e02-i-never-met-the-dead-man',
    season: 1,
    episode_number: 2,
    title: 'I Never Met the Dead Man',
    air_date: 'Apr 11, 1999',
    summary:
      'Peter knocks out the city cable TV transmitter while teaching Meg to drive, then suffers extreme television withdrawal.',
    youtube_url: null,
    reviews: [{ id: 'rev-2' }],
  },
  {
    id: 's01e03-chitty-chitty-death-bang',
    season: 1,
    episode_number: 3,
    title: 'Chitty Chitty Death Bang',
    air_date: 'Apr 18, 1999',
    summary:
      "Meg gets invited to a party that turns out to be a cult suicide pact while Peter tries to salvage Stewie's first birthday.",
    youtube_url: null,
    reviews: [{ id: 'rev-3' }],
  },
];

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

  try {
    if (!supabase) {
      console.warn('Supabase credentials missing, falling back to local episode list.');
      renderEpisodeList(DEFAULT_FALLBACK_EPISODES, latestEpisodeContainer, episodesList);
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
      console.warn('Error fetching dynamic episodes from Supabase, using local fallback:', error);
      renderEpisodeList(DEFAULT_FALLBACK_EPISODES, latestEpisodeContainer, episodesList);
      return;
    }

    if (!episodes || episodes.length === 0) {
      console.log('No published episodes found in Supabase, using local fallback.');
      renderEpisodeList(DEFAULT_FALLBACK_EPISODES, latestEpisodeContainer, episodesList);
      return;
    }

    renderEpisodeList(episodes, latestEpisodeContainer, episodesList);
  } catch (err) {
    console.warn('Error rendering dynamic episodes, using local fallback:', err);
    renderEpisodeList(DEFAULT_FALLBACK_EPISODES, latestEpisodeContainer, episodesList);
  }
}

// Bootstrap dynamic features on load
loadDynamicEpisodes();
