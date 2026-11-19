import { describe, it, expect } from 'vitest';
import {
  normalizeRatingToFive,
  getNativeRatingDisplay,
  computeNormalizedAverage,
  countSeasonStatuses,
  findEpisodeByRouteId,
  findHostByRouteId,
  sanitizeExternalHttpsUrl,
  type WatchStatus,
} from '../src/reviews/lib/reviewHelpers';

describe('reviewHelpers', () => {
  describe('normalizeRatingToFive & getNativeRatingDisplay', () => {
    it('formats 100-point canonical 0..5 ratings into native 0..100 display', () => {
      const display = getNativeRatingDisplay(
        { rating: 4.25, ratingScaleMax: 100, ratingTerminology: 'Vibes' },
        'Quahogs'
      );
      expect(display.normalizedFive).toBe(4.25);
      expect(display.value).toBe(85);
      expect(display.scaleMax).toBe(100);
      expect(display.terminology).toBe('Vibes');
      expect(display.formatted).toBe('85/100 Vibes');
    });

    it('formats standard 5-point ratings into native 5-scale display', () => {
      const display = getNativeRatingDisplay(
        { rating: 4, ratingScaleMax: 5, ratingTerminology: 'Quahogs' },
        'Stars'
      );
      expect(display.normalizedFive).toBe(4);
      expect(display.value).toBe(4);
      expect(display.scaleMax).toBe(5);
      expect(display.terminology).toBe('Quahogs');
      expect(display.formatted).toBe('4/5 Quahogs');
    });

    it('handles null or undefined rating cleanly', () => {
      const display = getNativeRatingDisplay(
        { rating: null, ratingScaleMax: 100, ratingTerminology: 'Vibes' },
        'Quahogs'
      );
      expect(display.normalizedFive).toBeNull();
      expect(display.value).toBeNull();
      expect(display.formatted).toBe('Not Rated');
    });

    it('defensively normalizes legacy >5 ratings on a 100-point scale', () => {
      expect(normalizeRatingToFive(85, 100)).toBe(4.25);
      expect(normalizeRatingToFive(4.25, 100)).toBe(4.25);
      expect(normalizeRatingToFive(4, 5)).toBe(4);
      expect(normalizeRatingToFive(null, 5)).toBeNull();
    });
  });

  describe('computeNormalizedAverage', () => {
    it('averages mixed 5-scale and 100-scale ratings on a unified 0..5 scale', () => {
      const avg = computeNormalizedAverage([
        { rating: 4, ratingScaleMax: 5 },
        { rating: 4.5, ratingScaleMax: 100 }, // canonical 4.5 (90/100)
        { rating: 70, ratingScaleMax: 100 }, // unnormalized 70/100 -> 3.5
        { rating: null, ratingScaleMax: 5 },
      ]);
      expect(avg).toBeCloseTo(4.0, 5);
    });

    it('returns null when no ratings are present', () => {
      expect(computeNormalizedAverage([{ rating: null }, { rating: undefined }])).toBeNull();
    });
  });

  describe('countSeasonStatuses', () => {
    it('tallies backlog, watched, recorded, and published episodes for a season', () => {
      const episodes: Array<{ season: number; watchStatus: WatchStatus }> = [
        { season: 1, watchStatus: 'published' },
        { season: 1, watchStatus: 'published' },
        { season: 1, watchStatus: 'recorded' },
        { season: 1, watchStatus: 'watched' },
        { season: 1, watchStatus: 'backlog' },
        { season: 2, watchStatus: 'published' },
      ];
      expect(countSeasonStatuses(episodes, 1)).toEqual({
        backlog: 1,
        watched: 1,
        recorded: 1,
        published: 2,
      });
    });
  });

  describe('findEpisodeByRouteId', () => {
    const episodes = [
      { id: '991a-uuid-ep1', season: 1, episodeNumber: 1 },
      { id: '123b-uuid-s2e4', season: 2, episodeNumber: 4 },
    ];

    it('resolves exact UUIDs, canonical s1e1, zero-padded s01e01, and full slugs', () => {
      expect(findEpisodeByRouteId(episodes, '991a-uuid-ep1')?.season).toBe(1);
      expect(findEpisodeByRouteId(episodes, 's1e1')?.id).toBe('991a-uuid-ep1');
      expect(findEpisodeByRouteId(episodes, 's01e01')?.id).toBe('991a-uuid-ep1');
      expect(findEpisodeByRouteId(episodes, 's01e01-death-has-a-shadow')?.id).toBe('991a-uuid-ep1');
      expect(findEpisodeByRouteId(episodes, 'S02E04')?.id).toBe('123b-uuid-s2e4');
      expect(findEpisodeByRouteId(episodes, 's99e99')).toBeUndefined();
    });
  });

  describe('findHostByRouteId', () => {
    const cohosts = [
      { id: '0a3dfd13-90b2-47db-b0af-2e0c0df21cff', name: 'Collin Brown' },
      { id: 'e08c8c4b-ecf5-427e-8890-fe9cef0a2c9a', name: 'Tyler Simpson' },
      { id: '01201e1a-dafd-424a-b596-ff9ece65f1aa', name: 'Jason Hackett' },
    ];
    const aliasMap = {
      collin: { name: 'Collin Brown' },
      tyler: { name: 'Tyler Simpson' },
      jason: { name: 'Jason Hackett' },
    };

    it('resolves short aliases, UUIDs, and full names', () => {
      expect(findHostByRouteId(cohosts, 'collin', aliasMap)?.name).toBe('Collin Brown');
      expect(findHostByRouteId(cohosts, 'tyler', aliasMap)?.name).toBe('Tyler Simpson');
      expect(findHostByRouteId(cohosts, 'jason', aliasMap)?.name).toBe('Jason Hackett');
      expect(findHostByRouteId(cohosts, '0a3dfd13-90b2-47db-b0af-2e0c0df21cff', aliasMap)?.name).toBe(
        'Collin Brown'
      );
      expect(findHostByRouteId(cohosts, 'unknown', aliasMap)).toBeUndefined();
    });
  });

  describe('sanitizeExternalHttpsUrl', () => {
    it('accepts valid HTTPS URLs and rejects unsafe schemes', () => {
      expect(sanitizeExternalHttpsUrl('https://youtube.com/watch?v=abc12345678')).toBe(
        'https://youtube.com/watch?v=abc12345678'
      );
      expect(sanitizeExternalHttpsUrl('javascript:alert(1)')).toBeNull();
      expect(sanitizeExternalHttpsUrl('http://example.com')).toBeNull();
      expect(sanitizeExternalHttpsUrl('//evil.com')).toBeNull();
      expect(sanitizeExternalHttpsUrl('')).toBeNull();
    });
  });
});
