import { expose, releaseProxy } from 'comlink'
import type { EntryData, Tables } from '$lib/types'
import type { WorkerPatch } from './worker-patch'
import { _search_entries, _search_sentences, _search_texts, create_corpus_indexes, create_index, update_index_entry, update_index_sentence, update_index_text } from './orama.worker'
import { should_include_tag } from '$lib/helpers/tag-visibility'
import { assemble_entry_data } from './assemble-entry-data'
import { augment_sentence_for_search, augment_text_for_search } from './augment-sentence-for-search'

const log = false

let dictionary_id: string
let admin: number
/** The ONE proxied callback to the main-thread store reducer (see worker-patch.ts). */
let on_patch: (patch: WorkerPatch) => Promise<void>

let entries: Record<string, Tables<'entries'>>
let senses: Record<string, Tables<'senses'>>
let audios: Record<string, Tables<'audio'>>
let speakers: Record<string, Tables<'speakers'>>
let audio_speakers: Record<string, Tables<'audio_speakers'>>
let tags: Record<string, Tables<'tags'>>
let entry_tags: Record<string, Tables<'entry_tags'>>
let dialects: Record<string, Tables<'dialects'>>
let entry_dialects: Record<string, Tables<'entry_dialects'>>
let sources: Record<string, Tables<'sources'>>
let photos: Record<string, Tables<'photos'>>
let sense_photos: Record<string, Tables<'sense_photos'>>
let videos: Record<string, Tables<'videos'>>
let video_speakers: Record<string, Tables<'video_speakers'>>
let sense_videos: Record<string, Tables<'sense_videos'>>
let sentences: Record<string, Tables<'sentences'>>
let senses_in_sentences: Record<string, Tables<'senses_in_sentences'>>
let texts: Record<string, Tables<'texts'>>
let sentence_photos: Record<string, Tables<'sentence_photos'>>
let sentence_videos: Record<string, Tables<'sentence_videos'>>

let entry_id_to_tags: Record<string, Tables<'tags'>[]> = {}
let entry_id_to_dialects: Record<string, Tables<'dialects'>[]> = {}
let entry_id_to_senses: Record<string, Tables<'senses'>[]> = {}
let sense_id_to_sentences: Record<string, Tables<'sentences'>[]> = {}
let sense_id_to_photos: Record<string, Tables<'photos'>[]> = {}
let video_id_to_speakers: Record<string, Tables<'speakers'>[]> = {}
let sense_id_to_videos: Record<string, Tables<'videos'>[]> = {}
let audio_id_to_speakers: Record<string, Tables<'speakers'>[]> = {}
let entry_id_to_audios: Record<string, Tables<'audio'>[]> = {}
let sentence_id_to_audios: Record<string, Tables<'audio'>[]> = {}
let sentence_id_to_photo_joins: Record<string, Tables<'sentence_photos'>[]> = {}
let sentence_id_to_video_joins: Record<string, Tables<'sentence_videos'>[]> = {}

// The grouping maps above accumulate via .push() across the bulk load. On a long-running
// dev server init_entries can run more than once (CDN cache pass + dummy-data pass, navigation),
// so they must be cleared before each bulk rebuild or items duplicate (e.g. one sense rendered N times).
// The incremental insert/update/delete operations rebuild correctly from the deduped dicts after a reset.
function reset_grouping_maps() {
  entry_id_to_tags = {}
  entry_id_to_dialects = {}
  entry_id_to_senses = {}
  sense_id_to_sentences = {}
  sense_id_to_photos = {}
  video_id_to_speakers = {}
  sense_id_to_videos = {}
  audio_id_to_speakers = {}
  entry_id_to_audios = {}
  sentence_id_to_audios = {}
  sentence_id_to_photo_joins = {}
  sentence_id_to_video_joins = {}
}

// vps-migration M4 write/sync P4b: the watch-based Orama feed. The main-thread
// `orama-watcher` reads rows changed since a watermark from wa-sqlite (local
// edits AND remote sync-pulls — one path) and hands them here. `apply_rows`
// upserts each changed row into the in-memory base/junction maps (LIVE rows
// only — a `deleted` row is removed), RECOMPUTES the affected grouping slices
// from those maps (robust, no fragile in-place mutation), resolves the owning
// entry_id(s) across all 16 tables, and re-assembles + reindexes each affected
// entry once via the existing `process_entry`. This replaces the prior interim
// `api.X` double-write from operations.ts.

const SYNC_TABLE_ORDER = [
  'entries', 'texts', 'senses', 'speakers', 'tags', 'dialects', 'sources', 'audio', 'photos', 'videos', 'sentences',
  'audio_speakers', 'entry_tags', 'entry_dialects', 'sense_photos', 'video_speakers', 'sense_videos', 'senses_in_sentences', 'sentence_photos', 'sentence_videos',
] as const

function pair_values<T>(map: Record<string, T>, field: 'audio_id' | 'speaker_id' | 'video_id' | 'entry_id' | 'tag_id' | 'dialect_id' | 'sense_id' | 'photo_id' | 'sentence_id', value: string): T[] {
  return Object.values(map).filter(row => (row as Record<string, unknown>)[field] === value)
}

function recompute_entry_senses(entry_id: string) {
  if (!entry_id) return
  const list = Object.values(senses).filter(sense => sense.entry_id === entry_id)
  list.sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime())
  entry_id_to_senses[entry_id] = list
}

function recompute_audio_speakers(audio_id: string) {
  audio_id_to_speakers[audio_id] = pair_values(audio_speakers, 'audio_id', audio_id)
    .map(join => speakers[(join as Tables<'audio_speakers'>).speaker_id])
    .filter(Boolean)
}

function recompute_video_speakers(video_id: string) {
  video_id_to_speakers[video_id] = pair_values(video_speakers, 'video_id', video_id)
    .map(join => speakers[(join as Tables<'video_speakers'>).speaker_id])
    .filter(Boolean)
}

function recompute_entry_audios(entry_id: string) {
  if (!entry_id) return
  const list = Object.values(audios)
    .filter(audio => audio.entry_id === entry_id)
    .sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime())
    .map(audio => ({
      ...audio,
      ...(audio_id_to_speakers[audio.id]?.length ? { speakers: audio_id_to_speakers[audio.id] } : {}),
    }))
  entry_id_to_audios[entry_id] = list
}

function recompute_entry_tags(entry_id: string) {
  if (!entry_id) return
  entry_id_to_tags[entry_id] = pair_values(entry_tags, 'entry_id', entry_id)
    .map(join => tags[(join as Tables<'entry_tags'>).tag_id])
    .filter(tag => tag && should_include_tag(tag, admin))
}

function recompute_entry_dialects(entry_id: string) {
  if (!entry_id) return
  entry_id_to_dialects[entry_id] = pair_values(entry_dialects, 'entry_id', entry_id)
    .map(join => dialects[(join as Tables<'entry_dialects'>).dialect_id])
    .filter(Boolean)
}

function recompute_sense_sentences(sense_id: string) {
  if (!sense_id) return
  sense_id_to_sentences[sense_id] = pair_values(senses_in_sentences, 'sense_id', sense_id)
    .map(join => sentences[(join as Tables<'senses_in_sentences'>).sentence_id])
    .filter(Boolean)
}

function recompute_sense_photos(sense_id: string) {
  if (!sense_id) return
  sense_id_to_photos[sense_id] = pair_values(sense_photos, 'sense_id', sense_id)
    .map(join => photos[(join as Tables<'sense_photos'>).photo_id])
    .filter(Boolean)
}

function recompute_sense_videos(sense_id: string) {
  if (!sense_id) return
  sense_id_to_videos[sense_id] = pair_values(sense_videos, 'sense_id', sense_id)
    .map((join) => {
      const video = videos[(join as Tables<'sense_videos'>).video_id]
      if (!video) return null
      return {
        ...video,
        ...(video_id_to_speakers[video.id]?.length ? { speakers: video_id_to_speakers[video.id] } : {}),
      }
    })
    .filter(Boolean) as Tables<'videos'>[]
}

function recompute_sentence_audios(sentence_id: string) {
  if (!sentence_id) return
  sentence_id_to_audios[sentence_id] = Object.values(audios).filter(audio => audio.sentence_id === sentence_id)
}

function recompute_sentence_photo_joins(sentence_id: string) {
  if (!sentence_id) return
  sentence_id_to_photo_joins[sentence_id] = pair_values(sentence_photos, 'sentence_id', sentence_id)
}

function recompute_sentence_video_joins(sentence_id: string) {
  if (!sentence_id) return
  sentence_id_to_video_joins[sentence_id] = pair_values(sentence_videos, 'sentence_id', sentence_id)
}

/** Shape one sentence row into its index doc from the current grouping maps. */
function process_sentence(sentence: Tables<'sentences'>) {
  return augment_sentence_for_search(sentence, {
    audios: sentence_id_to_audios[sentence.id] || [],
    // Junctions can outlive their media row in these maps (a media hard-delete
    // arrives as its own tombstone; the cascaded junction deletes may not) —
    // filter to junctions whose media row still exists.
    photo_junctions: (sentence_id_to_photo_joins[sentence.id] || []).filter(join => photos[join.photo_id]),
    video_junctions: (sentence_id_to_video_joins[sentence.id] || []).filter(join => videos[join.video_id]),
  })
}

/**
 * Which sentence/text docs does this changed row affect? Runs BEFORE `apply_one`
 * mutates the maps so it can see the OLD row state (e.g. an audio moved off a
 * sentence). The entries side stays in `apply_one`'s return value.
 */
function collect_corpus_effects(table: string, row: Record<string, any>): { sentence_ids: string[], text_ids: string[] } {
  switch (table) {
    case 'sentences':
      return { sentence_ids: [row.id], text_ids: [] }
    case 'texts': {
      // A text delete flips its sentences to standalone (FK SET NULL happens
      // silently in SQL — no updated_at bump), so their `in_text` facet changes.
      const sentence_ids = row.deleted
        ? Object.values(sentences).filter(sentence => sentence.text_id === row.id).map(sentence => sentence.id)
        : []
      return { sentence_ids, text_ids: [row.id] }
    }
    case 'audio': {
      const old_sentence_id = audios[row.id]?.sentence_id
      const ids = new Set([old_sentence_id, row.sentence_id].filter(Boolean) as string[])
      return { sentence_ids: [...ids], text_ids: [] }
    }
    case 'photos':
      return { sentence_ids: pair_values(sentence_photos, 'photo_id', row.id).map(join => (join as Tables<'sentence_photos'>).sentence_id), text_ids: [] }
    case 'videos':
      return { sentence_ids: pair_values(sentence_videos, 'video_id', row.id).map(join => (join as Tables<'sentence_videos'>).sentence_id), text_ids: [] }
    case 'sentence_photos':
    case 'sentence_videos':
      return { sentence_ids: row.sentence_id ? [row.sentence_id] : [], text_ids: [] }
    default:
      return { sentence_ids: [], text_ids: [] }
  }
}

/** Upsert (or remove if `deleted`) one changed row and return the entry_id(s) it affects. */
function apply_one(table: string, row: Record<string, any>): string[] {
  const is_deleted = !!row.deleted
  switch (table) {
    case 'entries': {
      if (is_deleted) {
        delete entries[row.id]
        return []
      }
      entries[row.id] = { ...entries[row.id], ...row }
      return [row.id]
    }
    case 'senses': {
      const entry_id = row.entry_id ?? senses[row.id]?.entry_id
      if (is_deleted) delete senses[row.id]
      else senses[row.id] = { ...senses[row.id], ...row }
      recompute_entry_senses(entry_id)
      return entry_id ? [entry_id] : []
    }
    case 'audio': {
      const entry_id = row.entry_id ?? audios[row.id]?.entry_id
      if (is_deleted) delete audios[row.id]
      else audios[row.id] = { ...audios[row.id], ...row }
      recompute_entry_audios(entry_id)
      return entry_id ? [entry_id] : []
    }
    case 'photos': {
      if (is_deleted) delete photos[row.id]
      else photos[row.id] = { ...photos[row.id], ...row }
      const affected: string[] = []
      for (const join of pair_values(sense_photos, 'photo_id', row.id)) {
        const { sense_id } = join as Tables<'sense_photos'>
        recompute_sense_photos(sense_id)
        const entry_id = senses[sense_id]?.entry_id
        if (entry_id) affected.push(entry_id)
      }
      return affected
    }
    case 'videos': {
      if (is_deleted) delete videos[row.id]
      else videos[row.id] = { ...videos[row.id], ...row }
      const affected: string[] = []
      for (const join of pair_values(sense_videos, 'video_id', row.id)) {
        const { sense_id } = join as Tables<'sense_videos'>
        recompute_sense_videos(sense_id)
        const entry_id = senses[sense_id]?.entry_id
        if (entry_id) affected.push(entry_id)
      }
      return affected
    }
    case 'sentences': {
      if (is_deleted) delete sentences[row.id]
      else sentences[row.id] = { ...sentences[row.id], ...row }
      const affected: string[] = []
      for (const join of pair_values(senses_in_sentences, 'sentence_id', row.id)) {
        const { sense_id } = join as Tables<'senses_in_sentences'>
        recompute_sense_sentences(sense_id)
        const entry_id = senses[sense_id]?.entry_id
        if (entry_id) affected.push(entry_id)
      }
      return affected
    }
    case 'speakers': {
      if (is_deleted) delete speakers[row.id]
      else speakers[row.id] = { ...speakers[row.id], ...row }
      on_patch({ type: 'speakers', rows: Object.values(speakers) })
      const affected: string[] = []
      for (const join of pair_values(audio_speakers, 'speaker_id', row.id)) {
        const { audio_id } = join as Tables<'audio_speakers'>
        recompute_audio_speakers(audio_id)
        const entry_id = audios[audio_id]?.entry_id
        if (entry_id) { recompute_entry_audios(entry_id); affected.push(entry_id) }
      }
      for (const join of pair_values(video_speakers, 'speaker_id', row.id)) {
        const { video_id } = join as Tables<'video_speakers'>
        recompute_video_speakers(video_id)
        for (const sv of pair_values(sense_videos, 'video_id', video_id)) {
          const { sense_id } = sv as Tables<'sense_videos'>
          recompute_sense_videos(sense_id)
          const entry_id = senses[sense_id]?.entry_id
          if (entry_id) affected.push(entry_id)
        }
      }
      return affected
    }
    case 'tags': {
      if (is_deleted) delete tags[row.id]
      else tags[row.id] = { ...tags[row.id], ...row }
      on_patch({ type: 'tags', rows: Object.values(tags) })
      const affected: string[] = []
      for (const join of pair_values(entry_tags, 'tag_id', row.id)) {
        const { entry_id } = join as Tables<'entry_tags'>
        recompute_entry_tags(entry_id)
        affected.push(entry_id)
      }
      return affected
    }
    case 'dialects': {
      if (is_deleted) delete dialects[row.id]
      else dialects[row.id] = { ...dialects[row.id], ...row }
      on_patch({ type: 'dialects', rows: Object.values(dialects) })
      const affected: string[] = []
      for (const join of pair_values(entry_dialects, 'dialect_id', row.id)) {
        const { entry_id } = join as Tables<'entry_dialects'>
        recompute_entry_dialects(entry_id)
        affected.push(entry_id)
      }
      return affected
    }
    case 'sources': {
      // Facet-only registry: slugs live on the entry column, so a source edit
      // never re-indexes entries — it just refreshes the label list for the UI
      // (facet chips + badges + picker resolve slug→citation from page.data.sources).
      if (is_deleted) delete sources[row.id]
      else sources[row.id] = { ...sources[row.id], ...row }
      on_patch({ type: 'sources', rows: Object.values(sources) })
      return []
    }
    case 'audio_speakers': {
      const key = `${row.audio_id}_${row.speaker_id}`
      if (is_deleted) delete audio_speakers[key]
      else audio_speakers[key] = row as Tables<'audio_speakers'>
      recompute_audio_speakers(row.audio_id)
      const entry_id = audios[row.audio_id]?.entry_id
      if (entry_id) recompute_entry_audios(entry_id)
      return entry_id ? [entry_id] : []
    }
    case 'entry_tags': {
      const key = `${row.entry_id}_${row.tag_id}`
      if (is_deleted) delete entry_tags[key]
      else entry_tags[key] = row as Tables<'entry_tags'>
      recompute_entry_tags(row.entry_id)
      return [row.entry_id]
    }
    case 'entry_dialects': {
      const key = `${row.entry_id}_${row.dialect_id}`
      if (is_deleted) delete entry_dialects[key]
      else entry_dialects[key] = row as Tables<'entry_dialects'>
      recompute_entry_dialects(row.entry_id)
      return [row.entry_id]
    }
    case 'sense_photos': {
      const key = `${row.sense_id}_${row.photo_id}`
      if (is_deleted) delete sense_photos[key]
      else sense_photos[key] = row as Tables<'sense_photos'>
      recompute_sense_photos(row.sense_id)
      const entry_id = senses[row.sense_id]?.entry_id
      return entry_id ? [entry_id] : []
    }
    case 'video_speakers': {
      const key = `${row.video_id}_${row.speaker_id}`
      if (is_deleted) delete video_speakers[key]
      else video_speakers[key] = row as Tables<'video_speakers'>
      recompute_video_speakers(row.video_id)
      const affected: string[] = []
      for (const sv of pair_values(sense_videos, 'video_id', row.video_id)) {
        const { sense_id } = sv as Tables<'sense_videos'>
        recompute_sense_videos(sense_id)
        const entry_id = senses[sense_id]?.entry_id
        if (entry_id) affected.push(entry_id)
      }
      return affected
    }
    case 'sense_videos': {
      const key = `${row.sense_id}_${row.video_id}`
      if (is_deleted) delete sense_videos[key]
      else sense_videos[key] = row as Tables<'sense_videos'>
      recompute_sense_videos(row.sense_id)
      const entry_id = senses[row.sense_id]?.entry_id
      return entry_id ? [entry_id] : []
    }
    case 'senses_in_sentences': {
      const key = `${row.sense_id}_${row.sentence_id}`
      if (is_deleted) delete senses_in_sentences[key]
      else senses_in_sentences[key] = row as Tables<'senses_in_sentences'>
      recompute_sense_sentences(row.sense_id)
      const entry_id = senses[row.sense_id]?.entry_id
      return entry_id ? [entry_id] : []
    }
    case 'texts': {
      if (is_deleted) {
        delete texts[row.id]
        // Mirror the client DB's FK `ON DELETE SET NULL` (which fires without a
        // sentence updated_at bump) so re-assembled sentence docs flip to standalone.
        for (const sentence of Object.values(sentences)) {
          if (sentence.text_id === row.id) sentence.text_id = null
        }
      } else {
        texts[row.id] = { ...texts[row.id], ...row }
      }
      return []
    }
    case 'sentence_photos': {
      const key = `${row.sentence_id}_${row.photo_id}`
      if (is_deleted) delete sentence_photos[key]
      else sentence_photos[key] = row as Tables<'sentence_photos'>
      return []
    }
    case 'sentence_videos': {
      const key = `${row.sentence_id}_${row.video_id}`
      if (is_deleted) delete sentence_videos[key]
      else sentence_videos[key] = row as Tables<'sentence_videos'>
      return []
    }
    default:
      return []
  }
}

/**
 * Resolve the in-memory row for a hard-deleted (table, id) so `apply_one` can
 * remove it + recompute the owning entry. The DB row is already gone, so we look
 * it up in the worker's own base/junction maps (junctions are pair-keyed, so we
 * scan by id). Returns undefined if we never indexed it (then there's nothing to
 * remove).
 */
function find_row_by_id(table: string, id: string): Record<string, any> | undefined {
  switch (table) {
    case 'entries': return entries[id]
    case 'senses': return senses[id]
    case 'audio': return audios[id]
    case 'photos': return photos[id]
    case 'videos': return videos[id]
    case 'sentences': return sentences[id]
    case 'texts': return texts[id]
    case 'speakers': return speakers[id]
    case 'tags': return tags[id]
    case 'dialects': return dialects[id]
    case 'sources': return sources[id]
    case 'audio_speakers': return Object.values(audio_speakers).find(row => row.id === id)
    case 'entry_tags': return Object.values(entry_tags).find(row => row.id === id)
    case 'entry_dialects': return Object.values(entry_dialects).find(row => row.id === id)
    case 'sense_photos': return Object.values(sense_photos).find(row => row.id === id)
    case 'video_speakers': return Object.values(video_speakers).find(row => row.id === id)
    case 'sense_videos': return Object.values(sense_videos).find(row => row.id === id)
    case 'senses_in_sentences': return Object.values(senses_in_sentences).find(row => row.id === id)
    case 'sentence_photos': return Object.values(sentence_photos).find(row => row.id === id)
    case 'sentence_videos': return Object.values(sentence_videos).find(row => row.id === id)
    default: return undefined
  }
}

export async function apply_rows(
  changes: Record<string, Record<string, any>[]>,
  deletes?: { table_name: string, id: string }[],
) {
  const affected_entry_ids = new Set<string>()
  const removed_entry_ids = new Set<string>()
  const affected_sentence_ids = new Set<string>()
  const removed_sentence_ids = new Set<string>()
  const affected_text_ids = new Set<string>()
  const removed_text_ids = new Set<string>()

  function collect_corpus(table: string, row: Record<string, any>) {
    const { sentence_ids, text_ids } = collect_corpus_effects(table, row)
    for (const id of sentence_ids) affected_sentence_ids.add(id)
    for (const id of text_ids) affected_text_ids.add(id)
  }

  // Upserts. Content rows have no `deleted` column anymore (hard-delete), so
  // `apply_one`'s removal branch is never reached from `changes` — only via the
  // `deletes` events below.
  for (const table of SYNC_TABLE_ORDER) {
    const rows = changes[table]
    if (!rows?.length) continue
    for (const row of rows) {
      collect_corpus(table, row)
      for (const entry_id of apply_one(table, row)) {
        if (entry_id) affected_entry_ids.add(entry_id)
      }
    }
  }

  // Hard-deletes (local + sync-pulled). Reconstruct the row from our maps and
  // route it through `apply_one`'s removal branch via a synthetic `deleted` mark.
  for (const { table_name, id } of deletes ?? []) {
    const base = find_row_by_id(table_name, id)
    const row = { ...(base ?? {}), id, deleted: true }
    collect_corpus(table_name, row)
    if (table_name === 'sentences') {
      removed_sentence_ids.add(id)
      affected_sentence_ids.delete(id)
    }
    if (table_name === 'texts') {
      removed_text_ids.add(id)
      affected_text_ids.delete(id)
    }
    if (table_name === 'entries') {
      removed_entry_ids.add(id)
      affected_entry_ids.delete(id)
      apply_one('entries', row)
      continue
    }
    for (const entry_id of apply_one(table_name, row)) {
      if (entry_id) affected_entry_ids.add(entry_id)
    }
  }

  for (const entry_id of removed_entry_ids) {
    await on_patch({ type: 'entry_delete', entry_id })
    await update_index_entry({ id: entry_id, deleted: new Date().toISOString() } as EntryData, dictionary_id)
  }
  for (const entry_id of affected_entry_ids) {
    const entry = entries[entry_id]
    if (entry) await process_and_update_entry(entry)
  }

  // Corpus indexes (sentences + texts).
  for (const sentence_id of removed_sentence_ids)
    await update_index_sentence({ doc: null, sentence_id, deleted: true, dictionary_id })
  for (const sentence_id of affected_sentence_ids) {
    const sentence = sentences[sentence_id]
    if (!sentence) continue
    recompute_sentence_audios(sentence_id)
    recompute_sentence_photo_joins(sentence_id)
    recompute_sentence_video_joins(sentence_id)
    await update_index_sentence({ doc: process_sentence(sentence), sentence_id, deleted: false, dictionary_id })
  }
  for (const text_id of removed_text_ids)
    await update_index_text({ doc: null, text_id, deleted: true, dictionary_id })
  for (const text_id of affected_text_ids) {
    const text = texts[text_id]
    if (text) await update_index_text({ doc: augment_text_for_search(text), text_id, deleted: false, dictionary_id })
  }

  if (affected_entry_ids.size || removed_entry_ids.size
    || affected_sentence_ids.size || removed_sentence_ids.size
    || affected_text_ids.size || removed_text_ids.size) {
    await on_patch({ type: 'index_updated' })
  }
}

async function process_and_update_entry(entry: Tables<'entries'>) {
  const entry_data = process_entry(entry)
  await on_patch({ type: 'entries_upsert', entries: { [entry.id]: entry_data } })
  await update_index_entry(entry_data, dictionary_id)
  await on_patch({ type: 'index_updated' })
}

export interface InitEntryWorkerOptions {
  dictionary_id: string
  can_edit: boolean
  admin: number
  bundle: EntriesDataBundle
  on_patch: (patch: WorkerPatch) => void
}

export async function init_entries(
  options: {
    dictionary_id: string
    can_edit: boolean
    admin: number
  },
  bundle: EntriesDataBundle,
  // comlink-proxied callbacks must be TOP-LEVEL arguments (nested inside an
  // options object they'd hit structured clone and throw), hence not folded
  // into `options`.
  _on_patch: (patch: WorkerPatch) => Promise<void>,
) {
  // init_entries re-runs per dict navigation; release the previous run's
  // proxy so its MessagePort doesn't leak (pre-union this leaked 9 ports/nav).
  ;(on_patch as unknown as { [releaseProxy]?: () => void } | undefined)?.[releaseProxy]?.()
  on_patch = _on_patch

  ;({ dictionary_id, admin } = options)

  // vps-migration M4 write/sync: the bundle is read on the main thread from the
  // browser wa-sqlite dict.db (snapshot + sync), NOT fetched from an endpoint.
  // Rows arrive in the legacy supabase shape (JSON parsed, soft-deletes excluded).
  entries = key_by_id(bundle.entries)
  senses = key_by_id(bundle.senses)
  audios = key_by_id(bundle.audio)
  speakers = key_by_id(bundle.speakers)
  tags = key_by_id(bundle.tags)
  dialects = key_by_id(bundle.dialects)
  sources = key_by_id(bundle.sources)
  photos = key_by_id(bundle.photos)
  videos = key_by_id(bundle.videos)
  sentences = key_by_id(bundle.sentences)
  audio_speakers = key_by_pair(bundle.audio_speakers, 'audio_id', 'speaker_id')
  texts = key_by_id(bundle.texts ?? [])
  entry_tags = key_by_pair(bundle.entry_tags, 'entry_id', 'tag_id')
  entry_dialects = key_by_pair(bundle.entry_dialects, 'entry_id', 'dialect_id')
  sense_photos = key_by_pair(bundle.sense_photos, 'sense_id', 'photo_id')
  video_speakers = key_by_pair(bundle.video_speakers, 'video_id', 'speaker_id')
  sense_videos = key_by_pair(bundle.sense_videos, 'sense_id', 'video_id')
  senses_in_sentences = key_by_pair(bundle.senses_in_sentences, 'sense_id', 'sentence_id')
  sentence_photos = key_by_pair(bundle.sentence_photos ?? [], 'sentence_id', 'photo_id')
  sentence_videos = key_by_pair(bundle.sentence_videos ?? [], 'sentence_id', 'video_id')

  reset_grouping_maps()

  for (const entry_tag of Object.values(entry_tags)) {
    if (!entry_id_to_tags[entry_tag.entry_id]) entry_id_to_tags[entry_tag.entry_id] = []
    const tag = tags[entry_tag.tag_id]
    if (should_include_tag(tag, admin)) entry_id_to_tags[entry_tag.entry_id].push(tag)
  }

  for (const entry_dialect of Object.values(entry_dialects)) {
    if (!entry_id_to_dialects[entry_dialect.entry_id]) entry_id_to_dialects[entry_dialect.entry_id] = []
    const dialect = dialects[entry_dialect.dialect_id]
    entry_id_to_dialects[entry_dialect.entry_id].push(dialect)
  }

  for (const sense of Object.values(senses)) {
    if (!entry_id_to_senses[sense.entry_id]) entry_id_to_senses[sense.entry_id] = []
    entry_id_to_senses[sense.entry_id].push(sense)
    if (entry_id_to_senses[sense.entry_id].length > 1) {
      entry_id_to_senses[sense.entry_id].sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime())
    }
  }

  for (const { sense_id, sentence_id } of Object.values(senses_in_sentences)) {
    if (!sense_id_to_sentences[sense_id]) sense_id_to_sentences[sense_id] = []
    sense_id_to_sentences[sense_id].push(sentences[sentence_id])
  }

  for (const { sense_id, photo_id } of Object.values(sense_photos)) {
    if (!sense_id_to_photos[sense_id]) sense_id_to_photos[sense_id] = []
    sense_id_to_photos[sense_id].push(photos[photo_id])
  }

  for (const video_speaker of Object.values(video_speakers)) {
    if (!video_id_to_speakers[video_speaker.video_id]) video_id_to_speakers[video_speaker.video_id] = []
    const speaker = speakers[video_speaker.speaker_id]
    video_id_to_speakers[video_speaker.video_id].push(speaker)
  }
  for (const { sense_id, video_id } of Object.values(sense_videos)) {
    if (!sense_id_to_videos[sense_id]) sense_id_to_videos[sense_id] = []
    const video = videos[video_id]

    sense_id_to_videos[sense_id].push({
      ...video,
      ...(video_id_to_speakers[video_id] ? { speakers: video_id_to_speakers[video_id] } : {}),
    })
  }

  for (const audio_speaker of Object.values(audio_speakers)) {
    if (!audio_id_to_speakers[audio_speaker.audio_id]) audio_id_to_speakers[audio_speaker.audio_id] = []
    const speaker = speakers[audio_speaker.speaker_id]
    audio_id_to_speakers[audio_speaker.audio_id].push(speaker)
  }
  for (const audio of Object.values(audios)) {
    if (!entry_id_to_audios[audio.entry_id]) entry_id_to_audios[audio.entry_id] = []
    entry_id_to_audios[audio.entry_id].push({
      ...audio,
      ...(audio_id_to_speakers[audio.id] ? { speakers: audio_id_to_speakers[audio.id] } : {}),
    })
    if (entry_id_to_audios[audio.entry_id].length > 1) {
      entry_id_to_audios[audio.entry_id].sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime())
    }
  }

  for (const audio of Object.values(audios)) {
    if (!audio.sentence_id) continue
    if (!sentence_id_to_audios[audio.sentence_id]) sentence_id_to_audios[audio.sentence_id] = []
    sentence_id_to_audios[audio.sentence_id].push(audio)
  }
  for (const join of Object.values(sentence_photos)) {
    if (!sentence_id_to_photo_joins[join.sentence_id]) sentence_id_to_photo_joins[join.sentence_id] = []
    sentence_id_to_photo_joins[join.sentence_id].push(join)
  }
  for (const join of Object.values(sentence_videos)) {
    if (!sentence_id_to_video_joins[join.sentence_id]) sentence_id_to_video_joins[join.sentence_id] = []
    sentence_id_to_video_joins[join.sentence_id].push(join)
  }

  console.time('Process Entries Time')
  const processed_data: Record<string, EntryData> = {}
  for (const entry of Object.values(entries)) {
    processed_data[entry.id] = process_entry(entry)
  }
  console.timeEnd('Process Entries Time')

  on_patch({ type: 'entries_set', entries: processed_data })
  on_patch({ type: 'tags', rows: Object.values(tags) })
  on_patch({ type: 'dialects', rows: Object.values(dialects) })
  on_patch({ type: 'sources', rows: Object.values(sources) })
  on_patch({ type: 'speakers', rows: Object.values(speakers) })

  await create_index(Object.values(processed_data), dictionary_id)
  on_patch({ type: 'index_updated' })
  on_patch({ type: 'loading', value: false })

  // Corpus indexes build after the entries index so word search is ready first.
  await create_corpus_indexes({
    sentence_docs: Object.values(sentences).map(process_sentence),
    text_docs: Object.values(texts).map(augment_text_for_search),
    dictionary_id,
  })
  on_patch({ type: 'index_updated' })
}

// Delegates the final shaping to the shared `assemble_entry_data` (also used by
// the server SSR endpoint) so SSR-built and client-built entries are
// byte-identical. The grouping maps above stay for O(1) per-entry slices.
function process_entry(entry: Tables<'entries'>) {
  return assemble_entry_data({
    entry: entry as Tables<'entries'> & Record<string, unknown>,
    senses: entry_id_to_senses[entry.id] || [],
    sentences_by_sense: sense_id_to_sentences as any,
    photos_by_sense: sense_id_to_photos as any,
    videos_by_sense: sense_id_to_videos as any,
    audios: (entry_id_to_audios[entry.id] || []) as any,
    tags: (entry_id_to_tags[entry.id] || []) as any,
    dialects: (entry_id_to_dialects[entry.id] || []) as any,
    admin_level: admin,
  })
}

type EntriesDataBundle = Record<string, any[]>

function key_by_id(rows: any[]): Record<string, any> {
  return rows.reduce((acc, row) => {
    acc[row.id] = row
    return acc
  }, {} as Record<string, any>)
}

function key_by_pair(rows: any[], field_1: string, field_2: string): Record<string, any> {
  return rows.reduce((acc, row) => {
    acc[`${row[field_1]}_${row[field_2]}`] = row
    return acc
  }, {} as Record<string, any>)
}

export const api = {
  init_entries,
  apply_rows,
  search_entries: _search_entries,
  search_sentences: _search_sentences,
  search_texts: _search_texts,
}

expose(api)
