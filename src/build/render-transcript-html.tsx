/**
 * render-transcript-html.tsx
 * Pure React component rendered to static HTML via react-dom/server.
 * Generates semantic, accessible, SEO-rich markup for episode reviews and transcripts.
 */
import React from 'react';
import { formatSeconds } from '../transcripts/transcript-utils';
import { EpisodeTranscript } from '../transcripts/transcript-schema';
import { resolveEpisodeImage } from './build-page-metadata';

interface PrerenderProps {
  episode: {
    id: string;
    season: number;
    episode_number?: number;
    episodeNumber?: number;
    title: string;
    air_date?: string;
    airDate?: string;
    runtime?: string;
    imdb_rating?: string;
    imdbRating?: string;
    summary?: string;
    podcast_url?: string;
    podcastUrl?: string;
    thumbnail_url?: string;
    thumbnailUrl?: string;
    thumbnail_public_id?: string;
    thumbnailPublicId?: string;
  };
  transcript?: EpisodeTranscript | null;
}

export function RenderEpisodeReviewPage({ episode, transcript }: PrerenderProps) {
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

  return (
    <article className="episode-detail-container" id="prerendered-episode-content">
      {/* Breadcrumb Navigation */}
      <nav aria-label="Breadcrumb" className="detail-breadcrumb">
        <ol>
          <li>
            <a href="/">Home</a>
          </li>
          <li aria-hidden="true">/</li>
          <li>
            <a href="/reviews">Reviews</a>
          </li>
          <li aria-hidden="true">/</li>
          <li aria-current="page">
            Season {epSeason}, Episode {epNumber}
          </li>
        </ol>
      </nav>

      {/* Back button */}
      <div className="back-link-wrapper">
        <a href="/reviews" className="back-link">
          ← Back to Episode Catalog
        </a>
      </div>

      {/* Episode Header Card */}
      <header className="episode-hero-card">
        <div className="episode-hero-content">
          <div className="episode-badges">
            <span className="badge-season">
              Season {epSeason}, Episode {epNumber}
            </span>
            <span className="badge-runtime">{runtime}</span>
            <span className="badge-rating">★ IMDb {imdbRating}</span>
          </div>

          <h1 className="episode-main-title">{episode.title}</h1>
          <p className="episode-air-date">Original Air Date: {airDate}</p>

          {episode.summary && <p className="episode-synopsis">{episode.summary}</p>}

          {podcastUrl && (
            <div className="episode-audio-action">
              <a
                href={podcastUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="listen-podcast-btn"
              >
                ▶ Listen to Full Episode Audio
              </a>
            </div>
          )}
        </div>

        <div className="episode-hero-media">
          <img
            src={thumbnailUrl}
            alt={`${episode.title} Episode Thumbnail`}
            className="episode-thumbnail"
            loading="eager"
            width="480"
            height="270"
          />
        </div>
      </header>

      {/* Intro Note / Editorial Review Context */}
      {transcript?.intro && (
        <section className="episode-editorial-intro" aria-label="Episode Review Overview">
          <h2 className="intro-heading">Review Overview & Notes</h2>
          <p className="intro-text">{transcript.intro}</p>
        </section>
      )}

      {/* Spoken Transcript Section */}
      <section className="episode-transcript-wrapper" aria-label="Episode Transcript">
        <div className="transcript-header-bar">
          <h2 className="transcript-section-title">Full Spoken Podcast Transcript</h2>
          {hasTranscript && (
            <span className="transcript-wordcount">
              {transcript?.word_count
                ? `${transcript.word_count.toLocaleString()} words`
                : 'Full Length'}
            </span>
          )}
        </div>

        {hasTranscript && transcript?.sections ? (
          <div className="transcript-body" id="prerendered-transcript">
            {/* Table of Contents for Long Transcripts */}
            {transcript.sections.length > 1 && (
              <nav className="transcript-toc" aria-label="Transcript Topics">
                <h3 className="toc-title">Episode Topics</h3>
                <ul className="toc-list">
                  {transcript.sections.map((sec) => (
                    <li key={sec.id}>
                      <a href={`#${sec.id}`} className="toc-link">
                        <span className="toc-time">{formatSeconds(sec.start_seconds)}</span>
                        <span className="toc-heading">{sec.heading}</span>
                      </a>
                    </li>
                  ))}
                </ul>
              </nav>
            )}

            {/* Transcript Sections */}
            <div className="transcript-sections-list">
              {transcript.sections.map((section) => (
                <section
                  key={section.id}
                  id={section.id}
                  className="transcript-section-block"
                  aria-labelledby={`heading-${section.id}`}
                >
                  <div className="section-meta-header">
                    <h3 id={`heading-${section.id}`} className="section-title">
                      {section.heading}
                    </h3>
                    <span className="section-time-range">
                      {formatSeconds(section.start_seconds)} – {formatSeconds(section.end_seconds)}
                    </span>
                  </div>

                  <div className="section-entries">
                    {section.entries.map((entry, idx) => {
                      const speakerSlug = entry.speaker.toLowerCase().replace(/[^a-z0-9]/g, '');
                      return (
                        <div
                          key={`${section.id}-e${idx}`}
                          className={`dialogue-entry speaker-${speakerSlug}`}
                        >
                          <div className="entry-header">
                            <span className="speaker-label">{entry.speaker}</span>
                            <span className="timestamp-label">
                              {formatSeconds(entry.start_seconds)}
                            </span>
                          </div>
                          <div className="dialogue-content">
                            <p>{entry.text}</p>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </section>
              ))}
            </div>
          </div>
        ) : (
          <div className="no-transcript-fallback">
            <p className="no-transcript-msg">
              The full transcribed conversation for this episode is currently being curated.
            </p>
            <p className="no-transcript-sub">
              Listen to the complete audio discussion above, or explore other reviewed episodes.
            </p>
          </div>
        )}
      </section>
    </article>
  );
}
