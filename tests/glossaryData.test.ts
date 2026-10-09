import { describe, it, expect } from 'vitest';
import {
  GLOSSARY_CATEGORIES,
  GLOSSARY_ENTRIES,
  GLOSSARY_ENTRY_COUNT,
  getGlossarySortKey,
  getEntriesByCategory,
  getGlossaryAlphabet,
  GlossaryCategoryId,
} from '../src/data/glossary.js';

describe('Glossary Canonical Data Layer', () => {
  it('defines exactly 5 categories in canonical order', () => {
    expect(GLOSSARY_CATEGORIES).toHaveLength(5);
    expect(GLOSSARY_CATEGORIES.map((c) => c.id)).toEqual([
      'frameworks',
      'segments',
      'personas',
      'terminology',
      'aliases',
    ]);
  });

  it('matches baseline count of 29 entries', () => {
    expect(GLOSSARY_ENTRIES).toHaveLength(29);
    expect(GLOSSARY_ENTRY_COUNT).toBe(29);
  });

  it('enforces unique kebab-case IDs on every entry', () => {
    const idRegex = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
    const seenIds = new Set<string>();

    for (const entry of GLOSSARY_ENTRIES) {
      expect(entry.id).toMatch(idRegex);
      expect(seenIds.has(entry.id)).toBe(false);
      seenIds.add(entry.id);
    }
  });

  it('validates every categoryId maps to an exported category ID', () => {
    const validCategoryIds = new Set(GLOSSARY_CATEGORIES.map((c) => c.id));
    for (const entry of GLOSSARY_ENTRIES) {
      expect(validCategoryIds.has(entry.categoryId)).toBe(true);
    }
  });

  it('contains at least one entry in every defined category', () => {
    for (const category of GLOSSARY_CATEGORIES) {
      const entries = getEntriesByCategory(category.id);
      expect(entries.length).toBeGreaterThan(0);
    }
  });

  it('validates non-empty trimmed strings for required fields', () => {
    for (const entry of GLOSSARY_ENTRIES) {
      expect(entry.id.trim().length).toBeGreaterThan(0);
      expect(entry.term.trim().length).toBeGreaterThan(0);
      expect(entry.definition.trim().length).toBeGreaterThan(0);
      if (entry.aka !== undefined) {
        expect(entry.aka.trim().length).toBeGreaterThan(0);
      }
    }
  });

  it('validates origin structure and episode numbering when present', () => {
    for (const entry of GLOSSARY_ENTRIES) {
      if (entry.origin) {
        expect(Number.isInteger(entry.origin.season)).toBe(true);
        expect(entry.origin.season).toBeGreaterThanOrEqual(1);
        expect(Number.isInteger(entry.origin.episode)).toBe(true);
        expect(entry.origin.episode).toBeGreaterThanOrEqual(1);
        if (entry.origin.timestamp !== undefined) {
          expect(typeof entry.origin.timestamp).toBe('string');
          expect(entry.origin.timestamp.trim().length).toBeGreaterThan(0);
        }
        if (entry.origin.note !== undefined) {
          expect(typeof entry.origin.note).toBe('string');
          expect(entry.origin.note.trim().length).toBeGreaterThan(0);
        }
      }
    }
  });

  it('validates references array structure', () => {
    for (const entry of GLOSSARY_ENTRIES) {
      expect(Array.isArray(entry.references)).toBe(true);
      for (const ref of entry.references) {
        expect(Number.isInteger(ref.season)).toBe(true);
        expect(ref.season).toBeGreaterThanOrEqual(1);
        expect(Number.isInteger(ref.episode)).toBe(true);
        expect(ref.episode).toBeGreaterThanOrEqual(1);
        if (ref.note !== undefined) {
          expect(typeof ref.note).toBe('string');
          expect(ref.note.trim().length).toBeGreaterThan(0);
        }
      }
    }
  });

  it('normalizes sort keys ignoring leading "The "', () => {
    expect(getGlossarySortKey('The Blue Tent')).toBe('blue tent');
    expect(getGlossarySortKey('The Lisa Metrics')).toBe('lisa metrics');
    expect(getGlossarySortKey('Structurehead')).toBe('structurehead');
    expect(getGlossarySortKey('  The Cheesecake Factory Zone  ')).toBe('cheesecake factory zone');
  });

  it('sorts category entries alphabetically without mutating GLOSSARY_ENTRIES', () => {
    const originalFirstId = GLOSSARY_ENTRIES[0].id;
    const sortedFrameworks = getEntriesByCategory('frameworks');
    expect(sortedFrameworks.map((e) => e.term)).toEqual([
      'Gagger',
      'Hat on a Hat vs. Cherry on Top',
      'Structurehead',
      'Structurehead Head Nod',
    ]);
    expect(GLOSSARY_ENTRIES[0].id).toBe(originalFirstId);
  });

  it('derives uppercase alphabet from normalized sort keys including B and L', () => {
    const alphabet = getGlossaryAlphabet();
    expect(alphabet).toContain('B');
    expect(alphabet).toContain('L');
    expect(alphabet).toContain('S');
    // Ensure sorted order
    const sortedCopy = [...alphabet].sort((a, b) =>
      a.localeCompare(b, 'en', { sensitivity: 'base' })
    );
    expect(alphabet).toEqual(sortedCopy);
  });

  it('confirms "Fix It in Post" has null origin and retains recurring-catchphrase description', () => {
    const entry = GLOSSARY_ENTRIES.find((e) => e.id === 'fix-it-in-post');
    expect(entry).toBeDefined();
    expect(entry?.origin).toBeNull();
    expect(entry?.definition).toContain("Jason's editor catchphrase");
  });
});
