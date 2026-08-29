/**
 * build-page-metadata.js — Pure metadata generator for episode review pages.
 * Implements exact image fallback chain and dynamic Twitter card sizing:
 * 1. episode.thumbnail_url / episode.thumbnailUrl
 * 2. Cloudinary URL constructed from thumbnail_public_id
 * 3. Fallback: /og/podcast-art-512.png (with twitter:card="summary")
 */

export function resolveEpisodeImage(episode) {
  const explicitUrl = episode.thumbnail_url || episode.thumbnailUrl;
  if (explicitUrl && typeof explicitUrl === 'string' && explicitUrl.trim() !== '') {
    const trimmed = explicitUrl.trim();
    return {
      imageUrl: trimmed.startsWith('http')
        ? trimmed
        : `https://familyguyguys.com${trimmed.startsWith('/') ? '' : '/'}${trimmed}`,
      isFallback: false,
    };
  }

  const publicId = episode.thumbnail_public_id || episode.thumbnailPublicId;
  const cloudName = process.env.CLOUDINARY_CLOUD_NAME;
  if (
    publicId &&
    typeof publicId === 'string' &&
    publicId.trim() !== '' &&
    cloudName &&
    typeof cloudName === 'string' &&
    cloudName.trim() !== ''
  ) {
    return {
      imageUrl: `https://res.cloudinary.com/${cloudName.trim()}/image/upload/${publicId.trim()}`,
      isFallback: false,
    };
  }

  return {
    imageUrl: 'https://familyguyguys.com/og/podcast-art-512.png',
    isFallback: true,
  };
}

export function buildEpisodePageMetadata(episode, transcript = null) {
  const epId = episode.id;
  const epTitle = episode.title || 'Untitled Episode';
  const season = episode.season ?? 1;
  const episodeNumber = episode.episode_number ?? episode.episodeNumber ?? 1;
  const hasTranscript = Boolean(
    transcript && transcript.sections && transcript.sections.length > 0
  );

  const title = `S${season}E${episodeNumber}: ${epTitle} — Family Guy Guys Review & Transcript`;

  let description = '';
  if (transcript && transcript.seo_description) {
    description = transcript.seo_description;
  } else if (episode.summary) {
    description = `Review and full podcast analysis of Family Guy S${season}E${episodeNumber} '${epTitle}'. ${episode.summary}`;
  } else {
    description = `Review and full spoken breakdown of Family Guy S${season}E${episodeNumber} '${epTitle}' with Jason, Collin, and Tyler on Family Guy Guys.`;
  }

  // Ensure description length is suitable for SEO meta (<= 160 chars recommended, capped at 250)
  if (description.length > 250) {
    description = description.slice(0, 247).trim() + '...';
  }

  const canonicalUrl = `https://familyguyguys.com/reviews/${epId}`;
  const { imageUrl, isFallback } = resolveEpisodeImage(episode);
  const twitterCard = isFallback ? 'summary' : 'summary_large_image';

  return {
    title,
    description,
    canonicalUrl,
    hasTranscript,
    og: {
      type: 'article',
      url: canonicalUrl,
      title,
      description,
      image: imageUrl,
      siteName: 'Family Guy Guys',
    },
    twitter: {
      card: twitterCard,
      url: canonicalUrl,
      title,
      description,
      image: imageUrl,
    },
  };
}
