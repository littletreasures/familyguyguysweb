const TOTAL_EPISODES = 461;

function escapeHTML(str) {
  if (typeof str !== 'string') return str;
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

async function loadEpisodes() {
  const res = await fetch('content/episodes.json');
  const episodes = await res.json();
  return episodes.sort((a, b) => b.episode_number - a.episode_number);
}

function episodeCard(ep) {
  const remaining = TOTAL_EPISODES - ep.episode_number;
  const dateStr = new Date(ep.date).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });

  const safeTitle = escapeHTML(ep.title);
  const safeDesc = escapeHTML(ep.description);
  const safeLink = escapeHTML(ep.youtube_link);
  const safeThumb = escapeHTML(ep.thumbnail);

  return `
    <article class="episode-card">
      <a href="${safeLink}" target="_blank" rel="noopener" class="episode-thumb">
        <img src="${safeThumb}" alt="${safeTitle} thumbnail" loading="lazy" />
        <span class="episode-countdown">${remaining} left</span>
      </a>
      <div class="episode-body">
        <div class="episode-number">Episode #${String(ep.episode_number).padStart(3, '0')} of ${TOTAL_EPISODES}</div>
        <h3 class="episode-title">"${safeTitle}"</h3>
        <div class="episode-date">${dateStr}</div>
        <p class="episode-desc">${safeDesc}</p>
        <a class="episode-link" href="${safeLink}" target="_blank" rel="noopener">Watch the chaos &rarr;</a>
      </div>
    </article>
  `;
}

async function renderHomeEpisodes() {
  const grid = document.getElementById('episodes-grid');
  if (!grid) return;
  const episodes = await loadEpisodes();
  const recent = episodes.slice(0, 3);
  grid.innerHTML = recent.map(episodeCard).join('');
}

async function renderAllEpisodes() {
  const grid = document.getElementById('all-episodes-grid');
  if (!grid) return;
  const episodes = await loadEpisodes();
  grid.innerHTML = episodes.map(episodeCard).join('');
}

document.addEventListener('DOMContentLoaded', () => {
  renderHomeEpisodes();
  renderAllEpisodes();
});
