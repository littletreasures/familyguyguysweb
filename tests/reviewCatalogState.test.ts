import { describe, it, expect } from 'vitest';
import {
  parseCatalogQueryParams,
  buildCatalogQueryString,
} from '../src/reviews/lib/reviewHelpers';

describe('reviewCatalogState URL query params', () => {
  it('defaults to status=published and sort=newest when query params are absent', () => {
    expect(parseCatalogQueryParams('')).toEqual({
      search: '',
      seasonFilter: 'all',
      statusFilter: 'published',
      sortOrder: 'newest',
    });
  });

  it('parses explicit search, season, status, and sort query params', () => {
    expect(parseCatalogQueryParams('?q=stewie&season=2&status=all&sort=oldest')).toEqual({
      search: 'stewie',
      seasonFilter: '2',
      statusFilter: 'all',
      sortOrder: 'oldest',
    });
  });

  it('ignores invalid status or sort query params and falls back safely', () => {
    expect(parseCatalogQueryParams('?status=invalid&sort=random')).toEqual({
      search: '',
      seasonFilter: 'all',
      statusFilter: 'published',
      sortOrder: 'newest',
    });
  });

  it('serializes only non-default values cleanly', () => {
    expect(
      buildCatalogQueryString({
        search: '',
        seasonFilter: 'all',
        statusFilter: 'published',
        sortOrder: 'newest',
      })
    ).toBe('');

    expect(
      buildCatalogQueryString({
        search: 'peter',
        seasonFilter: '1',
        statusFilter: 'all',
        sortOrder: 'oldest',
      })
    ).toBe('?q=peter&season=1&status=all&sort=oldest');
  });
});
