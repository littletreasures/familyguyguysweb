-- Migration DDL: Add rating_terminology and rating_scale_max columns to reviews table
ALTER TABLE public.reviews ADD COLUMN IF NOT EXISTS rating_terminology text DEFAULT 'Quahogs';
ALTER TABLE public.reviews ADD COLUMN IF NOT EXISTS rating_scale_max integer DEFAULT 5;
