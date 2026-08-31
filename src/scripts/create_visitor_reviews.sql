-- Migration DDL: Create public.visitor_reviews table for community comments and ratings
CREATE TABLE IF NOT EXISTS public.visitor_reviews (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  episode_id text NOT NULL,
  author text NOT NULL,
  rating numeric NOT NULL CHECK (rating >= 0 AND rating <= 100),
  scale text NOT NULL,
  terminology text NOT NULL,
  content text NOT NULL,
  likes integer DEFAULT 0,
  created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Enable Row Level Security (RLS)
ALTER TABLE public.visitor_reviews ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if any
DROP POLICY IF EXISTS "Allow anonymous read access" ON public.visitor_reviews;
DROP POLICY IF EXISTS "Allow anonymous insert access" ON public.visitor_reviews;
DROP POLICY IF EXISTS "Allow anonymous update likes access" ON public.visitor_reviews;

-- 1. Allow anonymous read access
CREATE POLICY "Allow anonymous read access" ON public.visitor_reviews
  FOR SELECT USING (true);

-- 2. Allow anonymous insert access
CREATE POLICY "Allow anonymous insert access" ON public.visitor_reviews
  FOR INSERT WITH CHECK (true);

-- 3. Allow anonymous update strictly on the likes counter (Option B)
-- Revoke general table-wide update privileges from anon & authenticated
REVOKE UPDATE ON public.visitor_reviews FROM anon, authenticated;

-- Grant column-level UPDATE privilege strictly on the `likes` column
GRANT UPDATE (likes) ON public.visitor_reviews TO anon;
GRANT UPDATE (likes) ON public.visitor_reviews TO authenticated;

-- Create scoped RLS update policy for likes
CREATE POLICY "Allow anonymous update likes access" ON public.visitor_reviews
  FOR UPDATE USING (true) WITH CHECK (true);

-- ============================================================================
-- SECURE UPDATE / LIKES POLICY GUIDELINES & ALTERNATIVES
-- ============================================================================
-- Security Note:
-- Do NOT create an open column-wide or table-wide UPDATE policy (e.g. `FOR UPDATE USING (true)`)
-- without column-level grants. An unrestricted UPDATE policy would allow anonymous visitors
-- to maliciously alter other fields such as author, rating, scale, terminology, or content.
--
-- The active configuration above uses Option B (Column-Level Grant + Scoped Policy).
-- Below is the alternative Option A (Security Definer RPC) if preferred:
--
-- OPTION A (Alternative): Security Definer RPC Function
-- ------------------------------------------------------
-- An isolated PostgreSQL function executes with elevated permissions strictly for the like counter:
--
-- CREATE OR REPLACE FUNCTION public.increment_like(review_id uuid)
-- RETURNS integer
-- LANGUAGE plpgsql
-- SECURITY DEFINER
-- AS $$
-- DECLARE
--   new_likes integer;
-- BEGIN
--   UPDATE public.visitor_reviews
--   SET likes = COALESCE(likes, 0) + 1
--   WHERE id = review_id
--   RETURNING likes INTO new_likes;
--   RETURN new_likes;
-- END;
-- $$;
--
-- GRANT EXECUTE ON FUNCTION public.increment_like(uuid) TO anon, authenticated;
--
-- ============================================================================
-- LIVE DATABASE POLICY VERIFICATION QUERIES
-- ============================================================================
-- Run the following queries against the live database in the Supabase SQL editor
-- to audit and verify policies and privilege settings:
--
-- 1. Verify active Row Level Security (RLS) policies on visitor_reviews:
--    select * from pg_policies where tablename = 'visitor_reviews';
--
-- 2. Verify column-level privileges granted on visitor_reviews:
--    select table_schema, table_name, column_name, privilege_type
--    from information_schema.column_privileges
--    where table_name = 'visitor_reviews';
--
-- 3. Verify table-level privileges granted on visitor_reviews:
--    select grantee, privilege_type
--    from information_schema.role_table_grants
--    where table_name = 'visitor_reviews';
-- ============================================================================

