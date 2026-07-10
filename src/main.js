// Main entry point for familyguyguys.com SPA
import './styles/main.css';
import { initRouter } from './router.js';

// Setup mobile nav toggling
const mobileNav = document.getElementById('mobileNav');
const hamburger = document.querySelector('.hamburger');

window.toggleMobile = function toggleMobile() {
  if (mobileNav) {
    mobileNav.classList.toggle('open');
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
  }
});

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
      newsletterStatus.textContent = 'Welcome to the club, hog! Check your inbox to confirm.';
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

async function loadDynamicEpisodes() {
  const latestEpisodeCard = document.querySelector('.episode-card-featured');
  const episodesList = document.getElementById('episodesList');

  if (!latestEpisodeCard && !episodesList) return;

  try {
    const { data: episodes, error } = await supabase
      .from('episodes')
      .select('id, season, episode_number, title, air_date, summary, podcast_url, watch_status')
      .eq('watch_status', 'published')
      .order('season', { ascending: false })
      .order('episode_number', { ascending: false });

    if (error || !episodes || episodes.length === 0) {
      console.log('No published episodes found in Supabase or query error, using static fallback.');
      return;
    }

    // Populate Latest Episode Card (Home Page)
    if (latestEpisodeCard) {
      const latest = episodes[0];
      const thumbUrl = `/assets/ep${latest.episode_number.toString().padStart(3, '0')}-thumb-360w.webp`;
      
      latestEpisodeCard.innerHTML = `
        <div class="episode-thumb-featured">
          <picture>
            <source srcset="/assets/ep${latest.episode_number.toString().padStart(3, '0')}-thumb-180w.avif 180w, /assets/ep${latest.episode_number.toString().padStart(3, '0')}-thumb-360w.avif 360w" type="image/avif" sizes="160px">
            <source srcset="/assets/ep${latest.episode_number.toString().padStart(3, '0')}-thumb-180w.webp 180w, /assets/ep${latest.episode_number.toString().padStart(3, '0')}-thumb-360w.webp 360w" type="image/webp" sizes="160px">
            <img src="${thumbUrl}" alt="${latest.title} thumbnail" width="160" height="90" loading="lazy" onerror="this.src='/hero-480w.webp'; this.onerror=null;">
          </picture>
        </div>
        <div class="episode-meta">
          <div class="episode-number">Episode #${latest.episode_number.toString().padStart(3, '0')}</div>
          <div class="episode-title">${latest.title}</div>
          <div class="episode-desc">${latest.summary || ''}</div>
        </div>
      `;
    }

    // Populate Episodes Archive Feed (Episodes Page)
    if (episodesList) {
      episodesList.innerHTML = episodes.map(ep => {
        const thumbUrl = `/assets/ep${ep.episode_number.toString().padStart(3, '0')}-thumb-360w.webp`;
        return `
          <a href="/reviews/${encodeURIComponent(ep.id)}" class="ep-row" style="display:grid; text-decoration:none; color:inherit;">
            <picture>
              <source srcset="/assets/ep${ep.episode_number.toString().padStart(3, '0')}-thumb-180w.avif 180w, /assets/ep${ep.episode_number.toString().padStart(3, '0')}-thumb-360w.avif 360w" type="image/avif" sizes="180px">
              <source srcset="/assets/ep${ep.episode_number.toString().padStart(3, '0')}-thumb-180w.webp 180w, /assets/ep${ep.episode_number.toString().padStart(3, '0')}-thumb-360w.webp 360w" type="image/webp" sizes="180px">
              <img src="${thumbUrl}" alt="${ep.title}" class="ep-thumb" width="180" height="101" loading="lazy" onerror="this.src='/hero-480w.webp'; this.onerror=null;">
            </picture>
            <div class="ep-info">
              <div class="ep-num">Episode #${ep.episode_number.toString().padStart(3, '0')}</div>
              <div class="ep-title">${ep.title}</div>
              <div class="ep-desc">${ep.summary || ''}</div>
            </div>
          </a>
        `;
      }).join('');
    }
  } catch (err) {
    console.error('Error rendering dynamic episodes:', err);
  }
}

// Bootstrap dynamic features on load
loadDynamicEpisodes();
