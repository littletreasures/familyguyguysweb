/**
 * rss-embed.js — RSS.com embed player URL derivation helper.
 *
 * Derives the official RSS.com embedded player iframe URL from a canonical podcast page URL.
 * Regex enforces anchored matching, rejecting non-HTTPS, player.rss.com, media enclosures,
 * extra path segments, and query parameters.
 */

const RSS_PAGE_URL_PATTERN = /^https:\/\/rss\.com\/podcasts\/([a-z0-9-]+)\/(\d+)\/?$/;
const EMBED_THEME = 'dark';
const EMBED_PLAYER_VERSION = '2';

/**
 * Derive the RSS.com embed player URL from a podcast episode page URL.
 * @param {string} podcastUrl
 * @returns {{ embedUrl: string, pageUrl: string } | null}
 */
export function deriveRssEmbed(podcastUrl) {
  if (!podcastUrl || typeof podcastUrl !== 'string') return null;
  const match = podcastUrl.trim().match(RSS_PAGE_URL_PATTERN);
  if (!match) return null;
  const [, slug, episodeId] = match;
  return {
    embedUrl: `https://player.rss.com/${slug}/${episodeId}?theme=${EMBED_THEME}&v=${EMBED_PLAYER_VERSION}`,
    pageUrl: `https://rss.com/podcasts/${slug}/${episodeId}/`,
  };
}
