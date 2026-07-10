// History API SPA Router for familyguyguys.com

const PAGES = {
  home: document.getElementById('page-home'),
  episodes: document.getElementById('page-episodes'),
  contact: document.getElementById('page-contact'),
  reviews: document.getElementById('page-reviews')
};

export function initRouter() {
  // Bind all nav links and navigation handlers
  document.addEventListener('click', (e) => {
    const link = e.target.closest('a');
    if (!link) return;

    const href = link.getAttribute('href');
    if (!href || href.startsWith('http') || href.startsWith('mailto:') || link.target === '_blank') {
      return;
    }

    e.preventDefault();
    const path = href === '#' || href === '' ? '/' : href;
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

  if (path === '/' || path === '/home') {
    activePage = 'home';
  } else if (path === '/episodes') {
    activePage = 'episodes';
  } else if (path === '/contact') {
    activePage = 'contact';
  } else if (path.startsWith('/reviews')) {
    activePage = 'reviews';
    const subpath = path.slice('/reviews'.length);
    
    if (subpath === '/pipeline') {
      routeParams = { page: 'pipeline' };
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
    }
  }

  // Update page visibility and nav links with View Transitions support
  const updateDOM = () => {
    Object.keys(PAGES).forEach((name) => {
      const pageEl = document.getElementById(`page-${name}`);
      if (pageEl) {
        if (name === activePage) {
          pageEl.classList.add('active');
          pageEl.style.display = 'block';
        } else {
          pageEl.classList.remove('active');
          pageEl.style.display = 'none';
        }
      }
    });

    // Update active state in nav links
    document.querySelectorAll('.nav-links a').forEach((a) => {
      const href = a.getAttribute('href');
      const isHome = (href === '/' || href === '#' || href === '/home') && activePage === 'home';
      const matches = href === `/${activePage}` || isHome;
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
  window.dispatchEvent(new CustomEvent('routechange', { detail: { page: activePage, params: routeParams } }));

  // Scroll to top on navigation
  window.scrollTo(0, 0);
}
