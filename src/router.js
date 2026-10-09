function getPages() {
  if (typeof document === 'undefined') return {};
  return {
    home: document.getElementById('page-home'),
    episodes: document.getElementById('page-episodes'),
    contact: document.getElementById('page-contact'),
    reviews: document.getElementById('page-reviews'),
    headersGaggs: document.getElementById('page-headers-gaggs'),
    prerenderedReview: document.getElementById('page-prerendered-review'),
    glossary: document.getElementById('page-glossary'),
  };
}

const ROUTE_TITLES = {
  home: 'Family Guy Guys — A Chronological Rewatch Podcast',
  episodes: 'Episode Feed — Family Guy Guys',
  contact: 'Contact Us — Family Guy Guys',
  reviews: 'Episode Reviews — Family Guy Guys',
  headersGaggs: 'The Headers-Gaggs Test — Family Guy Guys',
  glossary: 'Glossary — Family Guy Guys',
  notFound: '404 Page Not Found — Family Guy Guys',
};

const ROUTE_DESCRIPTIONS = {
  home: 'Join Collin, Tyler, and Jason as they watch and review every single episode of Family Guy in chronological order. Live reaction logs, host ratings, and transcript breakdowns.',
  episodes: 'Episode Feed — Family Guy Guys',
  contact: 'Contact Us — Family Guy Guys',
  reviews: 'Episode Reviews — Family Guy Guys',
  headersGaggs: 'The Headers-Gaggs Test — Family Guy Guys',
  glossary:
    'The official Family Guy Guys glossary: Structurehead, Gagger, Stewie Gay Watch, Arbitrary Rating Units, and every bit of lore from the podcast.',
};

function updateMetadata(activePage, path, isNotFound) {
  if (typeof document === 'undefined') return;
  if (activePage === 'prerenderedReview') return;

  // Update document title per route
  if (isNotFound) {
    document.title = ROUTE_TITLES.notFound;
  } else {
    document.title = ROUTE_TITLES[activePage] || ROUTE_TITLES.home;
  }

  // Update meta description
  const metaDesc = document.querySelector('meta[name="description"]');
  if (metaDesc) {
    const desc =
      !isNotFound && ROUTE_DESCRIPTIONS[activePage]
        ? ROUTE_DESCRIPTIONS[activePage]
        : ROUTE_DESCRIPTIONS.home;
    metaDesc.setAttribute('content', desc);
  }

  // Update canonical link
  let canonicalLink = document.querySelector('link[rel="canonical"]');
  if (!isNotFound) {
    const canonicalUrl = `https://familyguyguys.com${path === '/' ? '' : path}`;
    if (!canonicalLink) {
      canonicalLink = document.createElement('link');
      canonicalLink.setAttribute('rel', 'canonical');
      document.head.appendChild(canonicalLink);
    }
    canonicalLink.setAttribute('href', canonicalUrl);
  }

  // Synchronize Open Graph & Twitter metadata
  const ogTitle = document.querySelector('meta[property="og:title"]');
  if (ogTitle) ogTitle.setAttribute('content', document.title);
  const twitterTitle = document.querySelector('meta[property="twitter:title"]');
  if (twitterTitle) twitterTitle.setAttribute('content', document.title);

  if (!isNotFound) {
    const pageUrl = `https://familyguyguys.com${path === '/' ? '' : path}`;
    const ogUrl = document.querySelector('meta[property="og:url"]');
    if (ogUrl) ogUrl.setAttribute('content', pageUrl);
    const twitterUrl = document.querySelector('meta[property="twitter:url"]');
    if (twitterUrl) twitterUrl.setAttribute('content', pageUrl);
  }

  if (metaDesc) {
    const currentDesc = metaDesc.getAttribute('content');
    const ogDesc = document.querySelector('meta[property="og:description"]');
    if (ogDesc && currentDesc) ogDesc.setAttribute('content', currentDesc);
    const twitterDesc = document.querySelector('meta[property="twitter:description"]');
    if (twitterDesc && currentDesc) twitterDesc.setAttribute('content', currentDesc);
  }

  // Synchronize glossary JSON-LD structured data lifecycle
  const glossaryJsonLd = document.getElementById('glossary-jsonld');
  if (activePage === 'glossary') {
    if (!glossaryJsonLd) {
      const script = document.createElement('script');
      script.id = 'glossary-jsonld';
      script.type = 'application/ld+json';
      script.text = JSON.stringify({
        '@context': 'https://schema.org',
        '@type': 'DefinedTermSet',
        '@id': 'https://familyguyguys.com/glossary#term-set',
        url: 'https://familyguyguys.com/glossary',
        name: 'Family Guy Guys Official Podcast Glossary',
        description:
          'The official glossary of critical frameworks, segments, and lore from Family Guy Guys: The Podcast.',
      });
      document.head.appendChild(script);
    }
  } else if (glossaryJsonLd) {
    glossaryJsonLd.remove();
  }
}

export function initRouter() {
  // Bind all nav links and navigation handlers with strict non-app link filtering
  document.addEventListener('click', (e) => {
    const link = e.target.closest('a');
    if (!link) return;

    const href = link.getAttribute('href');
    if (!href) return;

    const trimmedHref = href.trim();
    // Do not intercept external URLs, protocol-relative, mailto, tel, hash, javascript, data, or target="_blank"
    if (
      trimmedHref.startsWith('http:') ||
      trimmedHref.startsWith('https:') ||
      trimmedHref.startsWith('//') ||
      trimmedHref.startsWith('mailto:') ||
      trimmedHref.startsWith('tel:') ||
      trimmedHref.startsWith('#') ||
      trimmedHref.startsWith('javascript:') ||
      trimmedHref.startsWith('data:') ||
      link.target === '_blank' ||
      link.hasAttribute('download')
    ) {
      return;
    }

    // Do not intercept individual canonical episode review routes (/reviews/s1e6, etc.)
    // to ensure pure static document navigation as required by the SEO rendering architecture.
    const isEpisodeReviewRoute =
      /^\/reviews\/[a-zA-Z0-9_-]+(?:\/)?$/i.test(trimmedHref) &&
      !trimmedHref.startsWith('/reviews/season/') &&
      !trimmedHref.startsWith('/reviews/host/') &&
      trimmedHref !== '/reviews' &&
      trimmedHref !== '/reviews/';

    if (isEpisodeReviewRoute) {
      return; // Allow native browser document navigation
    }

    e.preventDefault();
    const path = trimmedHref === '' ? '/' : trimmedHref;
    navigateTo(path);
  });

  window.addEventListener('popstate', handleLocation);
  handleLocation(); // Initial route resolution
}

export function navigateTo(path) {
  window.history.pushState({}, '', path);
  handleLocation();
}

function handleLocation() {
  if (typeof window === 'undefined') return;
  const rawPath = window.location.pathname || '/';
  const path = rawPath.endsWith('/') && rawPath.length > 1 ? rawPath.slice(0, -1) : rawPath;

  // Preserve query parameters and hash fragments when normalizing trailing slashes
  if (rawPath !== path && window.history && window.history.replaceState) {
    const search = window.location.search || '';
    const hash = window.location.hash || '';
    window.history.replaceState(window.history.state, '', path + search + hash);
  }

  let activePage = 'home';
  let routeParams = null;
  let isNotFound = false;

  if (path === '/' || path === '/home') {
    activePage = 'home';
  } else if (path === '/episodes') {
    activePage = 'episodes';
  } else if (path === '/contact') {
    activePage = 'contact';
  } else if (path === '/headers-gaggs') {
    activePage = 'headersGaggs';
  } else if (path === '/glossary') {
    activePage = 'glossary';
  } else if (path.startsWith('/reviews')) {
    const isEpisodePath =
      /^\/reviews\/[a-zA-Z0-9_-]+$/i.test(path) &&
      !path.startsWith('/reviews/season/') &&
      !path.startsWith('/reviews/host/');

    const prerenderedEl =
      typeof document !== 'undefined' && document.getElementById('page-prerendered-review');
    if (prerenderedEl && isEpisodePath) {
      activePage = 'prerenderedReview';
    } else {
      activePage = 'reviews';
      const subpath = path.slice('/reviews'.length);

      if (subpath === '' || subpath === '/') {
        routeParams = null;
      } else if (subpath.startsWith('/season/')) {
        const seasonNum = Number(subpath.split('/')[2]);
        routeParams = { page: 'season', season: seasonNum };
      } else if (subpath.startsWith('/host/')) {
        const hostId = decodeURIComponent(subpath.split('/')[2]);
        routeParams = { page: 'host', id: hostId };
      } else if (subpath.startsWith('/')) {
        const episodeId = decodeURIComponent(subpath.slice(1));
        if (episodeId) {
          routeParams = { page: 'episode', id: episodeId };
        }
      } else {
        isNotFound = true;
      }
    }
  } else {
    isNotFound = true;
  }

  // Update page-specific metadata (title, meta description, canonical link)
  updateMetadata(activePage, path, isNotFound);

  // Update page visibility and nav links with View Transitions support
  const updateDOM = () => {
    const pages = getPages();
    Object.keys(pages).forEach((name) => {
      const pageEl = pages[name];
      if (pageEl) {
        if (!isNotFound && name === activePage) {
          pageEl.classList.add('active');
          pageEl.style.display = 'block';
        } else {
          pageEl.classList.remove('active');
          pageEl.style.display = 'none';
        }
      }
    });

    // Handle 404 state UI
    let notFoundContainer = document.getElementById('page-404');
    if (isNotFound) {
      if (!notFoundContainer) {
        notFoundContainer = document.createElement('div');
        notFoundContainer.id = 'page-404';
        notFoundContainer.className = 'page active';
        notFoundContainer.innerHTML = `
          <div class="page-content halftone-bg" style="min-height:80vh; display:flex; flex-direction:column; align-items:center; justify-center; text-align:center; padding: 4rem 1rem;">
            <div style="font-size: 4rem; margin-bottom: 1rem;">🐔</div>
            <h1 style="font-family: 'Special Elite', monospace; font-size: 2.5rem; color: var(--maroon);">404 — Page Not Found</h1>
            <p style="margin-top: 1rem; color: #555; max-width: 450px; line-height: 1.5;">Giggity? Whatever page you were looking for doesn't exist or has been moved.</p>
            <a href="/" class="btn-orange" style="margin-top: 2rem; display: inline-block;">Return Home</a>
          </div>
        `;
        const main = document.querySelector('main');
        if (main) main.appendChild(notFoundContainer);
      } else {
        notFoundContainer.style.display = 'block';
        notFoundContainer.classList.add('active');
      }
    } else if (notFoundContainer) {
      notFoundContainer.style.display = 'none';
      notFoundContainer.classList.remove('active');
    }

    // Update active state in nav links
    document.querySelectorAll('.nav-links a, .mobile-nav a').forEach((a) => {
      const href = a.getAttribute('href');
      const isHome =
        (href === '/' || href === '#' || href === '/home') && activePage === 'home' && !isNotFound;
      const matches = (!isNotFound && href === `/${activePage}`) || isHome;
      if (matches) {
        a.classList.add('active');
      } else {
        a.classList.remove('active');
      }
    });
  };

  try {
    if (document.startViewTransition) {
      document.startViewTransition(updateDOM);
    } else {
      updateDOM();
    }
  } catch (e) {
    console.error('View transition error:', e);
    updateDOM();
  }

  // Dispatch custom route change event for React review app or analytics to listen to
  window.dispatchEvent(
    new CustomEvent('routechange', {
      detail: { page: isNotFound ? '404' : activePage, params: routeParams },
    })
  );

  // Scroll to top on navigation, unless navigating to /glossary with a hash fragment
  // (the glossary fragment coordinator handles anchor scrolling)
  const isGlossaryWithHash = activePage === 'glossary' && !!window.location.hash;
  if (!isGlossaryWithHash) {
    window.scrollTo(0, 0);
  }
}
