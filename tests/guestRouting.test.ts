import { describe, it, expect, beforeEach, beforeAll } from 'vitest';
import * as cheerio from 'cheerio';
import { initRouter, navigateTo } from '../src/router.js';

class MockClassList {
  private _set = new Set<string>();

  add(c: string) {
    this._set.add(c);
  }
  remove(c: string) {
    this._set.delete(c);
  }
  contains(c: string): boolean {
    return this._set.has(c);
  }
  clear() {
    this._set.clear();
  }
  get size() {
    return this._set.size;
  }
  toString() {
    return Array.from(this._set).join(' ');
  }
}

class MockElement {
  tagName: string;
  id = '';
  attributes = new Map<string, string>();
  classList = new MockClassList();
  style: Record<string, string> = {};
  children: MockElement[] = [];
  parentNode: MockElement | null = null;
  target?: string;

  constructor(tagName: string) {
    this.tagName = tagName.toUpperCase();
  }

  getAttribute(name: string): string | null {
    if (name === 'id') return this.id || null;
    if (name === 'class') return this.classList.toString() || null;
    return this.attributes.get(name) ?? null;
  }

  setAttribute(name: string, value: string) {
    if (name === 'id') {
      this.id = value;
    } else if (name === 'class') {
      this.classList.clear();
      value.split(/\s+/).filter(Boolean).forEach((c) => this.classList.add(c));
    } else {
      this.attributes.set(name, value);
    }
  }

  hasAttribute(name: string): boolean {
    if (name === 'id') return Boolean(this.id);
    if (name === 'class') return this.classList.size > 0;
    return this.attributes.has(name);
  }

  appendChild(child: MockElement): MockElement {
    child.parentNode = this;
    this.children.push(child);
    return child;
  }

  remove() {
    if (this.parentNode) {
      const idx = this.parentNode.children.indexOf(this);
      if (idx !== -1) this.parentNode.children.splice(idx, 1);
      this.parentNode = null;
    }
  }

  closest(selector: string): MockElement | null {
    if (selector === 'a' && this.tagName === 'A') return this;
    return null;
  }
}

function parseHtml(html: string, parent: MockElement) {
  const $ = cheerio.load(html, null, false);
  function convert(node: any, parentEl: MockElement) {
    if (node.type === 'tag') {
      const el = new MockElement(node.name);
      for (const [k, v] of Object.entries(node.attribs || {})) {
        el.setAttribute(k, v as string);
      }
      parentEl.appendChild(el);
      if (node.children) {
        for (const child of node.children) {
          convert(child, el);
        }
      }
    }
  }
  const rootNodes = $.root().children().toArray();
  for (const node of rootNodes) {
    convert(node, parent);
  }
}

function matchesSelector(el: MockElement, selector: string): boolean {
  if (selector.startsWith('#')) return el.id === selector.slice(1);
  if (selector === 'main') return el.tagName === 'MAIN';
  const attrMatch = selector.match(/^([a-z0-9_-]+)?\s*\[([a-z0-9_:-]+)=\"([^\"]+)\"\]$/i);
  if (attrMatch) {
    const [, tag, attr, val] = attrMatch;
    if (tag && el.tagName !== tag.toUpperCase()) return false;
    return el.getAttribute(attr) === val;
  }
  return false;
}

function setupMockDOM() {
  const mockDoc: any = {
    head: new MockElement('head'),
    body: new MockElement('body'),
    title: '',
    getElementById(id: string): MockElement | null {
      let result: MockElement | null = null;
      const find = (el: MockElement) => {
        if (el.id === id) {
          result = el;
          return;
        }
        for (const c of el.children) {
          if (!result) find(c);
        }
      };
      find(mockDoc.head);
      if (!result) find(mockDoc.body);
      return result;
    },
    querySelector(selector: string): MockElement | null {
      let result: MockElement | null = null;
      const find = (el: MockElement) => {
        if (matchesSelector(el, selector)) {
          result = el;
          return;
        }
        for (const c of el.children) {
          if (!result) find(c);
        }
      };
      find(mockDoc.head);
      if (!result) find(mockDoc.body);
      return result;
    },
    querySelectorAll(selector: string): MockElement[] {
      const results: MockElement[] = [];
      const check = (el: MockElement) => {
        if (
          el.tagName === 'A' &&
          el.parentNode &&
          (el.parentNode.classList.contains('nav-links') ||
            el.parentNode.parentNode?.classList.contains('nav-links'))
        ) {
          results.push(el);
        }
        for (const c of el.children) check(c);
      };
      check(mockDoc.body);
      return results;
    },
    createElement(tag: string): MockElement {
      return new MockElement(tag);
    },
    addEventListener() {},
    removeEventListener() {},
  };

  Object.defineProperty(mockDoc.body, 'innerHTML', {
    set(html: string) {
      mockDoc.body.children = [];
      parseHtml(html, mockDoc.body);
    },
  });

  const mockWin: any = {
    location: {
      pathname: '/',
      search: '',
      hash: '',
    },
    history: {
      state: {},
      pushState(_state: any, _title: string, url: string) {
        mockWin.location.pathname = url.split('?')[0].split('#')[0];
      },
      replaceState(_state: any, _title: string, url: string) {
        mockWin.location.pathname = url.split('?')[0].split('#')[0];
      },
    },
    addEventListener() {},
    removeEventListener() {},
    dispatchEvent() {
      return true;
    },
    scrollTo() {},
  };

  (globalThis as any).document = mockDoc;
  (globalThis as any).window = mockWin;
}

setupMockDOM();

describe('Guest Route Resolution', () => {
  beforeEach(() => {
    document.body.innerHTML = `
      <nav class="nav-links">
        <a href="/" id="nav-home">Home</a>
      </nav>
      <main>
        <div class="page active" id="page-home"></div>
        <div class="page" id="page-guest"></div>
      </main>
      <meta name="description" content="Initial description">
    `;
  });

  it('renders #page-guest directly on fresh startup at /guest without prior in-app navigation', () => {
    window.history.replaceState({}, '', '/guest');
    initRouter();

    const guestPage = document.getElementById('page-guest');
    const homePage = document.getElementById('page-home');
    const metaDesc = document.querySelector('meta[name="description"]');

    expect(guestPage?.classList.contains('active')).toBe(true);
    expect(homePage?.classList.contains('active')).toBe(false);
    expect(window.location.pathname).toBe('/guest');
    expect(document.title).toBe('Be a Guest | Family Guy Guys');
    expect(metaDesc?.getAttribute('content')).toContain('Guest information, recording details, and booking');
  });

  it('normalizes trailing slash /guest/ to /guest on direct startup and activates page', () => {
    window.history.replaceState({}, '', '/guest/');
    initRouter();

    const guestPage = document.getElementById('page-guest');
    expect(guestPage?.classList.contains('active')).toBe(true);
    expect(window.location.pathname).toBe('/guest');
  });

  it('navigates to /guest via navigateTo, activates #page-guest and sets metadata', () => {
    window.history.replaceState({}, '', '/');
    initRouter();

    navigateTo('/guest');

    const guestPage = document.getElementById('page-guest');
    const homePage = document.getElementById('page-home');
    expect(guestPage?.classList.contains('active')).toBe(true);
    expect(homePage?.classList.contains('active')).toBe(false);
    expect(document.title).toBe('Be a Guest | Family Guy Guys');
  });
});
