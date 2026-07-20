import fetch from 'node-fetch';
import cloudinary from 'cloudinary';
import fs from 'fs/promises';

cloudinary.v2.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

const WIKI_API = 'https://family-guy.fandom.com/api.php';
const DELAY_MS = 350; // polite crawl rate

// "Death Has a Shadow" → "death-has-a-shadow"
function titleToSlug(title) {
  return title
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, '')   // strip special chars
    .replace(/\s+/g, '-')            // spaces to hyphens
    .replace(/-+/g, '-')             // collapse double hyphens
    .trim();
}

// season 1, episode 3 → "s01e03"
function toEpisodeCode(season, episode) {
  return `s${String(season).padStart(2, '0')}e${String(episode).padStart(2, '0')}`;
}

// Build full slug: "s01e03-death-has-a-shadow"
function buildSlug(season, episode, title) {
  return `${toEpisodeCode(season, episode)}-${titleToSlug(title)}`;
}

async function getEpisodePages() {
  let pages = [];
  let cmcontinue = null;

  // Paginate through all category members (Fandom caps at 500/request)
  do {
    const params = new URLSearchParams({
      action: 'query',
      list: 'categorymembers',
      cmtitle: 'Category:Episodes',
      cmlimit: '500',
      format: 'json',
      ...(cmcontinue && { cmcontinue }),
    });
    const res = await fetch(`${WIKI_API}?${params}`);
    const data = await res.json();
    pages = pages.concat(data.query.categorymembers);
    cmcontinue = data.continue?.cmcontinue || null;
  } while (cmcontinue);

  return pages;
}

async function getEpisodeData(pageTitle) {
  // Get thumbnail + wikitext infobox in one API call
  const params = new URLSearchParams({
    action: 'query',
    titles: pageTitle,
    prop: 'pageimages|revisions',
    pithumbsize: '500',
    rvprop: 'content',
    rvsection: '0',       // only the infobox section
    format: 'json',
  });
  const res = await fetch(`${WIKI_API}?${params}`);
  const data = await res.json();
  const page = Object.values(data.query.pages)[0];

  const thumbUrl = page?.thumbnail?.source || null;
  const wikitext = page?.revisions?.[0]?.['*'] || '';

  // Parse season/episode from infobox: | season = 1 | epnum = 3
  const seasonMatch = wikitext.match(/\|\s*season\s*=\s*(\d+)/i);
  const epMatch = wikitext.match(/\|\s*epnum\s*=\s*(\d+)/i);

  const season = seasonMatch ? parseInt(seasonMatch[1]) : null;
  const episode = epMatch ? parseInt(epMatch[1]) : null;

  return { thumbUrl, season, episode };
}

async function uploadToCloudinary(imageUrl, slug) {
  return cloudinary.v2.uploader.upload(imageUrl, {
    public_id: slug,
    folder: 'family-guy-guys/episode-thumbnails',
    overwrite: false,
  });
}

async function run() {
  console.log('Fetching episode list from Fandom...');
  const episodes = await getEpisodePages();
  console.log(`Found ${episodes.length} pages in Category:Episodes\n`);

  const manifest = {};
  const errors = [];

  for (const ep of episodes) {
    // Skip non-episode pages that sneak into the category (e.g. "List of episodes")
    if (ep.title.toLowerCase().startsWith('list of') || ep.title.toLowerCase().startsWith('category:')) {
      console.log(`Skipping: ${ep.title}`);
      continue;
    }

    console.log(`Processing: ${ep.title}`);
    const { thumbUrl, season, episode } = await getEpisodeData(ep.title);

    if (!thumbUrl) {
      console.warn(`  ⚠ No thumbnail`);
      errors.push({ title: ep.title, reason: 'no thumbnail' });
      continue;
    }
    if (!season || !episode) {
      console.warn(`  ⚠ Could not parse season/episode numbers`);
      errors.push({ title: ep.title, reason: 'could not parse s/e numbers' });
      continue;
    }

    const slug = buildSlug(season, episode, ep.title);
    console.log(`  slug: ${slug}`);

    try {
      const result = await uploadToCloudinary(thumbUrl, slug);
      manifest[slug] = {
        title: ep.title,
        season,
        episode,
        cloudinary_url: result.secure_url,
        public_id: result.public_id,
      };
      console.log(`  ✓ ${result.secure_url}`);
    } catch (e) {
      console.error(`  ✗ Upload failed: ${e.message}`);
      errors.push({ title: ep.title, slug, reason: e.message });
    }

    await new Promise(r => setTimeout(r, DELAY_MS));
  }

  await fs.writeFile(
    'admin-tools/episode-manifest.json',
    JSON.stringify(manifest, null, 2)
  );
  await fs.writeFile(
    'admin-tools/scrape-errors.json',
    JSON.stringify(errors, null, 2)
  );

  console.log(`\n✅ Done. ${Object.keys(manifest).length} uploaded, ${errors.length} errors.`);
  console.log('Manifest saved to admin-tools/episode-manifest.json');
}

run();