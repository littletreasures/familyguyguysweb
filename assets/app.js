const TOTAL_EPISODES = 461;

async function loadEpisodes() {
  const res = await fetch('content/episodes.json');
  const episodes = await res.json();
  return episodes.sort((a, b) => b.episode_number - a.episode_number);
}

function episodeCard(ep) {
  const remaining = TOTAL_EPISODES - ep.episode_number;
  const dateStr = new Date(ep.date).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
  return `
    <article class="episode-card">
      <a href="${ep.youtube_link}" target="_blank" rel="noopener" class="episode-thumb">
        <img src="${ep.thumbnail}" alt="${ep.title} thumbnail" loading="lazy" />
        <span class="episode-countdown">${remaining} left</span>
      </a>
      <div class="episode-body">
        <div class="episode-number">Episode #${String(ep.episode_number).padStart(3, '0')} of ${TOTAL_EPISODES}</div>
        <h3 class="episode-title">"${ep.title}"</h3>
        <div class="episode-date">${dateStr}</div>
        <p class="episode-desc">${ep.description}</p>
        <a class="episode-link" href="${ep.youtube_link}" target="_blank" rel="noopener">Watch the chaos &rarr;</a>
      </div>
    </article>
  `;
}

async function renderEpisodes(gridId, limit = null) {
  const grid = document.getElementById(gridId);
  if (!grid) return;
  let episodes = await loadEpisodes();
  if (limit) {
    episodes = episodes.slice(0, limit);
  }
  grid.innerHTML = episodes.map(episodeCard).join('');
}

async function renderHomeEpisodes() {
  await renderEpisodes('episodes-grid', 3);
}

async function renderAllEpisodes() {
  await renderEpisodes('all-episodes-grid');
}

document.addEventListener('DOMContentLoaded', () => {
  renderHomeEpisodes();
  renderAllEpisodes();
});
