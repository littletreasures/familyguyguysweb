# Family Guy Guys — Podcast Reviews Project

A comprehensive web application and admin pipeline for managing and displaying episode reviews for the "Family Guy Guys" podcast. This project consists of a Vite React frontend for users to browse and read reviews, and Python-based admin tools to generate, edit, and publish reviews directly to a Supabase database.

---

## Security & Trust Boundaries

> [!IMPORTANT]
> This repository strictly separates the **Public Frontend Domain** from the **Server Admin Domain**:
> - **Public Frontend (`.env.local`)**: Contains **ONLY** `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY`. Never place service role keys or server secrets in frontend configuration.
> - **Server Admin (`admin-tools/.env`)**: Contains `SUPABASE_URL`, `SUPABASE_SERVICE_KEY`, `OMDB_API_KEY`, and LLM keys. Used exclusively by Python admin utilities on local operator machines.

---

## Code Verification Commands

Run quality and security checks locally:

```bash
# Typecheck TypeScript paths
npm run typecheck

# Lint JavaScript and TypeScript
npm run lint

# Check formatting
npm run format:check

# Run Vitest unit & security test suite
npm test

# Build production bundle
npm run build
```

---

## Vite React Frontend Setup & Run Guide

### Installation & Environment

1. Install Node dependencies:
   ```bash
   npm install
   ```
2. Create `.env.local` in the root directory (copied from `.env.example`):
   ```env
   VITE_SUPABASE_URL=https://your-supabase-project.supabase.co
   VITE_SUPABASE_ANON_KEY=your_public_anon_key
   ```

3. Start local development server:
   ```bash
   npm run dev
   ```

---

## Admin Tools Setup & Safe Local Run Guide

The admin tools are local Python utilities for fetching episode metadata and generating episode reviews.

### Installation

1. Navigate to `admin-tools`:
   ```bash
   cd admin-tools
   ```
2. Install Python requirements:
   ```bash
   pip install -r requirements.txt
   ```
3. Copy `.env.example` to `.env` and fill in server credentials:
   ```env
   ENVIRONMENT=development
   SUPABASE_URL=https://your-supabase-project.supabase.co
   SUPABASE_SERVICE_KEY=your_supabase_service_role_key
   OMDB_API_KEY=your_omdb_api_key
   ```

### Safe Local Launch (Localhost Only)

Run the Streamlit GUI bound strictly to `127.0.0.1`:

```bash
# Using the safe local launcher script:
./run-admin.sh

# Or directly:
streamlit run app.py --server.address 127.0.0.1 --server.port 8501
```

> [!NOTE]
> Database write operations in the GUI require typing the explicit confirmation string `PUBLISH TO PRODUCTION`. Dry-run mode allows previewing payloads without performing database writes.

---

## Publishing New Episodes Workflow

1. **Fetch Metadata & Validate**:
   ```bash
   python omdb_fetch.py --season 1 --episode 6 --episode-id s1e6 --youtube-url "https://youtu.be/your-video-id"
   ```
2. **Generate and Upload Reviews**:
   ```bash
   python generate_review.py --transcript transcript.txt --episode-id s1e6 --provider gemini --out s1e6_review.json
   python supabase_upsert.py --review-json s1e6_review.json
   ```
3. **Operator Verification**:
   Verify external security checklist items in [SECURITY_ACTIONS_REQUIRED.md](SECURITY_ACTIONS_REQUIRED.md).


