# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

- **Primary users:** Both existing *Family Guy Guys* podcast listeners (browsing episode reviews, host ratings, glossary lore, and show notes/audio) and new or casual *Family Guy* fans discovering the show through search-indexed episode reviews or glossary entries and deciding whether to listen.
- **Secondary users:** Prospective podcast guests and collaborators looking for recording details and booking/contact information (`/guest`, `/contact`).

## Product Purpose

Serve as the official web hub and chronological rewatch archive for the *Family Guy Guys* podcast (`familyguyguys.com`), enabling listeners and newcomers to browse episodes, read structured episode reviews and reaction logs, explore podcast-specific critical frameworks and lore, and subscribe or listen across major podcast platforms.

## Positioning

A structured chronological rewatch archive—combining host ratings, live reaction logs, transcript breakdowns, and original critical frameworks and lore (such as the Headers-Gaggs Test and Arbitrary Rating Units)—rather than a generic podcast landing page or audio-feed wrapper.

## Operating Context

- Listeners and search visitors browse individual episode reviews, the glossary of show terminology, and the episode feed on desktop or mobile web.
- Episode review and glossary pages are prerendered for search discovery and social sharing, backed by Supabase data and local scripts (`src/scripts/prerender-reviews.js`, `src/scripts/prerender-glossary.js`, `src/scripts/generate-feed.js`).
- Local Python admin tools (`admin-tools/`) generate, edit, and publish episode metadata and reviews to Supabase separately from the public frontend.

## Capabilities and Constraints

- **Routes and features:** Home (`/`), Episode Feed (`/episodes`) with audio player, Episode Reviews (`/reviews` and prerendered review pages), The Headers-Gaggs Test (`/headers-gaggs`), Official Glossary (`/glossary`), Guest info/booking (`/guest`), Contact (`/contact`), and external listening links (Spotify, Apple Podcasts, YouTube, RSS).
- **Technical constraints:** Hybrid Vite vanilla JS shell (`src/main.js`, `src/router.js`) + React/TSX/TS reviews feature, deployed as static assets on Cloudflare Workers via Wrangler (`wrangler.jsonc`) with Supabase (`VITE_SUPABASE_URL` / `VITE_SUPABASE_ANON_KEY` only on the public frontend) and prerendered static HTML for reviews and glossary pages.
- **Data integrity:** Never expose server/service-role credentials on the frontend, and never invent fake listener quotes, ratings, benchmarks, or episode facts.

## Brand Commitments

- **Hosts:** Collin, Tyler, and Jason — preserve all three hosts and their authentic roles/perspectives.
- **Voice:** Irreverent comedy / fan-podcast voice; do not sanitize or flatten the show's tone, and preserve official podcast terminology and lore (e.g., *Structurehead*, *Gagger*, *Stewie Gay Watch*, *Arbitrary Rating Units*, *The Headers-Gaggs Test*).
- **Brand assets:** Existing wordmark (`title.png` / `title-*.webp`/`avif`), hero/host photography (`hero.png`, `collin1.png`, `collinhost.png`, `tyler1.png`, `tylerhost.png`, `jasontall.png`, `jasonhost.png`), and podcast platform links.

## Evidence on Hand

- Live episode and review data sourced from Supabase and prerendered build outputs (`src/data/`, `glossary-data.json`, `episodes/`, `src/transcripts/`, `public/feed.xml`).
- No fabricated testimonials, press quotes, download counts, or listener metrics; any new proof or claims must come from confirmed show data or user-provided assets.

## Product Principles

1. **Archive-first utility:** Treat episode reviews, host ratings, transcripts, and glossary lore as first-class navigable content, not secondary afterthoughts to a subscribe button.
2. **Discovery-to-listener flow:** Make search-landed review and glossary pages self-contained and engaging enough to convert curious *Family Guy* fans into podcast listeners.
3. **Preserve show voice and lore:** Keep Collin, Tyler, and Jason's irreverent comedy voice and original critical frameworks intact across all UI copy and structure.
4. **Static-ready & boundary-safe:** Respect the hybrid Vite + React/TSX prerendered Cloudflare Workers architecture and keep public frontend data strictly separated from admin tooling.
