-- Migration DDL: Add youtube_url column to episodes table
ALTER TABLE public.episodes ADD COLUMN IF NOT EXISTS youtube_url text DEFAULT '';

-- Backfill Data for Episodes 1, 2, and 3
UPDATE public.episodes
SET 
  youtube_url = 'https://youtu.be/-NQAqWC2BK0',
  watch_status = 'published',
  summary = 'The format is introduced and immediately derailed. Stewie Gay Watch officially launches (verdict: not yet). Tyler reveals he watched the original broadcast as an 8-year-old. Collin did not see it until middle school and we judge him for it. Jason plays the theme song entirely too loud. The hogs are cranked. 461 episodes remaining.',
  air_date = '31 Jan 1999',
  runtime = '30 min',
  imdb_rating = '7.6',
  director = 'Peter Shin, Roy Allen Smith',
  cast = '{"Seth MacFarlane","Alex Borstein","Seth Green"}'::text[],
  writers = '{"Seth MacFarlane","David Zuckerman","Mike Henry"}'::text[]
WHERE id = 's1e1';

UPDATE public.episodes
SET 
  youtube_url = 'https://youtu.be/a9Y_LX9c8Bk',
  watch_status = 'published',
  summary = 'Peter teaches Meg to drive and immediately turns the town''s satellite dish into scrap metal. That''s the real episode. What we actually talk about: an AI that tried to summarize the season for us and just started inventing cults out of thin air, Jedi semen retention, Al Pacino (briefly), and so many stories about convertibles it''ll make your head spin.',
  air_date = '11 Apr 1999',
  runtime = '23 min',
  imdb_rating = '7.5',
  director = 'Michael Dante DiMartino, Peter Shin, Roy Allen Smith',
  cast = '{"Seth MacFarlane","Alex Borstein","Seth Green"}'::text[],
  writers = '{"Seth MacFarlane","David Zuckerman","Chris Sheridan"}'::text[]
WHERE id = 's1e2';

UPDATE public.episodes
SET 
  youtube_url = 'https://youtu.be/BcrVPdWeCZ4',
  watch_status = 'published',
  summary = 'Lois plans a party for Stewie''s first birthday, while Meg gets mixed up in a weird cult. Meanwhile, on the pod: Collin''s faith in the project is severely shaken, Tyler aligns spiritually with the show after a trip to the Cheesecake Factory, and Jason declares the episode a clunker while sick all week. Plus, Star Wars references and sinus rinsing.',
  air_date = '18 Apr 1999',
  runtime = '30 min',
  imdb_rating = '7.6',
  director = 'Dominic Polcino, Peter Shin, Roy Allen Smith',
  cast = '{"Seth MacFarlane","Alex Borstein","Seth Green"}'::text[],
  writers = '{"Seth MacFarlane","David Zuckerman","Danny Smith"}'::text[]
WHERE id = 's1e3';

