/**
 * render-transcript-component.js
 * Native Node ESM React component rendered to static HTML via react-dom/server.
 * Uses React.createElement for zero-loader native execution.
 */
import React from 'react';
import { formatSeconds } from './format-time.js';
import { resolveEpisodeImage } from './build-page-metadata.js';
import { validateAudioUrlShape } from './validate-audio.js';
import { deriveRssEmbed } from './rss-embed.js';

const e = React.createElement;

const COHOST_NAME_MAP = {
  '01201e1a-dafd-424a-b596-ff9ece65f1aa': {
    name: 'Jason Hackett',
    role: 'Host',
    photo: '/hosts/jasonhost.webp',
    themeClass: 'host-bg-jason',
    fallbackBg: '#aa6200',
  },
  'e08c8c4b-ecf5-427e-8890-fe9cef0a2c9a': {
    name: 'Tyler Simpson',
    role: 'Host',
    photo: '/hosts/tylerhost.webp',
    themeClass: 'host-bg-tyler',
    fallbackBg: '#5c1a1a',
  },
  '0a3dfd13-90b2-47db-b0af-2e0c0df21cff': {
    name: 'Collin Brown',
    role: 'Host',
    photo: '/hosts/collinhost.webp',
    themeClass: 'host-bg-collin',
    fallbackBg: '#1a6b6b',
  },
  'mock-cohost-jason': {
    name: 'Jason Hackett',
    role: 'Host',
    photo: '/hosts/jasonhost.webp',
    themeClass: 'host-bg-jason',
    fallbackBg: '#aa6200',
  },
  'mock-cohost-tyler': {
    name: 'Tyler Simpson',
    role: 'Host',
    photo: '/hosts/tylerhost.webp',
    themeClass: 'host-bg-tyler',
    fallbackBg: '#5c1a1a',
  },
  'mock-cohost-collin': {
    name: 'Collin Brown',
    role: 'Host',
    photo: '/hosts/collinhost.webp',
    themeClass: 'host-bg-collin',
    fallbackBg: '#1a6b6b',
  },
  jason: {
    name: 'Jason Hackett',
    role: 'Host',
    photo: '/hosts/jasonhost.webp',
    themeClass: 'host-bg-jason',
    fallbackBg: '#aa6200',
  },
  tyler: {
    name: 'Tyler Simpson',
    role: 'Host',
    photo: '/hosts/tylerhost.webp',
    themeClass: 'host-bg-tyler',
    fallbackBg: '#5c1a1a',
  },
  collin: {
    name: 'Collin Brown',
    role: 'Host',
    photo: '/hosts/collinhost.webp',
    themeClass: 'host-bg-collin',
    fallbackBg: '#1a6b6b',
  },
};

function renderStarSvg(isFilled, key) {
  return e(
    'svg',
    {
      key,
      width: '14',
      height: '14',
      viewBox: '0 0 24 24',
      fill: isFilled ? '#ffffff' : 'transparent',
      stroke: 'currentColor',
      strokeWidth: '2.5',
      strokeLinecap: 'round',
      strokeLinejoin: 'round',
      className: 'star-icon',
      'aria-hidden': 'true',
    },
    e('polygon', {
      points:
        '12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2',
    })
  );
}

export function RenderEpisodeReviewPage({ episode, transcript, cohosts }) {
  const epNumber = episode.episode_number ?? episode.episodeNumber ?? 1;
  const epSeason = episode.season ?? 1;
  const airDate = episode.air_date ?? episode.airDate ?? 'Original Air Date Unknown';
  const runtime = episode.runtime ?? '22 min';
  const imdbRating = episode.imdb_rating ?? episode.imdbRating ?? 'N/A';
  const rawPodcastUrl = episode.podcast_url ?? episode.podcastUrl;
  const { imageUrl: thumbnailUrl } = resolveEpisodeImage(episode);
  const hasTranscript = Boolean(
    transcript && transcript.sections && transcript.sections.length > 0
  );

  // Safe audio URL validation: only render audio link if valid HTTPS shape and not forbidden host
  const isAudioValid = rawPodcastUrl && validateAudioUrlShape(rawPodcastUrl).valid;
  const safePodcastUrl = isAudioValid ? rawPodcastUrl : null;
  const rssEmbed = safePodcastUrl ? deriveRssEmbed(safePodcastUrl) : null;

  // Cohost review alignment
  const hostList =
    cohosts && cohosts.length > 0
      ? cohosts
      : [
          { id: '01201e1a-dafd-424a-b596-ff9ece65f1aa', name: 'Jason Hackett', role: 'Host' },
          { id: 'e08c8c4b-ecf5-427e-8890-fe9cef0a2c9a', name: 'Tyler Simpson', role: 'Host' },
          { id: '0a3dfd13-90b2-47db-b0af-2e0c0df21cff', name: 'Collin Brown', role: 'Host' },
        ];

  const episodeReviews = episode.reviews || [];

  return e(
    'article',
    { className: 'episode-detail-container', id: 'prerendered-episode-content' },

    // Breadcrumb Navigation
    e(
      'nav',
      { 'aria-label': 'Breadcrumb', className: 'detail-breadcrumb' },
      e(
        'ol',
        { className: 'breadcrumb-list' },
        e('li', null, e('a', { href: '/' }, 'Home')),
        e('li', { 'aria-hidden': 'true', className: 'breadcrumb-separator' }, '/'),
        e('li', null, e('a', { href: '/reviews' }, 'Reviews')),
        e('li', { 'aria-hidden': 'true', className: 'breadcrumb-separator' }, '/'),
        e('li', { 'aria-current': 'page' }, `Season ${epSeason}, Episode ${epNumber}`)
      )
    ),

    // Back button
    e(
      'div',
      { className: 'back-link-wrapper' },
      e('a', { href: '/reviews', className: 'back-link' }, '← Back to Episode Catalog')
    ),

    // Episode Header Card
    e(
      'header',
      { className: 'episode-hero-card' },
      e(
        'div',
        { className: 'episode-hero-content' },
        e(
          'div',
          { className: 'episode-badges' },
          e('span', { className: 'badge-season' }, `Season ${epSeason}, Episode ${epNumber}`),
          e('span', { className: 'badge-runtime' }, runtime),
          e('span', { className: 'badge-rating' }, `★ IMDb ${imdbRating}`)
        ),
        e('h1', { className: 'episode-main-title' }, episode.title),
        e('p', { className: 'episode-air-date' }, `Original Air Date: ${airDate}`),
        episode.summary ? e('p', { className: 'episode-synopsis' }, episode.summary) : null,
        safePodcastUrl
          ? e(
              'div',
              { className: 'episode-audio-action' },
              rssEmbed
                ? e(
                    'div',
                    { className: 'rss-embed-wrapper' },
                    e(
                      'iframe',
                      {
                        src: rssEmbed.embedUrl,
                        title: `Family Guy Guys podcast player: ${episode.title}`,
                        width: '100%',
                        height: '202',
                        frameBorder: '0',
                        allow:
                          'accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture',
                        allowFullScreen: true,
                        scrolling: 'no',
                        loading: 'lazy',
                      },
                      e('a', { href: rssEmbed.pageUrl }, `${episode.title} | RSS.com`)
                    ),
                    e(
                      'a',
                      {
                        href: rssEmbed.pageUrl,
                        target: '_blank',
                        rel: 'noopener noreferrer',
                        className: 'rss-embed-external-link',
                      },
                      'Open on RSS.com ↗'
                    )
                  )
                : e(
                    'a',
                    {
                      href: safePodcastUrl,
                      target: '_blank',
                      rel: 'noopener noreferrer',
                      className: 'listen-podcast-btn',
                    },
                    '▶ Listen to Full Episode Audio'
                  )
            )
          : null
      ),
      e(
        'div',
        { className: 'episode-hero-media' },
        e('img', {
          src: thumbnailUrl,
          alt: `${episode.title} Episode Thumbnail`,
          className: 'episode-thumbnail',
          loading: 'eager',
          width: '480',
          height: '270',
        })
      )
    ),

    // Host Ratings & Reviews Section
    e(
      'section',
      { className: 'host-ratings-section', 'aria-label': 'Host Ratings and Reviews' },
      e(
        'div',
        { className: 'host-ratings-banner' },
        e('h2', { className: 'host-ratings-title' }, 'Host Ratings for This Episode')
      ),
      e(
        'div',
        { className: 'host-reviews-list' },
        hostList.map((host) => {
          const hostId = host.id ? host.id.toLowerCase() : '';
          const mapped = COHOST_NAME_MAP[hostId] ||
            COHOST_NAME_MAP[host.name?.toLowerCase()] || {
              name: host.name,
              role: host.role || 'Host',
              photo: null,
              themeClass: 'host-bg-jason',
              fallbackBg: '#aa6200',
            };

          const name = mapped.name || host.name;
          const photoUrl = mapped.photo;
          const themeClass = mapped.themeClass;
          const fallbackBg = mapped.fallbackBg;

          const rev = episodeReviews.find((r) => {
            const rId = (r.cohost_id || r.cohostId || '').toLowerCase();
            return rId === hostId || rId === (host.name || '').toLowerCase();
          });

          const scaleMax = rev?.rating_scale_max || rev?.ratingScaleMax || 5;
          const terminology = rev?.rating_terminology || rev?.ratingTerminology || 'Quahogs';
          const rawRating = rev?.rating;
          const ratingVal =
            rawRating !== null && rawRating !== undefined
              ? (Number(rawRating) / 5) * scaleMax
              : null;
          const pullQuote = rev?.pull_quote || rev?.pullQuote;
          const reviewText = rev?.review || 'No review yet.';

          const initials = name
            .split(/\s+/)
            .map((part) => part[0])
            .join('')
            .slice(0, 2)
            .toUpperCase();
          const firstName = name.split(' ')[0].toUpperCase();

          return e(
            'div',
            { key: host.id || name, className: 'host-review-card' },
            // Host Avatar / Photo
            e(
              'div',
              { className: 'host-avatar-col' },
              photoUrl
                ? e('img', {
                    src: photoUrl,
                    alt: name,
                    className: 'host-avatar-img',
                    width: '80',
                    height: '80',
                    loading: 'lazy',
                  })
                : e(
                    'div',
                    {
                      className: 'host-avatar-fallback',
                      style: { backgroundColor: fallbackBg },
                    },
                    e('span', { className: 'host-avatar-initials' }, initials),
                    e('div', { className: 'host-avatar-name-bar' }, firstName)
                  )
            ),
            // Host Review Content
            e(
              'div',
              { className: 'host-review-body' },
              e(
                'div',
                { className: `host-metric-header ${themeClass}` },
                e('span', { className: 'host-metric-label' }, `${firstName}'S METRIC`),
                e(
                  'div',
                  { className: 'host-metric-score' },
                  ratingVal === null
                    ? e('span', { className: 'score-unrated' }, 'Not Rated')
                    : scaleMax === 100
                      ? e(
                          'div',
                          { className: 'score-bar-wrapper' },
                          e(
                            'div',
                            { className: 'score-bar-track' },
                            e('div', {
                              className: 'score-bar-fill',
                              style: { width: `${Math.min(100, Math.max(0, ratingVal))}%` },
                            })
                          ),
                          e(
                            'span',
                            { className: 'score-pill' },
                            `${ratingVal.toFixed(0)}/100 ${terminology}`
                          )
                        )
                      : e(
                          'div',
                          { className: 'score-stars-wrapper' },
                          [1, 2, 3, 4, 5].map((s) => renderStarSvg(s <= Math.round(ratingVal), s)),
                          e(
                            'span',
                            { className: 'score-pill' },
                            `${ratingVal.toFixed(1)}/5 ${terminology}`
                          )
                        )
                )
              ),
              pullQuote ? e('p', { className: 'host-pull-quote' }, `"${pullQuote}"`) : null,
              e('p', { className: 'host-review-text' }, reviewText)
            )
          );
        })
      )
    ),

    // Intro Note / Editorial Review Context
    transcript?.intro
      ? e(
          'section',
          { className: 'episode-editorial-intro', 'aria-label': 'Episode Review Overview' },
          e('h2', { className: 'intro-heading' }, 'Review Overview & Notes'),
          e('p', { className: 'intro-text' }, transcript.intro)
        )
      : null,

    // Visitor / Community Reviews Section (Progressive Enhancement Island Mount)
    e(
      'section',
      { className: 'visitor-reviews-static-section', 'aria-label': 'Community Reviews' },
      e(
        'div',
        {
          id: 'visitor-reviews-root',
          'data-episode-id': episode.id,
        },
        e(
          'noscript',
          null,
          e(
            'div',
            { className: 'visitor-reviews-nojs' },
            e('h3', null, 'Community Reviews & Ratings'),
            e(
              'p',
              null,
              'Visitor reviews require JavaScript to load and submit. Please enable JavaScript in your browser to view community ratings or leave your own review!'
            )
          )
        )
      )
    ),

    // Spoken Transcript Section (Collapsible Native Details)
    e(
      'section',
      { className: 'episode-transcript-container', 'aria-label': 'Episode Transcript' },
      hasTranscript && transcript?.sections
        ? e(
            'details',
            {
              className: 'episode-transcript-wrapper transcript-collapse',
              id: 'transcript-details',
            },
            e(
              'summary',
              { className: 'transcript-header-bar transcript-summary' },
              e('h2', { className: 'transcript-section-title' }, 'Full Spoken Podcast Transcript'),
              e(
                'div',
                { className: 'transcript-summary-meta' },
                e(
                  'span',
                  { className: 'transcript-wordcount' },
                  transcript.word_count
                    ? `${transcript.word_count.toLocaleString()} words`
                    : 'Full Length'
                ),
                e(
                  'span',
                  { className: 'transcript-expand-badge' },
                  e('span', { className: 'transcript-expand-text' }, 'Read Transcript'),
                  e('span', { className: 'transcript-expand-icon', 'aria-hidden': 'true' }, '▾')
                )
              )
            ),
            e(
              'div',
              { className: 'transcript-body', id: 'prerendered-transcript' },
              e(
                'div',
                { className: 'transcript-layout-grid' },
                // Column 1: Table of Contents (sticky on desktop >=1100px, collapsed details on mobile <1100px)
                transcript.sections.length > 1
                  ? e(
                      'aside',
                      { className: 'transcript-toc', 'aria-label': 'Transcript Topics' },
                      e(
                        'details',
                        { className: 'toc-mobile-details', open: true },
                        e(
                          'summary',
                          { className: 'toc-summary' },
                          e('span', { className: 'toc-title' }, 'Episode Topics'),
                          e(
                            'span',
                            { className: 'toc-badge' },
                            `${transcript.sections.length} topics`
                          ),
                          e('span', { className: 'toc-chevron', 'aria-hidden': 'true' }, '▾')
                        ),
                        e(
                          'ul',
                          { className: 'toc-list' },
                          transcript.sections.map((sec) =>
                            e(
                              'li',
                              { key: sec.id },
                              e(
                                'a',
                                { href: `#${sec.id}`, className: 'toc-link' },
                                e(
                                  'span',
                                  { className: 'toc-time' },
                                  formatSeconds(sec.start_seconds)
                                ),
                                e('span', { className: 'toc-heading' }, sec.heading)
                              )
                            )
                          )
                        )
                      )
                    )
                  : null,

                // Column 2: Transcript Sections
                e(
                  'div',
                  { className: 'transcript-sections-list' },
                  transcript.sections.map((section) =>
                    e(
                      'section',
                      {
                        key: section.id,
                        id: section.id,
                        className: 'transcript-section-block',
                        'aria-labelledby': `heading-${section.id}`,
                      },
                      e(
                        'div',
                        { className: 'section-meta-header' },
                        e(
                          'h3',
                          { id: `heading-${section.id}`, className: 'section-title' },
                          section.heading
                        ),
                        e(
                          'span',
                          { className: 'section-time-range' },
                          `${formatSeconds(section.start_seconds)} – ${formatSeconds(section.end_seconds)}`
                        )
                      ),
                      e(
                        'div',
                        { className: 'section-entries' },
                        section.entries.map((entry, idx) => {
                          const speakerSlug = entry.speaker.toLowerCase().replace(/[^a-z0-9]/g, '');
                          return e(
                            'div',
                            {
                              key: `${section.id}-e${idx}`,
                              className: `dialogue-entry speaker-${speakerSlug}`,
                            },
                            e(
                              'div',
                              { className: 'entry-header' },
                              e('span', { className: 'speaker-label' }, entry.speaker),
                              e(
                                'span',
                                { className: 'timestamp-label' },
                                formatSeconds(entry.start_seconds)
                              )
                            ),
                            e('div', { className: 'dialogue-content' }, e('p', null, entry.text))
                          );
                        })
                      )
                    )
                  )
                )
              )
            )
          )
        : e(
            'div',
            { className: 'episode-transcript-wrapper' },
            e(
              'div',
              { className: 'transcript-header-bar' },
              e('h2', { className: 'transcript-section-title' }, 'Full Spoken Podcast Transcript')
            ),
            e(
              'div',
              { className: 'no-transcript-fallback' },
              e(
                'p',
                { className: 'no-transcript-msg' },
                'The full transcribed conversation for this episode is currently being curated.'
              ),
              e(
                'p',
                { className: 'no-transcript-sub' },
                'Listen to the complete audio discussion above, or explore other reviewed episodes.'
              )
            )
          )
    )
  );
}
