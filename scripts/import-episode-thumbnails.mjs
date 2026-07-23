import "dotenv/config";
import fs from "node:fs/promises";
import pLimit from "p-limit";
import { createClient } from "@supabase/supabase-js";
import { v2 as cloudinary } from "cloudinary";

const WIKI_API = "https://familyguy.fandom.com/api.php";
const CLOUDINARY_FOLDER = "family-guy/episodes";
const CONCURRENCY = 1;
const ONLY_EPISODE_ID = process.argv[2] || null;
const RESULTS_FILE = "./thumbnail-import-results.json";

const requiredEnv = [
  "SUPABASE_URL",
  "SUPABASE_SECRET_KEY",
  "CLOUDINARY_CLOUD_NAME",
  "CLOUDINARY_API_KEY",
  "CLOUDINARY_API_SECRET"
];

for (const key of requiredEnv) {
  if (!process.env[key]) {
    throw new Error(`Missing ${key} in your .env file`);
  }
}

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SECRET_KEY
);

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
  secure: true
});

const headers = {
  "User-Agent":
    "FamilyGuyGuysPodcastThumbnailImporter/1.0 (personal editorial podcast site)",
  Accept: "application/json, text/plain, */*"
};

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function fandomApi(params) {
  const url = new URL(WIKI_API);

  url.search = new URLSearchParams({
    action: "query",
    format: "json",
    formatversion: "2",
    origin: "*",
    ...params
  });

  const response = await fetch(url, { headers });

  if (!response.ok) {
    throw new Error(`Fandom API request failed: HTTP ${response.status}`);
  }

  return response.json();
}

async function findFandomImage(title) {
  const data = await fandomApi({
    prop: "pageimages",
    piprop: "original",
    redirects: "1",
    titles: title
  });

  const page = data?.query?.pages?.[0];

  if (!page || page.missing) {
    throw new Error(`No Fandom page found for "${title}"`);
  }

  if (!page.original?.source) {
    throw new Error(`No lead image available for "${page.title}"`);
  }

  return {
    fandomPage: page.title,
    sourceUrl: page.original.source
  };
}

async function downloadImage(sourceUrl) {
  const response = await fetch(sourceUrl, {
    headers: {
      ...headers,
      Accept: "image/avif,image/webp,image/apng,image/svg+xml,image/*,*/*;q=0.8",
      Referer: "https://familyguy.fandom.com/"
    }
  });

  if (!response.ok) {
    throw new Error(`Fandom image download failed: HTTP ${response.status}`);
  }

  const contentType = response.headers.get("content-type") || "";

  if (!contentType.startsWith("image/")) {
    throw new Error(`Source returned "${contentType}", not an image`);
  }

  return Buffer.from(await response.arrayBuffer());
}

function uploadToCloudinary(imageBuffer, episode, sourceUrl, fandomPage) {
  const publicId = `${CLOUDINARY_FOLDER}/${episode.id}`;

  return new Promise((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream(
      {
        resource_type: "image",
        public_id: publicId,
        overwrite: true,
        unique_filename: false,
        use_filename: false,
        tags: [
          "family-guy",
          "episode-thumbnail",
          `episode-${episode.id}`,
          `season-${episode.season}`
        ],
        context: {
          episode_id: episode.id,
          episode_title: episode.title,
          fandom_page: fandomPage,
          source_url: sourceUrl
        }
      },
      (error, result) => {
        if (error) reject(error);
        else resolve(result);
      }
    );

    stream.end(imageBuffer);
  });
}

async function setEpisodeStatus(id, updates) {
  const { error } = await supabase
    .from("episodes")
    .update({
      ...updates,
      thumbnail_updated_at: new Date().toISOString()
    })
    .eq("id", id);

  if (error) {
    throw new Error(`Supabase update failed for ${id}: ${error.message}`);
  }
}

async function importOneEpisode(episode) {
  try {
    const { fandomPage, sourceUrl } = await findFandomImage(episode.title);
    await sleep(800);

    const imageBuffer = await downloadImage(sourceUrl);
    const cloudinaryResult = await uploadToCloudinary(
      imageBuffer,
      episode,
      sourceUrl,
      fandomPage
    );

    await setEpisodeStatus(episode.id, {
      thumbnail_public_id: cloudinaryResult.public_id,
      thumbnail_url: cloudinaryResult.secure_url,
      thumbnail_source_url: sourceUrl,
      thumbnail_status: "uploaded",
      thumbnail_error: null
    });

    return {
      id: episode.id,
      title: episode.title,
      status: "uploaded",
      cloudinary_public_id: cloudinaryResult.public_id,
      cloudinary_url: cloudinaryResult.secure_url
    };
  } catch (error) {
    const message = error.message || "Unknown import error";

    await setEpisodeStatus(episode.id, {
      thumbnail_status: "failed",
      thumbnail_error: message
    });

    return {
      id: episode.id,
      title: episode.title,
      status: "failed",
      error: message
    };
  }
}

let query = supabase
  .from("episodes")
  .select("id, season, episode_number, title, thumbnail_status")
  .order("season", { ascending: true })
  .order("episode_number", { ascending: true });

if (ONLY_EPISODE_ID) {
  query = query.eq("id", ONLY_EPISODE_ID);
} else {
  query = query.in("thumbnail_status", ["pending", "failed"]);
}

const { data: episodes, error } = await query;

if (error) {
  throw new Error(`Could not fetch episodes: ${error.message}`);
}

if (!episodes?.length) {
  console.log("No pending or failed thumbnail imports found.");
  process.exit(0);
}

console.log(`Importing ${episodes.length} episode thumbnail(s)...`);

const limit = pLimit(CONCURRENCY);
const results = await Promise.all(
  episodes.map((episode) => limit(() => importOneEpisode(episode)))
);

await fs.writeFile(RESULTS_FILE, JSON.stringify(results, null, 2));

console.table(results);

const uploaded = results.filter((result) => result.status === "uploaded").length;
const failed = results.filter((result) => result.status === "failed").length;

console.log(`Uploaded: ${uploaded}`);
console.log(`Failed: ${failed}`);
console.log(`Detailed results: ${RESULTS_FILE}`);

if (failed > 0) {
  process.exitCode = 1;
}