import { useEffect, useMemo, useState } from 'react';
import { supabase } from './lib/supabase';
import { navigateTo } from '../router.js';
import { deriveRssEmbed } from '../build/rss-embed.js';
import { formatSeconds } from '../build/format-time.js';
import { Star } from 'lucide-react';
import { VisitorReviewsSection } from './VisitorReviewsSection';
import {
  buildCatalogQueryString,
  computeNormalizedAverage,
  countSeasonStatuses,
  findEpisodeByRouteId,
  findHostByRouteId,
  getNativeRatingDisplay,
  parseCatalogQueryParams,
  sanitizeExternalHttpsUrl,
  type CatalogSortOrder,
  type WatchStatus,
} from './lib/reviewHelpers';

type Cohost = {
  id: string;
  name: string;
  role: string;
  bio: string;
  accent: string;
};

type Review = {
  cohostId: string;
  rating: number | null;
  review: string;
  pullQuote?: string;
  draftSource?: 'manual' | 'transcript';
  updatedAt?: string;
  ratingTerminology?: string;
  ratingScaleMax?: number;
};

type EpisodeFact = {
  label: string;
  value: string;
};

type TranscriptEntry = {
  start_seconds?: number;
  speaker?: string;
  text?: string;
};

type TranscriptSection = {
  id: string;
  heading: string;
  start_seconds?: number;
  end_seconds?: number;
  entries?: TranscriptEntry[];
};

type EpisodeTranscript = {
  episode_id: string;
  status: string;
  word_count: number | null;
  intro: string | null;
  sections: TranscriptSection[] | null;
  published_at: string | null;
};

type Episode = {
  id: string;
  season: number;
  episodeNumber: number;
  title: string;
  airDate: string;
  runtime: string;
  imdbRating: string;
  summary: string;
  cast: string[];
  guestStars: string[];
  writers: string[];
  director: string;
  facts: EpisodeFact[];
  watchStatus: WatchStatus;
  podcastUrl: string;
  youtubeUrl: string;
  transcriptNotes: string;
  thumbnailPublicId: string | null;
  thumbnailUrl: string | null;
  thumbnailStatus: 'pending' | 'uploaded' | 'failed' | 'manual';
  thumbnailError: string | null;
  reviews: Review[];
};

type PodcastDataset = {
  schemaVersion: 'fg-letterlog-v2';
  showName: string;
  subtitle: string;
  ratingScale: {
    label: string;
    max: number;
  };
  cohosts: Cohost[];
  episodes: Episode[];
};

type Route =
  | { page: 'catalog' }
  | { page: 'episode'; id: string }
  | { page: 'season'; season: number }
  | { page: 'host'; id: string };

const STATUS_ORDER: WatchStatus[] = ['backlog', 'watched', 'recorded', 'published'];
const STATUS_LABEL: Record<WatchStatus, string> = {
  backlog: 'Backlog',
  watched: 'Watched',
  recorded: 'Recorded',
  published: 'Published',
};

const COHOST_NAME_MAP: Record<string, { name: string; role: string; photo: string }> = {
  '01201e1a-dafd-424a-b596-ff9ece65f1aa': {
    name: 'Jason Hackett',
    role: 'Host',
    photo: '/hosts/jasonhost.webp',
  },
  'e08c8c4b-ecf5-427e-8890-fe9cef0a2c9a': {
    name: 'Tyler Simpson',
    role: 'Host',
    photo: '/hosts/tylerhost.webp',
  },
  '0a3dfd13-90b2-47db-b0af-2e0c0df21cff': {
    name: 'Collin Brown',
    role: 'Host',
    photo: '/hosts/collinhost.webp',
  },
  'mock-cohost-jason': {
    name: 'Jason Hackett',
    role: 'Host',
    photo: '/hosts/jasonhost.webp',
  },
  'mock-cohost-tyler': {
    name: 'Tyler Simpson',
    role: 'Host',
    photo: '/hosts/tylerhost.webp',
  },
  'mock-cohost-collin': {
    name: 'Collin Brown',
    role: 'Host',
    photo: '/hosts/collinhost.webp',
  },
  jason: { name: 'Jason Hackett', role: 'Host', photo: '/hosts/jasonhost.webp' },
  tyler: { name: 'Tyler Simpson', role: 'Host', photo: '/hosts/tylerhost.webp' },
  collin: { name: 'Collin Brown', role: 'Host', photo: '/hosts/collinhost.webp' },
};

function getHostTheme(hostId: string): {
  bgClass: string;
  fallbackBg: string;
  textClass: string;
} {
  const id = hostId.toLowerCase();
  if (
    id === 'collin' ||
    id === '0a3dfd13-90b2-47db-b0af-2e0c0df21cff' ||
    id === 'mock-cohost-collin'
  ) {
    return {
      bgClass: 'host-bg-collin',
      fallbackBg: 'var(--teal, #1a6b6b)',
      textClass: 'text-white',
    };
  }
  if (
    id === 'tyler' ||
    id === 'e08c8c4b-ecf5-427e-8890-fe9cef0a2c9a' ||
    id === 'mock-cohost-tyler'
  ) {
    return {
      bgClass: 'host-bg-tyler',
      fallbackBg: 'var(--maroon, #5c1a1a)',
      textClass: 'text-white',
    };
  }
  return {
    bgClass: 'host-bg-jason',
    fallbackBg: 'var(--amber, #aa6200)',
    textClass: 'text-white',
  };
}

function cohostFromRow(row: Record<string, any>): Cohost {
  const mapped = COHOST_NAME_MAP[row.id?.toLowerCase()] || COHOST_NAME_MAP[row.name?.toLowerCase()];
  return {
    id: row.id,
    name: mapped?.name ?? row.name,
    role: mapped?.role ?? row.role,
    bio: row.bio,
    accent: row.accent,
  };
}

function reviewFromRow(row: Record<string, any>): Review {
  return {
    cohostId: row.cohost_id,
    rating: row.rating,
    review: row.review,
    pullQuote: row.pull_quote,
    draftSource: row.draft_source,
    updatedAt: row.updated_at,
    ratingTerminology: row.rating_terminology,
    ratingScaleMax: row.rating_scale_max,
  };
}

function episodeFromRow(row: Record<string, any>): Episode {
  return {
    id: row.id,
    season: row.season,
    episodeNumber: row.episode_number,
    title: row.title,
    airDate: row.air_date,
    runtime: row.runtime,
    imdbRating: row.imdb_rating,
    summary: row.summary,
    cast: row.cast || [],
    guestStars: row.guest_stars || [],
    writers: row.writers || [],
    director: row.director,
    facts: Array.isArray(row.facts) ? row.facts : [],
    watchStatus: row.watch_status,
    podcastUrl: row.podcast_url ?? row.podcasturl ?? '',
    youtubeUrl: row.youtube_url ?? '',
    transcriptNotes: row.transcript_notes ?? row.transcriptnotes ?? '',
    thumbnailPublicId: row.thumbnail_public_id ?? null,
    thumbnailUrl: row.thumbnail_url ?? null,
    thumbnailStatus: row.thumbnail_status ?? 'pending',
    thumbnailError: row.thumbnail_error ?? null,
    reviews: [],
  };
}

function configFromRow(row: Record<string, any> | null | undefined) {
  return {
    showName: row?.show_name ?? 'Family Guy Guys',
    subtitle:
      row?.subtitle ??
      'Join Collin, Tyler, and Jason as they watch and review every single episode of Family Guy in chronological order.',
    ratingScale: {
      label: row?.rating_label ?? 'Quahogs',
      max: row?.rating_max ?? 5,
    },
  };
}

function buildDataset(
  cohostsRaw: Record<string, any>[],
  episodesRaw: Record<string, any>[],
  reviewsRaw: Record<string, any>[],
  configRaw: Record<string, any> | null | undefined
): PodcastDataset {
  const cohosts = cohostsRaw.map(cohostFromRow);
  const config = configFromRow(configRaw);

  const episodes = episodesRaw.map((row) => {
    const episode = episodeFromRow(row);
    episode.reviews = alignReviews(
      reviewsRaw.filter((r) => r.episode_id === episode.id).map(reviewFromRow),
      cohosts
    );
    return episode;
  });

  return {
    schemaVersion: 'fg-letterlog-v2',
    showName: config.showName,
    subtitle: config.subtitle,
    ratingScale: config.ratingScale,
    cohosts,
    episodes: episodes.sort(compareEpisodes),
  };
}

function App() {
  const initialFilters = useMemo(
    () =>
      typeof window !== 'undefined'
        ? parseCatalogQueryParams(window.location.search)
        : parseCatalogQueryParams(''),
    []
  );

  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [retryCount, setRetryCount] = useState(0);
  const [dataset, setDataset] = useState<PodcastDataset | null>(null);
  const [route, setRoute] = useState<Route>(() => parsePath());
  const [search, setSearch] = useState(initialFilters.search);
  const [seasonFilter, setSeasonFilter] = useState(initialFilters.seasonFilter);
  const [statusFilter, setStatusFilter] = useState<WatchStatus | 'all'>(
    initialFilters.statusFilter
  );
  const [sortOrder, setSortOrder] = useState<CatalogSortOrder>(initialFilters.sortOrder);

  useEffect(() => {
    let cancelled = false;

    async function fetchData() {
      setLoading(true);
      setLoadError(null);

      try {
        if (!supabase) {
          throw new Error(
            'Reviews database connection is not configured right now. Please try again later.'
          );
        }

        const client = supabase;
        const fetchReviews = async () => {
          const res = await client
            .from('reviews')
            .select(
              'episode_id, cohost_id, rating, review, pull_quote, draft_source, updated_at, rating_terminology, rating_scale_max'
            );
          if (!res.error) return res;
          console.warn(
            'New columns not found in reviews table, falling back to legacy schema:',
            res.error.message
          );
          return await client
            .from('reviews')
            .select('episode_id, cohost_id, rating, review, pull_quote, draft_source, updated_at');
        };

        const results = await Promise.allSettled([
          client.from('cohosts').select('id, name, role, bio, accent'),
          client
            .from('episodes')
            .select(
              'id, season, episode_number, title, air_date, runtime, imdb_rating, summary, cast, guest_stars, writers, director, facts, watch_status, podcast_url, youtube_url, transcript_notes, thumbnail_public_id, thumbnail_url, thumbnail_status, thumbnail_error'
            ),
          fetchReviews(),
          client.from('config').select('rating_label, rating_max, show_name, subtitle'),
        ]);

        if (cancelled) return;

        const [cohostsRes, episodesRes, reviewsRes, configRes] = results;

        const hasCriticalError =
          cohostsRes.status === 'rejected' ||
          episodesRes.status === 'rejected' ||
          reviewsRes.status === 'rejected' ||
          (cohostsRes.status === 'fulfilled' && Boolean(cohostsRes.value.error)) ||
          (episodesRes.status === 'fulfilled' && Boolean(episodesRes.value.error)) ||
          (reviewsRes.status === 'fulfilled' && Boolean(reviewsRes.value.error));

        if (hasCriticalError) {
          const errDetail =
            (episodesRes.status === 'fulfilled' && episodesRes.value.error?.message) ||
            (reviewsRes.status === 'fulfilled' && reviewsRes.value.error?.message) ||
            (cohostsRes.status === 'fulfilled' && cohostsRes.value.error?.message) ||
            'Unable to reach the reviews archive.';
          throw new Error(errDetail);
        }

        const cohosts =
          cohostsRes.status === 'fulfilled' && Array.isArray(cohostsRes.value.data)
            ? cohostsRes.value.data
            : [];
        const episodes =
          episodesRes.status === 'fulfilled' && Array.isArray(episodesRes.value.data)
            ? episodesRes.value.data
            : [];
        const reviews =
          reviewsRes.status === 'fulfilled' && Array.isArray(reviewsRes.value.data)
            ? reviewsRes.value.data
            : [];
        const config =
          configRes.status === 'fulfilled' && Array.isArray(configRes.value.data)
            ? configRes.value.data[0]
            : null;

        const nextDataset = buildDataset(cohosts, episodes, reviews, config);
        setDataset(nextDataset);
        setLoading(false);
      } catch (error) {
        if (cancelled) return;
        setLoadError(
          error instanceof Error ? error.message : 'Unable to load reviews from the archive.'
        );
        setLoading(false);
      }
    }

    fetchData();
    return () => {
      cancelled = true;
    };
  }, [retryCount]);

  useEffect(() => {
    const onRouteChange = (e: CustomEvent<{ page: string; params?: any }>) => {
      const { page, params } = e.detail;
      if (page === 'reviews') {
        if (params) {
          if (params.page === 'episode') setRoute({ page: 'episode', id: params.id });
          else if (params.page === 'season') setRoute({ page: 'season', season: params.season });
          else if (params.page === 'host') setRoute({ page: 'host', id: params.id });
        } else {
          setRoute({ page: 'catalog' });
        }
      }
    };
    window.addEventListener('routechange', onRouteChange as EventListener);
    setRoute(parsePath());
    return () => window.removeEventListener('routechange', onRouteChange as EventListener);
  }, []);

  useEffect(() => {
    if (typeof window === 'undefined' || route.page !== 'catalog') return;
    const qs = buildCatalogQueryString({ search, seasonFilter, statusFilter, sortOrder });
    const nextUrl = `/reviews${qs}`;
    const currentUrl = `${window.location.pathname}${window.location.search}`;
    if (currentUrl !== nextUrl && window.location.pathname.startsWith('/reviews')) {
      window.history.replaceState(window.history.state, '', nextUrl);
    }
  }, [route.page, search, seasonFilter, statusFilter, sortOrder]);

  const seasons = useMemo(() => (dataset ? getSeasons(dataset.episodes) : []), [dataset]);

  const visibleEpisodes = useMemo(() => {
    if (!dataset) return [];
    const query = search.trim().toLowerCase();
    const sorted = [...dataset.episodes].sort((a, b) =>
      sortOrder === 'newest' ? compareEpisodes(b, a) : compareEpisodes(a, b)
    );
    return sorted
      .filter((episode) => seasonFilter === 'all' || episode.season === Number(seasonFilter))
      .filter((episode) => statusFilter === 'all' || episode.watchStatus === statusFilter)
      .filter((episode) => {
        if (!query) return true;
        return searchableEpisodeText(episode).includes(query);
      });
  }, [dataset, search, seasonFilter, statusFilter, sortOrder]);

  function resetFilters() {
    setSearch('');
    setSeasonFilter('all');
    setStatusFilter('published');
    setSortOrder('newest');
  }

  function navigate(nextRoute: Route) {
    if (nextRoute.page === 'episode') {
      window.location.href = routeToPath(nextRoute);
      return;
    }
    navigateTo(routeToPath(nextRoute));
  }

  if (loading) {
    return (
      <div
        id="review-app"
        className="min-h-screen text-[#1a1a1a] reviews-halftone-bg p-6 md:p-10 flex items-center justify-center"
      >
        <div
          className="max-w-lg w-full bg-white border-2 border-[#1a1a1a] rounded-lg shadow-[4px_4px_0_#1a1a1a] p-8 text-center"
          role="status"
          aria-live="polite"
        >
          <p className="text-xs font-bold uppercase tracking-widest text-[#7a2b0f]">
            Loading Reviews Archive
          </p>
          <h1 className="mt-2 text-3xl text-[#1a1a1a] uppercase">Fetching Episode Ledger…</h1>
          <p className="mt-3 text-sm text-[#4a4a4a]">
            Pulling host scores, ratings, and episode notes from the Family Guy Guys archive.
          </p>
        </div>
      </div>
    );
  }

  if (loadError || !dataset) {
    return (
      <div
        id="review-app"
        className="min-h-screen text-[#1a1a1a] reviews-halftone-bg p-6 md:p-10 flex items-center justify-center"
      >
        <div
          className="max-w-lg w-full bg-white border-2 border-[#1a1a1a] rounded-lg shadow-[4px_4px_0_#1a1a1a] p-8 text-center"
          role="alert"
          aria-live="polite"
        >
          <p className="text-xs font-bold uppercase tracking-widest text-[#5c1a1a]">
            Archive Unavailable {retryCount > 0 ? `(Attempt #${retryCount + 1})` : ''}
          </p>
          <h1 className="mt-2 text-3xl text-[#1a1a1a] uppercase">Could Not Load Reviews</h1>
          <p className="mt-3 text-sm text-[#4a4a4a]">
            {loadError || 'Unable to reach the reviews archive right now.'}
          </p>
          <div className="mt-6 flex flex-wrap justify-center gap-3">
            <button
              type="button"
              onClick={() => setRetryCount((prev) => prev + 1)}
              className="primary-button"
            >
              Retry
            </button>
            <a href="/episodes" className="secondary-button">
              Browse Episode Feed
            </a>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div
      className="min-h-screen text-[#1a1a1a] reviews-halftone-bg relative p-4 md:p-8 animate-rise"
      id="review-app"
    >
      <div className="mx-auto max-w-7xl px-5 pb-28 pt-2 sm:px-6 lg:px-8">
        {route.page === 'catalog' ? (
          <CatalogPage
            dataset={dataset}
            episodes={visibleEpisodes}
            seasons={seasons}
            onNavigate={navigate}
            search={search}
            onSearchChange={setSearch}
            seasonFilter={seasonFilter}
            onSeasonFilterChange={setSeasonFilter}
            statusFilter={statusFilter}
            onStatusFilterChange={setStatusFilter}
            sortOrder={sortOrder}
            onSortOrderChange={setSortOrder}
            onResetFilters={resetFilters}
          />
        ) : null}

        {route.page === 'episode' ? (
          <EpisodePage dataset={dataset} episodeId={route.id} onNavigate={navigate} />
        ) : null}

        {route.page === 'season' ? (
          <SeasonPage dataset={dataset} season={route.season} onNavigate={navigate} />
        ) : null}

        {route.page === 'host' ? (
          <HostPage dataset={dataset} hostId={route.id} onNavigate={navigate} />
        ) : null}
      </div>
    </div>
  );
}

function CatalogPage({
  dataset,
  episodes,
  seasons,
  onNavigate,
  search,
  onSearchChange,
  seasonFilter,
  onSeasonFilterChange,
  statusFilter,
  onStatusFilterChange,
  sortOrder,
  onSortOrderChange,
  onResetFilters,
}: {
  dataset: PodcastDataset;
  episodes: Episode[];
  seasons: number[];
  onNavigate: (route: Route) => void;
  search: string;
  onSearchChange: (value: string) => void;
  seasonFilter: string;
  onSeasonFilterChange: (value: string) => void;
  statusFilter: WatchStatus | 'all';
  onStatusFilterChange: (value: WatchStatus | 'all') => void;
  sortOrder: CatalogSortOrder;
  onSortOrderChange: (value: CatalogSortOrder) => void;
  onResetFilters: () => void;
}) {
  return (
    <div className="animate-rise mt-4 grid gap-8 lg:grid-cols-[minmax(0,1fr)_330px]">
      <section>
        <header className="mb-6 border-b-4 border-[#1a1a1a] pb-4">
          <h1 className="text-4xl md:text-6xl uppercase tracking-tight leading-none">
            Episode Reviews
          </h1>
          <p className="mt-2 text-sm text-[#4a4a4a] font-medium max-w-2xl">
            Every chronological rewatch episode rated by Collin, Tyler, and Jason — complete with
            arbitrary units, show links, and community scores.
          </p>
        </header>

        {/* Search and Filters Block */}
        <div className="mb-8 flex flex-col gap-4 font-sans">
          <div className="flex flex-wrap md:flex-nowrap md:items-center gap-3">
            <div className="relative flex-grow min-w-0">
              <input
                type="text"
                value={search}
                onChange={(e) => onSearchChange(e.target.value)}
                placeholder="Search episodes, guests, quotes..."
                className="field w-full text-sm font-sans pr-10"
                aria-label="Search reviews"
              />
              {search && (
                <button
                  onClick={() => onSearchChange('')}
                  className="absolute right-1 top-1/2 -translate-y-1/2 min-h-[44px] min-w-[44px] flex items-center justify-center text-[#4a4a4a] hover:text-[#1a1a1a] font-black text-sm"
                  aria-label="Clear search"
                  type="button"
                >
                  ✕
                </button>
              )}
            </div>
            <div className="flex gap-3 flex-shrink-0 flex-wrap sm:flex-nowrap">
              <select
                value={seasonFilter}
                onChange={(e) => onSeasonFilterChange(e.target.value)}
                className="field min-w-[130px] text-sm font-sans cursor-pointer"
                aria-label="Filter by season"
              >
                <option value="all">All Seasons</option>
                {seasons.map((s) => (
                  <option key={s} value={String(s)}>
                    Season {s}
                  </option>
                ))}
              </select>
              <select
                value={statusFilter}
                onChange={(e) => onStatusFilterChange(e.target.value as WatchStatus | 'all')}
                className="field min-w-[135px] text-sm font-sans cursor-pointer"
                aria-label="Filter by status"
              >
                <option value="all">All Statuses</option>
                {STATUS_ORDER.map((status) => (
                  <option key={status} value={status}>
                    {STATUS_LABEL[status]}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="text-xs font-bold text-[#4a4a4a] tracking-wider uppercase font-sans">
              Found {episodes.length} {episodes.length === 1 ? 'episode' : 'episodes'}
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={() =>
                  onStatusFilterChange(statusFilter === 'published' ? 'all' : 'published')
                }
                aria-pressed={statusFilter === 'published'}
                className={`min-h-[44px] px-3 py-1.5 rounded border-2 border-[#1a1a1a] text-xs font-bold uppercase tracking-wider transition-colors ${
                  statusFilter === 'published'
                    ? 'bg-[#e8841a] text-[#1a1a1a]'
                    : 'bg-white text-[#1a1a1a] hover:bg-[#f5f4f0]'
                }`}
              >
                {statusFilter === 'published' ? 'Published only' : 'Showing all statuses'}
              </button>
              <button
                type="button"
                onClick={() => onSortOrderChange(sortOrder === 'newest' ? 'oldest' : 'newest')}
                aria-pressed={sortOrder === 'oldest'}
                className="min-h-[44px] px-3 py-1.5 rounded border-2 border-[#1a1a1a] bg-white text-[#1a1a1a] hover:bg-[#f5f4f0] text-xs font-bold uppercase tracking-wider"
              >
                Sort: {sortOrder === 'newest' ? 'Newest first' : 'Chronological'}
              </button>
            </div>
          </div>
        </div>

        <h2 className="sr-only">Episodes</h2>
        <div className="mt-6 grid gap-5 sm:grid-cols-2 xl:grid-cols-3">
          {episodes.map((episode) => (
            <EpisodeTile
              key={episode.id}
              episode={episode}
              ratingLabel={dataset.ratingScale.label}
              onOpen={() => onNavigate({ page: 'episode', id: episode.id })}
            />
          ))}
        </div>
        {!episodes.length ? (
          <EmptyState
            title="No episodes match"
            copy="Try widening your search or switching back to all seasons and statuses."
            actionLabel="Reset filters"
            onAction={onResetFilters}
          />
        ) : null}
      </section>

      <aside className="space-y-6">
        <SidePanel title="Season Shelves">
          <div className="space-y-4">
            {seasons.map((season) => {
              const seasonEpisodes = dataset.episodes.filter(
                (episode) => episode.season === season
              );
              return (
                <button
                  key={season}
                  type="button"
                  onClick={() => onNavigate({ page: 'season', season })}
                  className="group w-full min-h-[44px] border-b border-gray-200 pb-4 text-left last:border-b-0 last:pb-0 focus:ring-2 focus:ring-[#1a1a1a] focus:outline-none"
                >
                  <div className="flex items-center justify-between gap-4 font-sans">
                    <p className="font-bold text-[#1a1a1a] group-hover:text-[#7a2b0f] transition-colors">
                      Season {season}
                    </p>
                    <p className="text-sm font-semibold text-[#4a4a4a]">
                      {seasonEpisodes.length} eps
                    </p>
                  </div>
                  <ProgressBar value={seasonProgress(seasonEpisodes)} />
                </button>
              );
            })}
          </div>
        </SidePanel>

        <SidePanel title="Host Profiles">
          <div className="space-y-3">
            {dataset.cohosts.map((host) => {
              const mapped =
                COHOST_NAME_MAP[host.id.toLowerCase()] || COHOST_NAME_MAP[host.name?.toLowerCase()];
              const name = mapped?.name ?? host.name;
              const role = mapped?.role ?? host.role;
              return (
                <button
                  key={host.id}
                  type="button"
                  onClick={() => onNavigate({ page: 'host', id: host.id })}
                  className="flex w-full min-h-[44px] items-center gap-3 border-2 border-[#1a1a1a] bg-white p-3 text-left transition shadow-[3px_3px_0px_0px_#1a1a1a] hover:translate-y-[-1px] hover:shadow-[4px_4px_0px_0px_#1a1a1a] text-[#1a1a1a]"
                >
                  <Avatar host={host} />
                  <div>
                    <p className="font-bold text-[#1a1a1a] leading-none">{name}</p>
                    <p className="text-xs font-bold text-[#4a4a4a] mt-1.5 leading-none">{role}</p>
                  </div>
                </button>
              );
            })}
          </div>
        </SidePanel>
      </aside>
    </div>
  );
}

function EpisodeTile({
  episode,
  ratingLabel,
  onOpen,
}: {
  episode: Episode;
  ratingLabel: string;
  onOpen: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onOpen}
      className="block w-full text-left group animate-rise"
      aria-label={`Open reviews for ${episode.title}`}
    >
      <EpisodePoster episode={episode} ratingScale={ratingLabel} />
    </button>
  );
}

function EpisodePage({
  dataset,
  episodeId,
  onNavigate,
}: {
  dataset: PodcastDataset;
  episodeId: string;
  onNavigate: (route: Route) => void;
}) {
  const publishedEpisodes = useMemo(() => {
    return [...dataset.episodes]
      .sort(compareEpisodes)
      .filter((ep) => ep.watchStatus === 'published');
  }, [dataset.episodes]);

  const episode = findEpisodeByRouteId(dataset.episodes, episodeId);
  const resolvedEpisodeId = episode?.id ?? null;

  const [transcript, setTranscript] = useState<EpisodeTranscript | null>(null);
  const [transcriptLoading, setTranscriptLoading] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setTranscript(null);

    if (!supabase || !resolvedEpisodeId) {
      setTranscriptLoading(false);
      return () => {
        cancelled = true;
      };
    }

    const client = supabase;
    setTranscriptLoading(true);

    async function fetchTranscript() {
      try {
        const res = await client
          .from('episode_transcripts')
          .select('episode_id, status, word_count, intro, sections, published_at')
          .eq('episode_id', resolvedEpisodeId)
          .eq('status', 'published')
          .maybeSingle();

        if (cancelled) return;
        if (res.error) {
          console.warn('Failed to fetch episode transcript:', res.error.message);
          setTranscript(null);
        } else {
          setTranscript((res.data as EpisodeTranscript | null) ?? null);
        }
      } catch (err) {
        if (cancelled) return;
        console.warn('Failed to fetch episode transcript:', err);
        setTranscript(null);
      } finally {
        if (!cancelled) {
          setTranscriptLoading(false);
        }
      }
    }

    fetchTranscript();

    return () => {
      cancelled = true;
    };
  }, [resolvedEpisodeId]);

  useEffect(() => {
    if (typeof window === 'undefined' || !transcript?.sections?.length) return;
    const hash = window.location.hash;
    if (hash && hash.startsWith('#sec-')) {
      const details = document.getElementById('transcript-details') as HTMLDetailsElement | null;
      if (details && !details.open) {
        details.open = true;
      }
      const target = document.getElementById(hash.slice(1));
      if (target) {
        requestAnimationFrame(() => {
          target.scrollIntoView({ behavior: 'smooth' });
        });
      }
    }
  }, [transcript]);

  if (!episode) {
    return (
      <EmptyState
        title="Episode not found"
        copy="This URL does not match an episode in the archive."
        actionLabel="Back to catalog"
        onAction={() => onNavigate({ page: 'catalog' })}
        headingLevel="h1"
      />
    );
  }

  const currentIndex = publishedEpisodes.findIndex((item) => item.id === episode.id);
  const prevEpisode = currentIndex > 0 ? publishedEpisodes[currentIndex - 1] : null;
  const nextEpisode =
    currentIndex < publishedEpisodes.length - 1 && currentIndex !== -1
      ? publishedEpisodes[currentIndex + 1]
      : null;

  const average = computeNormalizedAverage(episode.reviews);
  const safePodcastUrl = sanitizeExternalHttpsUrl(episode.podcastUrl);
  const safeYoutubeUrl = sanitizeExternalHttpsUrl(episode.youtubeUrl);
  const rssEmbed = safePodcastUrl ? deriveRssEmbed(safePodcastUrl) : null;

  const filteredGuestStars = episode.guestStars.filter(
    (item) => !item.toLowerCase().includes('guest cast to be imported')
  );
  const filteredFacts = episode.facts.filter(
    (fact) => !fact.value.toLowerCase().includes('demo placeholder')
  );
  const directorsList = episode.director
    ? episode.director
        .split(/,\s+(?!Jr\.?|Sr\.?|II\b|III\b)/)
        .map((item) => item.trim())
        .filter(Boolean)
    : [];
  const introNotes = transcript?.intro || episode.transcriptNotes;
  const transcriptSections = Array.isArray(transcript?.sections) ? transcript.sections : [];
  const hasTranscript = transcriptSections.length > 0;

  return (
    <div className="animate-rise mt-8 text-[#1a1a1a]">
      {/* Top adjacent navigation */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b-4 border-[#1a1a1a] pb-3 mb-6 font-sans">
        <button
          type="button"
          onClick={() => onNavigate({ page: 'catalog' })}
          className="text-link min-h-[44px] inline-flex items-center focus:ring-2 focus:ring-[#1a1a1a] focus:outline-none"
        >
          ← Back to catalog
        </button>
        <div className="flex items-center gap-3 text-xs font-black uppercase">
          {prevEpisode ? (
            <button
              type="button"
              onClick={() => onNavigate({ page: 'episode', id: prevEpisode.id })}
              className="hover:underline focus:ring-2 focus:ring-[#1a1a1a] focus:outline-none px-3.5 py-2 bg-white border-2 border-[#1a1a1a] shadow-[1.5px_1.5px_0px_0px_#1a1a1a] active:translate-y-0.5 active:shadow-none min-h-[44px] inline-flex items-center justify-center"
              aria-label={`Previous episode: ${formatEpisodeCode(prevEpisode)}, ${prevEpisode.title}`}
            >
              &larr; {formatEpisodeCode(prevEpisode)}
            </button>
          ) : (
            <span className="text-[#4a4a4a] opacity-65 px-3.5 py-2 bg-gray-100 border-2 border-[#1a1a1a] min-h-[44px] inline-flex items-center justify-center select-none">
              &larr; Start
            </span>
          )}

          <span className="text-[#1a1a1a] select-none">/</span>

          {nextEpisode ? (
            <button
              type="button"
              onClick={() => onNavigate({ page: 'episode', id: nextEpisode.id })}
              className="hover:underline focus:ring-2 focus:ring-[#1a1a1a] focus:outline-none px-3.5 py-2 bg-white border-2 border-[#1a1a1a] shadow-[1.5px_1.5px_0px_0px_#1a1a1a] active:translate-y-0.5 active:shadow-none min-h-[44px] inline-flex items-center justify-center"
              aria-label={`Next episode: ${formatEpisodeCode(nextEpisode)}, ${nextEpisode.title}`}
            >
              {formatEpisodeCode(nextEpisode)} &rarr;
            </button>
          ) : (
            <span className="text-[#4a4a4a] opacity-65 px-3.5 py-2 bg-gray-100 border-2 border-[#1a1a1a] min-h-[44px] inline-flex items-center justify-center select-none font-bold">
              End &rarr;
            </span>
          )}
        </div>
      </div>

      <div className="grid gap-8 lg:grid-cols-[360px_minmax(0,1fr)]">
        <aside className="space-y-6 w-full max-w-[360px] mx-auto lg:mx-0">
          <EpisodePoster episode={episode} ratingScale={dataset.ratingScale.label} size="detail" />
        </aside>

        <section className="space-y-8">
          {/* Main info card */}
          <div className="bg-white border-2 border-[#1a1a1a] rounded-lg p-6 shadow-[4px_4px_0_#1a1a1a]">
            <div className="flex flex-wrap items-start justify-between gap-4 border-b-2 border-dashed border-gray-300 pb-6">
              <div>
                <p className="text-sm font-black text-[#4a4a4a] uppercase">
                  <button
                    type="button"
                    onClick={() => onNavigate({ page: 'season', season: episode.season })}
                    className="hover:text-[#7a2b0f] underline min-h-[44px] inline-flex items-center"
                  >
                    Season {episode.season}
                  </button>{' '}
                  / Episode {episode.episodeNumber}
                </p>
                <h1 className="mt-1 text-3xl md:text-4xl uppercase text-[#1a1a1a]">
                  {formatEpisodeCode(episode)}: {episode.title}
                </h1>
              </div>
              <div className="bg-yellow-200 border-2 border-[#1a1a1a] rounded-md px-5 py-4 text-right shadow-[2px_2px_0px_0px_#1a1a1a]">
                <p className="text-xs font-black uppercase tracking-[0.2em] text-[#4a4a4a]">
                  Normalized Avg
                </p>
                <p className="mt-1 text-3xl font-black text-[#1a1a1a]">
                  {average === null ? '--' : average.toFixed(1)} / 5
                </p>
                <a
                  href="/glossary#arbitrary-rating-units"
                  className="mt-1 inline-block text-xs font-bold text-[#1a6b6b] underline hover:text-[#7a2b0f]"
                >
                  Why the scales? &rarr; Glossary
                </a>
              </div>
            </div>

            <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <Info label="Air date" value={episode.airDate || 'Unknown'} />
              <Info label="Runtime" value={episode.runtime || '22 min'} />
              <Info label="IMDb" value={episode.imdbRating || '--'} />
              <Info label="Status" value={STATUS_LABEL[episode.watchStatus]} />
            </div>

            <div className="mt-6 border-t-2 border-dashed border-gray-200 pt-6">
              <p className="mb-2 text-xs font-black uppercase tracking-[0.35em] text-[#4a4a4a]">
                Synopsis
              </p>
              <p className="max-w-3xl text-sm font-medium leading-relaxed text-[#1a1a1a]">
                {episode.summary}
              </p>
            </div>

            {safePodcastUrl || safeYoutubeUrl || rssEmbed ? (
              <div className="mt-6 border-t-2 border-dashed border-gray-200 pt-6 space-y-4">
                <div className="flex flex-wrap gap-3">
                  {safePodcastUrl ? (
                    <a
                      href={rssEmbed?.pageUrl ?? safePodcastUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="primary-button"
                    >
                      Listen to Episode
                    </a>
                  ) : null}
                  {safeYoutubeUrl ? (
                    <a
                      href={safeYoutubeUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center justify-center min-h-[44px] px-5 py-2.5 rounded-md border-2 border-[#1a1a1a] bg-[#1a6b6b] text-white hover:bg-[#0f3f3f] text-sm font-bold uppercase tracking-wider shadow-[3px_3px_0_#1a1a1a] transition-colors"
                    >
                      Watch on YouTube
                    </a>
                  ) : null}
                </div>

                {rssEmbed ? (
                  <div className="border-2 border-[#1a1a1a] rounded-lg bg-[#222226] p-3 shadow-[3px_3px_0_#1a1a1a]">
                    <iframe
                      src={rssEmbed.embedUrl}
                      title={`Family Guy Guys podcast player: ${episode.title}`}
                      loading="lazy"
                      className="w-full h-[154px] rounded border-0 block"
                      allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                      allowFullScreen
                    />
                  </div>
                ) : null}
              </div>
            ) : null}
          </div>

          <details className="episode-credits-dossier">
            <summary className="dossier-summary">
              <div className="dossier-summary-left">
                <span className="dossier-kicker">Production Dossier</span>
                <span className="dossier-title">Episode Credits &amp; Production Facts</span>
              </div>
              <span className="dossier-toggle-pill">
                <span className="dossier-label-expand">Expand &#9662;</span>
                <span className="dossier-label-collapse">Collapse &#9652;</span>
              </span>
            </summary>
            <div className="dossier-body">
              <div className="dossier-grid">
                <DetailList title="Cast" items={episode.cast} variant="cast" />
                <DetailList title="Guest stars" items={filteredGuestStars} variant="guests" />
                <DetailList title="Writers" items={episode.writers} variant="writers" />
                <DetailList title="Director" items={directorsList} variant="director" />
              </div>

              {filteredFacts.length ? (
                <div className="dossier-facts-box">
                  <div className="dossier-facts-header">Metadata &amp; Production Facts</div>
                  <dl className="dossier-facts-grid">
                    {filteredFacts.map((fact) => (
                      <div key={`${fact.label}-${fact.value}`} className="dossier-fact-row">
                        <dt className="dossier-fact-label">{fact.label}</dt>
                        <dd className="dossier-fact-value">{fact.value}</dd>
                      </div>
                    ))}
                  </dl>
                </div>
              ) : null}
            </div>
          </details>

          {/* Host ratings */}
          <div>
            <div className="inline-block bg-[#e8841a] border-2 border-[#1a1a1a] px-4 py-2 mb-6 shadow-[2px_2px_0px_0px_#1a1a1a] text-[#1a1a1a]">
              <h2 className="text-xl uppercase tracking-wide text-[#1a1a1a]">
                HOST RATINGS FOR THIS EPISODE
              </h2>
            </div>
            <div className="space-y-6">
              {episode.reviews.map((review) => {
                const host = dataset.cohosts.find((item) => item.id === review.cohostId);
                if (!host) return null;
                return (
                  <HostReviewRow
                    key={review.cohostId}
                    host={host}
                    review={review}
                    ratingLabel={dataset.ratingScale.label}
                  />
                );
              })}
            </div>
          </div>

          {/* Visitor Reviews Feed & Composer */}
          <VisitorReviewsSection episodeId={episode.id} />

          {/* Spoken Transcript Section */}
          <section className="episode-transcript-container" aria-label="Episode Transcript">
            {introNotes ? (
              <div className="episode-editorial-intro" aria-label="Transcript Overview">
                <h2 className="intro-heading">Transcript Overview &amp; Notes</h2>
                <p className="intro-text">{introNotes}</p>
              </div>
            ) : null}
            {transcriptLoading ? (
              <div className="episode-transcript-wrapper" role="status" aria-live="polite">
                <div className="transcript-header-bar">
                  <h2 className="transcript-section-title">Full Spoken Podcast Transcript</h2>
                </div>
                <div className="no-transcript-fallback">
                  <p className="no-transcript-msg">Loading full episode transcript…</p>
                  <p className="no-transcript-sub">
                    Fetching timestamped conversation logs from the Family Guy Guys archive.
                  </p>
                </div>
              </div>
            ) : hasTranscript ? (
              <details
                className="episode-transcript-wrapper transcript-collapse"
                id="transcript-details"
              >
                <summary className="transcript-header-bar transcript-summary">
                  <h2 className="transcript-section-title">Full Spoken Podcast Transcript</h2>
                  <div className="transcript-summary-meta">
                    <span className="transcript-wordcount">
                      {transcript?.word_count
                        ? `${transcript.word_count.toLocaleString()} words`
                        : 'Full Length'}
                    </span>
                    <span className="transcript-expand-badge">
                      <span className="transcript-expand-text">Read Transcript</span>
                      <span className="transcript-expand-icon" aria-hidden="true">
                        &#9662;
                      </span>
                    </span>
                  </div>
                </summary>
                <div className="transcript-body" id="prerendered-transcript">
                  <div className="transcript-layout-grid">
                    {transcriptSections.length > 1 ? (
                      <aside className="transcript-toc" aria-label="Transcript Topics">
                        <details className="toc-mobile-details" open>
                          <summary className="toc-summary">
                            <span className="toc-title">Episode Topics</span>
                            <span className="toc-badge">{transcriptSections.length} topics</span>
                            <span className="toc-chevron" aria-hidden="true">
                              &#9662;
                            </span>
                          </summary>
                          <ul className="toc-list">
                            {transcriptSections.map((sec) => (
                              <li key={sec.id}>
                                <a href={`#${sec.id}`} className="toc-link">
                                  <span className="toc-time">
                                    {formatSeconds(sec.start_seconds ?? 0)}
                                  </span>
                                  <span className="toc-heading">{sec.heading}</span>
                                </a>
                              </li>
                            ))}
                          </ul>
                        </details>
                      </aside>
                    ) : null}

                    <div className="transcript-sections-list">
                      {transcriptSections.map((section) => (
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
                              {formatSeconds(section.start_seconds ?? 0)} –{' '}
                              {formatSeconds(section.end_seconds ?? 0)}
                            </span>
                          </div>
                          <div className="section-entries">
                            {(section.entries || []).map((entry, idx) => {
                              const speakerName = entry.speaker || 'Host';
                              const speakerSlug = speakerName
                                .toLowerCase()
                                .replace(/[^a-z0-9]/g, '');
                              return (
                                <div
                                  key={`${section.id}-e${idx}`}
                                  className={`dialogue-entry speaker-${speakerSlug}`}
                                >
                                  <div className="entry-header">
                                    <span className="speaker-label">{speakerName}</span>
                                    <span className="timestamp-label">
                                      {formatSeconds(entry.start_seconds ?? 0)}
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
                </div>
              </details>
            ) : (
              <div className="episode-transcript-wrapper">
                <div className="transcript-header-bar">
                  <h2 className="transcript-section-title">Full Spoken Podcast Transcript</h2>
                </div>
                <div className="no-transcript-fallback">
                  <p className="no-transcript-msg">
                    The full transcribed conversation for this episode is currently being curated.
                  </p>
                  <p className="no-transcript-sub">
                    Listen to the complete audio discussion above, or explore other reviewed
                    episodes.
                  </p>
                </div>
              </div>
            )}
          </section>

          {/* Bottom adjacent navigation */}
          <div className="mt-12 pt-6 border-t-4 border-[#1a1a1a] flex flex-wrap items-center justify-between gap-4 font-sans">
            <button
              type="button"
              onClick={() => onNavigate({ page: 'catalog' })}
              className="text-link min-h-[44px] inline-flex items-center focus:ring-2 focus:ring-[#1a1a1a] focus:outline-none"
            >
              ← Back to catalog
            </button>
            <div className="flex items-center gap-3 text-sm font-black uppercase max-w-full min-w-0">
              {prevEpisode && (
                <button
                  type="button"
                  onClick={() => onNavigate({ page: 'episode', id: prevEpisode.id })}
                  className="px-3.5 py-2.5 border-2 border-[#1a1a1a] hover:bg-yellow-50 bg-white shadow-[2px_2px_0px_0px_#1a1a1a] active:translate-y-0.5 active:shadow-none min-h-[44px] inline-flex items-center justify-center focus:ring-2 focus:ring-[#1a1a1a] focus:outline-none max-w-full min-w-0"
                  aria-label={`Previous episode: ${formatEpisodeCode(prevEpisode)}, ${prevEpisode.title}`}
                >
                  <span className="flex-shrink-0">
                    &larr;&nbsp;{formatEpisodeCode(prevEpisode)}
                  </span>
                  <span className="hidden sm:inline truncate max-w-[240px]">
                    : {prevEpisode.title}
                  </span>
                </button>
              )}
              {nextEpisode && (
                <button
                  type="button"
                  onClick={() => onNavigate({ page: 'episode', id: nextEpisode.id })}
                  className="px-3.5 py-2.5 border-2 border-[#1a1a1a] hover:bg-yellow-50 bg-white shadow-[2px_2px_0px_0px_#1a1a1a] active:translate-y-0.5 active:shadow-none min-h-[44px] inline-flex items-center justify-center focus:ring-2 focus:ring-[#1a1a1a] focus:outline-none max-w-full min-w-0"
                  aria-label={`Next episode: ${formatEpisodeCode(nextEpisode)}, ${nextEpisode.title}`}
                >
                  <span className="hidden sm:inline truncate max-w-[240px]">
                    {nextEpisode.title}:{' '}
                  </span>
                  <span className="flex-shrink-0">
                    {formatEpisodeCode(nextEpisode)}&nbsp;&rarr;
                  </span>
                </button>
              )}
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}

function HostReviewRow({
  host,
  review,
  ratingLabel,
}: {
  host: Cohost;
  review: Review;
  ratingLabel: string;
}) {
  const mapped =
    COHOST_NAME_MAP[host.id.toLowerCase()] || COHOST_NAME_MAP[host.name?.toLowerCase()];
  const name = mapped?.name ?? host.name;
  const photoUrl = mapped?.photo;
  const theme = getHostTheme(host.id);
  const [imgError, setImgError] = useState(false);

  const ratingDisplay = getNativeRatingDisplay(review, ratingLabel);

  const initials = name
    .split(/\s+/)
    .map((part) => part[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();

  return (
    <div className="flex flex-col sm:flex-row gap-4 items-start bg-white border-2 border-[#1a1a1a] rounded-lg p-4 transition-transform duration-100">
      <div className="flex-shrink-0 self-start">
        {photoUrl && !imgError ? (
          <img
            src={photoUrl}
            alt={name}
            className="w-20 h-20 object-contain filter contrast-125 shrink-0"
            onError={() => setImgError(true)}
          />
        ) : (
          <div
            className={`w-20 h-20 grid place-items-center border-2 border-[#1a1a1a] font-black overflow-hidden relative ${theme.textClass}`}
            style={{ backgroundColor: theme.fallbackBg }}
          >
            <span className="absolute inset-0 flex items-center justify-center bg-transparent z-0">
              {initials}
            </span>
            <div className="absolute bottom-0 inset-x-0 bg-[#1a1a1a] text-white text-xs font-black uppercase text-center py-0.5 tracking-wider leading-none z-10">
              {name.split(' ')[0].toUpperCase()}
            </div>
          </div>
        )}
      </div>

      <div className="flex-grow w-full text-[#1a1a1a]">
        <div
          className={`border-2 border-[#1a1a1a] p-2 mb-2.5 flex flex-wrap items-center justify-between rounded-md ${theme.bgClass}`}
        >
          <span className="font-black text-xs uppercase tracking-wider">
            {name.split(' ')[0]}'S METRIC
          </span>
          <HostScoreDisplay ratingDisplay={ratingDisplay} />
        </div>
        {review.pullQuote && (
          <p className="mb-1 text-xs font-black text-[#7a2b0f] leading-normal">
            "{review.pullQuote}"
          </p>
        )}
        <p className="font-medium text-xs md:text-sm leading-relaxed text-[#1a1a1a] whitespace-pre-wrap">
          {review.review || 'No review yet.'}
        </p>
      </div>
    </div>
  );
}

function HostScoreDisplay({
  ratingDisplay,
}: {
  ratingDisplay: ReturnType<typeof getNativeRatingDisplay>;
}) {
  return (
    <div className="flex items-center gap-1 shrink-0">
      {ratingDisplay.value === null ? (
        <span className="bg-[#1a1a1a] text-white font-black text-xs px-2 py-0.5 border border-white leading-none">
          Not Rated
        </span>
      ) : ratingDisplay.scaleMax === 100 ? (
        <div className="flex items-center gap-1.5">
          <div className="w-16 bg-white border border-[#1a1a1a] h-2.5 relative overflow-hidden">
            <div
              className="bg-[#ff72c7] h-full border-r border-[#1a1a1a]"
              style={{ width: `${Math.min(100, Math.max(0, ratingDisplay.value))}%` }}
            />
          </div>
          <span className="bg-[#1a1a1a] text-white font-black text-xs px-2 py-0.5 border border-white leading-none">
            {ratingDisplay.formatted}
          </span>
        </div>
      ) : (
        <div className="flex items-center gap-1">
          {[1, 2, 3, 4, 5].map((s) => (
            <Star
              key={s}
              size={14}
              fill={s <= Math.round(ratingDisplay.value!) ? '#ffffff' : 'transparent'}
              className="stroke-[2.5] text-[#1a1a1a]"
            />
          ))}
          <span className="bg-[#1a1a1a] text-white font-black text-xs px-2 py-0.5 ml-1 border border-white leading-none">
            {ratingDisplay.formatted}
          </span>
        </div>
      )}
    </div>
  );
}

function SeasonPage({
  dataset,
  season,
  onNavigate,
}: {
  dataset: PodcastDataset;
  season: number;
  onNavigate: (route: Route) => void;
}) {
  const statusCounts = countSeasonStatuses(dataset.episodes, season);
  const episodes = dataset.episodes
    .filter((episode) => episode.season === season)
    .filter((episode) => episode.watchStatus === 'published')
    .sort(compareEpisodes);

  return (
    <div className="animate-rise mt-4">
      <div className="mb-4">
        <button
          type="button"
          onClick={() => onNavigate({ page: 'catalog' })}
          className="text-link min-h-[44px] inline-flex items-center"
        >
          &larr; Back to catalog
        </button>
      </div>
      <header className="mb-6 border-b-4 border-[#1a1a1a] pb-4">
        <h1 className="text-4xl md:text-6xl uppercase tracking-tight leading-none">
          Season {season}
        </h1>
      </header>
      <h2 className="sr-only">Season status counts</h2>
      <div className="mt-6 grid gap-4 sm:grid-cols-4">
        {STATUS_ORDER.map((status) => (
          <Info key={status} label={STATUS_LABEL[status]} value={String(statusCounts[status])} />
        ))}
      </div>
      <h2 className="mt-10 text-2xl uppercase tracking-tight">Published Episodes</h2>
      <div className="mt-4 grid gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {episodes.map((episode) => (
          <EpisodeTile
            key={episode.id}
            episode={episode}
            ratingLabel={dataset.ratingScale.label}
            onOpen={() => onNavigate({ page: 'episode', id: episode.id })}
          />
        ))}
      </div>
      {!episodes.length ? (
        <EmptyState
          title="No published episodes yet"
          copy="Check back soon — no episodes are published for this season yet."
          actionLabel="Back to catalog"
          onAction={() => onNavigate({ page: 'catalog' })}
        />
      ) : null}
    </div>
  );
}

function HostPage({
  dataset,
  hostId,
  onNavigate,
}: {
  dataset: PodcastDataset;
  hostId: string;
  onNavigate: (route: Route) => void;
}) {
  const host = findHostByRouteId(dataset.cohosts, hostId, COHOST_NAME_MAP);
  if (!host) {
    return (
      <EmptyState
        title="Host not found"
        copy="This profile does not exist in the loaded dataset."
        actionLabel="Back to catalog"
        onAction={() => onNavigate({ page: 'catalog' })}
        headingLevel="h1"
      />
    );
  }

  const hostReviews = dataset.episodes
    .map((episode) => ({
      episode,
      review: episode.reviews.find((review) => review.cohostId === host.id),
    }))
    .filter((item): item is { episode: Episode; review: Review } => Boolean(item.review))
    .filter((item) => item.episode.watchStatus === 'published');

  const average = computeNormalizedAverage(hostReviews.map((item) => item.review));

  const mapped =
    COHOST_NAME_MAP[host.id.toLowerCase()] || COHOST_NAME_MAP[host.name?.toLowerCase()];
  const name = mapped?.name ?? host.name;
  const role = mapped?.role ?? host.role;
  const firstName = name.split(' ')[0];
  const theme = getHostTheme(host.id);
  const otherCohosts = dataset.cohosts.filter((item) => item.id !== host.id);

  return (
    <div className="animate-rise mt-4">
      <div className="mb-4">
        <button
          type="button"
          onClick={() => onNavigate({ page: 'catalog' })}
          className="text-link min-h-[44px] inline-flex items-center"
        >
          &larr; Back to catalog
        </button>
      </div>
      <div className="grid gap-8 lg:grid-cols-[330px_minmax(0,1fr)] items-start">
        <aside>
          <div className="border-2 border-[#1a1a1a] rounded-xl bg-white text-[#1a1a1a] shadow-[4px_4px_0_#1a1a1a] overflow-hidden">
            <div className={`${theme.bgClass} border-b-2 border-[#1a1a1a] p-6 text-center`}>
              <div className="w-24 h-24 mx-auto mb-4 rounded-xl border-2 border-[#1a1a1a] bg-white shadow-[3px_3px_0_#1a1a1a] overflow-hidden flex items-center justify-center">
                <Avatar host={host} large />
              </div>
              <h2 className="text-3xl uppercase text-white tracking-wide leading-tight">{name}</h2>
              <span className="inline-block mt-2 bg-[#1a1a1a] text-white text-xs font-black uppercase tracking-widest px-3 py-1 rounded border border-white leading-none">
                {role}
              </span>
            </div>

            <div className="p-5 sm:p-6 bg-white space-y-5">
              {host.bio ? (
                <div className="bg-[#f5f4f0] border-2 border-[#1a1a1a] rounded-lg p-4 text-sm sm:text-base font-bold leading-relaxed text-[#1a1a1a] text-center shadow-[2px_2px_0_#1a1a1a]">
                  "{host.bio}"
                </div>
              ) : null}

              <div className="grid grid-cols-2 gap-3 items-stretch">
                <Info label="Reviews" value={String(hostReviews.length)} />
                <div className="flex flex-col justify-between min-h-[88px] bg-yellow-200 border-2 border-[#1a1a1a] rounded-lg p-3.5 shadow-[2px_2px_0_#1a1a1a] text-[#1a1a1a]">
                  <p className="text-xs font-black uppercase tracking-wider text-[#4a4a4a] leading-tight">
                    Normalized Avg
                  </p>
                  <p className="mt-auto pt-2 text-2xl font-black text-[#1a1a1a] leading-none">
                    {average === null ? '--' : `${average.toFixed(1)} / 5`}
                  </p>
                </div>
              </div>

              {otherCohosts.length > 0 ? (
                <div className="pt-4" style={{ borderTop: '2px dashed #d1d5db' }}>
                  <p className="text-xs font-black uppercase tracking-[0.2em] text-[#4a4a4a] mb-2.5">
                    Other Hosts
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {otherCohosts.map((other) => {
                      const otherMapped =
                        COHOST_NAME_MAP[other.id.toLowerCase()] ||
                        COHOST_NAME_MAP[other.name?.toLowerCase()];
                      const otherName = (otherMapped?.name ?? other.name).split(' ')[0];
                      const otherTheme = getHostTheme(other.id);
                      return (
                        <button
                          key={other.id}
                          type="button"
                          onClick={() => onNavigate({ page: 'host', id: other.id })}
                          className={`min-h-[44px] flex-1 px-3 py-2 rounded-md border-2 border-[#1a1a1a] font-bold text-xs uppercase tracking-wider shadow-[2px_2px_0_#1a1a1a] hover:translate-y-[-1px] transition-transform ${otherTheme.bgClass}`}
                        >
                          {otherName}
                        </button>
                      );
                    })}
                  </div>
                </div>
              ) : null}
            </div>
          </div>
        </aside>

        <section>
          <header className="bg-white border-2 border-[#1a1a1a] rounded-xl p-5 sm:p-6 shadow-[4px_4px_0_#1a1a1a] mb-6 flex flex-wrap items-center justify-between gap-4">
            <div>
              <span
                className={`inline-block px-3 py-1 rounded border-2 border-[#1a1a1a] text-xs font-black uppercase tracking-widest mb-2 ${theme.bgClass}`}
              >
                Host Critique Log
              </span>
              <h1 className="text-3xl md:text-5xl uppercase tracking-tight leading-none text-[#1a1a1a]">
                {firstName}'s Reviews
              </h1>
            </div>
            <div className="bg-[#f5f4f0] border-2 border-[#1a1a1a] rounded-lg px-4 py-2.5 text-center shadow-[2px_2px_0_#1a1a1a]">
              <p className="text-xs font-black uppercase tracking-wider text-[#4a4a4a]">Logged</p>
              <p className="text-2xl font-black text-[#1a1a1a] leading-none mt-1">
                {hostReviews.length}
              </p>
            </div>
          </header>

          <h2 className="sr-only">Reviewed Episodes</h2>
          <div className="space-y-4">
            {hostReviews.map(({ episode, review }) => {
              const display = getNativeRatingDisplay(review, dataset.ratingScale.label);
              const thumbSrc =
                (episode.thumbnailStatus === 'uploaded' || episode.thumbnailStatus === 'manual') &&
                episode.thumbnailUrl
                  ? episode.thumbnailUrl
                  : null;
              return (
                <button
                  key={episode.id}
                  type="button"
                  onClick={() => onNavigate({ page: 'episode', id: episode.id })}
                  className="group flex flex-col sm:flex-row gap-4 w-full text-left bg-white border-2 border-[#1a1a1a] rounded-xl p-4 sm:p-5 shadow-[4px_4px_0_#1a1a1a] hover:translate-x-[-1px] hover:translate-y-[-1px] hover:shadow-[5px_5px_0_#1a1a1a] transition-all text-[#1a1a1a]"
                >
                  <div className="w-full sm:w-44 aspect-video rounded-lg border-2 border-[#1a1a1a] overflow-hidden bg-[#f5f4f0] shrink-0 shadow-[2px_2px_0_#1a1a1a] flex items-center justify-center">
                    {thumbSrc ? (
                      <img
                        src={thumbSrc}
                        alt={`Family Guy — ${episode.title}`}
                        className="w-full h-full object-cover"
                        loading="lazy"
                      />
                    ) : (
                      <span className="text-xs font-black uppercase tracking-widest text-[#4a4a4a]">
                        {formatEpisodeCode(episode)}
                      </span>
                    )}
                  </div>

                  <div className="flex-1 min-w-0">
                    <div
                      className={`border-2 border-[#1a1a1a] rounded-md px-3 py-2 mb-3 flex flex-wrap items-center justify-between gap-2 ${theme.bgClass}`}
                    >
                      <h3 className="text-sm sm:text-base font-black uppercase leading-tight text-white">
                        {formatEpisodeCode(episode)}: {episode.title}
                      </h3>
                      <HostScoreDisplay ratingDisplay={display} />
                    </div>

                    {review.pullQuote ? (
                      <p className="mb-1.5 text-sm font-black text-[#7a2b0f] leading-snug">
                        "{review.pullQuote}"
                      </p>
                    ) : null}

                    <p className="text-sm font-medium leading-relaxed text-[#1a1a1a] line-clamp-3">
                      {review.review || 'No review yet.'}
                    </p>

                    <p className="mt-3 text-xs font-black uppercase tracking-wider text-[#1a6b6b] group-hover:text-[#7a2b0f]">
                      Read Full Episode Review &rarr;
                    </p>
                  </div>
                </button>
              );
            })}
          </div>
        </section>
      </div>
    </div>
  );
}

function EpisodePoster({
  episode,
  ratingScale,
  size = 'card',
}: {
  episode: Episode;
  ratingScale: string;
  size?: 'card' | 'hero' | 'detail' | 'mini';
}) {
  const average = computeNormalizedAverage(episode.reviews);
  const [imageFailed, setImageFailed] = useState(false);

  const thumbnailUrl =
    (episode.thumbnailStatus === 'uploaded' || episode.thumbnailStatus === 'manual') &&
    episode.thumbnailUrl &&
    !imageFailed
      ? episode.thumbnailUrl
      : null;

  if (size === 'mini') {
    return (
      <div className="relative overflow-hidden border-2 border-[#1a1a1a] p-2 bg-white w-[116px] min-h-[120px] flex flex-col justify-between text-[#1a1a1a] rounded-md shrink-0 shadow-[2px_2px_0_#1a1a1a]">
        <div className="text-xs font-black uppercase text-[#4a4a4a] leading-none">
          {formatEpisodeCode(episode)}
        </div>

        <div className="h-10 w-full border border-[#1a1a1a] bg-[#f5f4f0] overflow-hidden relative my-1 flex items-center justify-center rounded">
          {thumbnailUrl ? (
            <img
              src={thumbnailUrl}
              alt={`Family Guy — ${episode.title}`}
              className="w-full h-full object-cover"
              onError={() => setImageFailed(true)}
            />
          ) : (
            <svg
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.5"
              className="w-4 h-4 text-[#4a4a4a]"
              aria-hidden="true"
            >
              <rect x="2" y="7" width="20" height="15" rx="2" ry="2" />
              <polyline points="17 2 12 7 7 2" />
            </svg>
          )}
        </div>

        <h3 className="text-xs font-black leading-tight text-[#1a1a1a] uppercase truncate w-full">
          {episode.title}
        </h3>

        <div className="border-t border-black/15 pt-1 text-xs text-[#4a4a4a] font-bold flex justify-between items-center leading-none">
          <span>
            {average === null ? '--' : average.toFixed(1)}/5 {ratingScale.slice(0, 3)}
          </span>
        </div>
      </div>
    );
  }

  const titleClass = size === 'hero' || size === 'detail' ? 'text-2xl' : 'text-xl';

  return (
    <div className="poster-shine relative overflow-hidden border-2 border-[#1a1a1a] p-3.5 rounded-lg bg-white aspect-[4/5] shadow-[3px_3px_0_#1a1a1a] flex flex-col justify-between text-[#1a1a1a]">
      <div className="flex items-center justify-between text-xs font-extrabold uppercase tracking-[0.2em] text-[#4a4a4a]">
        <span>{formatEpisodeCode(episode)}</span>

        <span className="bg-[#1a1a1a] text-white px-1.5 py-0.5 border border-[#1a1a1a] font-black rounded">
          {STATUS_LABEL[episode.watchStatus]}
        </span>
      </div>

      <div className="text-[#1a1a1a]">
        <div className="mb-3 aspect-[16/9] w-full border-2 border-[#1a1a1a] bg-[#f5f4f0] overflow-hidden relative flex items-center justify-center rounded">
          {thumbnailUrl ? (
            <img
              src={thumbnailUrl}
              alt={`Family Guy — ${episode.title}`}
              className="w-full h-full object-cover"
              loading={size === 'detail' ? 'eager' : 'lazy'}
              onError={() => setImageFailed(true)}
            />
          ) : (
            <div
              className="flex items-center justify-center h-full w-full bg-[#f5f4f0]"
              aria-hidden="true"
            >
              <svg
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.5"
                className="w-10 h-10 text-[#4a4a4a]"
              >
                <rect x="2" y="7" width="20" height="15" rx="2" ry="2" />
                <polyline points="17 2 12 7 7 2" />
              </svg>
            </div>
          )}
        </div>

        {size === 'detail' ? (
          <p className={`${titleClass} font-black leading-tight text-[#1a1a1a] uppercase`}>
            {episode.title}
          </p>
        ) : (
          <h3 className={`${titleClass} font-black leading-tight text-[#1a1a1a] uppercase`}>
            {episode.title}
          </h3>
        )}

        <div className="mt-4 flex items-center justify-between gap-4 border-t-2 border-black/15 pt-3 text-sm text-[#4a4a4a] font-bold">
          <span>{episode.airDate}</span>

          <span>{average === null ? '--' : `${average.toFixed(1)} / 5`}</span>
        </div>
      </div>
    </div>
  );
}

function Info({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-col justify-between min-h-[88px] bg-[#f5f4f0] border-2 border-[#1a1a1a] rounded-lg p-3.5 shadow-[2px_2px_0_#1a1a1a] text-[#1a1a1a]">
      <p className="text-xs font-black uppercase tracking-wider text-[#4a4a4a] leading-tight">
        {label}
      </p>
      <p className="mt-auto pt-2 text-lg font-extrabold text-[#1a1a1a] leading-snug">{value}</p>
    </div>
  );
}

function SidePanel({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="bg-white border-2 border-[#1a1a1a] rounded-lg p-5 text-[#1a1a1a] shadow-[3px_3px_0_#1a1a1a]">
      <h2 className="text-xl text-[#1a1a1a] uppercase tracking-wider">{title}</h2>
      <div className="mt-4">{children}</div>
    </section>
  );
}

type DossierVariant = 'cast' | 'guests' | 'writers' | 'director';

function DetailList({
  title,
  items,
  variant = 'cast',
}: {
  title: string;
  items: string[];
  variant?: DossierVariant;
}) {
  return (
    <div className="dossier-card">
      <div className={`dossier-card-header dossier-card-header--${variant}`}>
        <span>{title}</span>
        {items.length ? <span className="dossier-count">{items.length}</span> : null}
      </div>
      <ul className="dossier-chip-list">
        {items.length ? (
          items.map((item) => (
            <li key={item} className="dossier-chip">
              {item}
            </li>
          ))
        ) : (
          <li className="dossier-chip dossier-chip--empty">None listed</li>
        )}
      </ul>
    </div>
  );
}

function Avatar({ host, large = false }: { host: Cohost; large?: boolean }) {
  const mapped =
    COHOST_NAME_MAP[host.id.toLowerCase()] || COHOST_NAME_MAP[host.name?.toLowerCase()];
  const photoUrl = mapped?.photo;
  const name = mapped?.name ?? host.name;
  const initials = name
    .split(/\s+/)
    .map((part) => part[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();
  const [imageError, setImageError] = useState(false);

  if (photoUrl && !imageError) {
    return (
      <img
        src={photoUrl}
        alt={name}
        className={`object-contain filter contrast-125 shrink-0 ${large ? 'h-24 w-24' : 'h-11 w-11'}`}
        onError={() => setImageError(true)}
      />
    );
  }

  const theme = getHostTheme(host.id);
  return (
    <div
      className={`grid shrink-0 place-items-center border-2 border-[#1a1a1a] font-black overflow-hidden relative ${theme.textClass} ${large ? 'h-24 w-24 text-3xl' : 'h-11 w-11 text-sm'}`}
      style={{ backgroundColor: theme.fallbackBg }}
    >
      <span className="absolute inset-0 flex items-center justify-center bg-transparent z-0">
        {initials}
      </span>
    </div>
  );
}

function ProgressBar({ value }: { value: number }) {
  return (
    <div className="mt-2.5 h-3 overflow-hidden border-2 border-[#1a1a1a] bg-white">
      <div
        className="h-full bg-[#1a1a1a]"
        style={{ width: `${Math.max(2, Math.min(100, value))}%` }}
      />
    </div>
  );
}

function EmptyState({
  title,
  copy,
  actionLabel,
  onAction,
  headingLevel = 'h3',
}: {
  title: string;
  copy: string;
  actionLabel?: string;
  onAction?: () => void;
  headingLevel?: 'h1' | 'h2' | 'h3';
}) {
  const HeadingTag = headingLevel;
  return (
    <div className="mt-8 rounded-lg border-2 border-[#1a1a1a] bg-white p-8 text-center text-[#1a1a1a] shadow-[3px_3px_0_#1a1a1a]">
      <HeadingTag className="text-2xl font-black uppercase text-[#1a1a1a]">{title}</HeadingTag>
      <p className="mt-2 text-sm font-medium text-[#4a4a4a]">{copy}</p>
      {actionLabel && onAction ? (
        <button type="button" onClick={onAction} className="primary-button mt-5">
          {actionLabel}
        </button>
      ) : null}
    </div>
  );
}

function parsePath(): Route {
  if (typeof window === 'undefined') return { page: 'catalog' };
  const path = window.location.pathname;
  if (path.startsWith('/reviews')) {
    const subpath = path.slice('/reviews'.length);
    if (subpath.startsWith('/season/')) {
      const seasonNum = Number(subpath.split('/')[2]);
      if (!isNaN(seasonNum)) return { page: 'season', season: seasonNum };
    }
    if (subpath.startsWith('/host/')) {
      const hostId = decodeURIComponent(subpath.split('/')[2]);
      if (hostId) return { page: 'host', id: hostId };
    }
    if (subpath.startsWith('/')) {
      const episodeId = decodeURIComponent(subpath.slice(1));
      if (episodeId) return { page: 'episode', id: episodeId };
    }
  }
  return { page: 'catalog' };
}

function routeToPath(route: Route): string {
  if (route.page === 'catalog') return '/reviews';
  if (route.page === 'episode') return `/reviews/${encodeURIComponent(route.id)}`;
  if (route.page === 'season') return `/reviews/season/${route.season}`;
  return `/reviews/host/${encodeURIComponent(route.id)}`;
}

function alignReviews(reviews: Review[], cohosts: Cohost[]): Review[] {
  const map = new Map(reviews.map((review) => [review.cohostId, review]));
  return cohosts.map(
    (host) =>
      map.get(host.id) ?? {
        cohostId: host.id,
        rating: null,
        review: '',
        pullQuote: '',
        draftSource: 'manual',
      }
  );
}

function searchableEpisodeText(episode: Episode): string {
  return [
    episode.id,
    formatEpisodeCode(episode),
    episode.title,
    episode.summary,
    episode.cast.join(' '),
    episode.guestStars.join(' '),
    episode.writers.join(' '),
    episode.director,
    episode.transcriptNotes,
    episode.reviews.map((review) => `${review.review} ${review.pullQuote ?? ''}`).join(' '),
  ]
    .join(' ')
    .toLowerCase();
}

function getSeasons(episodes: Episode[]): number[] {
  return Array.from(new Set(episodes.map((episode) => episode.season))).sort(
    (left, right) => left - right
  );
}

function compareEpisodes(left: Episode, right: Episode): number {
  if (left.season !== right.season) return left.season - right.season;
  return left.episodeNumber - right.episodeNumber;
}

function seasonProgress(episodes: Episode[]): number {
  if (!episodes.length) return 0;
  const weights: Record<WatchStatus, number> = {
    backlog: 0,
    watched: 33,
    recorded: 66,
    published: 100,
  };
  return episodes.reduce((sum, episode) => sum + weights[episode.watchStatus], 0) / episodes.length;
}

function formatEpisodeCode(episode: Pick<Episode, 'season' | 'episodeNumber'>): string {
  return `S${String(episode.season).padStart(2, '0')}E${String(episode.episodeNumber).padStart(2, '0')}`;
}

export default App;
