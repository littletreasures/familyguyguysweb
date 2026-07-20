// admin-tools/upsert-thumbnails.mjs
import { createClient } from '@supabase/supabase-js';
import manifest from './episode-manifest.json' assert { type: 'json' };

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY);

const rows = Object.entries(manifest).map(([slug, data]) => ({
  slug,
  title: data.title,
  season: data.season,
  episode: data.episode,
  thumbnail_url: data.cloudinary_url,
}));

const { error } = await supabase.from('episodes').upsert(rows, { onConflict: 'slug' });
if (error) console.error(error);
else console.log(`Upserted ${rows.length} episodes.`);