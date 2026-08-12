import { describe, it, expect } from 'vitest';
import { getYouTubeThumbnailUrls } from '../src/main.js';

describe('YouTube Thumbnail Helper: getYouTubeThumbnailUrls', () => {
  it('parses youtu.be URLs correctly', () => {
    const result = getYouTubeThumbnailUrls('https://youtu.be/BcrVPdWeCZ4');
    expect(result).toEqual({
      primary: 'https://i.ytimg.com/vi/BcrVPdWeCZ4/maxresdefault.jpg',
      fallback: 'https://i.ytimg.com/vi/BcrVPdWeCZ4/hqdefault.jpg',
    });
  });

  it('parses standard watch?v= URLs with or without www', () => {
    const withWww = getYouTubeThumbnailUrls('https://www.youtube.com/watch?v=BcrVPdWeCZ4');
    expect(withWww).toEqual({
      primary: 'https://i.ytimg.com/vi/BcrVPdWeCZ4/maxresdefault.jpg',
      fallback: 'https://i.ytimg.com/vi/BcrVPdWeCZ4/hqdefault.jpg',
    });

    const withoutWww = getYouTubeThumbnailUrls('https://youtube.com/watch?v=BcrVPdWeCZ4');
    expect(withoutWww).toEqual({
      primary: 'https://i.ytimg.com/vi/BcrVPdWeCZ4/maxresdefault.jpg',
      fallback: 'https://i.ytimg.com/vi/BcrVPdWeCZ4/hqdefault.jpg',
    });
  });

  it('parses shorts URLs correctly', () => {
    const result = getYouTubeThumbnailUrls('https://www.youtube.com/shorts/BcrVPdWeCZ4');
    expect(result).toEqual({
      primary: 'https://i.ytimg.com/vi/BcrVPdWeCZ4/maxresdefault.jpg',
      fallback: 'https://i.ytimg.com/vi/BcrVPdWeCZ4/hqdefault.jpg',
    });
  });

  it('parses embed URLs correctly', () => {
    const result = getYouTubeThumbnailUrls('https://www.youtube.com/embed/BcrVPdWeCZ4');
    expect(result).toEqual({
      primary: 'https://i.ytimg.com/vi/BcrVPdWeCZ4/maxresdefault.jpg',
      fallback: 'https://i.ytimg.com/vi/BcrVPdWeCZ4/hqdefault.jpg',
    });
  });

  it('handles query parameters and mobile domains correctly', () => {
    const mobile = getYouTubeThumbnailUrls('https://m.youtube.com/watch?v=BcrVPdWeCZ4&t=10s');
    expect(mobile).toEqual({
      primary: 'https://i.ytimg.com/vi/BcrVPdWeCZ4/maxresdefault.jpg',
      fallback: 'https://i.ytimg.com/vi/BcrVPdWeCZ4/hqdefault.jpg',
    });

    const queryParams = getYouTubeThumbnailUrls('https://youtu.be/BcrVPdWeCZ4?si=123');
    expect(queryParams).toEqual({
      primary: 'https://i.ytimg.com/vi/BcrVPdWeCZ4/maxresdefault.jpg',
      fallback: 'https://i.ytimg.com/vi/BcrVPdWeCZ4/hqdefault.jpg',
    });
  });

  it('returns null for blank, malformed, non-YouTube, or invalid URLs without throwing', () => {
    expect(getYouTubeThumbnailUrls(null)).toBe(null);
    expect(getYouTubeThumbnailUrls(undefined)).toBe(null);
    expect(getYouTubeThumbnailUrls('')).toBe(null);
    expect(getYouTubeThumbnailUrls('   ')).toBe(null);
    expect(getYouTubeThumbnailUrls('not-a-url')).toBe(null);
    expect(getYouTubeThumbnailUrls('https://google.com/watch?v=BcrVPdWeCZ4')).toBe(null);
    expect(getYouTubeThumbnailUrls('https://youtube.com/watch')).toBe(null);
    expect(getYouTubeThumbnailUrls('https://youtube.com/shorts/')).toBe(null);
    expect(getYouTubeThumbnailUrls('https://youtu.be/')).toBe(null);
    expect(getYouTubeThumbnailUrls('https://youtube.com/watch?v=short')).toBe(null);
  });
});
