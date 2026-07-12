import fs from 'fs';
import path from 'path';

const PUBLIC_DIR = path.resolve('public');
const ASSETS_DIR = path.resolve('public/assets');

const IMAGES_TO_OPTIMIZE = [
  { file: 'hero.png', path: PUBLIC_DIR, widths: [480, 768, 1200], name: 'hero' },
  { file: 'title.png', path: PUBLIC_DIR, widths: [300, 600], name: 'title' },
  { file: 'tv-watching.png', path: PUBLIC_DIR, widths: [480, 768, 1200], name: 'tv-watching' },
  { file: 'collinhost.png', path: PUBLIC_DIR, widths: [400], name: 'collinhost' },
  { file: 'tylerhost.png', path: PUBLIC_DIR, widths: [400], name: 'tylerhost' },
  { file: 'jasonhost.png', path: PUBLIC_DIR, widths: [400], name: 'jasonhost' },
  { file: 'structurehead.png', path: ASSETS_DIR, widths: [300], name: 'structurehead' },
  { file: 'I’m A Gagger.png', path: ASSETS_DIR, widths: [300], name: 'I’m A Gagger' },
];

// Dynamically scan public/assets for episode thumbnails (e.g. ep003-thumb.jpg)
if (fs.existsSync(ASSETS_DIR)) {
  const files = fs.readdirSync(ASSETS_DIR);
  for (const file of files) {
    const match = file.match(/^(ep\d+-thumb)\.(jpg|jpeg|png)$/i);
    if (match) {
      const name = match[1];
      if (!IMAGES_TO_OPTIMIZE.some(img => img.file === file)) {
        IMAGES_TO_OPTIMIZE.push({
          file: file,
          path: ASSETS_DIR,
          widths: [180, 360],
          name: name
        });
      }
    }
  }
}

async function optimizeImage(img, sharp) {
  const inputPath = path.join(img.path, img.file);
  if (!fs.existsSync(inputPath)) {
    console.warn(`Input image not found: ${inputPath}`);
    return;
  }

  console.log(`Optimizing ${img.file}...`);

  for (const width of img.widths) {
    const isSingleWidth = img.widths.length === 1;
    const suffix = isSingleWidth ? '' : `-${width}w`;
    
    // Determine output paths (keep in the same directory as source)
    const outName = isSingleWidth ? path.basename(img.name) : `${path.basename(img.name)}${suffix}`;
    const outDir = path.dirname(path.join(img.path, img.name));
    
    const webpPath = path.join(outDir, `${outName}.webp`);
    const avifPath = path.join(outDir, `${outName}.avif`);

    const transformer = sharp(inputPath).resize(width);

    // Write WebP
    await transformer
      .clone()
      .webp({ quality: 80 })
      .toFile(webpPath);
    console.log(`  -> Generated WebP: ${path.relative('.', webpPath)}`);

    // Write AVIF
    await transformer
      .clone()
      .avif({ quality: 65 })
      .toFile(avifPath);
    console.log(`  -> Generated AVIF: ${path.relative('.', avifPath)}`);
  }
}

async function main() {
  let sharp;
  try {
    const sharpModule = await import('sharp');
    sharp = sharpModule.default;
  } catch (err) {
    console.warn('Skipping image optimization: sharp module could not be loaded (native binary support might be missing in this environment). Error:', err.message);
    return;
  }

  try {
    for (const img of IMAGES_TO_OPTIMIZE) {
      await optimizeImage(img, sharp);
    }
    console.log('Image optimization pipeline completed successfully.');
  } catch (err) {
    console.warn('Non-blocking error during image optimization:', err);
  }
}

main();
