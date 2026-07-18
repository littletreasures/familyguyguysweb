// Main entry point for familyguyguys.com SPA
import './styles/main.css';
import { initRouter } from './router.js';

// Setup mobile nav toggling
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
  hamburger.addEventListener('click', toggleMobile);
}

// Close mobile nav on outside click
document.addEventListener('click', function(e) {
  if (!mobileNav) return;
  const isNavClick = e.target.closest('nav') || e.target.closest('#mobileNav');
  if (!isNavClick) {
    mobileNav.classList.remove('open');
    if (hamburger) {
      hamburger.setAttribute('aria-expanded', 'false');
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

// Lazy load the React review app when visiting /reviews
let reviewAppLoaded = false;
window.addEventListener('routechange', async (e) => {
  const { page, params } = e.detail;
  if (page === 'reviews' && !reviewAppLoaded) {
    reviewAppLoaded = true;
    const reviewAppContainer = document.getElementById('review-app');
    if (reviewAppContainer) {
      reviewAppContainer.innerHTML = '<div class="p-8 text-center text-slate-800">Loading Reviews Platform...</div>';
      try {
        // Dynamically import the React review application entry point
        const { mountReviews } = await import('./reviews/mount.jsx');
        mountReviews(reviewAppContainer);
      } catch (err) {
        console.error('Failed to load reviews app:', err);
        reviewAppContainer.innerHTML = '<div class="p-8 text-center text-red-600">Failed to load reviews platform. Please try again.</div>';
      }
    }
  }
});

// Setup active link highlight and route handling - MUST run after registering event listeners
initRouter();

// Initialize the persistent audio player
import { initAudioPlayer } from './audio-player.js';
initAudioPlayer();

// Spreadshirt Shop Integration (Spreadshop ID: 401265528)
if (document.getElementById('merchShopContainer')) {
  window.spread_shop_config = {
    shopName: '401265528',
    locale: 'us_US',
    prefix: 'https://familyguyguys.com/merch',
    baseId: 'merchShopContainer'
  };

  const script = document.createElement('script');
  script.type = 'text/javascript';
  script.src = 'https://shop.spreadshirt.com/shopfiles/shopclient.nocache.js';
  script.async = true;
  script.onerror = () => {
    console.warn('Failed to load Spreadshirt shop widget.');
  };
  document.body.appendChild(script);
}

// Newsletter Signup Integration
const newsletterForm = document.getElementById('newsletter-form');
const newsletterEmail = document.getElementById('newsletter-email');
const newsletterStatus = document.getElementById('newsletter-status');

if (newsletterForm) {
  newsletterForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    
    newsletterStatus.style.display = 'block';
    newsletterStatus.style.color = 'var(--black)';
    newsletterStatus.textContent = 'Subscribing...';

    try {
      // Simulate API delay
      await new Promise(resolve => setTimeout(resolve, 800));
      
      newsletterStatus.style.color = 'var(--teal)';
      newsletterStatus.textContent = 'Thanks for your interest! Newsletter signup is coming soon.';
      newsletterEmail.value = '';
      
      localStorage.setItem('faguugu-newsletter-subscribed', 'true');
    } catch (err) {
      newsletterStatus.style.color = 'var(--maroon)';
      newsletterStatus.textContent = 'Something went wrong. Let us know at feedback@familyguyguys.com!';
    }
  });
}

// Dynamic Episode Loader from Supabase
import { supabase } from './reviews/lib/supabase.ts';

// Helper to escape HTML characters to prevent DOM-based XSS
function escapeHTML(str) {
  if (!str) return '';
  return str.replace(/[&<>'"]/g, 
    tag => ({
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      "'": '&#39;',
      '"': '&quot;'
    }[tag] || tag)
  );
}

function createEpisodeMarkup(ep, isFeatured = false) {
  const hasYoutube = !!ep.youtube_url;
  const hasReviews = !!(ep.reviews && ep.reviews.length > 0);
  const isBoth = hasYoutube && hasReviews;

  const tag = isBoth ? 'div' : 'a';
  const classNames = isFeatured ? 'episode-card-featured' : (isBoth ? 'ep-row' : 'ep-row ep-row-clickable');
  
  let linkAttrs = '';
  if (!isBoth) {
    if (hasYoutube) {
      linkAttrs = `href="${escapeHTML(ep.youtube_url)}" target="_blank" rel="noopener"`;
    } else {
      linkAttrs = `href="/reviews/${encodeURIComponent(ep.id)}"`;
    }
  }

  const epNumStr = ep.episode_number.toString().padStart(3, '0');
  const thumbPrefix = `/assets/ep${epNumStr}-thumb`;
  const thumbUrl = `${thumbPrefix}-360w.webp`;

  const thumbContainerClass = isFeatured ? 'episode-thumb-featured' : '';
  const thumbImgClass = isFeatured ? '' : 'ep-thumb';
  const metaContainerClass = isFeatured ? 'episode-meta' : 'ep-info';
  const numClass = isFeatured ? 'episode-number' : 'ep-num';
  const titleClass = 'ep-title';
  const descClass = 'ep-desc';

  // Build CTA buttons if both exist
  const ctasHtml = isBoth ? `
    <div class="ep-actions">
      <a href="${escapeHTML(ep.youtube_url)}" target="_blank" rel="noopener" class="ep-action-btn watch">Watch Video</a>
      <a href="/reviews/${encodeURIComponent(ep.id)}" class="ep-action-btn review">Read Review</a>
    </div>
  ` : '';

  const innerContent = `
    <div class="${thumbContainerClass}">
      <picture>
        <source srcset="${thumbPrefix}-180w.avif 180w, ${thumbPrefix}-360w.avif 360w" type="image/avif" sizes="${isFeatured ? '160px' : '180px'}">
        <source srcset="${thumbPrefix}-180w.webp 180w, ${thumbPrefix}-360w.webp 360w" type="image/webp" sizes="${isFeatured ? '160px' : '180px'}">
        <img src="${thumbUrl}" alt="Episode ${epNumStr} thumbnail" class="${thumbImgClass}" width="${isFeatured ? '160' : '180'}" height="${isFeatured ? '90' : '101'}" loading="lazy" onerror="this.onerror=null; this.src='/tv-watching-480w.webp'; this.alt='Family Guy Guys default thumbnail';">
      </picture>
    </div>
    <div class="${metaContainerClass}">
      <div class="${numClass}">Episode #${epNumStr}</div>
      <div class="${titleClass}">${escapeHTML(ep.title)}</div>
      <div class="${descClass}">${escapeHTML(ep.summary || '')}</div>
      ${ctasHtml}
    </div>
  `;

  return `<${tag} ${linkAttrs} class="${classNames}" ${isBoth ? 'style="cursor: default;"' : ''}>${innerContent}</${tag}>`;
}

function renderErrorState(container, message, isFeatured = false) {
  if (!container) return;
  const padding = isFeatured ? '1.5rem' : '3rem';
  container.innerHTML = `
    <div class="episode-error-state" style="padding: ${padding}; text-align: center; border: 2px dashed var(--maroon); border-radius: 8px; color: var(--maroon); font-family: 'Special Elite', monospace;">
      <div style="font-size: 1.5rem; margin-bottom: 0.5rem;">⚠️</div>
      <div style="font-weight: bold; text-transform: uppercase; font-size: 0.9rem;">Database Connection Failed</div>
      <p style="margin-top: 0.5rem; font-size: 0.8rem; color: #666; font-family: sans-serif; line-height: 1.4;">${escapeHTML(message)}</p>
    </div>
  `;
}

function renderEmptyState(container, isFeatured = false) {
  if (!container) return;
  const padding = isFeatured ? '1.5rem' : '3rem';
  container.innerHTML = `
    <div class="episode-empty-state" style="padding: ${padding}; text-align: center; border: 2px dashed var(--orange); border-radius: 8px; color: var(--orange-dark); font-family: 'Special Elite', monospace;">
      <div style="font-size: 1.5rem; margin-bottom: 0.5rem;">📭</div>
      <div style="font-weight: bold; text-transform: uppercase; font-size: 0.9rem;">No Published Episodes</div>
      <p style="margin-top: 0.5rem; font-size: 0.8rem; color: #666; font-family: sans-serif; line-height: 1.4;">Check back later for new episodes of Family Guy Guys!</p>
    </div>
  `;
}

async function loadDynamicEpisodes() {
  const latestEpisodeContainer = document.getElementById('latest-episode-container');
  const episodesList = document.getElementById('episodesList');

  if (!latestEpisodeContainer && !episodesList) return;

  try {
    if (!supabase) {
      const msg = 'Supabase credentials missing, skipping dynamic load.';
      console.log(msg);
      if (latestEpisodeContainer) renderErrorState(latestEpisodeContainer, msg, true);
      if (episodesList) renderErrorState(episodesList, msg, false);
      return;
    }

    const { data: episodes, error } = await supabase
      .from('episodes')
      .select('id, season, episode_number, title, air_date, summary, podcast_url, watch_status, youtube_url, reviews(id)')
      .eq('watch_status', 'published')
      .order('season', { ascending: false })
      .order('episode_number', { ascending: false });

    if (error) {
      console.error('Error fetching dynamic episodes:', error);
      if (latestEpisodeContainer) renderErrorState(latestEpisodeContainer, error.message, true);
      if (episodesList) renderErrorState(episodesList, error.message, false);
      return;
    }

    if (!episodes || episodes.length === 0) {
      console.log('No published episodes found in Supabase.');
      if (latestEpisodeContainer) renderEmptyState(latestEpisodeContainer, true);
      if (episodesList) renderEmptyState(episodesList, false);
      return;
    }

    // Populate Latest Episode Card (Home Page)
    if (latestEpisodeContainer) {
      // episodes are ordered descending, so episodes[0] is the latest
      latestEpisodeContainer.innerHTML = createEpisodeMarkup(episodes[0], true);
    }

    // Populate Episodes Archive Feed (Episodes Page)
    if (episodesList) {
      episodesList.innerHTML = episodes.map(ep => createEpisodeMarkup(ep, false)).join('');
    }
  } catch (err) {
    console.error('Error rendering dynamic episodes:', err);
    const msg = err.message || 'An unexpected error occurred.';
    if (latestEpisodeContainer) renderErrorState(latestEpisodeContainer, msg, true);
    if (episodesList) renderErrorState(episodesList, msg, false);
  }
}

// Bootstrap dynamic features on load
loadDynamicEpisodes();
