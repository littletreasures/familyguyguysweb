/**
 * html-shell.js — HTML template assembler for prerendered review pages.
 * Injects unique head metadata, Open Graph tags, Schema.org JSON-LD, and
 * places static transcript markup inside #prerendered-episode-content.
 */

function escapeHtml(str) {
  if (typeof str !== 'string') return '';
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

export function assemblePrerenderedHtml({
  templateHtml,
  metadata,
  jsonLd,
  bodyMarkup,
  _episodeId,
  isFixture = false,
}) {
  let html = templateHtml;

  // 1. Replace Title
  html = html.replace(/<title>[\s\S]*?<\/title>/i, `<title>${escapeHtml(metadata.title)}</title>`);

  // 2. Head Tags to Inject / Replace
  const headInjects = [];

  // Canonical Link
  headInjects.push(`<link rel="canonical" href="${escapeHtml(metadata.canonicalUrl)}">`);

  // Meta Description
  headInjects.push(`<meta name="description" content="${escapeHtml(metadata.description)}">`);

  // Open Graph
  headInjects.push(`<meta property="og:type" content="${escapeHtml(metadata.og.type)}">`);
  headInjects.push(`<meta property="og:url" content="${escapeHtml(metadata.og.url)}">`);
  headInjects.push(`<meta property="og:title" content="${escapeHtml(metadata.og.title)}">`);
  headInjects.push(
    `<meta property="og:description" content="${escapeHtml(metadata.og.description)}">`
  );
  headInjects.push(`<meta property="og:image" content="${escapeHtml(metadata.og.image)}">`);
  headInjects.push(
    `<meta property="og:site_name" content="${escapeHtml(metadata.og.siteName || 'Family Guy Guys')}">`
  );

  // Twitter Cards
  headInjects.push(`<meta property="twitter:card" content="${escapeHtml(metadata.twitter.card)}">`);
  headInjects.push(`<meta property="twitter:url" content="${escapeHtml(metadata.twitter.url)}">`);
  headInjects.push(
    `<meta property="twitter:title" content="${escapeHtml(metadata.twitter.title)}">`
  );
  headInjects.push(
    `<meta property="twitter:description" content="${escapeHtml(metadata.twitter.description)}">`
  );
  headInjects.push(
    `<meta property="twitter:image" content="${escapeHtml(metadata.twitter.image)}">`
  );

  // JSON-LD Structured Data
  const jsonLdString = JSON.stringify(jsonLd, null, 2);
  headInjects.push(`<script type="application/ld+json">\n${jsonLdString}\n</script>`);

  // Remove pre-existing standard meta descriptions / og tags from base template to avoid duplicate tags
  html = html
    .replace(/<meta name="description"[^>]*>/gi, '')
    .replace(/<meta property="og:[^"]*"[^>]*>/gi, '')
    .replace(/<meta property="twitter:[^"]*"[^>]*>/gi, '')
    .replace(/<link rel="canonical"[^>]*>/gi, '');

  // Inject our customized tags right before </head>
  html = html.replace('</head>', `  ${headInjects.join('\n  ')}\n</head>`);

  // 3. Inject prerendered episode content outside the React-controlled container
  // In index.html, the main tag contains #page-home, #page-episodes, #page-reviews, etc.
  // We hide #page-home and #page-reviews, and inject #prerendered-episode-content into <main>.
  const fixtureComment = isFixture ? '<!-- __FGG_FIXTURE__ -->\n    ' : '';
  const contentWrapper = `
    <!-- Prerendered Static Episode & Transcript Content (Static HTML First) -->
    <div id="page-prerendered-review" class="page active" style="display:block;">
      ${fixtureComment}${bodyMarkup}
    </div>
  `;

  // Hide default home page in the prerendered HTML shell
  html = html.replace(
    'id="page-home" class="page active"',
    'id="page-home" class="page" style="display:none;"'
  );
  html = html.replace(
    'id="page-reviews" class="page"',
    'id="page-reviews" class="page" style="display:none;"'
  );

  // Set active nav link to Reviews
  html = html.replace('id="nav-home" class="active"', 'id="nav-home"');
  html = html.replace('id="nav-reviews"', 'id="nav-reviews" class="active"');

  // Inject content inside <main>
  if (html.includes('</main>')) {
    html = html.replace('</main>', `${contentWrapper}\n  </main>`);
  } else {
    html = html.replace('</body>', `${contentWrapper}\n</body>`);
  }

  return html;
}
