import { describe, it, expect, beforeEach } from 'vitest';
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
  textContent = '';

  constructor(tagName: string) {
    this.tagName = tagName.toUpperCase();
  }

  get className(): string {
    return this.classList.toString();
  }

  set className(value: string) {
    this.classList.clear();
    value
      .split(/\s+/)
      .filter(Boolean)
      .forEach((c) => this.classList.add(c));
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
      value
        .split(/\s+/)
        .filter(Boolean)
        .forEach((c) => this.classList.add(c));
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

let innerHtmlSetterCalled = false;

function setupMockDOM() {
  innerHtmlSetterCalled = false;
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
      const el = new MockElement(tag);
      // Spy on innerHTML to guarantee that no element created during routing uses innerHTML
      Object.defineProperty(el, 'innerHTML', {
        set(_val: string) {
          innerHtmlSetterCalled = true;
        },
        get() {
          return '';
        },
        configurable: true,
      });
      return el;
    },
    addEventListener() {},
    removeEventListener() {},
  };

  Object.defineProperty(mockDoc.body, 'innerHTML', {
    set(html: string) {
      mockDoc.body.children = [];
      parseHtml(html, mockDoc.body);
    },
    configurable: true,
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

describe('Router 404 Security & DOM Creation', () => {
  beforeEach(() => {
    setupMockDOM();
    document.body.innerHTML = `
      <nav class="nav-links">
        <a href="/" id="nav-home">Home</a>
      </nav>
      <main>
        <div class="page active" id="page-home"></div>
      </main>
      <meta name="description" content="Initial description">
    `;
  });

  it('builds 404 state UI safely using DOM APIs without innerHTML', () => {
    window.history.replaceState({}, '', '/non-existent-route');
    initRouter();

    const notFoundEl = document.getElementById('page-404');
    expect(notFoundEl).toBeTruthy();
    expect(notFoundEl?.classList.contains('active')).toBe(true);

    // Verify innerHTML setter was NOT invoked on the newly created elements
    expect(innerHtmlSetterCalled).toBe(false);

    // Verify child elements and textContent
    const content = notFoundEl?.children[0];
    expect(content).toBeTruthy();
    expect(content?.classList.contains('page-content')).toBe(true);
    expect(content?.classList.contains('halftone-bg')).toBe(true);

    const texts = content?.children.map((c) => c.textContent);
    expect(texts).toContain('🐔');
    expect(texts).toContain('404 — Page Not Found');
    expect(texts).toContain(
      "Giggity? Whatever page you were looking for doesn't exist or has been moved."
    );
    expect(texts).toContain('Return Home');

    const homeLink = content?.children.find((c) => c.tagName === 'A');
    expect(homeLink?.getAttribute('href')).toBe('/');
    expect(homeLink?.classList.contains('btn-orange')).toBe(true);
  });

  it('toggles 404 view correctly on route transitions without re-injection', () => {
    window.history.replaceState({}, '', '/non-existent-route');
    initRouter();

    let notFoundEl = document.getElementById('page-404');
    expect(notFoundEl?.classList.contains('active')).toBe(true);

    // Navigate back to home
    navigateTo('/');
    const homePage = document.getElementById('page-home');
    expect(homePage?.classList.contains('active')).toBe(true);
    expect(notFoundEl?.style.display).toBe('none');
    expect(notFoundEl?.classList.contains('active')).toBe(false);

    // Navigate to another 404
    navigateTo('/another-404');
    expect(notFoundEl?.style.display).toBe('block');
    expect(notFoundEl?.classList.contains('active')).toBe(true);
    // Should reuse the existing element, not duplicate it
    const main = document.querySelector('main');
    const notFoundNodes = main?.children.filter((c) => c.id === 'page-404');
    expect(notFoundNodes?.length).toBe(1);
    expect(notFoundEl?.children.length).toBe(1);
  });
});
