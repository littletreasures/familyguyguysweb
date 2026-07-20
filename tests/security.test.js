import { describe, it, expect } from 'vitest';
import { sanitizeURL, escapeHTML } from '../src/main.js';

describe('Security Utilities: sanitizeURL', () => {
  it('permits valid https external URLs', () => {
    expect(sanitizeURL('https://youtube.com/watch?v=123')).toBe('https://youtube.com/watch?v=123');
    expect(sanitizeURL('https://open.spotify.com/show/abc')).toBe('https://open.spotify.com/show/abc');
  });

  it('permits valid internal relative paths', () => {
    expect(sanitizeURL('/')).toBe('/');
    expect(sanitizeURL('/episodes')).toBe('/episodes');
    expect(sanitizeURL('/reviews/s1e4')).toBe('/reviews/s1e4');
  });

  it('rejects malicious javascript: and data: schemes', () => {
    expect(sanitizeURL('javascript:alert(1)')).toBe(null);
    expect(sanitizeURL('JAVASCRIPT:alert("xss")')).toBe(null);
    expect(sanitizeURL('data:text/html,<script>alert(1)</script>')).toBe(null);
    expect(sanitizeURL('blob:https://example.com/123')).toBe(null);
  });

  it('rejects protocol-relative URLs and invalid schemes', () => {
    expect(sanitizeURL('//malicious-site.com/payload')).toBe(null);
    expect(sanitizeURL('http://insecure-site.com')).toBe(null);
    expect(sanitizeURL('ftp://example.com')).toBe(null);
    expect(sanitizeURL('/unapproved/internal/path')).toBe(null);
  });
});

describe('Security Utilities: escapeHTML', () => {
  it('escapes dangerous HTML characters', () => {
    expect(escapeHTML('<script>alert("xss")</script>')).toBe('&lt;script&gt;alert(&quot;xss&quot;)&lt;&#47;script&gt;');
    expect(escapeHTML("Tom & Jerry's `test` = 1")).toBe('Tom &amp; Jerry&#39;s &#96;test&#96; &#61; 1');
  });

  it('returns empty string for falsy input', () => {
    expect(escapeHTML('')).toBe('');
    expect(escapeHTML(null)).toBe('');
    expect(escapeHTML(undefined)).toBe('');
  });
});
