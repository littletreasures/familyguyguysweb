import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';
import {
  parseRiversideTimestamp,
  formatTimestamp,
  normalizeSpeaker,
  parseRiversideTranscript,
  generatePlainText,
  validateTranscript,
  escapeHtml,
  validateEpisodeJoin,
} from '../src/transcripts/transcript-utils';
import { EpisodeTranscript } from '../src/transcripts/transcript-schema';

describe('Transcript Parsing and Utilities', () => {
  describe('parseRiversideTimestamp', () => {
    it('parses MM:SS format correctly', () => {
      expect(parseRiversideTimestamp('00:05')).toBe(5);
      expect(parseRiversideTimestamp('12:34')).toBe(754);
      expect(parseRiversideTimestamp('(12:34)')).toBe(754);
    });

    it('parses MM:SS.mmm format with milliseconds', () => {
      expect(parseRiversideTimestamp('00:01.9')).toBe(1.9);
      expect(parseRiversideTimestamp('01:14.572')).toBe(74.572);
    });

    it('parses HH:MM:SS.mmm format with hours', () => {
      expect(parseRiversideTimestamp('01:00:07.372')).toBe(3607.372);
      expect(parseRiversideTimestamp('01:54:36.176')).toBe(6876.176);
    });

    it('throws on invalid timestamp formats', () => {
      expect(() => parseRiversideTimestamp('invalid')).toThrow();
      expect(() => parseRiversideTimestamp('00:65')).toThrow();
      expect(() => parseRiversideTimestamp('01:99:00')).toThrow();
    });
  });

  describe('formatTimestamp', () => {
    it('formats short durations as MM:SS', () => {
      expect(formatTimestamp(0)).toBe('00:00');
      expect(formatTimestamp(65)).toBe('01:05');
      expect(formatTimestamp(754)).toBe('12:34');
    });

    it('formats hour-long durations as HH:MM:SS', () => {
      expect(formatTimestamp(3607)).toBe('01:00:07');
      expect(formatTimestamp(6876)).toBe('01:54:36');
    });
  });

  describe('normalizeSpeaker', () => {
    it('normalizes known host names and aliases', () => {
      expect(normalizeSpeaker('Jason')).toBe('Jason');
      expect(normalizeSpeaker('jason')).toBe('Jason');
      expect(normalizeSpeaker('Collin')).toBe('Collin');
      expect(normalizeSpeaker('Colin')).toBe('Collin');
      expect(normalizeSpeaker('Tyler')).toBe('Tyler');
    });

    it('rejects generic speaker labels like Speaker 1', () => {
      expect(() => normalizeSpeaker('Speaker 1')).toThrow(/Generic speaker label/);
      expect(() => normalizeSpeaker('Speaker 2')).toThrow(/Generic speaker label/);
    });
  });

  describe('parseRiversideTranscript format detection', () => {
    it('parses raw Riverside fixture text into structured sections and entries', () => {
      const fixturePath = path.resolve(__dirname, 'fixtures/riverside-s1e6-sample.txt');
      const rawText = fs.readFileSync(fixturePath, 'utf8');

      const sections = parseRiversideTranscript(rawText, 'Cold Open & Highlights');
      expect(sections.length).toBe(1);
      expect(sections[0].heading).toBe('Cold Open & Highlights');
      expect(sections[0].entries.length).toBe(8);

      const [first, second, third] = sections[0].entries;
      expect(first.speaker).toBe('Jason');
      expect(first.start_seconds).toBe(1.9);
      expect(first.text).toContain('make sure I got all my stuff in here');

      expect(second.speaker).toBe('Collin');
      expect(second.start_seconds).toBe(3.462);

      expect(third.speaker).toBe('Tyler');
      expect(third.start_seconds).toBe(7.506);
    });

    it('rejects unstructured plain text without Riverside speaker tags', () => {
      const unstructuredText = 'Just some plain text without any timestamps or speaker headers.';
      expect(() => parseRiversideTranscript(unstructuredText)).toThrow(
        /Unsupported transcript format/
      );
    });
  });

  describe('generatePlainText and word_count', () => {
    it('calculates continuous plain text and positive word count', () => {
      const fixturePath = path.resolve(__dirname, 'fixtures/s1e6-transcript-fixture.json');
      const data: EpisodeTranscript = JSON.parse(fs.readFileSync(fixturePath, 'utf8'));

      const { plain_text, word_count } = generatePlainText(data.sections);
      expect(plain_text).toContain('## Cold Open: Red Hot Chili Peppers and Cigarettes');
      expect(plain_text).toContain(
        'Jason [00:01]: Yeah. let me make sure I got all my stuff in here.'
      );
      expect(word_count).toBeGreaterThan(50);
    });
  });

  describe('validateTranscript bound checks & integrity', () => {
    it('accepts a valid published episode transcript fixture with proper bounds and published_at', () => {
      const fixturePath = path.resolve(__dirname, 'fixtures/s1e6-transcript-fixture.json');
      const data = JSON.parse(fs.readFileSync(fixturePath, 'utf8'));

      const result = validateTranscript(data);
      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('rejects an entry whose start_seconds exceeds section.end_seconds', () => {
      const invalid = {
        episode_id: 's1e6',
        status: 'draft',
        sections: [
          {
            id: 'sec-1',
            heading: 'Section 1',
            start_seconds: 0.0,
            end_seconds: 3600.0,
            entries: [
              { start_seconds: 10.0, end_seconds: 20.0, speaker: 'Jason', text: 'First line' },
              {
                start_seconds: 6876.176,
                end_seconds: 7000.0,
                speaker: 'Tyler',
                text: 'Late entry',
              },
            ],
          },
        ],
        plain_text: 'sample',
        word_count: 10,
      };

      const result = validateTranscript(invalid);
      expect(result.valid).toBe(false);
      expect(result.errors.some((e) => e.includes('exceeds section end'))).toBe(true);
    });

    it('rejects an entry whose end_seconds exceeds section.end_seconds', () => {
      const invalid = {
        episode_id: 's1e6',
        status: 'draft',
        sections: [
          {
            id: 'sec-1',
            heading: 'Section 1',
            start_seconds: 0.0,
            end_seconds: 100.0,
            entries: [
              { start_seconds: 10.0, end_seconds: 150.0, speaker: 'Jason', text: 'Overlong line' },
            ],
          },
        ],
        plain_text: 'sample',
        word_count: 10,
      };

      const result = validateTranscript(invalid);
      expect(result.valid).toBe(false);
      expect(result.errors.some((e) => e.includes('exceeds section end'))).toBe(true);
    });

    it('rejects overlapping sections', () => {
      const overlapping = {
        episode_id: 's1e6',
        status: 'draft',
        sections: [
          {
            id: 'sec-1',
            heading: 'Section 1',
            start_seconds: 0.0,
            end_seconds: 100.0,
            entries: [{ start_seconds: 10.0, end_seconds: 50.0, speaker: 'Jason', text: 'Line 1' }],
          },
          {
            id: 'sec-2',
            heading: 'Section 2',
            start_seconds: 50.0, // starts before sec-1 ends at 100.0
            end_seconds: 200.0,
            entries: [
              { start_seconds: 60.0, end_seconds: 120.0, speaker: 'Collin', text: 'Line 2' },
            ],
          },
        ],
        plain_text: 'sample',
        word_count: 10,
      };

      const result = validateTranscript(overlapping);
      expect(result.valid).toBe(false);
      expect(result.errors.some((e) => e.includes('overlapping sections'))).toBe(true);
    });

    it('rejects a published transcript missing published_at', () => {
      const missingPublishedAt = {
        episode_id: 's1e6',
        status: 'published',
        published_at: null,
        sections: [
          {
            id: 'sec-1',
            heading: 'Section 1',
            start_seconds: 0.0,
            end_seconds: 100.0,
            entries: [{ start_seconds: 10.0, end_seconds: 50.0, speaker: 'Jason', text: 'Line 1' }],
          },
        ],
        plain_text: 'sample',
        word_count: 10,
      };

      const result = validateTranscript(missingPublishedAt);
      expect(result.valid).toBe(false);
      expect(result.errors.some((e) => e.includes('published_at'))).toBe(true);
    });

    it('rejects invalid or missing required fields', () => {
      const invalid = {
        episode_id: 'bad-id',
        status: 'unknown_status',
        sections: [],
        plain_text: '',
        word_count: 0,
      };

      const result = validateTranscript(invalid);
      expect(result.valid).toBe(false);
      expect(result.errors.some((e) => e.includes('episode_id'))).toBe(true);
      expect(result.errors.some((e) => e.includes('status'))).toBe(true);
      expect(result.errors.some((e) => e.includes('sections'))).toBe(true);
    });

    it('rejects non-monotonic entry timestamps', () => {
      const nonMonotonic = {
        episode_id: 's1e6',
        status: 'draft',
        sections: [
          {
            id: 'sec-1',
            heading: 'Section 1',
            start_seconds: 0,
            end_seconds: 100,
            entries: [
              { start_seconds: 10, end_seconds: 20, speaker: 'Jason', text: 'First line' },
              {
                start_seconds: 5,
                end_seconds: 15,
                speaker: 'Tyler',
                text: 'Going backwards in time',
              },
            ],
          },
        ],
        plain_text: 'sample',
        word_count: 10,
      };

      const result = validateTranscript(nonMonotonic);
      expect(result.valid).toBe(false);
      expect(result.errors.some((e) => e.includes('non-monotonic'))).toBe(true);
    });
  });

  describe('escapeHtml', () => {
    it('sanitizes script tags, html elements, quotes, and dangerous entities', () => {
      const dangerous =
        '<script>alert("xss")</script> & "quotes" \'apostrophes\' <div class="test">content</div>';
      const escaped = escapeHtml(dangerous);

      expect(escaped).not.toContain('<script>');
      expect(escaped).not.toContain('</script>');
      expect(escaped).not.toContain('<div');
      expect(escaped).toContain('&lt;script&gt;');
      expect(escaped).toContain('&amp;');
      expect(escaped).toContain('&quot;quotes&quot;');
      expect(escaped).toContain('&#039;apostrophes&#039;');
    });
  });

  describe('validateEpisodeJoin', () => {
    it('passes when episode_id exists in known episodes list', () => {
      const episodes = JSON.parse(
        fs.readFileSync(path.resolve(__dirname, 'fixtures/mock-episodes.json'), 'utf8')
      );
      const episodeIds = episodes.map((e: any) => e.id);

      const validTranscript: EpisodeTranscript = {
        episode_id: 's1e6',
        status: 'published',
        published_at: '2020-01-01T00:00:00Z',
        sections: [],
        plain_text: 'sample',
        word_count: 1,
      };

      const result = validateEpisodeJoin(validTranscript, episodeIds);
      expect(result.valid).toBe(true);
    });

    it('rejects orphan transcript whose episode_id does not exist', () => {
      const episodes = JSON.parse(
        fs.readFileSync(path.resolve(__dirname, 'fixtures/mock-episodes.json'), 'utf8')
      );
      const episodeIds = episodes.map((e: any) => e.id);

      const orphanTranscript: EpisodeTranscript = {
        episode_id: 's99e99',
        status: 'published',
        published_at: '2020-01-01T00:00:00Z',
        sections: [],
        plain_text: 'sample',
        word_count: 1,
      };

      const result = validateEpisodeJoin(orphanTranscript, episodeIds);
      expect(result.valid).toBe(false);
      expect(result.error).toContain('Orphan transcript rejected');
    });
  });

  describe('Public eligibility logic', () => {
    it('filters out draft and archived transcripts from public display', () => {
      const transcripts: EpisodeTranscript[] = [
        {
          episode_id: 's1e1',
          status: 'published',
          published_at: '2020-01-01T00:00:00Z',
          sections: [],
          plain_text: 'p1',
          word_count: 1,
        },
        { episode_id: 's1e2', status: 'draft', sections: [], plain_text: 'd1', word_count: 1 },
        { episode_id: 's1e3', status: 'archived', sections: [], plain_text: 'a1', word_count: 1 },
        {
          episode_id: 's1e6',
          status: 'published',
          published_at: '2020-01-01T00:00:00Z',
          sections: [],
          plain_text: 'p2',
          word_count: 1,
        },
      ];

      const publicTranscripts = transcripts.filter((t) => t.status === 'published');
      expect(publicTranscripts.map((t) => t.episode_id)).toEqual(['s1e1', 's1e6']);
    });
  });
});
