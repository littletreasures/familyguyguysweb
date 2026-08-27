/**
 * transcript-schema.ts
 * Core types and constants for structured episode transcripts.
 */

export const ALLOWED_HOST_SPEAKERS = ['Jason', 'Collin', 'Tyler'] as const;
export type HostSpeaker = (typeof ALLOWED_HOST_SPEAKERS)[number];

export type TranscriptStatus = 'draft' | 'published' | 'archived';

export interface TranscriptEntry {
  start_seconds: number;
  end_seconds?: number;
  speaker: string;
  text: string;
}

export interface TranscriptSection {
  id: string;
  heading: string;
  start_seconds: number;
  end_seconds: number;
  entries: TranscriptEntry[];
}

export interface EpisodeTranscript {
  id?: string;
  episode_id: string;
  status: TranscriptStatus;
  source?: string;
  language?: string;
  transcript_version?: number;
  intro?: string | null;
  seo_description?: string | null;
  sections: TranscriptSection[];
  plain_text: string;
  word_count: number;
  published_at?: string | null;
  created_at?: string;
  updated_at?: string;
  _comment?: string;
  is_synthetic?: boolean;
}

export interface TranscriptValidationResult {
  valid: boolean;
  errors: string[];
}
