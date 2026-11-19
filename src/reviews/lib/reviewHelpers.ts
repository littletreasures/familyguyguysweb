export type WatchStatus = 'backlog' | 'watched' | 'recorded' | 'published';

export type CatalogSortOrder = 'newest' | 'oldest';

export type CatalogFilterState = {
  search: string;
  seasonFilter: string;
  statusFilter: WatchStatus | 'all';
  sortOrder: CatalogSortOrder;
};

const VALID_STATUSES = new Set<string>(['backlog', 'watched', 'recorded', 'published', 'all']);

export function formatRatingValue(val: number): string {
  const rounded = Math.round((val + Number.EPSILON) * 100) / 100;
  return String(rounded);
}

export function normalizeRatingToFive(
  rating: number | null | undefined,
  scaleMax = 5
): number | null {
  if (rating === null || rating === undefined || Number.isNaN(Number(rating))) {
    return null;
  }
  const num = Number(rating);
  if (scaleMax === 100 && num > 5) {
    return num / 20;
  }
  return num;
}

export function getNativeRatingDisplay(
  review: {
    rating: number | null | undefined;
    ratingScaleMax?: number;
    ratingTerminology?: string;
  },
  fallbackLabel: string
): {
  value: number | null;
  scaleMax: number;
  terminology: string;
  formatted: string;
  normalizedFive: number | null;
} {
  const scaleMax = review.ratingScaleMax || 5;
  const terminology = review.ratingTerminology || fallbackLabel;
  const normalizedFive = normalizeRatingToFive(review.rating, scaleMax);
  const value =
    normalizedFive === null ? null : scaleMax === 100 ? (normalizedFive / 5) * 100 : normalizedFive;

  const formatted =
    value === null ? 'Not Rated' : `${formatRatingValue(value)}/${scaleMax} ${terminology}`;

  return {
    value,
    scaleMax,
    terminology,
    formatted,
    normalizedFive,
  };
}

export function computeNormalizedAverage(
  reviews: Array<{ rating: number | null | undefined; ratingScaleMax?: number }>
): number | null {
  const normalized = reviews
    .map((r) => normalizeRatingToFive(r.rating, r.ratingScaleMax))
    .filter((val): val is number => val !== null);

  if (!normalized.length) return null;
  return normalized.reduce((sum, val) => sum + val, 0) / normalized.length;
}

export function countSeasonStatuses(
  episodes: Array<{ season: number; watchStatus: WatchStatus }>,
  season: number
): Record<WatchStatus, number> {
  const counts: Record<WatchStatus, number> = {
    backlog: 0,
    watched: 0,
    recorded: 0,
    published: 0,
  };
  for (const ep of episodes) {
    if (ep.season === season && ep.watchStatus in counts) {
      counts[ep.watchStatus] += 1;
    }
  }
  return counts;
}

export function findEpisodeByRouteId<
  T extends { id: string; season: number; episodeNumber: number },
>(episodes: T[], routeId: string): T | undefined {
  const target = routeId.trim().toLowerCase();
  if (!target) return undefined;

  const exact = episodes.find((ep) => ep.id.toLowerCase() === target);
  if (exact) return exact;

  const slugMatch = target.match(/^s0*(\d+)e0*(\d+)(?:-|$)/i);
  if (!slugMatch) return undefined;

  const targetSeason = Number(slugMatch[1]);
  const targetEp = Number(slugMatch[2]);
  return episodes.find((ep) => ep.season === targetSeason && ep.episodeNumber === targetEp);
}

export function findHostByRouteId<T extends { id: string; name: string }>(
  cohosts: T[],
  routeId: string,
  aliasMap?: Record<string, { name: string }>
): T | undefined {
  const target = routeId.trim().toLowerCase();
  if (!target) return undefined;

  const exact = cohosts.find((host) => host.id.toLowerCase() === target);
  if (exact) return exact;

  const mappedName = aliasMap?.[target]?.name?.toLowerCase();
  return cohosts.find((host) => {
    const hostName = host.name?.toLowerCase() || '';
    if (mappedName && hostName === mappedName) return true;
    return hostName === target || hostName.startsWith(`${target} `);
  });
}

export function sanitizeExternalHttpsUrl(rawUrl: string | null | undefined): string | null {
  if (!rawUrl || typeof rawUrl !== 'string') return null;
  const str = rawUrl.trim();
  if (!str) return null;
  // eslint-disable-next-line no-control-regex
  if (str.startsWith('//') || /[\x00-\x1F\x7F]/.test(str)) return null;
  try {
    const parsed = new URL(str);
    if (parsed.protocol === 'https:') {
      return parsed.href;
    }
  } catch {
    return null;
  }
  return null;
}

export function parseCatalogQueryParams(searchStr: string): CatalogFilterState {
  const params = new URLSearchParams(searchStr.startsWith('?') ? searchStr.slice(1) : searchStr);
  const search = params.get('q') ?? '';
  const rawSeason = params.get('season') ?? 'all';
  const seasonFilter =
    rawSeason === 'all' || (/^\d+$/.test(rawSeason) && Number(rawSeason) > 0) ? rawSeason : 'all';

  const rawStatus = params.get('status');
  const statusFilter: WatchStatus | 'all' =
    rawStatus && VALID_STATUSES.has(rawStatus) ? (rawStatus as WatchStatus | 'all') : 'published';

  const rawSort = params.get('sort');
  const sortOrder: CatalogSortOrder = rawSort === 'oldest' ? 'oldest' : 'newest';

  return {
    search,
    seasonFilter,
    statusFilter,
    sortOrder,
  };
}

export function buildCatalogQueryString(state: CatalogFilterState): string {
  const params = new URLSearchParams();
  if (state.search.trim()) {
    params.set('q', state.search.trim());
  }
  if (state.seasonFilter !== 'all') {
    params.set('season', state.seasonFilter);
  }
  if (state.statusFilter !== 'published') {
    params.set('status', state.statusFilter);
  }
  if (state.sortOrder !== 'newest') {
    params.set('sort', state.sortOrder);
  }
  const qs = params.toString();
  return qs ? `?${qs}` : '';
}
