import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import fs from 'fs';
import path from 'path';
import * as cheerio from 'cheerio';
import { navigateTo } from '../src/router.js';

describe('Task 3: Client Routing & Navigation Integration', () => {
  const indexHtmlPath = path.resolve(__dirname, '../index.html');
  const indexHtml = fs.readFileSync(indexHtmlPath, 'utf8');
  const $ = cheerio.load(indexHtml);

  describe('index.html structure', () => {
    it('contains desktop nav link between Reviews and Contact', () => {
      const $navLinks = $('.nav-links li a');
      const hrefs = $navLinks.map((_, el) => $(el).attr('href')).get();
      expect(hrefs).toContain('/glossary');

      const reviewsIdx = hrefs.indexOf('/reviews');
      const glossaryIdx = hrefs.indexOf('/glossary');
      const contactIdx = hrefs.indexOf('/contact');

      expect(reviewsIdx).toBeGreaterThan(-1);
      expect(glossaryIdx).toBe(reviewsIdx + 1);
      expect(contactIdx).toBe(glossaryIdx + 1);

      const $glossaryLink = $('#nav-glossary');
      expect($glossaryLink.length).toBe(1);
      expect($glossaryLink.attr('href')).toBe('/glossary');
      expect($glossaryLink.text().trim()).toBe('Glossary');
    });

    it('contains mobile nav link between Reviews and Contact', () => {
      const $mobileLinks = $('#mobileNav a');
      const hrefs = $mobileLinks.map((_, el) => $(el).attr('href')).get();
      expect(hrefs).toContain('/glossary');

      const reviewsIdx = hrefs.indexOf('/reviews');
      const glossaryIdx = hrefs.indexOf('/glossary');
      const contactIdx = hrefs.indexOf('/contact');

      expect(reviewsIdx).toBeGreaterThan(-1);
      expect(glossaryIdx).toBe(reviewsIdx + 1);
      expect(contactIdx).toBe(glossaryIdx + 1);
    });

    it('contains footer link to Glossary', () => {
      const $footerLinks = $('footer a');
      const hrefs = $footerLinks.map((_, el) => $(el).attr('href')).get();
      expect(hrefs).toContain('/glossary');

      const $glossaryFooter = $('footer a[href="/glossary"]');
      expect($glossaryFooter.text().trim()).toBe('Glossary');
      expect($glossaryFooter.attr('style')).toContain('color: var(--orange)');
    });

    it('contains #page-glossary with #glossary-app container inside <main>', () => {
      const $main = $('main');
      const $pageGlossary = $main.find('#page-glossary');
      expect($pageGlossary.length).toBe(1);
      expect($pageGlossary.hasClass('page')).toBe(true);

      const $app = $pageGlossary.find('#glossary-app');
      expect($app.length).toBe(1);
    });
  });

  describe('src/router.js routing & metadata behavior', () => {
    let originalWindow: typeof global.window;
    let originalDocument: typeof global.document;

    let mockDoc: any;
    let mockWin: any;
    let metaTags: Record<string, string>;
    let canonicalHref = '';
    let pageElements: Record<string, { classList: Set<string>; style: Record<string, string> }>;
    let navElements: Array<{ href: string; classList: Set<string> }>;
    let scrollToCalls: Array<[number, number]>;
    let replacedUrls: string[];

    beforeEach(() => {
      originalWindow = global.window;
      originalDocument = global.document;

      metaTags = {};
      canonicalHref = '';
      scrollToCalls = [];
      replacedUrls = [];

      const createMockElement = (initialClasses: string[] = ['page']) => {
        const classes = new Set(initialClasses);
        return {
          classList: {
            add: (c: string) => classes.add(c),
            remove: (c: string) => classes.delete(c),
            contains: (c: string) => classes.has(c),
          },
          style: {} as Record<string, string>,
        };
      };

      pageElements = {
        'page-home': createMockElement(['page', 'active']),
        'page-episodes': createMockElement(['page']),
        'page-reviews': createMockElement(['page']),
        'page-headers-gaggs': createMockElement(['page']),
        'page-prerendered-review': createMockElement(['page']),
        'page-glossary': createMockElement(['page']),
      };

      navElements = [
        { href: '/', classList: new Set(['active']) },
        { href: '/episodes', classList: new Set() },
        { href: '/reviews', classList: new Set() },
        { href: '/glossary', classList: new Set() },
        { href: '/contact', classList: new Set() },
      ];

      let mockHeadElements: any[] = [];
      mockDoc = {
        title: '',
        getElementById: vi.fn((id: string) => {
          if (id === 'glossary-jsonld') {
            return mockHeadElements.find((el) => el.id === 'glossary-jsonld') || null;
          }
          return pageElements[id] || null;
        }),
        createElement: vi.fn((tag: string) => {
          const el: any = {
            tagName: tag.toUpperCase(),
            id: '',
            type: '',
            text: '',
            setAttribute: vi.fn((k: string, v: string) => {
              el[k] = v;
            }),
            remove: vi.fn(() => {
              mockHeadElements = mockHeadElements.filter((e) => e !== el);
            }),
          };
          return el;
        }),
        querySelector: vi.fn((selector: string) => {
          if (selector === 'meta[name="description"]') {
            return {
              getAttribute: (attr: string) => (attr === 'content' ? metaTags.description : null),
              setAttribute: (attr: string, val: string) => {
                if (attr === 'content') metaTags.description = val;
              },
            };
          }
          if (selector === 'meta[property="og:title"]') {
            return {
              setAttribute: (attr: string, val: string) => {
                metaTags['og:title'] = val;
              },
            };
          }
          if (selector === 'meta[property="twitter:title"]') {
            return {
              setAttribute: (attr: string, val: string) => {
                metaTags['twitter:title'] = val;
              },
            };
          }
          if (selector === 'meta[property="og:description"]') {
            return {
              setAttribute: (attr: string, val: string) => {
                metaTags['og:description'] = val;
              },
            };
          }
          if (selector === 'meta[property="twitter:description"]') {
            return {
              setAttribute: (attr: string, val: string) => {
                metaTags['twitter:description'] = val;
              },
            };
          }
          if (selector === 'meta[property="og:url"]') {
            return {
              setAttribute: (attr: string, val: string) => {
                metaTags['og:url'] = val;
              },
            };
          }
          if (selector === 'meta[property="twitter:url"]') {
            return {
              setAttribute: (attr: string, val: string) => {
                metaTags['twitter:url'] = val;
              },
            };
          }
          if (selector === 'link[rel="canonical"]') {
            return {
              setAttribute: (attr: string, val: string) => {
                if (attr === 'href') canonicalHref = val;
              },
            };
          }
          return null;
        }),
        querySelectorAll: vi.fn((selector: string) => {
          if (selector.includes('.nav-links a')) {
            return navElements.map((el) => ({
              getAttribute: (attr: string) => (attr === 'href' ? el.href : null),
              classList: {
                add: (c: string) => el.classList.add(c),
                remove: (c: string) => el.classList.delete(c),
                contains: (c: string) => el.classList.has(c),
              },
            }));
          }
          return [];
        }),
        head: {
          appendChild: vi.fn((el: any) => {
            mockHeadElements.push(el);
          }),
        },
      };

      mockWin = {
        location: {
          pathname: '/glossary',
          search: '',
          hash: '',
        },
        history: {
          pushState: vi.fn((_state, _title, url) => {
            const parsed = new URL(`https://familyguyguys.com${url}`);
            mockWin.location.pathname = parsed.pathname;
            mockWin.location.search = parsed.search;
            mockWin.location.hash = parsed.hash;
          }),
          replaceState: vi.fn((_state, _title, url) => {
            replacedUrls.push(url);
            const parsed = new URL(`https://familyguyguys.com${url}`);
            mockWin.location.pathname = parsed.pathname;
            mockWin.location.search = parsed.search;
            mockWin.location.hash = parsed.hash;
          }),
        },
        dispatchEvent: vi.fn(),
        scrollTo: vi.fn((x: number, y: number) => {
          scrollToCalls.push([x, y]);
        }),
      };

      global.document = mockDoc;
      global.window = mockWin;
    });

    afterEach(() => {
      global.document = originalDocument;
      global.window = originalWindow;
    });

    it('navigates to /glossary, sets document title, meta tags, canonical link, and activates page', () => {
      navigateTo('/glossary');

      expect(mockDoc.title).toBe('Glossary — Family Guy Guys');
      expect(metaTags.description).toBe(
        'The official Family Guy Guys glossary: Structurehead, Gagger, Stewie Gay Watch, Arbitrary Rating Units, and every bit of lore from the podcast.'
      );
      expect(canonicalHref).toBe('https://familyguyguys.com/glossary');
      expect(pageElements['page-glossary'].classList.contains('active')).toBe(true);
      expect(pageElements['page-home'].classList.contains('active')).toBe(false);

      const glossaryNav = navElements.find((n) => n.href === '/glossary');
      expect(glossaryNav?.classList.has('active')).toBe(true);

      const homeNav = navElements.find((n) => n.href === '/');
      expect(homeNav?.classList.has('active')).toBe(false);

      expect(scrollToCalls).toEqual([[0, 0]]);
    });

    it('bypasses scrollTo(0, 0) when navigating to /glossary with a hash fragment', () => {
      navigateTo('/glossary#structurehead');

      expect(mockWin.location.hash).toBe('#structurehead');
      expect(mockDoc.title).toBe('Glossary — Family Guy Guys');
      expect(scrollToCalls).toEqual([]); // Bypassed!
    });

    it('normalizes trailing slash while preserving query parameters and hash', () => {
      // Simulate direct load or navigation to /glossary/?q=test#anchor
      mockWin.location.pathname = '/glossary/';
      mockWin.location.search = '?q=test';
      mockWin.location.hash = '#anchor';

      navigateTo('/glossary/?q=test#anchor');

      expect(replacedUrls).toContain('/glossary?q=test#anchor');
      expect(mockDoc.title).toBe('Glossary — Family Guy Guys');
      expect(pageElements['page-glossary'].classList.contains('active')).toBe(true);
    });

    it('injects glossary JSON-LD on /glossary and removes it when navigating out to other pages', () => {
      // 1. Navigate into /glossary
      navigateTo('/glossary');
      expect(mockDoc.title).toBe('Glossary — Family Guy Guys');
      const jsonLdScript = mockDoc.getElementById('glossary-jsonld');
      expect(jsonLdScript).not.toBeNull();
      expect(jsonLdScript?.type).toBe('application/ld+json');

      // 2. Navigate out of /glossary to /contact
      navigateTo('/contact');
      expect(mockDoc.title).toBe('Contact Us — Family Guy Guys');
      expect(canonicalHref).toBe('https://familyguyguys.com/contact');
      expect(metaTags.description).toBe('Contact Us — Family Guy Guys');
      expect(metaTags['og:title']).toBe('Contact Us — Family Guy Guys');
      expect(metaTags['twitter:title']).toBe('Contact Us — Family Guy Guys');

      // Verify glossary JSON-LD is completely removed from head
      const lingeringJsonLd = mockDoc.getElementById('glossary-jsonld');
      expect(lingeringJsonLd).toBeNull();
    });
  });
});
