/**
 * render-transcript-component.js
 * Native Node ESM React component rendered to static HTML via react-dom/server.
 * Uses React.createElement for zero-loader native execution.
 */
import React from 'react';
import { formatSeconds } from './format-time.js';
import { resolveEpisodeImage } from './build-page-metadata.js';

const e = React.createElement;

export function RenderEpisodeReviewPage({ episode, transcript }) {
  const epNumber = episode.episode_number ?? episode.episodeNumber ?? 1;
  const epSeason = episode.season ?? 1;
  const airDate = episode.air_date ?? episode.airDate ?? 'Original Air Date Unknown';
  const runtime = episode.runtime ?? '22 min';
  const imdbRating = episode.imdb_rating ?? episode.imdbRating ?? 'N/A';
  const podcastUrl = episode.podcast_url ?? episode.podcastUrl;
  const { imageUrl: thumbnailUrl } = resolveEpisodeImage(episode);
  const hasTranscript = Boolean(
    transcript && transcript.sections && transcript.sections.length > 0
  );

  return e(
    'article',
    { className: 'episode-detail-container', id: 'prerendered-episode-content' },

    // Breadcrumb Navigation
    e(
      'nav',
      { 'aria-label': 'Breadcrumb', className: 'detail-breadcrumb' },
      e(
        'ol',
        null,
        e('li', null, e('a', { href: '/' }, 'Home')),
        e('li', { 'aria-hidden': 'true' }, '/'),
        e('li', null, e('a', { href: '/reviews' }, 'Reviews')),
        e('li', { 'aria-hidden': 'true' }, '/'),
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
        podcastUrl
          ? e(
              'div',
              { className: 'episode-audio-action' },
              e(
                'a',
                {
                  href: podcastUrl,
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

    // Intro Note / Editorial Review Context
    transcript?.intro
      ? e(
          'section',
          { className: 'episode-editorial-intro', 'aria-label': 'Episode Review Overview' },
          e('h2', { className: 'intro-heading' }, 'Review Overview & Notes'),
          e('p', { className: 'intro-text' }, transcript.intro)
        )
      : null,

    // Spoken Transcript Section
    e(
      'section',
      { className: 'episode-transcript-wrapper', 'aria-label': 'Episode Transcript' },
      e(
        'div',
        { className: 'transcript-header-bar' },
        e('h2', { className: 'transcript-section-title' }, 'Full Spoken Podcast Transcript'),
        hasTranscript
          ? e(
              'span',
              { className: 'transcript-wordcount' },
              transcript?.word_count
                ? `${transcript.word_count.toLocaleString()} words`
                : 'Full Length'
            )
          : null
      ),

      hasTranscript && transcript?.sections
        ? e(
            'div',
            { className: 'transcript-body', id: 'prerendered-transcript' },

            // Table of Contents
            transcript.sections.length > 1
              ? e(
                  'nav',
                  { className: 'transcript-toc', 'aria-label': 'Transcript Topics' },
                  e('h3', { className: 'toc-title' }, 'Episode Topics'),
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
                          e('span', { className: 'toc-time' }, formatSeconds(sec.start_seconds)),
                          e('span', { className: 'toc-heading' }, sec.heading)
                        )
                      )
                    )
                  )
                )
              : null,

            // Transcript Sections
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
        : e(
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
  );
}
