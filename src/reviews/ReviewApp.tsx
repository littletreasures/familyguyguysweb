import { useEffect, useMemo, useState } from "react";
import { supabase } from "./lib/supabase";
import { navigateTo } from "../router.js";
import { Star, ThumbsUp, Sliders, AlertCircle } from "lucide-react";

type WatchStatus = "backlog" | "watched" | "recorded" | "published";

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
  draftSource?: "manual" | "transcript";
  updatedAt?: string;
  ratingTerminology?: string;
  ratingScaleMax?: number;
};

type EpisodeFact = {
  label: string;
  value: string;
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
  transcriptNotes: string;
  reviews: Review[];
};

type PodcastDataset = {
  schemaVersion: "fg-letterlog-v2";
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
  | { page: "catalog" }
  | { page: "episode"; id: string }
  | { page: "season"; season: number }
  | { page: "host"; id: string }
  | { page: "pipeline" }
  | { page: "fg-admin" };

const STATUS_ORDER: WatchStatus[] = ["backlog", "watched", "recorded", "published"];
const STATUS_LABEL: Record<WatchStatus, string> = {
  backlog: "Backlog",
  watched: "Watched",
  recorded: "Recorded",
  published: "Published",
};
const STATUS_TONE: Record<WatchStatus, string> = {
  backlog: "border-slate-500/30 bg-slate-500/10 text-slate-300",
  watched: "border-blue-300/30 bg-blue-300/10 text-blue-200",
  recorded: "border-amber-300/30 bg-amber-300/10 text-amber-200",
  published: "border-emerald-300/30 bg-emerald-300/10 text-emerald-200",
};
const PALETTE = ["#65e4d3", "#f7c948", "#a78bfa", "#fb7185", "#38bdf8", "#f97316"];

function cohostFromRow(row: any): Cohost {
  return {
    id: row.id,
    name: row.name,
    role: row.role,
    bio: row.bio,
    accent: row.accent,
  };
}

function reviewFromRow(row: any): Review {
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

function episodeFromRow(row: any): Episode {
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
    podcastUrl: row.podcast_url,
    transcriptNotes: row.transcript_notes,
    reviews: [],
  };
}

function configFromRow(row: any) {
  return {
    showName: row?.show_name ?? "Family Guy Guys",
    subtitle: row?.subtitle ?? "Join Collin, Tyler, and Jason as they watch and review every single episode of Family Guy in chronological order.",
    ratingScale: {
      label: row?.rating_label ?? "Quahogs",
      max: row?.rating_max ?? 5,
    },
  };
}

function buildDataset(
  cohostsRaw: any[],
  episodesRaw: any[],
  reviewsRaw: any[],
  configRaw: any,
): PodcastDataset {
  const cohosts = cohostsRaw.map(cohostFromRow);
  const config = configFromRow(configRaw);

  const episodes = episodesRaw.map((row) => {
    const episode = episodeFromRow(row);
    episode.reviews = alignReviews(
      reviewsRaw
        .filter((r) => r.episode_id === episode.id)
        .map(reviewFromRow),
      cohosts,
    );
    return episode;
  });

  return {
    schemaVersion: "fg-letterlog-v2",
    showName: config.showName,
    subtitle: config.subtitle,
    ratingScale: config.ratingScale,
    cohosts,
    episodes: episodes.sort(compareEpisodes),
  };
}

const demoDataset = createDemoDataset();

const schemaTemplate = JSON.stringify(
  {
    schemaVersion: "fg-letterlog-v2",
    showName: "Family Guy Guys",
    subtitle: "Join Collin, Tyler, and Jason as they watch and review every single episode of Family Guy in chronological order.",
    ratingScale: { label: "Quahogs", max: 5 },
    cohosts: [
      {
        id: "collin",
        name: "Collin Brown",
        role: "Host",
        bio: "Longtime improv comedian, lifelong Family Guy apologist.",
        accent: "#65e4d3",
      },
    ],
    episodes: [
      {
        id: "s01e01-death-has-a-shadow",
        season: 1,
        episodeNumber: 1,
        title: "Death Has a Shadow",
        airDate: "1999-01-31",
        runtime: "22 min",
        imdbRating: "7.4",
        watchStatus: "recorded",
        podcastUrl: "https://example.com/podcast/s01e01",
        summary: "Short episode summary from your metadata or transcript workflow.",
        transcriptNotes: "Optional production notes from the recording.",
        cast: ["Seth MacFarlane as Peter Griffin"],
        guestStars: [],
        writers: ["Seth MacFarlane", "David Zuckerman"],
        director: "Peter Shin",
        facts: [{ label: "Production code", value: "1ACX01" }],
        reviews: [
          {
            cohostId: "collin",
            rating: 4,
            review: "Edited review text.",
            pullQuote: "Strong pilot energy.",
            draftSource: "manual",
          },
        ],
      },
    ],
  },
  null,
  2,
);



function App() {
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [retryCount, setRetryCount] = useState(0);
  const [dataset, setDataset] = useState<PodcastDataset>(demoDataset);
  const [selectedCohostId, setSelectedCohostId] = useState(
    demoDataset.cohosts[0].id,
  );
  const [route, setRoute] = useState<Route>(() => parsePath());
  const [search, setSearch] = useState("");
  const [seasonFilter, setSeasonFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState<WatchStatus | "all">("all");
  const [jsonText, setJsonText] = useState(schemaTemplate);
  const [importMessage, setImportMessage] = useState("Demo v2 dataset loaded.");
  const [importError, setImportError] = useState("");


  // The secure SHA-256 hash of the admin password
  // Default: giggity
  const ADMIN_HASH = "1e021f487c656e1e90d621e588fcc8d40d0faded69d3f76f379a07a289381250";

  // Admin mode: loaded securely from localStorage token and compared against ADMIN_HASH
  const [isAdmin, setIsAdmin] = useState(() => {
    if (typeof window !== "undefined") {
      const token = localStorage.getItem("fg-admin-token");
      return token === ADMIN_HASH;
    }
    return false;
  });

  useEffect(() => {
    const controller = new AbortController();

    async function fetchData() {
      try {
        if (!supabase) {
          console.warn("Missing Supabase credentials. Database features are disabled.");
          setLoading(false);
          return;
        }
        const results = await Promise.allSettled([
          supabase.from("cohosts").select("id, name, role, bio, accent"),
          supabase.from("episodes").select(
            "id, season, episode_number, title, air_date, runtime, imdb_rating, summary, cast, guest_stars, writers, director, facts, watch_status, podcast_url, transcript_notes",
          ),
          supabase.from("reviews").select(
            "episode_id, cohost_id, rating, review, pull_quote, draft_source, updated_at, rating_terminology, rating_scale_max",
          ),
          supabase.from("config").select("rating_label, rating_max, show_name, subtitle"),
        ]);

        const [cohostsRes, episodesRes, reviewsRes, configRes] = results;

        // Supabase returns fulfilled promises with { data, error } objects
        // Check for both rejected promises AND Supabase errors in fulfilled responses
        const hasCriticalError = 
          cohostsRes.status === "rejected" ||
          episodesRes.status === "rejected" ||
          reviewsRes.status === "rejected" ||
          (cohostsRes.status === "fulfilled" && cohostsRes.value.error) ||
          (episodesRes.status === "fulfilled" && episodesRes.value.error) ||
          (reviewsRes.status === "fulfilled" && reviewsRes.value.error);

        if (hasCriticalError) {
          throw new Error("Critical data fetch failed");
        }

        const cohosts = (cohostsRes as any).value.data;
        const episodes = (episodesRes as any).value.data;
        const reviews = (reviewsRes as any).value.data;
        const config = (configRes.status === "fulfilled" ? (configRes as any).value.data : null)?.[0];

        if (!episodes || episodes.length === 0) {
          setLoading(false);
          return;
        }

        const nextDataset = buildDataset(cohosts, episodes, reviews, config);
        setDataset(nextDataset);
        setSelectedCohostId(nextDataset.cohosts[0]?.id ?? demoDataset.cohosts[0].id);
        setLoading(false);
      } catch (error) {
        setLoadError(error instanceof Error ? error.message : "Failed to load data from Supabase");
        setLoading(false);
      }
    }

    fetchData();
    return () => controller.abort();
  }, []);

  useEffect(() => {
    const onRouteChange = (e: any) => {
      const { page, params } = e.detail;
      if (page === 'reviews') {
        if (params) {
          if (params.page === 'episode') setRoute({ page: 'episode', id: params.id });
          else if (params.page === 'season') setRoute({ page: 'season', season: params.season });
          else if (params.page === 'host') setRoute({ page: 'host', id: params.id });
          else if (params.page === 'pipeline') setRoute({ page: 'pipeline' });
          else if (params.page === 'fg-admin') setRoute({ page: 'fg-admin' });
        } else {
          setRoute({ page: 'catalog' });
        }
      }
    };
    window.addEventListener('routechange', onRouteChange);
    setRoute(parsePath());
    return () => window.removeEventListener('routechange', onRouteChange);
  }, []);

  useEffect(() => {
    if (!dataset.cohosts.some((host) => host.id === selectedCohostId)) {
      setSelectedCohostId(dataset.cohosts[0]?.id ?? "");
    }
  }, [dataset, selectedCohostId]);

  useEffect(() => {
  if (retryCount === 0) return; // Only run on retry attempts
  
  setLoading(true);
  
  const controller = new AbortController();
  
  const retryFetch = async () => {
    setLoadError(null);
    try {
      if (!supabase) {
        console.warn("Missing Supabase credentials. Database features are disabled.");
        setLoading(false);
        return;
      }
      const results = await Promise.allSettled([
        supabase.from("cohosts").select("id, name, role, bio, accent"),
        supabase.from("episodes").select(
          "id, season, episode_number, title, air_date, runtime, imdb_rating, summary, cast, guest_stars, writers, director, facts, watch_status, podcast_url, transcript_notes",
        ),
        supabase.from("reviews").select(
          "episode_id, cohost_id, rating, review, pull_quote, draft_source, updated_at, rating_terminology, rating_scale_max",
        ),
        supabase.from("config").select("rating_label, rating_max, show_name, subtitle"),
      ]);
      
      const [cohostsRes, episodesRes, reviewsRes, configRes] = results;
      
      // Supabase returns fulfilled promises with { data, error } objects
      // Check for both rejected promises AND Supabase errors in fulfilled responses
      const hasCriticalError = 
        cohostsRes.status === "rejected" ||
        episodesRes.status === "rejected" ||
        reviewsRes.status === "rejected" ||
        (cohostsRes.status === "fulfilled" && cohostsRes.value.error) ||
        (episodesRes.status === "fulfilled" && episodesRes.value.error) ||
        (reviewsRes.status === "fulfilled" && reviewsRes.value.error);
      
      if (hasCriticalError) {
        setLoadError("Critical data fetch failed");
        setLoading(false);
        return;
      }
      
      const cohosts = (cohostsRes as any).value.data;
      const episodes = (episodesRes as any).value.data;
      const reviews = (reviewsRes as any).value.data;
      const config = (configRes.status === "fulfilled" ? (configRes as any).value.data : null)?.[0];

      if (!episodes || episodes.length === 0) {
        setLoading(false);
        return;
      }

      const nextDataset = buildDataset(cohosts, episodes, reviews, config);
      setDataset(nextDataset);
      setSelectedCohostId(nextDataset.cohosts[0]?.id ?? demoDataset.cohosts[0].id);
      setLoading(false);
    } catch (error) {
      setLoadError(error instanceof Error ? error.message : "Failed to load data from Supabase");
      setLoading(false);
    }
  }

  retryFetch();
  
  return () => controller.abort();
}, [retryCount]);


  const seasons = useMemo(() => getSeasons(dataset.episodes), [dataset.episodes]);
  const selectedCohost = dataset.cohosts.find((host) => host.id === selectedCohostId) ?? dataset.cohosts[0];
  const visibleEpisodes = useMemo(() => {
    const query = search.trim().toLowerCase();
    return [...dataset.episodes]
      .sort(compareEpisodes)
      .filter((episode) => seasonFilter === "all" || episode.season === Number(seasonFilter))
      .filter((episode) => statusFilter === "all" || episode.watchStatus === statusFilter)
      .filter((episode) => {
        if (!query) return true;
        return searchableEpisodeText(episode).includes(query);
      });
  }, [dataset.episodes, search, seasonFilter, statusFilter]);
  const metrics = useMemo(() => getDatasetMetrics(dataset), [dataset]);

  function navigate(nextRoute: Route) {
    navigateTo(routeToPath(nextRoute));
  }

  function updateEpisode(episodeId: string, updater: (episode: Episode) => Episode) {
    setDataset((current) => ({
      ...current,
      episodes: current.episodes.map((episode) => (episode.id === episodeId ? updater(episode) : episode)),
    }));
  }

  function updateSelectedReview(episodeId: string, updates: Partial<Review>) {
    updateEpisode(episodeId, (episode) => ({
      ...episode,
      reviews: alignReviews(
        episode.reviews.map((review) =>
          review.cohostId === selectedCohostId
            ? { ...review, ...updates, cohostId: selectedCohostId, updatedAt: new Date().toISOString() }
            : review,
        ),
        dataset.cohosts,
      ),
    }));
  }

  function updateStatus(episodeId: string, watchStatus: WatchStatus) {
    updateEpisode(episodeId, (episode) => ({ ...episode, watchStatus }));
  }

  function importJson(text: string, sourceLabel: string) {
    try {
      const next = normalizeDataset(JSON.parse(text));
      setDataset(next);
      setJsonText(JSON.stringify(next, null, 2));
      setImportError("");
      setImportMessage(`Imported ${next.episodes.length} episodes and ${next.cohosts.length} hosts from ${sourceLabel}.`);
      setSelectedCohostId(next.cohosts[0]?.id ?? "");
      navigate({ page: "catalog" });
    } catch (error) {
      setImportError(error instanceof Error ? error.message : "Could not import this JSON.");
    }
  }

  async function importFile(file: File) {
    const text = await file.text();
    setJsonText(text);
    importJson(text, file.name);
  }

  function exportDataset() {
    const blob = new Blob([JSON.stringify(dataset, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "fg-letterlog-v2.json";
    link.click();
    URL.revokeObjectURL(url);
  }



if (loading) {
  return (
    <div className="flex h-screen flex-col bg-slate-950 text-white">
      {/* Full-width top banner */}
      <div className="w-full border-b border-white/10 p-4 text-center">
        <p className="text-sm font-semibold tracking-wider uppercase text-cyan-200/80">Loading from Supabase…</p>
      </div>
      
      {/* Centered animation */}
      <div className="flex h-[calc(100%-56px)] items-center justify-center">
        <div className="animate-pulse rounded-full bg-white/5 p-4">
          <svg className="h-8 w-8 animate-spin text-cyan-200" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
            <path
              className="opacity-75"
              d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
              stroke="currentColor"
              strokeWidth="4"></path>
          </svg>
        </div>
      </div>
    </div>
  );
}


if (loadError) {
  return (
    <div className="flex h-screen flex-col bg-slate-950 text-white p-5">
      {/* Full-width top banner */}
      <div className="w-full border-b border-white/10 p-4 text-center">
        <p className="text-sm font-semibold tracking-wider uppercase text-cyan-200/80">Couldn't reach Supabase: {loadError}</p>
      </div>
      
      {/* Retry section */}
      <div className="flex h-[calc(100%-56px)] flex-col items-center justify-center gap-4 p-5">
        {/* Retry counter badge */}
        <div className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs font-medium uppercase tracking-wider text-slate-400">
          Retry #{retryCount + 1}
        </div>
        
        {/* Error message */}
        <p className="text-rose-400 text-xl font-bold">{loadError}</p>
        
        {/* Retry button */}
        <button
          type="button"
          onClick={() => { setRetryCount(prev => prev + 1); window.location.reload(); }}
          className="primary-button"
        >
          Retry
        </button>
      </div>
    </div>
  );
}


  const handleLogout = () => {
    localStorage.removeItem("fg-admin-token");
    setIsAdmin(false);
    navigate({ page: "catalog" });
  };

  if (route.page === "fg-admin") {
    return (
      <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col justify-center py-12 sm:px-6 lg:px-8">
        <div className="sm:mx-auto sm:w-full sm:max-w-md mb-4 text-center">
          <button
            onClick={() => navigate({ page: "catalog" })}
            className="text-cyan-200 hover:text-cyan-100 text-sm font-medium transition"
          >
            ← Back to Catalog
          </button>
        </div>
        {isAdmin ? (
          <div className="mx-auto max-w-md px-4 py-16 text-center animate-rise">
            <div className="rounded-[2rem] border border-white/10 bg-white/5 p-8 shadow-2xl">
              <h2 className="text-3xl font-black tracking-tight text-white">Admin Active</h2>
              <p className="mt-2 text-sm text-slate-400">You are currently logged in as an administrator.</p>
              <div className="mt-8 flex flex-col gap-3">
                <button
                  type="button"
                  onClick={() => navigate({ page: "catalog" })}
                  className="primary-button w-full"
                >
                  Go to Catalog
                </button>
                <button
                  type="button"
                  onClick={handleLogout}
                  className="rounded-full border border-rose-500/30 bg-rose-500/10 px-4 py-3 text-sm font-medium text-rose-200 transition hover:bg-rose-500/20 w-full"
                >
                  Log Out
                </button>
              </div>
            </div>
          </div>
        ) : (
          <AdminLoginPage
            adminHash={ADMIN_HASH}
            onLoginSuccess={() => {
              setIsAdmin(true);
              navigate({ page: "catalog" });
            }}
          />
        )}
      </div>
    );
  }

  return (
    <div className="min-h-screen text-black reviews-halftone-bg relative p-4 md:p-8 animate-rise" id="review-app">
      <Hero dataset={dataset} metrics={metrics} onNavigate={navigate} onExport={exportDataset} isAdmin={isAdmin} />
      <main className="mx-auto max-w-7xl px-5 pb-16 pt-8 sm:px-6 lg:px-8">
        <Toolbar
          dataset={dataset}
          route={route}
          search={search}
          seasonFilter={seasonFilter}
          statusFilter={statusFilter}
          selectedCohostId={selectedCohostId}
          onNavigate={navigate}
          onSearch={setSearch}
          onSeasonFilter={setSeasonFilter}
          onStatusFilter={setStatusFilter}
          onCohost={setSelectedCohostId}
          onScaleLabel={(label) => setDataset((current) => ({ ...current, ratingScale: { ...current.ratingScale, label } }))}
          isAdmin={isAdmin}
          onLogout={handleLogout}
        />

        {route.page === "catalog" ? (
          <CatalogPage
            dataset={dataset}
            episodes={visibleEpisodes}
            seasons={seasons}
            onNavigate={navigate}
            onStatus={isAdmin ? updateStatus : undefined}
          />
        ) : null}

        {route.page === "episode" ? (
          <EpisodePage
            dataset={dataset}
            episodeId={route.id}
            selectedCohost={selectedCohost}
            onNavigate={navigate}
            onStatus={isAdmin ? updateStatus : undefined}
            onReview={isAdmin ? updateSelectedReview : undefined}
            isAdmin={isAdmin}
          />
        ) : null}

        {route.page === "season" ? (
          <SeasonPage dataset={dataset} season={route.season} onNavigate={navigate} onStatus={isAdmin ? updateStatus : undefined} />
        ) : null}

        {route.page === "host" ? (
          <HostPage dataset={dataset} hostId={route.id} onNavigate={navigate} />
        ) : null}

        {isAdmin && route.page === "pipeline" ? (
          <PipelinePage
            dataset={dataset}
            jsonText={jsonText}
            importMessage={importMessage}
            importError={importError}
            onJsonText={setJsonText}
            onImportJson={() => importJson(jsonText, "pasted JSON")}
            onImportFile={(file) => void importFile(file)}
            onRestoreTemplate={() => setJsonText(schemaTemplate)}
            onResetDemo={() => {
              setDataset(demoDataset);
              setSelectedCohostId(demoDataset.cohosts[0].id);
              setImportMessage("Demo v2 dataset restored.");
              setImportError("");
            }}
          />
        ) : null}
      </main>
    </div>
  );
}

function Hero({
  dataset,
  metrics,
  onNavigate,
  onExport,
  isAdmin,
}: {
  dataset: PodcastDataset;
  metrics: ReturnType<typeof getDatasetMetrics>;
  onNavigate: (route: Route) => void;
  onExport: () => void;
  isAdmin: boolean;
}) {
  const featured = dataset.episodes.find((episode) => episode.watchStatus === "published") ?? dataset.episodes[0];

  return (
    <header className="relative min-h-[460px] border-[6px] border-black bg-white p-8 shadow-[8px_8px_0px_0px_#000] mb-10 text-black">
      <div className="relative mx-auto grid gap-10 max-w-7xl lg:grid-cols-[minmax(0,1fr)_320px]">
        <div className="max-w-4xl self-center">
          <p className="text-xs font-black uppercase tracking-[0.45em] text-pink-600">
            Letterboxd for the rewatch
          </p>
          <h1 className="mt-5 max-w-4xl text-4xl font-black uppercase tracking-tight sm:text-6xl lg:text-7xl">
            {dataset.showName}
          </h1>
          <p className="mt-6 max-w-2xl text-base font-bold text-gray-700 leading-relaxed border-l-4 border-yellow-400 pl-3">
            {dataset.subtitle}
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <button className="primary-button" type="button" onClick={() => onNavigate({ page: "catalog" })}>
              Browse episodes
            </button>
            {isAdmin && (
              <button className="secondary-button" type="button" onClick={() => onNavigate({ page: "pipeline" })}>
                Import pipeline
              </button>
            )}
            {isAdmin && (
              <button className="secondary-button" type="button" onClick={onExport}>
                Export JSON
              </button>
            )}
          </div>
          <div className="mt-10 grid max-w-2xl grid-cols-2 gap-4 sm:grid-cols-4">
            <Metric value={String(metrics.episodeCount)} label="Episodes" />
            <Metric value={String(metrics.publishedCount)} label="Published" />
            <Metric value={metrics.average === null ? "--" : metrics.average.toFixed(1)} label="Avg rating" />
            <Metric value={dataset.ratingScale.label} label="Scale" />
          </div>
        </div>

        {featured ? (
          <button
            type="button"
            onClick={() => onNavigate({ page: "episode", id: featured.id })}
            className="mx-auto w-full max-w-xs self-end text-left transition hover:-translate-y-1"
          >
            <EpisodePoster episode={featured} ratingScale={dataset.ratingScale.label} size="hero" />
          </button>
        ) : null}
      </div>
    </header>
  );
}

function Metric({ value, label }: { value: string; label: string }) {
  return (
    <div className="border-l-4 border-black pl-4 text-black">
      <p className="text-2xl font-black">{value}</p>
      <p className="mt-1 text-xs font-bold uppercase tracking-[0.2em] text-gray-500">{label}</p>
    </div>
  );
}

function Toolbar({
  dataset,
  route,
  search,
  seasonFilter,
  statusFilter,
  selectedCohostId,
  onNavigate,
  onSearch,
  onSeasonFilter,
  onStatusFilter,
  onCohost,
  onScaleLabel,
  isAdmin,
  onLogout,
}: {
  dataset: PodcastDataset;
  route: Route;
  search: string;
  seasonFilter: string;
  statusFilter: WatchStatus | "all";
  selectedCohostId: string;
  onNavigate: (route: Route) => void;
  onSearch: (value: string) => void;
  onSeasonFilter: (value: string) => void;
  onStatusFilter: (value: WatchStatus | "all") => void;
  onCohost: (value: string) => void;
  onScaleLabel: (value: string) => void;
  isAdmin: boolean;
  onLogout: () => void;
}) {
  const seasons = getSeasons(dataset.episodes);

  return (
    <section className="bg-white border-4 border-black p-5 shadow-[6px_6px_0px_0px_#000] mb-8 text-black">
      <div className="flex flex-col gap-4">
        <div className="flex flex-wrap items-center justify-between gap-4 border-b-2 border-dashed border-gray-300 pb-4">
          <nav className="flex flex-wrap gap-2">
            <NavButton active={route.page === "catalog"} onClick={() => onNavigate({ page: "catalog" })}>
              Catalog
            </NavButton>
            {seasons.map((season) => (
              <NavButton
                key={season}
                active={route.page === "season" && route.season === season}
                onClick={() => onNavigate({ page: "season", season })}
              >
                Season {season}
              </NavButton>
            ))}
            {dataset.cohosts.map((host) => (
              <NavButton
                key={host.id}
                active={route.page === "host" && route.id === host.id}
                onClick={() => onNavigate({ page: "host", id: host.id })}
              >
                {host.name.split(" ")[0]}'s Diary
              </NavButton>
            ))}
            {isAdmin && (
              <NavButton active={route.page === "pipeline"} onClick={() => onNavigate({ page: "pipeline" })}>
                Import lab
              </NavButton>
            )}
          </nav>

          <div className="flex items-center gap-3">
            {isAdmin ? (
              <button onClick={onLogout} className="secondary-button small">
                Admin Logout
              </button>
            ) : (
              <button onClick={() => onNavigate({ page: "fg-admin" })} className="secondary-button small">
                Admin Portal
              </button>
            )}
          </div>
        </div>

        {route.page === "catalog" || route.page === "season" ? (
          <div className="grid gap-4 sm:grid-cols-2 md:grid-cols-4 items-end">
            <div>
              <label className="block text-xs font-black uppercase mb-1">Search Feed</label>
              <input
                type="text"
                value={search}
                onChange={(e) => onSearch(e.target.value)}
                placeholder="Search titles, cast..."
                className="field text-sm !py-2"
              />
            </div>
            <div>
              <label className="block text-xs font-black uppercase mb-1">Filter Season</label>
              <select
                value={seasonFilter}
                onChange={(e) => onSeasonFilter(e.target.value)}
                className="field text-sm !py-2 animate-none"
              >
                <option value="all">All Seasons</option>
                {seasons.map((s) => (
                  <option key={s} value={s}>
                    Season {s}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-black uppercase mb-1">Filter Workflow</label>
              <select
                value={statusFilter}
                onChange={(e) => onStatusFilter(e.target.value as WatchStatus | "all")}
                className="field text-sm !py-2 animate-none"
              >
                <option value="all">All Statuses</option>
                {STATUS_ORDER.map((status) => (
                  <option key={status} value={status}>
                    {STATUS_LABEL[status]}
                  </option>
                ))}
              </select>
            </div>
            {isAdmin && (
              <div>
                <label className="block text-xs font-black uppercase mb-1">Write Cohost</label>
                <select
                  value={selectedCohostId}
                  onChange={(e) => onCohost(e.target.value)}
                  className="field text-sm !py-2 animate-none"
                >
                  {dataset.cohosts.map((host) => (
                    <option key={host.id} value={host.id}>
                      {host.name}
                    </option>
                  ))}
                </select>
              </div>
            )}
          </div>
        ) : null}
      </div>
    </section>
  );
}

function NavButton({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`border-4 border-black px-4 py-2 text-sm font-black transition hover:translate-y-[-1px] ${
        active 
          ? "bg-[#FBBF24] text-black shadow-[2px_2px_0px_0px_#000]" 
          : "bg-white text-black shadow-[2px_2px_0px_0px_#000] hover:bg-gray-100"
      }`}
    >
      {children}
    </button>
  );
}


function CatalogPage({
  dataset,
  episodes,
  seasons,
  onNavigate,
  onStatus,
}: {
  dataset: PodcastDataset;
  episodes: Episode[];
  seasons: number[];
  onNavigate: (route: Route) => void;
  onStatus: ((episodeId: string, status: WatchStatus) => void) | undefined;
}) {
  return (
    <div className="animate-rise mt-8 grid gap-8 lg:grid-cols-[minmax(0,1fr)_330px]">
      <section>
        <SectionIntro
          eyebrow="Episode catalog"
          title="Every episode gets a page."
          copy="Open an episode to see metadata, status, cast, cohost ratings, and editable reviews."
        />
        <div className="mt-6 grid gap-5 sm:grid-cols-2 xl:grid-cols-3">
          {episodes.map((episode) => (
            <EpisodeTile
              key={episode.id}
              episode={episode}
              ratingLabel={dataset.ratingScale.label}
              onOpen={() => onNavigate({ page: "episode", id: episode.id })}
              onStatus={onStatus ? (status) => onStatus!(episode.id, status) : undefined}
            />
          ))}
        </div>
        {!episodes.length ? <EmptyState title="No episodes found" copy="Try changing the search or status filters." /> : null}
      </section>

      <aside className="space-y-6">
        <SidePanel title="Season shelves">
          <div className="space-y-4">
            {seasons.map((season) => {
              const seasonEpisodes = dataset.episodes.filter((episode) => episode.season === season);
              return (
                <button
                  key={season}
                  type="button"
                  onClick={() => onNavigate({ page: "season", season })}
                  className="group w-full border-b border-white/10 pb-4 text-left last:border-b-0 last:pb-0"
                >
                  <div className="flex items-center justify-between gap-4">
                    <p className="font-semibold text-white">Season {season}</p>
                    <p className="text-sm text-slate-400">{seasonEpisodes.length} eps</p>
                  </div>
                  <ProgressBar value={seasonProgress(seasonEpisodes)} />
                </button>
              );
            })}
          </div>
        </SidePanel>

        <SidePanel title="Host profiles">
          <div className="space-y-3">
            {dataset.cohosts.map((host) => (
              <button
                key={host.id}
                type="button"
                onClick={() => onNavigate({ page: "host", id: host.id })}
                className="flex w-full items-center gap-3 rounded-2xl border border-white/10 bg-white/5 p-3 text-left transition hover:border-white/20 hover:bg-white/8"
              >
                <Avatar host={host} />
                <div>
                  <p className="font-medium text-white">{host.name}</p>
                  <p className="text-sm text-slate-400">{host.role}</p>
                </div>
              </button>
            ))}
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
  onStatus,
}: {
  episode: Episode;
  ratingLabel: string;
  onOpen: () => void;
  onStatus: ((status: WatchStatus) => void) | undefined;
}) {
  return (
    <article className="group animate-rise border-4 border-black bg-white p-3 shadow-[6px_6px_0px_0px_#000] transition duration-300 hover:translate-y-[-2px] hover:shadow-[8px_8px_0px_0px_#000] text-black">
      <button type="button" onClick={onOpen} className="block w-full text-left">
        <EpisodePoster episode={episode} ratingScale={ratingLabel} />
      </button>
      <div className="px-1 pt-4">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.32em] text-gray-500">
              {formatEpisodeCode(episode)}
            </p>
            <h3 className="mt-1 text-lg font-black leading-tight text-black uppercase">{episode.title}</h3>
          </div>
          <StatusBadge status={episode.watchStatus} />
        </div>
        <p className="mt-3 line-clamp-3 text-sm font-bold text-gray-600 leading-6">{episode.summary}</p>
        <div className="mt-4 flex items-center justify-between gap-3">
          {onStatus ? (
            <select
              value={episode.watchStatus}
              onChange={(event) => onStatus!(event.target.value as WatchStatus)}
              className="mini-field cursor-pointer animate-none"
              aria-label={`Update watch status for ${episode.title}`}
            >
              {STATUS_ORDER.map((status) => (
                <option key={status} value={status}>
                  {STATUS_LABEL[status]}
                </option>
              ))}
            </select>
          ) : (
            <StatusBadge status={episode.watchStatus} />
          )}
          <button type="button" onClick={onOpen} className="text-sm font-black text-pink-600 hover:underline uppercase">
            Open page
          </button>
        </div>
      </div>
    </article>
  );
}

type VisitorReview = {
  id: string;
  episode_id: string;
  author: string;
  rating: number;
  scale: 'stars' | 'points';
  terminology: string;
  content: string;
  likes: number;
  created_at: string;
};

function EpisodePage({
  dataset,
  episodeId,
  selectedCohost,
  onNavigate,
  onStatus,
  onReview,
  isAdmin,
}: {
  dataset: PodcastDataset;
  episodeId: string;
  selectedCohost: Cohost | undefined;
  onNavigate: (route: Route) => void;
  onStatus: ((episodeId: string, status: WatchStatus) => void) | undefined;
  onReview: ((episodeId: string, updates: Partial<Review>) => void) | undefined;
  isAdmin: boolean;
}) {
  const episode = dataset.episodes.find((item) => item.id === episodeId);
  if (!episode) return <EmptyState title="Episode not found" copy="This URL does not match the loaded dataset." />;

  const hostReview = selectedCohost ? episode.reviews.find((review) => review.cohostId === selectedCohost.id) : null;
  const average = averageRating(episode.reviews);

  return (
    <div className="animate-rise mt-8 text-black">
      {/* Neo-brutalist Canva Mockup Header */}
      <header className="mb-10 text-center md:text-left border-b-4 border-black pb-6">
        <h1 className="text-5xl md:text-8xl font-black uppercase tracking-tighter select-none font-sans" style={{ letterSpacing: '-0.04em' }}>
          REVIEWS
        </h1>
        <p className="mt-4 text-xl md:text-2xl font-bold bg-white inline-block border-4 border-black px-4 py-2 shadow-[4px_4px_0px_0px_#000000] uppercase font-sans">
          {formatEpisodeCode(episode)}: {episode.title}
        </p>
      </header>

      <div className="grid gap-8 lg:grid-cols-[360px_minmax(0,1fr)]">
        <aside className="space-y-6">
          <EpisodePoster episode={episode} ratingScale={dataset.ratingScale.label} size="detail" />
          <SidePanel title="Watch status">
            {onStatus ? (
              <select
                value={episode.watchStatus}
                onChange={(event) => onStatus(episode.id, event.target.value as WatchStatus)}
                className="field w-full animate-none cursor-pointer"
              >
                {STATUS_ORDER.map((status) => (
                  <option key={status} value={status}>
                    {STATUS_LABEL[status]}
                  </option>
                ))}
              </select>
            ) : (
              <div className="field w-full bg-gray-50 border-4 border-black p-3">
                <span className="text-black font-bold">{STATUS_LABEL[episode.watchStatus]}</span>
              </div>
            )}
            <p className="mt-3 text-xs font-bold leading-6 text-gray-500">
              Use this as your production workflow: backlog, watched, recorded, then published.
            </p>
          </SidePanel>
        </aside>

        <section className="space-y-8">
          {/* Main info card */}
          <div className="bg-white border-4 border-black p-6 shadow-[6px_6px_0px_0px_#000]">
            <div className="flex flex-wrap items-start justify-between gap-4 border-b-2 border-dashed border-gray-300 pb-6">
              <div>
                <button type="button" onClick={() => onNavigate({ page: "catalog" })} className="text-link">
                  Back to catalog
                </button>
                <p className="mt-4 text-sm font-black text-gray-500 uppercase">
                  <button type="button" onClick={() => onNavigate({ page: "season", season: episode.season })} className="hover:text-pink-600 underline">
                    Season {episode.season}
                  </button>{" "}
                  / Episode {episode.episodeNumber}
                </p>
                <h2 className="mt-2 text-3xl font-black uppercase text-black">{episode.title}</h2>
              </div>
              <div className="bg-yellow-200 border-4 border-black px-5 py-4 text-right shadow-[3px_3px_0px_0px_#000]">
                <p className="text-xs font-black uppercase tracking-[0.2em] text-gray-600">Average</p>
                <p className="mt-1 text-3xl font-black text-black">
                  {average === null ? "--" : average.toFixed(1)} / {dataset.ratingScale.max}
                </p>
                <p className="text-xs font-bold text-gray-500">{dataset.ratingScale.label}</p>
              </div>
            </div>

            <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <Info label="Air date" value={episode.airDate} />
              <Info label="Runtime" value={episode.runtime} />
              <Info label="IMDb" value={episode.imdbRating} />
              <Info label="Status" value={STATUS_LABEL[episode.watchStatus]} />
            </div>

            <div className="mt-6 border-t-2 border-dashed border-gray-200 pt-6">
              <p className="mb-2 text-xs font-black uppercase tracking-[0.35em] text-gray-500">Synopsis</p>
              <p className="max-w-3xl text-sm font-bold leading-relaxed text-gray-700">{episode.summary}</p>
            </div>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <DetailList title="Cast" items={episode.cast} />
            <DetailList title="Guest stars" items={episode.guestStars} />
            <DetailList title="Writers" items={episode.writers} />
            <DetailList title="Director" items={episode.director ? [episode.director] : []} />
          </div>

          {episode.facts.length ? (
            <SectionBlock title="Metadata">
              <dl className="grid gap-4 sm:grid-cols-2">
                {episode.facts.map((fact) => (
                  <div key={`${fact.label}-${fact.value}`} className="flex justify-between gap-4 border-b border-gray-200 pb-3 font-bold text-sm">
                    <dt className="text-gray-500 font-black">{fact.label}</dt>
                    <dd className="text-right text-black">{fact.value}</dd>
                  </div>
                ))}
              </dl>
            </SectionBlock>
          ) : null}

          {/* Host ratings */}
          <div>
            <div className="inline-block bg-[#F99F1B] border-4 border-black px-4 py-2 mb-6 shadow-[4px_4px_0px_0px_#000000] text-black">
              <h3 className="text-xl font-black uppercase tracking-wide">HOST RATINGS FOR THIS EPISODE</h3>
            </div>
            <div className="space-y-6">
              {episode.reviews.map((review) => {
                const host = dataset.cohosts.find((item) => item.id === review.cohostId);
                if (!host) return null;
                return (
                  <HostReviewRow key={review.cohostId} host={host} review={review} ratingLabel={dataset.ratingScale.label} />
                );
              })}
            </div>
          </div>

          {/* Visitor Reviews Feed & Composer */}
          <VisitorReviewsSection episodeId={episode.id} />

          {/* Admin editing form */}
          {isAdmin && selectedCohost ? (
            <SectionBlock title={`Rewrite as ${selectedCohost.name}`}>
              <div className="space-y-4">
                <label className="block text-sm font-black text-black">
                  Rating: {hostReview?.rating == null ? "not rated" : `${hostReview.rating.toFixed(1)} / ${dataset.ratingScale.max}`}
                  <input
                    type="range"
                    min="0"
                    max={dataset.ratingScale.max}
                    step="0.5"
                    value={hostReview?.rating ?? 0}
                    onChange={(event) => onReview!(episode.id, { rating: Number(event.target.value), draftSource: "manual" })}
                    className="mt-3 w-full cursor-pointer h-2 bg-gray-200 border border-black rounded-none appearance-none"
                  />
                </label>
                <label className="block text-sm font-black text-black">
                  Pull quote
                  <input
                    value={hostReview?.pullQuote ?? ""}
                    onChange={(event) => onReview!(episode.id, { pullQuote: event.target.value, draftSource: "manual" })}
                    className="field mt-2 w-full text-sm"
                    placeholder="One-sentence quote for profile pages"
                  />
                </label>
                <label className="block text-sm font-black text-black">
                  Review
                  <textarea
                    value={hostReview?.review ?? ""}
                    onChange={(event) => onReview!(episode.id, { review: event.target.value, draftSource: "manual" })}
                    className="field mt-2 min-h-44 w-full text-sm"
                    placeholder="Rewrite your review here..."
                  />
                </label>
              </div>
            </SectionBlock>
          ) : null}
        </section>
    </div>
  </div>
  );
}


function SeasonPage({
  dataset,
  season,
  onNavigate,
  onStatus,
}: {
  dataset: PodcastDataset;
  season: number;
  onNavigate: (route: Route) => void;
  onStatus: ((episodeId: string, status: WatchStatus) => void) | undefined;
}) {
  const episodes = dataset.episodes.filter((episode) => episode.season === season).sort(compareEpisodes);
  const average = averageRating(episodes.flatMap((episode) => episode.reviews));

  return (
    <div className="animate-rise mt-8">
      <SectionIntro
        eyebrow="Season page"
        title={`Season ${season}`}
        copy={`${episodes.length} episodes, ${average === null ? "no" : average.toFixed(1)} average ${dataset.ratingScale.label.toLowerCase()}, ${Math.round(seasonProgress(episodes))}% through the production workflow.`}
      />
      <div className="mt-6 grid gap-4 sm:grid-cols-4">
        {STATUS_ORDER.map((status) => (
          <Info key={status} label={STATUS_LABEL[status]} value={String(episodes.filter((episode) => episode.watchStatus === status).length)} />
        ))}
      </div>
      <div className="mt-8 grid gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {episodes.map((episode) => (
          <EpisodeTile
            key={episode.id}
            episode={episode}
            ratingLabel={dataset.ratingScale.label}
            onOpen={() => onNavigate({ page: "episode", id: episode.id })}
            onStatus={onStatus ? (status) => onStatus!(episode.id, status) : undefined}
          />
        ))}
      </div>
      {!episodes.length ? <EmptyState title="Season not found" copy="Load a dataset with episodes for this season." /> : null}
    </div>
  );
}

function HostPage({ dataset, hostId, onNavigate }: { dataset: PodcastDataset; hostId: string; onNavigate: (route: Route) => void }) {
  const host = dataset.cohosts.find((item) => item.id === hostId);
  if (!host) return <EmptyState title="Host not found" copy="This profile does not exist in the loaded dataset." />;

  const hostReviews = dataset.episodes
    .map((episode) => ({ episode, review: episode.reviews.find((review) => review.cohostId === host.id) }))
    .filter((item): item is { episode: Episode; review: Review } => Boolean(item.review));
  const ratings = hostReviews.map((item) => item.review.rating).filter((rating): rating is number => rating !== null);
  const average = ratings.length ? ratings.reduce((sum, rating) => sum + rating, 0) / ratings.length : null;

  return (
    <div className="animate-rise mt-8 grid gap-8 lg:grid-cols-[320px_minmax(0,1fr)]">
      <aside>
        <div className="rounded-[2rem] border border-white/10 bg-white/5 p-6">
          <Avatar host={host} large />
          <h2 className="mt-5 text-3xl font-black tracking-tight text-white">{host.name}</h2>
          <p className="mt-1 text-cyan-200">{host.role}</p>
          <p className="mt-4 text-sm leading-7 text-slate-300">{host.bio}</p>
          <div className="mt-6 grid grid-cols-2 gap-3">
            <Info label="Reviews" value={String(hostReviews.length)} />
            <Info label="Average" value={average === null ? "--" : average.toFixed(1)} />
          </div>
        </div>
      </aside>
      <section>
        <SectionIntro eyebrow="Host profile" title={`${host.name}'s diary`} copy="A profile view for every rating and pull quote this cohost has logged." />
        <div className="mt-6 divide-y divide-white/10 border-y border-white/10">
          {hostReviews.map(({ episode, review }) => (
            <button
              key={episode.id}
              type="button"
              onClick={() => onNavigate({ page: "episode", id: episode.id })}
              className="grid w-full gap-4 py-5 text-left transition hover:bg-white/[0.025] sm:grid-cols-[120px_minmax(0,1fr)_90px]"
            >
              <EpisodePoster episode={episode} ratingScale={dataset.ratingScale.label} size="mini" />
              <div>
                <p className="text-xs uppercase tracking-[0.32em] text-slate-500">{formatEpisodeCode(episode)}</p>
                <h3 className="mt-1 text-xl font-semibold text-white">{episode.title}</h3>
                <p className="mt-2 line-clamp-2 text-sm leading-6 text-slate-400">{review.pullQuote || review.review || "No review yet."}</p>
              </div>
              <div className="text-right">
                <p className="text-2xl font-semibold text-white">{review.rating == null ? "--" : review.rating.toFixed(1)}</p>
                <p className="text-xs text-slate-500">{dataset.ratingScale.label}</p>
              </div>
            </button>
          ))}
        </div>
      </section>
    </div>
  );
}

function PipelinePage({
  dataset,
  jsonText,
  importMessage,
  importError,
  onJsonText,
  onImportJson,
  onImportFile,
  onRestoreTemplate,
  onResetDemo,
}: {
  dataset: PodcastDataset;
  jsonText: string;
  importMessage: string;
  importError: string;
  onJsonText: (value: string) => void;
  onImportJson: () => void;
  onImportFile: (file: File) => void;
  onRestoreTemplate: () => void;
  onResetDemo: () => void;
}) {
  return (
    <div className="animate-rise mt-8 grid gap-8 xl:grid-cols-[minmax(0,1fr)_420px]">
      <section>
        <SectionIntro
          eyebrow="Import lab"
          title="A schema for the workflow you actually have."
          copy="Review, validate, and load generated dataset JSON structures from your local Python admin pipeline."
        />
        <div className="mt-6 grid gap-5 lg:grid-cols-2">
          <div className="rounded-[1.6rem] border border-white/10 bg-white/5 p-5">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <h3 className="text-xl font-semibold text-white">Dataset JSON</h3>
              <div className="flex gap-2">
                <button type="button" onClick={onRestoreTemplate} className="secondary-button small">
                  Template
                </button>
                <button type="button" onClick={onResetDemo} className="secondary-button small">
                  Demo
                </button>
              </div>
            </div>
            <textarea value={jsonText} onChange={(event) => onJsonText(event.target.value)} className="field mt-4 min-h-[520px] w-full font-mono text-xs" />
            <div className="mt-4 flex flex-wrap gap-3">
              <button type="button" onClick={onImportJson} className="primary-button">
                Validate and load JSON
              </button>
              <label className="secondary-button cursor-pointer">
                Upload file
                <input
                  type="file"
                  accept="application/json"
                  className="hidden"
                  onChange={(event) => {
                    const file = event.target.files?.[0];
                    if (file) onImportFile(file);
                  }}
                />
              </label>
            </div>
            {importMessage ? <p className="mt-4 text-sm text-emerald-300">{importMessage}</p> : null}
            {importError ? <p className="mt-4 text-sm text-rose-300">{importError}</p> : null}
          </div>

          <div className="rounded-[1.6rem] border border-white/10 bg-white/5 p-5">
            <h3 className="text-xl font-semibold text-white">Python Admin Pipeline</h3>
            <p className="mt-2 text-sm leading-6 text-slate-400">
              For a secure and structured review workflow, use the local pipeline scripts in the admin-tools/ directory. You can launch a Streamlit GUI or execute raw commands via CLI to push updates directly to Supabase.
            </p>
            <div className="mt-5 space-y-4 rounded-3xl border border-white/10 bg-slate-950/50 p-4 text-xs font-mono text-slate-300">
              <div>
                <p className="text-cyan-200 font-semibold mb-1">1. Install Dependencies &amp; Secrets</p>
                <pre className="bg-black/30 p-2 rounded border border-white/5 overflow-x-auto whitespace-pre-wrap">
                  cd admin-tools{"\n"}
                  pip install -r requirements.txt{"\n"}
                  cp .env.example .env
                </pre>
              </div>
              <div>
                <p className="text-cyan-200 font-semibold mb-1">2. Launch Streamlit Hub</p>
                <pre className="bg-black/30 p-2 rounded border border-white/5 overflow-x-auto whitespace-pre-wrap">
                  streamlit run app.py
                </pre>
              </div>
              <div>
                <p className="text-cyan-200 font-semibold mb-1">3. CLI Command Guide</p>
                <pre className="bg-black/30 p-2 rounded border border-white/5 overflow-x-auto whitespace-pre-wrap">
                  python omdb_fetch.py --season 1 --episode 4 --episode-id s01e04
                </pre>
              </div>
            </div>
          </div>
        </div>
      </section>

      <aside className="space-y-5">
        <SidePanel title="Pipeline schema">
          <SchemaLine label="schemaVersion" value="fg-letterlog-v2" />
          <SchemaLine label="ratingScale" value="Flexible label plus max score" />
          <SchemaLine label="cohosts" value="Profiles, colors, review ownership" />
          <SchemaLine label="episodes" value="Metadata, status, transcript notes" />
          <SchemaLine label="reviews" value="Per-host rating, review, pull quote" />
        </SidePanel>
        <SidePanel title="Suggested pipeline">
          <ol className="space-y-3 text-sm leading-6 text-slate-300">
            <li>1. Backfill metadata from OMDb using the `omdb_fetch.py` tool.</li>
            <li>2. Run the transcript parsing tool locally via Streamlit or the `generate_review.py` script.</li>
            <li>3. Push reviews directly to database or paste the formatted JSON structure here.</li>
            <li>4. Cohosts edit or rewrite reviews via the host diary/episode page.</li>
            <li>5. Move status to Published to make the episode go live.</li>
          </ol>
        </SidePanel>
      </aside>
    </div>
  );
}

function EpisodePoster({
  episode,
  ratingScale,
  size = "card",
}: {
  episode: Episode;
  ratingScale: string;
  size?: "card" | "hero" | "detail" | "mini";
}) {
  const colors = posterColors(episode.id);
  const average = averageRating(episode.reviews);
  const sizeClass = size === "hero" ? "aspect-[4/5]" : size === "detail" ? "aspect-[4/5]" : size === "mini" ? "aspect-[5/3]" : "aspect-[4/5]";
  const titleClass = size === "mini" ? "text-sm" : size === "hero" || size === "detail" ? "text-3xl" : "text-2xl";

  return (
    <div
      className={`poster-shine relative overflow-hidden border-4 border-black p-5 shadow-[6px_6px_0px_0px_#000000] bg-white ${sizeClass}`}
      style={{
        background: `radial-gradient(circle at 20% 18%, ${colors[0]}33, transparent 32%), radial-gradient(circle at 80% 70%, ${colors[1]}33, transparent 35%), linear-gradient(145deg, #ffffff, #fffbeb 62%, ${colors[2]}22)`,
      }}
    >
      <div className="absolute inset-x-5 top-5 flex items-center justify-between text-xs font-extrabold uppercase tracking-[0.28em] text-black/60">
        <span>{formatEpisodeCode(episode)}</span>
        <span className="bg-black text-white px-1.5 py-0.5 border border-black font-black">{STATUS_LABEL[episode.watchStatus]}</span>
      </div>
      <div className="absolute inset-x-5 bottom-5 text-black">
        <div className="mb-5 h-16 w-24 border border-black/45 bg-black/5" />
        <h3 className={`${titleClass} max-w-[92%] font-black leading-[0.95] tracking-[-0.05em] text-black uppercase`}>{episode.title}</h3>
        <div className="mt-4 flex items-center justify-between gap-4 border-t-2 border-black/15 pt-4 text-sm text-black/75 font-bold">
          <span>{episode.airDate}</span>
          <span>{average === null ? "--" : average.toFixed(1)} {ratingScale}</span>
        </div>
      </div>
    </div>
  );
}

function StatusBadge({ status }: { status: WatchStatus }) {
  return <span className={`status-tag status-${status}`}>{STATUS_LABEL[status]}</span>;
}

function Info({ label, value }: { label: string; value: string }) {
  return (
    <div className="bg-white border-4 border-black p-4 shadow-[4px_4px_0px_0px_#000] text-black">
      <p className="text-[11px] font-black uppercase tracking-[0.3em] text-gray-500">{label}</p>
      <p className="mt-1 font-extrabold text-black">{value}</p>
    </div>
  );
}

function SectionIntro({ eyebrow, title, copy }: { eyebrow: string; title: string; copy: string }) {
  return (
    <div className="text-black">
      <p className="text-xs font-black uppercase tracking-[0.42em] text-pink-600">{eyebrow}</p>
      <h2 className="mt-3 text-3xl font-black tracking-tight text-black sm:text-4xl uppercase">{title}</h2>
      <p className="mt-3 max-w-2xl text-sm font-bold text-gray-600 leading-relaxed">{copy}</p>
    </div>
  );
}

function SectionBlock({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="mt-8 bg-white border-4 border-black p-5 shadow-[6px_6px_0px_0px_#000] text-black">
      <p className="mb-3 text-xs font-black uppercase tracking-[0.35em] text-gray-500">{title}</p>
      {children}
    </section>
  );
}

function SidePanel({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="bg-white border-4 border-black p-5 shadow-[6px_6px_0px_0px_#000] text-black">
      <h3 className="text-lg font-black text-black uppercase tracking-wider">{title}</h3>
      <div className="mt-4">{children}</div>
    </section>
  );
}

function DetailList({ title, items }: { title: string; items: string[] }) {
  return (
    <div className="bg-white border-4 border-black p-4 shadow-[4px_4px_0px_0px_#000] text-black">
      <p className="text-xs font-black uppercase tracking-[0.35em] text-gray-500">{title}</p>
      <ul className="mt-2 space-y-1 text-sm font-bold text-gray-700 leading-6">
        {items.length ? items.map((item) => <li key={item}>{item}</li>) : <li className="text-gray-400">Unknown</li>}
      </ul>
    </div>
  );
}

function ReviewRow({
  host,
  review,
  ratingLabel,
  onHost,
}: {
  host: Cohost | undefined;
  review: Review;
  ratingLabel: string;
  onHost: (route: Route) => void;
}) {
  return (
    <div className="grid gap-4 py-5 sm:grid-cols-[220px_minmax(0,1fr)_90px] text-black">
      <button type="button" onClick={() => host && onHost({ page: "host", id: host.id })} className="flex items-center gap-3 text-left">
        {host ? <Avatar host={host} /> : null}
        <div>
          <p className="font-black text-black">{host?.name ?? review.cohostId}</p>
          <p className="text-xs font-bold text-gray-500">{review.draftSource === "transcript" ? "Transcript draft" : "Manual edit"}</p>
        </div>
      </button>
      <div>
        {review.pullQuote ? <p className="mb-2 text-sm font-black text-pink-600">"{review.pullQuote}"</p> : null}
        <p className="whitespace-pre-wrap text-sm font-bold text-gray-700 leading-relaxed">{review.review || "No review yet."}</p>
      </div>
      <div className="text-right">
        <p className="text-2xl font-black text-black">{review.rating == null ? "--" : review.rating.toFixed(1)}</p>
        <p className="text-xs font-bold text-gray-500 uppercase">{ratingLabel}</p>
      </div>
    </div>
  );
}

function Avatar({ host, large = false }: { host: Cohost; large?: boolean }) {
  const defaultMapping: Record<string, string> = {
    collin: "/collinhost.png",
    tyler: "/tylerhost.png",
    jason: "/jasonhost.png",
  };
  const photoUrl = defaultMapping[host.id.toLowerCase()];
  const initials = host.name
    .split(/\s+/)
    .map((part) => part[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
  return (
    <div
      className={`grid shrink-0 place-items-center border-2 border-black font-black text-slate-950 overflow-hidden relative ${large ? "h-24 w-24 text-3xl" : "h-11 w-11 text-sm"}`}
      style={{ backgroundColor: host.accent }}
    >
      {photoUrl ? (
        <img 
          src={photoUrl} 
          alt={host.name} 
          className="w-full h-full object-cover filter contrast-125"
          onError={(e) => {
            e.currentTarget.style.display = 'none';
          }}
        />
      ) : null}
      <span className="absolute inset-0 flex items-center justify-center bg-transparent" style={{ zIndex: -1 }}>
        {initials}
      </span>
    </div>
  );
}

function ProgressBar({ value }: { value: number }) {
  return (
    <div className="mt-3 h-2 overflow-hidden rounded-full bg-white/10">
      <div className="h-full rounded-full bg-gradient-to-r from-cyan-300 to-emerald-300" style={{ width: `${Math.max(2, Math.min(100, value))}%` }} />
    </div>
  );
}

function SchemaLine({ label, value }: { label: string; value: string }) {
  return (
    <div className="border-b border-white/10 py-3 first:pt-0 last:border-b-0 last:pb-0">
      <p className="font-mono text-xs text-cyan-200">{label}</p>
      <p className="mt-1 text-sm text-slate-400">{value}</p>
    </div>
  );
}

function EmptyState({ title, copy }: { title: string; copy: string }) {
  return (
    <div className="mt-8 rounded-[1.6rem] border border-dashed border-white/15 bg-white/[0.025] p-8 text-center">
      <h3 className="text-2xl font-semibold text-white">{title}</h3>
      <p className="mt-2 text-slate-400">{copy}</p>
    </div>
  );
}

function createDemoDataset(): PodcastDataset {
  const cohosts: Cohost[] = [
    { id: "collin", name: "Collin Brown", role: "Host", bio: "Longtime improv comedian, lifelong Family Guy apologist, and the guy who didn't see the pilot until middle school.", accent: PALETTE[0] },
    { id: "tyler", name: "Tyler Simpson", role: "Host", bio: "Watched the original broadcast as an 8-year-old and loved it. This is either his origin story or his origin tragedy.", accent: PALETTE[1] },
    { id: "jason", name: "Jason Hackett", role: "Host", bio: "Played the theme song entirely too loud on episode one. Sets the tone. Cranks the hogs. Asks the hard questions nobody asked.", accent: PALETTE[2] },
  ];

  const baseEpisodes: Omit<Episode, "reviews">[] = [
    episodeBase("s01e01-death-has-a-shadow", 1, 1, "Death Has a Shadow", "Jan 31, 1999", "published", "Peter loses his job after a company party and the Griffin family dynamic arrives almost fully formed.", "Peter Shin", ["Seth MacFarlane", "David Zuckerman"], "1ACX01"),
    episodeBase("s01e02-i-never-met-the-dead-man", 1, 2, "I Never Met the Dead Man", "Apr 11, 1999", "published", "Peter is banned from television, so he finds increasingly desperate ways to get his favorite distraction back.", "Michael Dante DiMartino", ["Danny Smith"], "1ACX02"),
    episodeBase("s01e03-chitty-chitty-death-bang", 1, 3, "Chitty Chitty Death Bang", "Apr 18, 1999", "recorded", "A birthday party spirals into a cult standoff and shows how quickly the series can escalate a simple premise.", "Dominic Polcino", ["Mikey Day", "Matt Weitzman"], "1ACX03"),
    episodeBase("s01e04-mind-over-murder", 1, 4, "Mind Over Murder", "Apr 25, 1999", "watched", "Peter turns the basement into a bar while the episode tests how much story can be built around a single bad decision.", "Roy Allen Smith", ["Neil Goldman", "Garrett Donovan"], "1ACX04"),
    episodeBase("s01e05-peter-peter-caviar-eater", 1, 5, "Peter, Peter, Caviar Eater", "May 2, 1999", "backlog", "The Griffins brush up against wealth, which gives Peter a larger room to be the least elegant person alive.", "Jeff Myers", ["Chris Sheridan"], "1ACX05"),
    episodeBase("s01e06-the-son-also-draws", 1, 6, "The Son Also Draws", "May 9, 1999", "backlog", "A family road trip gives the show space to turn parenting anxiety into roaming nonsense.", "Neil Affleck", ["Ricky Blitt"], "1ACX06"),
    episodeBase("s02e01-peter-peter-caviar-eater", 2, 1, "Peter, Peter, Caviar Eater", "Sep 23, 1999", "backlog", "A new season shelf sample for testing chronological runs and season pages.", "Dan Povenmire", ["Chris Sheridan"], "2ACX01"),
    episodeBase("s02e02-holy-crap", 2, 2, "Holy Crap", "Sep 30, 1999", "backlog", "Peter's father visits and turns the house into a pressure cooker of generational tension and dumb rebellion.", "Neil Affleck", ["Danny Smith"], "2ACX02"),
  ];

  return {
    schemaVersion: "fg-letterlog-v2",
    showName: "Family Guy Guys",
    subtitle: "Join Collin, Tyler, and Jason as they watch and review every single episode of Family Guy in chronological order.",
    ratingScale: { label: "Quahogs", max: 5 },
    cohosts,
    episodes: baseEpisodes.map((episode, index) => ({ ...episode, reviews: demoReviews(cohosts, index) })),
  };
}

function episodeBase(
  id: string,
  season: number,
  episodeNumber: number,
  title: string,
  airDate: string,
  watchStatus: WatchStatus,
  summary: string,
  director: string,
  writers: string[],
  productionCode: string,
): Omit<Episode, "reviews"> {
  return {
    id,
    season,
    episodeNumber,
    title,
    airDate,
    runtime: "22 min",
    imdbRating: (7 + ((season + episodeNumber) % 6) / 10).toFixed(1),
    summary,
    cast: ["Seth MacFarlane as Peter Griffin", "Alex Borstein as Lois Griffin", "Seth Green as Chris Griffin", "Mila Kunis as Meg Griffin"],
    guestStars: ["Guest cast to be imported from your metadata source"],
    writers,
    director,
    facts: [
      { label: "Production code", value: productionCode },
      { label: "Metadata source", value: "Demo placeholder for IMDb-style fields" },
    ],
    watchStatus,
    podcastUrl: "",
    transcriptNotes: "",
  };
}

function demoReviews(cohosts: Cohost[], index: number): Review[] {
  return cohosts.map((host, hostIndex) => {
    const rating = Math.min(5, 3 + ((index + hostIndex) % 4) * 0.5);
    return {
      cohostId: host.id,
      rating,
      review: `${host.name} draft review for this episode. Replace this with the summarized discussion and let the host rewrite it later.`,
      pullQuote: rating >= 4 ? "A strong early swing." : "Still finding the formula.",
      draftSource: "manual",
      updatedAt: new Date().toISOString(),
    };
  });
}

function normalizeDataset(raw: unknown): PodcastDataset {
  if (!isRecord(raw)) throw new Error("The import must be a JSON object.");
  const source = isRecord(raw.dataset) ? raw.dataset : raw;
  const cohosts = normalizeCohosts(source.cohosts);
  const episodesRaw = Array.isArray(source.episodes) ? source.episodes : [];
  if (!episodesRaw.length) throw new Error("No episodes array was found.");
  const episodes = episodesRaw.map((episodeRaw, index) => normalizeEpisode(episodeRaw, cohosts, index)).sort(compareEpisodes);

  return {
    schemaVersion: "fg-letterlog-v2",
    showName: stringValue(source.showName ?? source.title ?? source.name, "Family Guy Rewatch Log"),
    subtitle: stringValue(source.subtitle ?? source.description, "A chronological podcast archive."),
    ratingScale: normalizeRatingScale(source.ratingScale, source.ratingLabel),
    cohosts,
    episodes,
  };
}

function normalizeRatingScale(raw: unknown, legacyLabel: unknown): PodcastDataset["ratingScale"] {
  if (isRecord(raw)) {
    return { label: stringValue(raw.label ?? raw.name, "Quahogs"), max: numberValue(raw.max, 5) };
  }
  return { label: stringValue(legacyLabel, "Quahogs"), max: 5 };
}

function normalizeCohosts(raw: unknown): Cohost[] {
  const cohosts = Array.isArray(raw) ? raw : [];
  const normalized = cohosts.map((hostRaw, index) => {
    if (typeof hostRaw === "string") {
      return { id: slugify(hostRaw), name: hostRaw, role: "Cohost", bio: "", accent: PALETTE[index % PALETTE.length] };
    }
    const record = isRecord(hostRaw) ? hostRaw : {};
    const name = stringValue(record.name ?? record.label ?? record.cohost, `Cohost ${index + 1}`);
    return {
      id: stringValue(record.id ?? record.slug, slugify(name)),
      name,
      role: stringValue(record.role, "Cohost"),
      bio: stringValue(record.bio ?? record.description, ""),
      accent: stringValue(record.accent ?? record.color, PALETTE[index % PALETTE.length]),
    };
  });
  return normalized.length ? normalized : demoDataset.cohosts;
}

function normalizeEpisode(raw: unknown, cohosts: Cohost[], index: number): Episode {
  const record = isRecord(raw) ? raw : {};
  const season = numberValue(record.season ?? record.seasonNumber, 1);
  const episodeNumber = numberValue(record.episodeNumber ?? record.episode ?? record.number, index + 1);
  const title = stringValue(record.title ?? record.name, `Episode ${index + 1}`);
  const reviews = normalizeReviews(record.reviews, cohosts);

  return {
    id: stringValue(record.id ?? record.slug, `s${String(season).padStart(2, "0")}e${String(episodeNumber).padStart(2, "0")}-${slugify(title)}`),
    season,
    episodeNumber,
    title,
    airDate: stringValue(record.airDate ?? record.firstAired ?? record.date, "Unknown"),
    runtime: formatRuntime(record.runtime ?? record.duration),
    imdbRating: stringValue(record.imdbRating ?? record.imdb ?? record.score, "--"),
    summary: stringValue(record.summary ?? record.synopsis ?? record.description, "No summary supplied."),
    cast: listValue(record.cast),
    guestStars: listValue(record.guestStars ?? record.guests),
    writers: listValue(record.writers ?? record.writer),
    director: stringValue(record.director, ""),
    facts: normalizeFacts(record.facts ?? record.metadata ?? record.details),
    watchStatus: normalizeStatus(record.watchStatus ?? record.status),
    podcastUrl: stringValue(record.podcastUrl ?? record.podcastEpisodeUrl ?? record.url, ""),
    transcriptNotes: stringValue(record.transcriptNotes ?? record.notes, ""),
    reviews,
  };
}

function normalizeReviews(raw: unknown, cohosts: Cohost[]): Review[] {
  const rawReviews = Array.isArray(raw) ? raw : [];
  const mapped: Review[] = rawReviews
    .map((item): Review | null => {
      if (!isRecord(item)) return null;
      const hostName = stringValue(item.cohost ?? item.name ?? item.author, "");
      const directId = stringValue(item.cohostId ?? item.hostId ?? item.id, "");
      const host = cohosts.find((cohost) => cohost.id === directId || cohost.name.toLowerCase() === hostName.toLowerCase());
      return {
        cohostId: (host?.id ?? directId) || slugify(hostName),
        rating: ratingValue(item.rating ?? item.score),
        review: stringValue(item.review ?? item.text ?? item.body, ""),
        pullQuote: stringValue(item.pullQuote ?? item.quote, ""),
        draftSource: item.draftSource === "transcript" ? "transcript" : "manual",
        updatedAt: stringValue(item.updatedAt, ""),
      };
    })
    .filter((item): item is Review => Boolean(item && item.cohostId));
  return alignReviews(mapped, cohosts);
}

function normalizeFacts(raw: unknown): EpisodeFact[] {
  if (Array.isArray(raw)) {
    return raw
      .map((item) => (isRecord(item) ? { label: stringValue(item.label ?? item.name, "Detail"), value: stringValue(item.value, "") } : null))
      .filter((item): item is EpisodeFact => Boolean(item && item.value));
  }
  if (isRecord(raw)) {
    return Object.entries(raw)
      .map(([label, value]) => ({ label: titleCase(label), value: listOrString(value) }))
      .filter((item) => item.value);
  }
  return [];
}




function parsePath(): Route {
  const path = window.location.pathname;
  if (path.startsWith('/reviews')) {
    const subpath = path.slice('/reviews'.length);
    if (subpath === '/pipeline') {
      return { page: 'pipeline' };
    }
    if (subpath === '/fg-admin') {
      return { page: 'fg-admin' };
    }
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
  if (route.page === 'host') return `/reviews/host/${encodeURIComponent(route.id)}`;
  if (route.page === 'fg-admin') return '/reviews/fg-admin';
  return '/reviews/pipeline';
}

function getDatasetMetrics(dataset: PodcastDataset) {
  const ratings = dataset.episodes.flatMap((episode) => episode.reviews.map((review) => review.rating).filter((rating): rating is number => rating !== null));
  return {
    episodeCount: dataset.episodes.length,
    publishedCount: dataset.episodes.filter((episode) => episode.watchStatus === "published").length,
    average: ratings.length ? ratings.reduce((sum, rating) => sum + rating, 0) / ratings.length : null,
  };
}

function averageRating(reviews: Review[]): number | null {
  const ratings = reviews.map((review) => review.rating).filter((rating): rating is number => rating !== null);
  return ratings.length ? ratings.reduce((sum, rating) => sum + rating, 0) / ratings.length : null;
}

function alignReviews(reviews: Review[], cohosts: Cohost[]): Review[] {
  const map = new Map(reviews.map((review) => [review.cohostId, review]));
  return cohosts.map((host) => map.get(host.id) ?? { cohostId: host.id, rating: null, review: "", pullQuote: "", draftSource: "manual" });
}

function searchableEpisodeText(episode: Episode): string {
  return [
    episode.title,
    episode.summary,
    episode.cast.join(" "),
    episode.guestStars.join(" "),
    episode.writers.join(" "),
    episode.director,
    episode.transcriptNotes,
    episode.reviews.map((review) => `${review.review} ${review.pullQuote ?? ""}`).join(" "),
  ]
    .join(" ")
    .toLowerCase();
}

function getSeasons(episodes: Episode[]): number[] {
  return Array.from(new Set(episodes.map((episode) => episode.season))).sort((left, right) => left - right);
}

function compareEpisodes(left: Episode, right: Episode): number {
  if (left.season !== right.season) return left.season - right.season;
  return left.episodeNumber - right.episodeNumber;
}

function seasonProgress(episodes: Episode[]): number {
  if (!episodes.length) return 0;
  const weights: Record<WatchStatus, number> = { backlog: 0, watched: 33, recorded: 66, published: 100 };
  return episodes.reduce((sum, episode) => sum + weights[episode.watchStatus], 0) / episodes.length;
}

function formatEpisodeCode(episode: Pick<Episode, "season" | "episodeNumber">): string {
  return `S${String(episode.season).padStart(2, "0")}E${String(episode.episodeNumber).padStart(2, "0")}`;
}

function posterColors(seed: string): string[] {
  let hash = 0;
  for (let index = 0; index < seed.length; index += 1) hash = seed.charCodeAt(index) + ((hash << 5) - hash);
  return [PALETTE[Math.abs(hash) % PALETTE.length], PALETTE[Math.abs(hash + 2) % PALETTE.length], PALETTE[Math.abs(hash + 4) % PALETTE.length]];
}

function normalizeStatus(raw: unknown): WatchStatus {
  const value = stringValue(raw, "backlog").toLowerCase();
  return STATUS_ORDER.includes(value as WatchStatus) ? (value as WatchStatus) : "backlog";
}

function stringValue(value: unknown, fallback = ""): string {
  if (typeof value === "string") return value.trim() || fallback;
  if (typeof value === "number" && Number.isFinite(value)) return String(value);
  if (typeof value === "boolean") return value ? "true" : "false";
  return fallback;
}

function numberValue(value: unknown, fallback: number): number {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim()) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : fallback;
  }
  return fallback;
}

function ratingValue(value: unknown): number | null {
  const parsed = numberValue(value, Number.NaN);
  return Number.isFinite(parsed) ? Math.min(5, Math.max(0, parsed)) : null;
}

function listValue(value: unknown): string[] {
  if (Array.isArray(value)) return value.map((item) => stringValue(item, "")).filter(Boolean);
  const text = stringValue(value, "");
  return text ? text.split(/\s*,\s*/).filter(Boolean) : [];
}

function listOrString(value: unknown): string {
  if (Array.isArray(value)) return listValue(value).join(", ");
  if (isRecord(value)) return Object.entries(value).map(([key, entry]) => `${titleCase(key)}: ${listOrString(entry)}`).join("; ");
  return stringValue(value, "");
}

function formatRuntime(value: unknown): string {
  if (typeof value === "number" && Number.isFinite(value)) return `${value} min`;
  return stringValue(value, "Unknown");
}

function titleCase(value: string): string {
  return value.replace(/([a-z])([A-Z])/g, "$1 $2").replace(/[_-]+/g, " ").replace(/\b\w/g, (char) => char.toUpperCase());
}



function slugify(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "") || "item";
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

// Helper to hash string to SHA-256 hex string using standard SubtleCrypto
async function sha256(message: string): Promise<string> {
  const msgBuffer = new TextEncoder().encode(message);
  const hashBuffer = await crypto.subtle.digest("SHA-256", msgBuffer);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");
}

function AdminLoginPage({
  adminHash,
  onLoginSuccess,
}: {
  adminHash: string;
  onLoginSuccess: () => void;
}) {
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      const hashedInput = await sha256(password);
      if (hashedInput === adminHash) {
        localStorage.setItem("fg-admin-token", adminHash);
        onLoginSuccess();
      } else {
        setError("Invalid passcode. Access denied.");
      }
    } catch (err) {
      setError("An unexpected error occurred during authorization.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="mx-auto max-w-md px-4 py-16 text-center animate-rise">
      <div className="rounded-[2rem] border border-white/10 bg-white/5 p-8 shadow-2xl">
        <h2 className="text-3xl font-black tracking-tight text-white">Admin Portal</h2>
        <p className="mt-2 text-sm text-slate-400">Enter the administration passcode to continue.</p>

        <form onSubmit={handleSubmit} className="mt-8 space-y-4">
          <div>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Passcode"
              className="field w-full text-center"
              autoFocus
              required
            />
          </div>

          {error && (
            <p className="text-sm font-semibold text-rose-400">{error}</p>
          )}

          <button
            type="submit"
            disabled={loading}
            className="primary-button w-full"
          >
            {loading ? "Authenticating..." : "Authorize"}
          </button>
        </form>
      </div>
    </div>
  );
}

export default App;