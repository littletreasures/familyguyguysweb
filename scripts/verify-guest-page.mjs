import fs from 'node:fs';
import path from 'node:path';
import * as cheerio from 'cheerio';

const ROOT_DIR = process.cwd();

console.log('=== Starting Automated Verification for Guest Page (/guest) ===\n');

let passCount = 0;
let failCount = 0;

function assert(condition, message) {
  if (condition) {
    console.log(`  ✓ ${message}`);
    passCount++;
  } else {
    console.error(`  ✗ FAIL: ${message}`);
    failCount++;
  }
}

// 1. Verify Image Presence on Disk (public and dist)
console.log('1. Checking image assets on disk (public/ and dist/)...');
const requiredImages = [
  'hosts/jasonhost.webp',
  'hosts/tylerhost.webp',
  'hosts/collinhost.webp',
  'guests/danny.png',
  'guests/sallie.png',
  'guests/christian.png',
  'guests/tim.png',
];

for (const img of requiredImages) {
  const publicPath = path.join(ROOT_DIR, 'public', img);
  const distPath = path.join(ROOT_DIR, 'dist', img);
  assert(fs.existsSync(publicPath), `public/${img} exists`);
  assert(fs.existsSync(distPath), `dist/${img} exists in build output`);
}

// 2. HTML Markup Structure Checks (both index.html and dist/index.html)
const htmlFiles = [
  { name: 'index.html', path: path.join(ROOT_DIR, 'index.html') },
  { name: 'dist/index.html', path: path.join(ROOT_DIR, 'dist', 'index.html') },
];

for (const { name, path: filePath } of htmlFiles) {
  console.log(`\n2. Checking HTML structure in ${name}...`);
  assert(fs.existsSync(filePath), `${name} exists`);
  const content = fs.readFileSync(filePath, 'utf8');
  const $ = cheerio.load(content);

  const guestPage = $('#page-guest');
  assert(guestPage.length === 1, `#page-guest element is present`);
  assert(guestPage.hasClass('page'), `#page-guest has class "page"`);

  // Verify all 8 sections in order
  const expectedSections = [
    { selector: 'section.guest-hero', name: '1. Hero' },
    { selector: 'section.guest-show-section', name: '2. What The Show Is' },
    { selector: 'section.guest-logistics-section', name: '3. Format and Logistics' },
    { selector: 'section.guest-hosts-section', name: '4. Hosts' },
    { selector: 'section.guest-boundaries-section', name: '5. Guest Expectations & Boundaries' },
    { selector: 'section.guest-process-section', name: '6. Guest Process' },
    { selector: 'section.guest-past-guests-section', name: '7. Selected Guests' },
    { selector: 'section.guest-bottom-cta', name: '8. Booking and Release CTA' },
  ];

  const sections = guestPage.find('section').toArray();
  assert(sections.length === 8, `#page-guest contains exactly 8 sections (found: ${sections.length})`);

  expectedSections.forEach(({ selector, name: sectionName }, index) => {
    const el = guestPage.find(selector);
    assert(el.length === 1, `Section ${sectionName} (${selector}) exists`);
    if (sections[index]) {
      const isMatch = $(sections[index]).is(selector);
      assert(isMatch, `Section ${sectionName} is at index ${index + 1} of 8`);
    }
  });

  // Check Cal.com booking links
  const bookingLinks = guestPage.find('a.guest-cta-booking');
  assert(bookingLinks.length === 2, `Found exactly 2 Cal.com booking CTA links`);
  bookingLinks.each((_, el) => {
    const href = $(el).attr('href');
    const target = $(el).attr('target');
    const rel = $(el).attr('rel');
    assert(href === 'https://cal.com/fagugu', `Booking CTA href is https://cal.com/fagugu`);
    assert(target === '_blank', `Booking CTA target is _blank`);
    assert(rel && rel.includes('noopener') && rel.includes('noreferrer'), `Booking CTA has rel="noopener noreferrer"`);
  });

  // Check email links
  const emailLinks = guestPage.find('a.guest-cta-email');
  assert(emailLinks.length === 2, `Found exactly 2 email CTA links`);
  emailLinks.each((_, el) => {
    const href = $(el).attr('href');
    assert(href === 'mailto:guests@familyguyguys.com', `Email CTA href is mailto:guests@familyguyguys.com`);
  });

  // Check DocuSeal release link
  const releaseLinks = guestPage.find('a.guest-release-btn');
  assert(releaseLinks.length === 1, `Found exactly 1 DocuSeal release button`);
  releaseLinks.each((_, el) => {
    const href = $(el).attr('href');
    const target = $(el).attr('target');
    const rel = $(el).attr('rel');
    const location = $(el).attr('data-analytics-location');
    assert(href === 'https://docuseal.com/d/sohRPEzpxqPK3V', `Release link href is DocuSeal URL`);
    assert(target === '_blank', `Release link target is _blank`);
    assert(rel && rel.includes('noopener') && rel.includes('noreferrer'), `Release link has rel="noopener noreferrer"`);
    assert(location === 'already_booked', `Release link has data-analytics-location="already_booked"`);
  });

  // Check Matty Frances placeholder accessibility attributes
  const mattyPlaceholder = guestPage.find('.guest-portrait-placeholder');
  assert(mattyPlaceholder.length === 1, `Matty Frances placeholder element exists`);
  assert(mattyPlaceholder.attr('role') === 'img', `Matty Frances placeholder has role="img"`);
  assert(
    mattyPlaceholder.attr('aria-label') === 'Matty Frances portrait placeholder',
    `Matty Frances placeholder has aria-label="Matty Frances portrait placeholder"`
  );
  assert(
    mattyPlaceholder.find('.guest-placeholder-text').text().trim() === 'Photo Coming Soon',
    `Matty Frances placeholder displays "Photo Coming Soon"`
  );

  // Check all images inside #page-guest have dimensions, alt, and loading="lazy"
  const guestImages = guestPage.find('img');
  assert(guestImages.length === 7, `Found 7 guest & host images in #page-guest`);
  guestImages.each((_, el) => {
    const src = $(el).attr('src');
    const alt = $(el).attr('alt');
    const width = $(el).attr('width');
    const height = $(el).attr('height');
    const loading = $(el).attr('loading');
    assert(Boolean(src), `Image has src (${src})`);
    assert(Boolean(alt), `Image (${src}) has alt: "${alt}"`);
    assert(Boolean(width && height), `Image (${src}) has dimensions: ${width}x${height}`);
    assert(loading === 'lazy', `Image (${src}) has loading="lazy"`);
  });
}

// 3. CSS Image Layout Lock Verification (src/styles/main.css & dist/assets/*.css)
console.log('\n3. Checking CSS layout locks in src/styles/main.css and dist/assets/...');
const srcCss = fs.readFileSync(path.join(ROOT_DIR, 'src', 'styles', 'main.css'), 'utf8');
assert(srcCss.includes('.guest-portrait'), `src/styles/main.css contains .guest-portrait`);
assert(srcCss.includes('.guest-portrait-placeholder'), `src/styles/main.css contains .guest-portrait-placeholder`);
assert(srcCss.includes('.guest-hosts-grid .host-photo'), `src/styles/main.css contains .guest-hosts-grid .host-photo`);

// Check layout lock properties in src CSS
const layoutLockRegex = /\.guest-portrait,\s*\.guest-portrait-placeholder,\s*\.guest-hosts-grid\s+\.host-photo\s*\{([^}]+)\}/s;
const match = srcCss.match(layoutLockRegex);
assert(Boolean(match), `Found unified layout lock rule in src/styles/main.css`);
if (match) {
  const ruleBody = match[1];
  assert(ruleBody.includes('aspect-ratio: 1'), `Layout lock specifies aspect-ratio: 1`);
  assert(ruleBody.includes('width: 100%'), `Layout lock specifies width: 100%`);
  assert(ruleBody.includes('height: auto'), `Layout lock specifies height: auto`);
  assert(ruleBody.includes('object-fit: cover'), `Layout lock specifies object-fit: cover`);
}

// Check bundled CSS in dist
const distAssets = fs.readdirSync(path.join(ROOT_DIR, 'dist', 'assets'));
const cssBundles = distAssets.filter((f) => f.endsWith('.css'));
assert(cssBundles.length > 0, `Found ${cssBundles.length} CSS bundles in dist/assets`);

let foundBundledLock = false;
for (const file of cssBundles) {
  const bundleContent = fs.readFileSync(path.join(ROOT_DIR, 'dist', 'assets', file), 'utf8');
  if (
    bundleContent.includes('.guest-portrait') &&
    bundleContent.includes('aspect-ratio:1') &&
    bundleContent.includes('object-fit:cover')
  ) {
    foundBundledLock = true;
    break;
  }
}
assert(foundBundledLock, `Bundled CSS contains compiled aspect-ratio and object-fit layout lock`);

// 4. Router and Routing Tests Assertions
console.log('\n4. Checking router configuration and tests...');
const routerContent = fs.readFileSync(path.join(ROOT_DIR, 'src', 'router.js'), 'utf8');
assert(routerContent.includes("guest: document.getElementById('page-guest')"), `src/router.js registers page-guest in getPages()`);
assert(routerContent.includes("guest: 'Be a Guest | Family Guy Guys'"), `src/router.js registers ROUTE_TITLES.guest`);
assert(routerContent.includes("activePage = 'guest'"), `src/router.js maps /guest path to activePage 'guest'`);

const routingTestContent = fs.readFileSync(path.join(ROOT_DIR, 'tests', 'guestRouting.test.ts'), 'utf8');
assert(routingTestContent.includes("window.history.replaceState({}, '', '/guest')"), `tests/guestRouting.test.ts tests direct startup at /guest`);
assert(routingTestContent.includes("window.history.replaceState({}, '', '/guest/')"), `tests/guestRouting.test.ts tests direct startup and slash normalization at /guest/`);
assert(routingTestContent.includes("navigateTo('/guest')"), `tests/guestRouting.test.ts tests client-side navigation to /guest`);

console.log(`\n=== Verification Summary ===`);
console.log(`Total checks passed: ${passCount}`);
console.log(`Total checks failed: ${failCount}`);

if (failCount > 0) {
  console.error(`FAILED: ${failCount} verification checks failed.`);
  process.exit(1);
} else {
  console.log(`SUCCESS: All ${passCount} verification checks passed!`);
}
