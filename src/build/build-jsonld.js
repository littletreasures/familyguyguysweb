/**
 * build-jsonld.js — Schema.org structured data generator for podcast episode review & transcript pages.
 * Implements nested AudioObject.transcript on associatedMedia.
 */
import { resolveEpisodeImage } from './build-page-metadata.js';

export function buildEpisodeJsonLd(episode, transcript = null) {
  const epId = episode.id;
  const epTitle = episode.title || 'Untitled Episode';
  const season = episode.season ?? 1;
  const episodeNumber = episode.episode_number ?? episode.episodeNumber ?? 1;
  const canonicalUrl = `https://familyguyguys.com/reviews/${epId}`;
  const { imageUrl } = resolveEpisodeImage(episode);

  const podcastAudioUrl = episode.podcast_url || episode.podcastUrl;
  const datePublished =
    transcript?.published_at || episode.air_date || episode.airDate || undefined;

  const creators = [
    { '@type': 'Person', name: 'Jason Hackett' },
    { '@type': 'Person', name: 'Collin Brown' },
    { '@type': 'Person', name: 'Tyler Simpson' },
  ];

  const podcastEpisode = {
    '@type': 'PodcastEpisode',
    name: `S${season}E${episodeNumber}: ${epTitle}`,
    description:
      transcript?.seo_description ||
      episode.summary ||
      `Family Guy Guys review and discussion of ${epTitle}`,
    url: canonicalUrl,
    episodeNumber,
    image: imageUrl,
    creator: creators,
    partOfSeason: {
      '@type': 'PodcastSeason',
      seasonNumber: season,
    },
    partOfSeries: {
      '@type': 'PodcastSeries',
      name: 'Family Guy Guys',
      url: 'https://familyguyguys.com',
    },
  };

  if (datePublished) {
    podcastEpisode.datePublished = datePublished;
  }

  if (podcastAudioUrl) {
    const audioObject = {
      '@type': 'AudioObject',
      contentUrl: podcastAudioUrl,
    };
    if (transcript && transcript.plain_text) {
      audioObject.transcript = transcript.plain_text;
    }
    podcastEpisode.associatedMedia = audioObject;
  } else if (transcript && transcript.plain_text) {
    podcastEpisode.transcript = transcript.plain_text;
  }

  return {
    '@context': 'https://schema.org',
    '@graph': [podcastEpisode],
  };
}
