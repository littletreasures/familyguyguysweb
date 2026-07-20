# SECURITY ACTIONS REQUIRED (Operator Checklist)

> [!IMPORTANT]
> The following human-controlled security actions **MUST** be performed by the repository owner / Supabase administrator. Automated repository fixes cannot execute external dashboard rotations or GitHub repository settings updates.

---

## 1. Environment File Clarification

- **Root Frontend (`/Volumes/.../FamilyGuyWebsite/.env.local`)**:
  - Contains **PUBLIC ONLY** keys used by Vite in the browser: `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY`.
- **Admin Tools Server Environment (`/Volumes/.../FamilyGuyWebsite/admin-tools/.env`)**:
  - Contains **SECRET SERVER** keys used by Python admin scripts on your local operator machine: `SUPABASE_URL`, `SUPABASE_SECRET_KEY` (or `SUPABASE_SERVICE_KEY`), `OMDB_API_KEY`, and LLM keys.
  - Create this file by copying `admin-tools/.env.example` to `admin-tools/.env`:
    ```bash
    cp admin-tools/.env.example admin-tools/.env
    ```

---

## 2. Credentials & Keys Rotation

- [x] **Supabase Secret Key / Service Role Key**:
  1. Open the [Supabase Dashboard](https://app.supabase.com/).
  2. Navigate to **Project Settings** -> **API**.
  3. Under **Project API Keys**, copy your **Secret Key** (`sb_secret_...` or `service_role`).
  4. In `admin-tools/.env`, set `SUPABASE_SECRET_KEY=your_secret_key` (or `SUPABASE_SERVICE_KEY=your_secret_key`).
- [x] **OMDb API Key**:
  - Configured in `admin-tools/.env`. Active and retained as is.
- [ ] **LLM Provider API Keys**:
  - Managed in `admin-tools/.env` (`GEMINI_API_KEY`, `OPENAI_API_KEY`, or `ANTHROPIC_API_KEY`).

---

## 3. Copy-Paste SQL Snippet for Supabase RLS Policies

Copy and execute the exact SQL block below in the **Supabase Dashboard -> SQL Editor**:

```sql
-- ===================================================
-- 1. EPISODES TABLE ROW-LEVEL SECURITY
-- ===================================================
ALTER TABLE public.episodes ENABLE ROW LEVEL SECURITY;

-- Drop legacy/existing policies to ensure clean state
DROP POLICY IF EXISTS "Public published episodes are viewable by everyone" ON public.episodes;
DROP POLICY IF EXISTS "Service role full access on episodes" ON public.episodes;

-- Allow public read access to published episodes only
CREATE POLICY "Public published episodes are viewable by everyone"
ON public.episodes
FOR SELECT
TO anon, authenticated
USING (watch_status = 'published');

-- Allow full management access for secret / service role only
CREATE POLICY "Service role full access on episodes"
ON public.episodes
FOR ALL
TO service_role
USING (true)
WITH CHECK (true);


-- ===================================================
-- 2. REVIEWS TABLE ROW-LEVEL SECURITY
-- ===================================================
ALTER TABLE public.reviews ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Reviews are viewable by everyone" ON public.reviews;
DROP POLICY IF EXISTS "Service role full access on reviews" ON public.reviews;

-- Allow public read access to reviews
CREATE POLICY "Reviews are viewable by everyone"
ON public.reviews
FOR SELECT
TO anon, authenticated
USING (true);

-- Allow full management access for secret / service role only
CREATE POLICY "Service role full access on reviews"
ON public.reviews
FOR ALL
TO service_role
USING (true)
WITH CHECK (true);


-- ===================================================
-- 3. HOSTS / COHOSTS TABLE ROW-LEVEL SECURITY
-- ===================================================
ALTER TABLE public.cohosts ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Cohosts are viewable by everyone" ON public.cohosts;
DROP POLICY IF EXISTS "Service role full access on cohosts" ON public.cohosts;

-- Allow public read access to cohosts
CREATE POLICY "Cohosts are viewable by everyone"
ON public.cohosts
FOR SELECT
TO anon, authenticated
USING (true);

-- Allow full management access for secret / service role only
CREATE POLICY "Service role full access on cohosts"
ON public.cohosts
FOR ALL
TO service_role
USING (true)
WITH CHECK (true);
```

---

## 4. GitHub & Repository Security Settings

- [x] **Enable GitHub Secret Scanning & Push Protection**:
  - Enabled under GitHub repository **Settings** -> **Code security and analysis**.
- [x] **Git History Audit**:
  - Executed `git log -p --all -- .env.local` — verified no secrets in history.

---

## 5. Verification Checklist

- [x] Python admin code supports both `SUPABASE_SECRET_KEY` and `SUPABASE_SERVICE_KEY`.
- [x] Frontend `.env.local` contains **ONLY** `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY`.
- [x] `admin-tools/.env` contains `SUPABASE_URL`, `SUPABASE_SECRET_KEY`, and `OMDB_API_KEY`.
- [x] Running `./admin-tools/run-admin.sh` binds exclusively to `127.0.0.1`.
