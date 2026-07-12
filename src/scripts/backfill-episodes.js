import fs from 'fs';
import path from 'path';
import { createClient } from '@supabase/supabase-js';

// Load .env.local variables
const envPath = path.resolve('.env.local');
const envVars = { ...process.env };

if (fs.existsSync(envPath)) {
  const envContent = fs.readFileSync(envPath, 'utf8');
  for (const line of envContent.split('\n')) {
    const match = line.match(/^\s*([^#\s=]+)\s*=\s*(.*)\s*$/);
    if (match) {
      let val = match[2].trim();
      if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
        val = val.slice(1, -1);
      }
      envVars[match[1]] = val;
    }
  }
}

const supabaseUrl = envVars.VITE_SUPABASE_URL;
const supabaseKey = envVars.SUPABASE_SERVICE_KEY || envVars.VITE_SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl) {
  console.error('Error: VITE_SUPABASE_URL is not set.');
  process.exit(1);
}

if (!supabaseKey) {
  console.error('========================================================================');
  console.error('WARNING: SUPABASE_SERVICE_KEY or VITE_SUPABASE_SERVICE_ROLE_KEY not found.');
  console.error('Row-level security (RLS) is active on the episodes table. Updates will');
  console.error('fail if using the public anon key.');
  console.error('Please run this script with the service role key:');
  console.error('  SUPABASE_SERVICE_KEY=your_service_role_key node src/scripts/backfill-episodes.js');
  console.error('========================================================================');
}

const supabase = createClient(supabaseUrl, supabaseKey || envVars.VITE_SUPABASE_ANON_KEY);

const episodesToUpdate = [
  {
    "id": "s1e1",
    "season": 1,
    "episode_number": 1,
    "title": "Death Has a Shadow",
    "air_date": "31 Jan 1999",
    "runtime": "30 min",
    "imdb_rating": "7.6",
    "summary": "The format is introduced and immediately derailed. Stewie Gay Watch officially launches (verdict: not yet). Tyler reveals he watched the original broadcast as an 8-year-old. Collin did not see it until middle school and we judge him for it. Jason plays the theme song entirely too loud. The hogs are cranked. 461 episodes remaining.",
    "cast": [
      "Seth MacFarlane",
      "Alex Borstein",
      "Seth Green"
    ],
    "writers": [
      "Seth MacFarlane",
      "David Zuckerman",
      "Mike Henry"
    ],
    "director": "Peter Shin, Roy Allen Smith",
    "youtube_url": "https://youtu.be/-NQAqWC2BK0"
  },
  {
    "id": "s1e2",
    "season": 1,
    "episode_number": 2,
    "title": "I Never Met the Dead Man",
    "air_date": "11 Apr 1999",
    "runtime": "23 min",
    "imdb_rating": "7.5",
    "summary": "Peter teaches Meg to drive and immediately turns the town's satellite dish into scrap metal. That's the real episode. What we actually talk about: an AI that tried to summarize the season for us and just started inventing cults out of thin air, Jedi semen retention, Al Pacino (briefly), and so many stories about convertibles it'll make your head spin.",
    "cast": [
      "Seth MacFarlane",
      "Alex Borstein",
      "Seth Green"
    ],
    "writers": [
      "Seth MacFarlane",
      "David Zuckerman",
      "Chris Sheridan"
    ],
    "director": "Michael Dante DiMartino, Peter Shin, Roy Allen Smith",
    "youtube_url": "https://youtu.be/a9Y_LX9c8Bk"
  },
  {
    "id": "s1e3",
    "season": 1,
    "episode_number": 3,
    "title": "Chitty Chitty Death Bang",
    "air_date": "18 Apr 1999",
    "runtime": "30 min",
    "imdb_rating": "7.6",
    "summary": "Lois plans a party for Stewie's first birthday, while Meg gets mixed up in a weird cult. Meanwhile, on the pod: Collin's faith in the project is severely shaken, Tyler aligns spiritually with the show after a trip to the Cheesecake Factory, and Jason declares the episode a clunker while sick all week. Plus, Star Wars references and sinus rinsing.",
    "cast": [
      "Seth MacFarlane",
      "Alex Borstein",
      "Seth Green"
    ],
    "writers": [
      "Seth MacFarlane",
      "David Zuckerman",
      "Danny Smith"
    ],
    "director": "Dominic Polcino, Peter Shin, Roy Allen Smith",
    "youtube_url": "https://youtu.be/BcrVPdWeCZ4"
  }
];

async function run() {
  console.log('Starting backfill of episodes table with OMDb and custom data...');
  
  for (const ep of episodesToUpdate) {
    console.log(`Updating ${ep.id} (${ep.title})...`);
    const { data, error } = await supabase
      .from('episodes')
      .update({
        youtube_url: ep.youtube_url,
        watch_status: 'published',
        summary: ep.summary,
        air_date: ep.air_date,
        runtime: ep.runtime,
        imdb_rating: ep.imdb_rating,
        director: ep.director,
        cast: ep.cast,
        writers: ep.writers
      })
      .eq('id', ep.id)
      .select();

    if (error) {
      console.error(`Error updating ${ep.id}:`, error);
    } else if (!data || data.length === 0) {
      console.warn(`Warning: No rows updated for ${ep.id}. This occurs if write permission is denied.`);
    } else {
      console.log(`Successfully updated ${ep.id}: `, data[0].title);
    }
  }
  
  console.log('Backfill script execution completed.');
}

run();
