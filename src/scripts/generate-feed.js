import fs from 'fs';
import path from 'path';
import { createClient } from '@supabase/supabase-js';

// Simple helper to load environment variables from .env.local locally
function loadEnv() {
  const envPath = path.resolve('.env.local');
  if (fs.existsSync(envPath)) {
    const lines = fs.readFileSync(envPath, 'utf8').split('\n');
    for (const line of lines) {
      const match = line.match(/^\s*([^#\s=]+)\s*=\s*(.*)\s*$/);
      if (match) {
        const key = match[1];
        let val = match[2].trim();
        // Remove surrounding quotes if present
        if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
          val = val.slice(1, -1);
        }
        process.env[key] = val;
      }
    }
  }
}


function escapeXml(unsafe) {
  if (typeof unsafe !== 'string') return unsafe;
  return unsafe.replace(/[<>&'"]/g, function (c) {
    switch (c) {
      case '<': return '&lt;';
      case '>': return '&gt;';
      case '&': return '&amp;';
      case '\'': return '&apos;';
      case '"': return '&quot;';
    }
  });
}

async function generateFeed() {
  loadEnv();

  const supabaseUrl = process.env.VITE_SUPABASE_URL;
  const supabaseAnonKey = process.env.VITE_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseAnonKey) {
    console.error('Skipping RSS generation: Missing VITE_SUPABASE_URL or VITE_SUPABASE_ANON_KEY.');
    return;
  }

  const supabase = createClient(supabaseUrl, supabaseAnonKey);

  console.log('Fetching episodes from Supabase for RSS feed...');
  const { data: episodes, error } = await supabase
    .from('episodes')
    .select('id, season, episode_number, title, air_date, summary, podcast_url, created_at')
    .eq('watch_status', 'published')
    .order('season', { ascending: false })
    .order('episode_number', { ascending: false });

  if (error) {
    console.error('Error fetching episodes from Supabase:', error);
    process.exit(1);
  }

  console.log(`Found ${episodes?.length || 0} published episodes.`);

  const feedUrl = 'https://familyguyguys.com/feed.xml';
  const siteUrl = 'https://familyguyguys.com';
  
  let xml = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" 
  xmlns:itunes="http://www.itunes.com/dtds/podcast-1.0.dtd" 
  xmlns:content="http://purl.org/rss/1.0/modules/content/">
  <channel>
    <title>Family Guy Guys</title>
    <link>${siteUrl}</link>
    <language>en-us</language>
    <copyright>&#x2117; &amp; &#xA9; 2026 Family Guy Guys</copyright>
    <itunes:author>Collin, Tyler, and Jason</itunes:author>
    <itunes:type>episodic</itunes:type>
    <itunes:summary>A chronological rewatch podcast of Family Guy. Collin, Tyler, and Jason review every single episode.</itunes:summary>
    <description>A chronological rewatch podcast of Family Guy. Collin, Tyler, and Jason review every single episode.</description>
    <itunes:owner>
      <itunes:name>Family Guy Guys</itunes:name>
      <itunes:email>feedback@familyguyguys.com</itunes:email>
    </itunes:owner>
    <itunes:image href="${siteUrl}/og/podcast-art-512.png" />
    <itunes:category text="TV &amp; Film">
      <itunes:category text="After Shows" />
    </itunes:category>
    <itunes:explicit>yes</itunes:explicit>
`;

  if (episodes && episodes.length > 0) {
    for (const ep of episodes) {
      const pubDate = ep.air_date ? new Date(ep.air_date).toUTCString() : new Date(ep.created_at).toUTCString();
      const episodeUrl = `${siteUrl}/reviews/${escapeXml(encodeURIComponent(ep.id))}`;
      const mediaUrl = escapeXml(ep.podcast_url) || 'https://familyguyguys.com/placeholder.mp3'; // fallback placeholder

      xml += `    <item>
      <title>${escapeXml(ep.title)}</title>
      <description>${escapeXml(ep.summary || '')}</description>
      <link>${episodeUrl}</link>
      <guid isPermaLink="true">${episodeUrl}</guid>
      <pubDate>${escapeXml(String(pubDate))}</pubDate>
      <itunes:episodeType>full</itunes:episodeType>
      <itunes:season>${escapeXml(String(ep.season))}</itunes:season>
      <itunes:episode>${escapeXml(String(ep.episode_number))}</itunes:episode>
      <itunes:explicit>yes</itunes:explicit>
      <enclosure url="${mediaUrl}" length="0" type="audio/mpeg" />
    </item>
`;
    }
  }

  xml += `  </channel>
</rss>`;

  const outputPath = path.resolve('public/feed.xml');
  fs.writeFileSync(outputPath, xml, 'utf8');
  console.log(`RSS feed generated successfully at: ${outputPath}`);
}

generateFeed();
