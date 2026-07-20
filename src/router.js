function getPages() {
  if (typeof document === 'undefined') return {};
  return {
    home: document.getElementById('page-home'),
    episodes: document.getElementById('page-episodes'),
    contact: document.getElementById('page-contact'),
    reviews: document.getElementById('page-reviews'),
  };
}

const ROUTE_TITLES = {
  home: 'Family Guy Guys — A Chronological Rewatch Podcast',
  episodes: 'Episode Feed — Family Guy Guys',
  contact: 'Contact Us — Family Guy Guys',
  reviews: 'Episode Reviews — Family Guy Guys',
  notFound: '404 Page Not Found — Family Guy Guys',
};

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
  const rawPath = window.location.pathname;
  const path = rawPath.endsWith('/') && rawPath.length > 1 ? rawPath.slice(0, -1) : rawPath;
  let activePage = 'home';
  let routeParams = null;
  let isNotFound = false;

  if (path === '/' || path === '/home') {
    activePage = 'home';
  } else if (path === '/episodes') {
    activePage = 'episodes';
  } else if (path === '/contact') {
    activePage = 'contact';
  } else if (path.startsWith('/reviews')) {
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
  } else {
    isNotFound = true;
  }

  // Update document title per route
  if (isNotFound) {
    document.title = ROUTE_TITLES.notFound;
  } else {
    document.title = ROUTE_TITLES[activePage] || ROUTE_TITLES.home;
  }

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
    document.querySelectorAll('.nav-links a').forEach((a) => {
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

  // Scroll to top on navigation
  window.scrollTo(0, 0);
}
