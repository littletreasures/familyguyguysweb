-- Migration DDL: Create public.visitor_reviews table for community comments and ratings
CREATE TABLE IF NOT EXISTS public.visitor_reviews (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  episode_id text NOT NULL,
  author text NOT NULL,
  rating numeric NOT NULL,
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

-- Allow anonymous read access
CREATE POLICY "Allow anonymous read access" ON public.visitor_reviews
  FOR SELECT USING (true);

-- Allow anonymous insert access
CREATE POLICY "Allow anonymous insert access" ON public.visitor_reviews
  FOR INSERT WITH CHECK (true);
