/**
 * transcript-utils.ts
 * Utilities for parsing Riverside transcripts, normalizing data, calculating
 * plain text/word count, validating transcript structure, and escaping HTML.
 */

import {
  TranscriptEntry,
  TranscriptSection,
  EpisodeTranscript,
  TranscriptValidationResult,
} from './transcript-schema';

/**
 * Parses timestamp strings from Riverside format:
 * - "MM:SS" or "MM:SS.mmm" (e.g. "00:01.9", "01:14.572", "54:30")
 * - "HH:MM:SS" or "HH:MM:SS.mmm" (e.g. "01:00:07.372", "01:59:13")
 * Returns number of seconds with fractional precision, or throws on invalid format.
 */
export function parseRiversideTimestamp(ts: string): number {
  if (typeof ts !== 'string') {
    throw new Error(`Invalid timestamp format: expected string, got ${typeof ts}`);
  }
  const clean = ts.trim().replace(/^\(|\)$/g, '');
  const parts = clean.split(':');

  if (parts.length === 2) {
    const minutes = parseInt(parts[0], 10);
    const seconds = parseFloat(parts[1]);
    if (isNaN(minutes) || isNaN(seconds) || minutes < 0 || seconds < 0 || seconds >= 60) {
      throw new Error(`Invalid MM:SS timestamp: "${ts}"`);
    }
    return Math.round((minutes * 60 + seconds) * 1000) / 1000;
  }

  if (parts.length === 3) {
    const hours = parseInt(parts[0], 10);
    const minutes = parseInt(parts[1], 10);
    const seconds = parseFloat(parts[2]);
    if (
      isNaN(hours) ||
      isNaN(minutes) ||
      isNaN(seconds) ||
      hours < 0 ||
      minutes < 0 ||
      minutes >= 60 ||
      seconds < 0 ||
      seconds >= 60
    ) {
      throw new Error(`Invalid HH:MM:SS timestamp: "${ts}"`);
    }
    return Math.round((hours * 3600 + minutes * 60 + seconds) * 1000) / 1000;
  }

  throw new Error(`Unrecognized timestamp format: "${ts}"`);
}

/**
 * Formats seconds into a human-readable string:
 * - MM:SS (e.g. 05:23)
 * - HH:MM:SS (e.g. 01:14:05) if duration >= 1 hour
 */
export function formatTimestamp(totalSeconds: number): string {
  if (typeof totalSeconds !== 'number' || isNaN(totalSeconds) || totalSeconds < 0) {
    return '00:00';
  }
  const total = Math.floor(totalSeconds);
  const hours = Math.floor(total / 3600);
  const minutes = Math.floor((total % 3600) / 60);
  const seconds = total % 60;

  const pad = (n: number) => n.toString().padStart(2, '0');

  if (hours > 0) {
    return `${pad(hours)}:${pad(minutes)}:${pad(seconds)}`;
  }
  return `${pad(minutes)}:${pad(seconds)}`;
}

/**
 * Normalizes speaker names.
 * Standardizes common variations/aliases:
 * - "Colin" -> "Collin"
 * - Rejects generic "Speaker 1", "Speaker 2", etc.
 */
export function normalizeSpeaker(rawSpeaker: string): string {
  if (!rawSpeaker || typeof rawSpeaker !== 'string') {
    throw new Error('Speaker name cannot be empty');
  }
  const trimmed = rawSpeaker.trim();

  // Reject generic placeholders
  if (/^speaker\s*\d+$/i.test(trimmed)) {
    throw new Error(
      `Generic speaker label "${trimmed}" is not permitted. Speaker must use real host/guest name.`
    );
  }

  const lower = trimmed.toLowerCase();
  if (lower === 'colin' || lower === 'collin') {
    return 'Collin';
  }
  if (lower === 'jason') {
    return 'Jason';
  }
  if (lower === 'tyler') {
    return 'Tyler';
  }

  return trimmed;
}

/**
 * Parses raw Riverside speaker-tagged text format into structured entries and sections.
 * Expected Riverside line format:
 * SpeakerName (MM:SS.mmm)
 * or SpeakerName (HH:MM:SS.mmm)
 * followed by speech lines.
 */
export function parseRiversideTranscript(
  rawText: string,
  defaultHeading: string = 'Full Episode Discussion'
): TranscriptSection[] {
  if (!rawText || typeof rawText !== 'string' || !rawText.trim()) {
    return [];
  }

  // Regex matching "Speaker (timestamp)" lines
  const headerRegex = /^([A-Za-z0-9 _.'"-]+?)\s*\(((\d{1,2}:)?\d{1,2}:\d{2}(?:\.\d+)?)\)\s*$/;

  const lines = rawText.split(/\r?\n/);
  const entries: TranscriptEntry[] = [];

  let currentSpeaker: string | null = null;
  let currentStartSeconds: number | null = null;
  let currentTextBuffer: string[] = [];
  let headerMatchCount = 0;

  const flushEntry = () => {
    if (currentSpeaker && currentStartSeconds !== null) {
      const text = currentTextBuffer.join(' ').trim();
      if (text.length > 0) {
        entries.push({
          start_seconds: currentStartSeconds,
          speaker: currentSpeaker,
          text,
        });
      }
    }
    currentSpeaker = null;
    currentStartSeconds = null;
    currentTextBuffer = [];
  };

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) {
      continue;
    }

    const match = trimmed.match(headerRegex);
    if (match) {
      headerMatchCount++;
      flushEntry();
      const rawSpeaker = match[1].trim();
      const rawTimestamp = match[2].trim();
      currentSpeaker = normalizeSpeaker(rawSpeaker);
      currentStartSeconds = parseRiversideTimestamp(rawTimestamp);
    } else if (currentSpeaker && currentStartSeconds !== null) {
      currentTextBuffer.push(trimmed);
    }
  }

  flushEntry();

  // Validate format detection: if no speaker headers were matched, reject with clear actionable message
  if (headerMatchCount === 0 || entries.length === 0) {
    throw new Error(
      'Unsupported transcript format: Input does not contain recognized Riverside speaker-tagged lines (e.g. "Jason (00:01.9)"). In Phase 1, only Riverside speaker-tagged .txt format is supported. (SRT, VTT, and JSON adapters are planned for subsequent phases).'
    );
  }

  // Assign end_seconds based on next entry's start_seconds where available
  for (let i = 0; i < entries.length; i++) {
    if (i < entries.length - 1) {
      entries[i].end_seconds = entries[i + 1].start_seconds;
    } else {
      const wordCount = entries[i].text.split(/\s+/).length;
      const estimatedDuration = Math.max(5, Math.round(wordCount / 2.5));
      entries[i].end_seconds = entries[i].start_seconds + estimatedDuration;
    }
  }

  const firstEntry = entries[0];
  const lastEntry = entries[entries.length - 1];
  const sectionEnd = lastEntry.end_seconds ?? lastEntry.start_seconds + 5;

  const section: TranscriptSection = {
    id: 'episode-discussion',
    heading: defaultHeading,
    start_seconds: firstEntry.start_seconds,
    end_seconds: sectionEnd,
    entries,
  };

  return [section];
}

/**
 * Generates continuous plain text and total word count from structured sections.
 */
export function generatePlainText(sections: TranscriptSection[]): {
  plain_text: string;
  word_count: number;
} {
  if (!Array.isArray(sections) || sections.length === 0) {
    return { plain_text: '', word_count: 0 };
  }

  const parts: string[] = [];

  for (const section of sections) {
    if (section.heading) {
      parts.push(`## ${section.heading}`);
    }
    if (Array.isArray(section.entries)) {
      for (const entry of section.entries) {
        if (entry.speaker && entry.text) {
          const time = formatTimestamp(entry.start_seconds);
          parts.push(`${entry.speaker} [${time}]: ${entry.text.trim()}`);
        }
      }
    }
  }

  const plain_text = parts.join('\n\n');
  const wordsOnly = plain_text.replace(/[#:[\]]/g, ' ').trim();
  const word_count = wordsOnly.length > 0 ? wordsOnly.split(/\s+/).length : 0;

  return { plain_text, word_count };
}

/**
 * Validates a transcript object against schema constraints and business rules.
 */
export function validateTranscript(data: unknown): TranscriptValidationResult {
  const errors: string[] = [];

  if (!data || typeof data !== 'object') {
    return { valid: false, errors: ['Transcript payload must be a non-null object'] };
  }

  const t = data as Record<string, any>;

  // Episode ID validation
  if (!t.episode_id || typeof t.episode_id !== 'string' || !t.episode_id.trim()) {
    errors.push("Missing required field 'episode_id'");
  } else if (!/^s\d+e\d+$/i.test(t.episode_id.trim())) {
    errors.push(`Invalid episode_id format '${t.episode_id}'. Expected format 's1e4'.`);
  }

  // Status validation
  const validStatuses: Array<EpisodeTranscript['status']> = ['draft', 'published', 'archived'];
  if (!t.status || !validStatuses.includes(t.status)) {
    errors.push(`Invalid status '${t.status}'. Must be one of: ${validStatuses.join(', ')}`);
  }

  // Published-at requirement validation (matches database check constraint)
  if (
    t.status === 'published' &&
    (!t.published_at || typeof t.published_at !== 'string' || !t.published_at.trim())
  ) {
    errors.push("Published transcripts must include a valid 'published_at' timestamp");
  }

  // Sections validation
  if (!Array.isArray(t.sections) || t.sections.length === 0) {
    errors.push('Transcript must contain at least one section in `sections` array');
  } else {
    let previousSectionEnd = -1;

    t.sections.forEach((section: any, sIdx: number) => {
      if (!section || typeof section !== 'object') {
        errors.push(`Section at index ${sIdx} is invalid`);
        return;
      }
      if (!section.id || typeof section.id !== 'string') {
        errors.push(`Section at index ${sIdx} is missing a string 'id'`);
      }
      if (!section.heading || typeof section.heading !== 'string') {
        errors.push(`Section at index ${sIdx} is missing a string 'heading'`);
      }
      if (typeof section.start_seconds !== 'number' || section.start_seconds < 0) {
        errors.push(`Section '${section.id || sIdx}' has invalid 'start_seconds'`);
      }
      if (typeof section.end_seconds !== 'number' || section.end_seconds < section.start_seconds) {
        errors.push(`Section '${section.id || sIdx}' has 'end_seconds' before 'start_seconds'`);
      }

      // Check section non-overlap with preceding sections
      if (
        sIdx > 0 &&
        typeof section.start_seconds === 'number' &&
        section.start_seconds < previousSectionEnd
      ) {
        errors.push(
          `Section '${section.id || sIdx}' starts at ${section.start_seconds}s before previous section ends at ${previousSectionEnd}s (overlapping sections)`
        );
      }
      if (typeof section.end_seconds === 'number') {
        previousSectionEnd = section.end_seconds;
      }

      // Check entries within section
      if (!Array.isArray(section.entries) || section.entries.length === 0) {
        errors.push(`Section '${section.id || sIdx}' must contain at least one entry`);
      } else {
        let lastEntryStart = -1;

        section.entries.forEach((entry: any, eIdx: number) => {
          if (!entry || typeof entry !== 'object') {
            errors.push(`Entry at index ${eIdx} in section '${section.id}' is invalid`);
            return;
          }

          // 1. Validate start_seconds within section bounds
          if (typeof entry.start_seconds !== 'number' || entry.start_seconds < 0) {
            errors.push(
              `Entry at index ${eIdx} in section '${section.id}' has invalid 'start_seconds'`
            );
          } else {
            if (
              typeof section.start_seconds === 'number' &&
              entry.start_seconds < section.start_seconds
            ) {
              errors.push(
                `Entry at index ${eIdx} in section '${section.id}' start_seconds (${entry.start_seconds}) is before section start (${section.start_seconds})`
              );
            }
            if (
              typeof section.end_seconds === 'number' &&
              entry.start_seconds > section.end_seconds
            ) {
              errors.push(
                `Entry at index ${eIdx} in section '${section.id}' start_seconds (${entry.start_seconds}) exceeds section end (${section.end_seconds})`
              );
            }
            if (entry.start_seconds < lastEntryStart) {
              errors.push(
                `Entry at index ${eIdx} in section '${section.id}' has non-monotonic start_seconds (${entry.start_seconds} < ${lastEntryStart})`
              );
            } else {
              lastEntryStart = entry.start_seconds;
            }
          }

          // 2. Validate end_seconds within entry and section bounds
          if (entry.end_seconds !== undefined && entry.end_seconds !== null) {
            if (typeof entry.end_seconds !== 'number' || entry.end_seconds < 0) {
              errors.push(
                `Entry at index ${eIdx} in section '${section.id}' has invalid 'end_seconds'`
              );
            } else {
              if (
                typeof entry.start_seconds === 'number' &&
                entry.end_seconds < entry.start_seconds
              ) {
                errors.push(
                  `Entry at index ${eIdx} in section '${section.id}' end_seconds (${entry.end_seconds}) is before entry start_seconds (${entry.start_seconds})`
                );
              }
              if (
                typeof section.end_seconds === 'number' &&
                entry.end_seconds > section.end_seconds
              ) {
                errors.push(
                  `Entry at index ${eIdx} in section '${section.id}' end_seconds (${entry.end_seconds}) exceeds section end_seconds (${section.end_seconds})`
                );
              }
            }
          }

          // 3. Speaker validation
          if (!entry.speaker || typeof entry.speaker !== 'string' || !entry.speaker.trim()) {
            errors.push(`Entry at index ${eIdx} in section '${section.id}' has empty speaker`);
          } else if (/^speaker\s*\d+$/i.test(entry.speaker.trim())) {
            errors.push(
              `Entry at index ${eIdx} in section '${section.id}' uses generic speaker label '${entry.speaker}'`
            );
          }

          // 4. Text validation
          if (!entry.text || typeof entry.text !== 'string' || !entry.text.trim()) {
            errors.push(`Entry at index ${eIdx} in section '${section.id}' has empty text`);
          }
        });
      }
    });
  }

  // Plain text and word count validation
  if (typeof t.plain_text !== 'string' || !t.plain_text.trim()) {
    errors.push("Missing or empty 'plain_text'");
  }
  if (typeof t.word_count !== 'number' || t.word_count <= 0) {
    errors.push("Invalid 'word_count': must be a positive integer");
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}

/**
 * Escapes unsafe HTML characters to prevent XSS.
 */
export function escapeHtml(unsafe: string): string {
  if (typeof unsafe !== 'string') {
    return '';
  }
  return unsafe
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

/**
 * Validates that a transcript's episode_id refers to a valid, existing episode record.
 */
export function validateEpisodeJoin(
  transcript: EpisodeTranscript,
  existingEpisodeIds: Set<string> | string[]
): { valid: boolean; error?: string } {
  const idSet =
    existingEpisodeIds instanceof Set ? existingEpisodeIds : new Set(existingEpisodeIds);
  if (!idSet.has(transcript.episode_id)) {
    return {
      valid: false,
      error: `Orphan transcript rejected: episode_id '${transcript.episode_id}' does not exist in the episodes table.`,
    };
  }
  return { valid: true };
}
