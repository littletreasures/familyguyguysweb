# Cloudflare Deployment Runbook & Architecture Contract

This document defines the canonical deployment architecture, environment contracts, build-time safety mechanisms, and verification procedures for **familyguyguys.com**.

---

## 1. Single Host Mandate

> [!IMPORTANT]
> **Cloudflare Workers (`familyguyguysweb`) is the ONLY and SOLE host for `familyguyguys.com`.**
>
> There is **no secondary host**, no fallback CDN, and no dual-hosting configuration (such as Vercel, Netlify, or AWS S3/CloudFront).
> If anyone attempts to introduce an alternate hosting platform or split traffic, consult the repository git history to understand why doing so violates architectural integrity and constitutes a fireable offense.

All production DNS records, edge routing, static assets, and single-page application routing are managed exclusively through Cloudflare Workers using the configuration defined in [`wrangler.jsonc`](./wrangler.jsonc).

---

## 2. Build Contract & Environment Taxonomy

Static HTML generation and client bundles are generated at build time using deterministic data loaders.

### Build Scripts Taxonomy

| NPM Script | Command | Purpose / Target |
| :--- | :--- | :--- |
| `npm run build:cf` | `PRERENDER_DATA_MODE=${PRERENDER_DATA_MODE:-fixture} npm run build` | **Wrangler Custom Build Command**.<br>Resolves to `fixture` mode if `PRERENDER_DATA_MODE` is unset (used for pull requests and preview branches). In production, Cloudflare injects `PRERENDER_DATA_MODE=production`. |
| `npm run build:fixture` | `PRERENDER_DATA_MODE=fixture npm run build` | Explicit local or preview build using deterministic fixture files in `tests/fixtures/`. |
| `npm run build:production` | `PRERENDER_DATA_MODE=production npm run build` | Explicit production build pulling real episodes, reviews, and published transcripts from Supabase. |
| `npm run deploy` | `PRERENDER_DATA_MODE=production wrangler deploy` | Production deployment command executed by Cloudflare Workers Builds or local operators. |

### Environment Variables & Secrets Matrix

Production prerendering requires elevated read access to Supabase during build time. These variables must **never** be exposed in client code or `.env.local`.

| Variable | Scope | Required in Production? | Description |
| :--- | :--- | :---: | :--- |
| `PRERENDER_DATA_MODE` | Build-time | **Yes** (`production`) | Switches data loader from static JSON fixtures to live Supabase data. |
| `SUPABASE_URL` | Build-time | **Yes** | Supabase project REST API endpoint URL. |
| `SUPABASE_SECRET_KEY` / `SUPABASE_SERVICE_KEY` | Build-time | **Yes** | Privileged Supabase key to query episodes, reviews, and published transcripts. |
| `CLOUDINARY_CLOUD_NAME` | Build-time | **Yes** | Cloudinary cloud identifier for optimized asset transformations. |
| `VITE_SUPABASE_URL` | Client bundle | **Yes** | Public Supabase URL for client-side queries (visitor comments). |
| `VITE_SUPABASE_ANON_KEY` | Client bundle | **Yes** | Public anon key for client-side queries. |

> [!CAUTION]
> **Loud Failure Policy**:
> Silent fallbacks to mock or fixture data during production builds are **strictly prohibited**.
> If `PRERENDER_DATA_MODE=production` is set but `SUPABASE_URL` or `SUPABASE_SECRET_KEY` is missing or invalid, the build process will immediately terminate with a non-zero exit code.

---

## 3. Safety Tripwires & Provenance Walls

To ensure that mock data or malformed URLs never contaminate the production website, two independent defense layers are enforced during the build pipeline:

```
[ Supabase Production DB ]
            │
            ▼
┌──────────────────────────────────────┐
│  Layer 1: The Provenance Wall        │
│  (src/build/episode-data.js)         │
│  - Rejects is_synthetic flags        │
│  - Rejects mock-cohost-* IDs         │
│  - Validates transcript publication  │
└──────────────────────────────────────┘
            │
            ▼
┌──────────────────────────────────────┐
│  Layer 2: Audio URL Shape Validation │
│  (src/build/validate-audio.js)       │
│  - Rejects malformed podcast URLs    │
└──────────────────────────────────────┘
            │
            ▼
┌──────────────────────────────────────┐
│  Layer 3: The Synthetic Tripwire     │
│  (src/scripts/prerender-reviews.js)  │
│  - Scans rendered HTML for markers   │
│  - Fatal abort on test fixture text  │
└──────────────────────────────────────┘
            │
            ▼
[ Emitted Production HTML in dist/ ]
```

### Layer 1: Data Provenance Validation ("The Wall")
Location: [`src/build/episode-data.js`](./src/build/episode-data.js)

- Validates each episode returned from Supabase: aborts if `is_synthetic === true` or `id === 's99e99'`.
- Validates all host reviews: aborts if any review references a mock cohost identifier (e.g. `mock-cohost-*`).
- Validates transcripts: requires `status === 'published'`, non-null `published_at`, non-empty `sections`, and `!is_synthetic`.

### Layer 2: Audio URL Shape Validation
Location: [`src/build/validate-audio.js`](./src/build/validate-audio.js)

- Enforces valid HTTPS podcast media URLs (e.g. RSS.com feeds).
- Aborts production builds if audio URLs fail format or reachability assertions.

### Layer 3: HTML Marker Blocklist ("The Tripwire")
Location: [`src/scripts/prerender-reviews.js`](./src/scripts/prerender-reviews.js)

The `SYNTHETIC_FIXTURE_MARKERS` array contains known test fixtures and mock strings:
- `'Red Hot Chili Peppers and Cigarettes'`
- `'is_synthetic'`
- `'s99e99'`
- `'Mock Test Episode'`
- `'mock-cohost-'`
- `'mock-cohost-jason'`
- `'mock-cohost-tyler'`
- `'mock-cohost-collin'`
- `'The vanishing blender alert'`
- `'Tyler\'s math meltdown'`
- `'We cranked our hogs pretty hard'`
- `'A legendary kickoff'`
- `'Still finding the formula'`

During production prerendering, every generated HTML document is scanned against this blocklist. If any marker is present, prerendering aborts immediately with `FATAL: Production artifact contains synthetic fixture marker`.

---

## 4. Deployment Procedure

### Option A: Cloudflare Workers CI (Automated via Git)

1. Ensure all changes are committed and pushed to the tracking branch (`main` or production release branch).
2. Cloudflare Workers Builds executes the user deploy command: `npm run deploy` (which runs `PRERENDER_DATA_MODE=production wrangler deploy`).
3. Wrangler triggers its custom build command: `npm run build:cf` (resolving `PRERENDER_DATA_MODE=production npm run build`).
4. Artifacts from `dist/` are deployed globally across Cloudflare's edge network.

### Option B: Local CLI Deployment (Manual Operator)

> [!WARNING]
> Manual deployment requires explicit approval and local access to the production credentials in your environment.

```bash
# 1. Verify code hygiene, types, and test suite
npm run typecheck
npm run lint
npm test

# 2. Deploy to Cloudflare Workers with production prerendering
npm run deploy
```

---

## 5. Verification Runbook & Health Checks

After any deployment to production, perform the following verification commands to ensure routing, server identity, and content integrity.

### 1. Host & Server Identity Check

Verify that responses are served exclusively by Cloudflare and that no legacy host headers (e.g. `x-vercel`) exist:

```bash
curl -sSI https://familyguyguys.com/reviews/s1e6 | grep -i "server:\|x-vercel\|cf-ray"
```

**Expected Output:**
- `server: cloudflare`
- `cf-ray: <ray-id>-<colo>`
- **No** `x-vercel*` headers present.

### 2. Live Review Content Assertion

Verify that real production review quotes and custom rating terminology are present in the prerendered HTML:

```bash
curl -sSL https://familyguyguys.com/reviews/s1e6 | grep -o "Two out of five reservations\|Giggitys"
```

**Expected Output:**
```text
Two out of five reservations
Giggitys
```

### 3. Synthetic Marker Absence Assertion

Verify that test fixture text has not leaked into production pages:

```bash
curl -sSL https://familyguyguys.com/reviews/s1e6 | grep -o "vanishing blender\|math meltdown\|podcast-art-512"
```

**Expected Output:**
- Empty output (exit code 1 / no matches found).

---

## 6. Rollback & Emergency Incident Response

If a faulty build is deployed or a regression is detected:

1. **Instant Rollback via Wrangler / Cloudflare Dashboard**:
   - In Cloudflare Dashboard: Navigate to **Workers & Pages** → **`familyguyguysweb`** → **Deployments**.
   - Select the previous stable deployment and click **Rollback**.
2. **CLI Rollback**:
   ```bash
   npx wrangler rollback
   ```
3. **Verify Health**:
   - Re-run the verification commands in [Section 5](#5-verification-runbook--health-checks).
