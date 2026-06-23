import type { HistoryUser } from './types'

/**
 * Schema-agnostic formatting for the change-history renderer. Deliberately
 * label-by-lookup-with-humanize-fallback so a NEW column added by a future
 * additive migration still renders (as its humanized name) without a code
 * change — the drift-survival promise on the read side.
 */

const TABLE_LABELS: Record<string, string> = {
  entries: 'Entry',
  senses: 'Sense',
  sentences: 'Sentence',
  texts: 'Text',
  senses_in_sentences: 'Sentence link',
  speakers: 'Speaker',
  audio: 'Audio',
  audio_speakers: 'Audio speaker',
  videos: 'Video',
  video_speakers: 'Video speaker',
  sense_videos: 'Sense video',
  sentence_videos: 'Sentence video',
  photos: 'Photo',
  sense_photos: 'Sense photo',
  sentence_photos: 'Sentence photo',
  dialects: 'Dialect',
  entry_dialects: 'Dialect',
  tags: 'Tag',
  entry_tags: 'Tag',
}

const FIELD_LABELS: Record<string, string> = {
  lexeme: 'Lexeme',
  phonetic: 'Phonetic',
  interlinearization: 'Interlinearization',
  morphology: 'Morphology',
  notes: 'Notes',
  linguistic_history: 'Linguistic history',
  sources: 'Sources',
  scientific_names: 'Scientific names',
  coordinates: 'Coordinates',
  elicitation_id: 'Elicitation ID',
  definition: 'Definition',
  glosses: 'Glosses',
  parts_of_speech: 'Parts of speech',
  semantic_domains: 'Semantic domains',
  write_in_semantic_domains: 'Semantic domains (write-in)',
  noun_class: 'Noun class',
  plural_form: 'Plural form',
  variant: 'Variant',
  text: 'Text',
  translation: 'Translation',
  title: 'Title',
  name: 'Name',
  storage_path: 'File',
  serving_url: 'Image',
  photographer: 'Photographer',
  videographer: 'Videographer',
  source: 'Source',
}

/** Columns never worth showing in an insert/delete summary. */
const STRUCTURAL_FIELDS = new Set([
  'id',
  'created_at',
  'created_by_user_id',
  'updated_at',
  'updated_by_user_id',
  'dirty',
  'sort_key',
  'ends_paragraph',
  'entry_id',
  'sense_id',
  'sentence_id',
  'text_id',
  'audio_id',
  'speaker_id',
  'photo_id',
  'video_id',
  'dialect_id',
  'tag_id',
])

export function humanize(key: string): string {
  return key.replace(/_/g, ' ').replace(/^\w/, c => c.toUpperCase())
}

export function table_label(table_name: string): string {
  return TABLE_LABELS[table_name] ?? humanize(table_name)
}

export function field_label(field: string): string {
  return FIELD_LABELS[field] ?? humanize(field)
}

/** Human-readable rendering of a stored value (MultiString, array, or scalar). */
export function format_value(value: unknown): string {
  if (value === null || value === undefined || value === '')
    return '—'
  if (Array.isArray(value))
    return value.map(v => format_value(v)).join(', ')
  if (typeof value === 'object') {
    // MultiString { locale: text } and similar maps.
    const entries = Object.entries(value as Record<string, unknown>).filter(([, v]) => v !== null && v !== '' && v !== undefined)
    if (!entries.length)
      return '—'
    return entries.map(([k, v]) => `${k}: ${format_value(v)}`).join(' · ')
  }
  return String(value)
}

/** A short summary of the notable content fields of a snapshot (for insert/delete). */
export function summarize_snapshot(snapshot: Record<string, unknown> | null): { field: string, value: string }[] {
  if (!snapshot)
    return []
  return Object.entries(snapshot)
    .filter(([key, value]) => !STRUCTURAL_FIELDS.has(key) && value !== null && value !== '' && value !== undefined)
    .map(([key, value]) => ({ field: field_label(key), value: format_value(value) }))
}

export function user_display(user: HistoryUser | undefined, user_id: string): string {
  return user?.name || user?.email || `Unknown (${user_id.slice(0, 8)})`
}

export function format_at(at: string): string {
  const d = new Date(at)
  if (Number.isNaN(d.getTime()))
    return at
  return d.toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' })
}

export function day_key(at: string): string {
  const d = new Date(at)
  if (Number.isNaN(d.getTime()))
    return at
  return d.toLocaleDateString(undefined, { dateStyle: 'full' } as Intl.DateTimeFormatOptions)
}
