import type { EntryView, Tables } from '@living-dictionaries/types'
import { get } from 'svelte/store'
import { friendlyName } from './friendlyName'
import { get_orthography_headers, get_sense_headers } from './assignHeadersForCsv'
import { display_speaker_gender, format_orthographies, format_senses, get_first_speaker_from_first_sound_file } from './assignFormattedEntryValuesForCsv'
import { stripHTMLTags } from './stripHTMLTags'
import { decades } from '$lib/components/media/ages'
import { translate_part_of_speech, translate_part_of_speech_abbreviation, translate_semantic_domain_keys } from '$lib/transformers/translate_keys_to_current_language'
import { page } from '$app/stores'

export enum StandardEntryCSVFields {
  ID = 'Entry Id',
  lexeme = 'Lexeme/Word/Phrase',
  phonetic = 'Phonetic (IPA)',
  interlinearization = 'Interlinearization',
  morphology = 'Morphology',
  dialects = 'Dialects',
  notes = 'Notes',
  source = 'Source(s)',
  soundSource = 'Audio source',
  soundFile = 'Audio filename',
  speakerName = 'Speaker name',
  speakerHometown = 'Speaker birthplace',
  speakerAge = 'Speaker decade',
  speakerGender = 'Speaker gender',
}

export type EntryForCSVKeys = keyof typeof StandardEntryCSVFields

export type EntryForCSV = {
  [key in EntryForCSVKeys]?: string; // TODO: where type problems exist, update using row.type.ts as a reference
}

export function translate_entries({ entries, photos, sentences, dialects }: { entries: EntryView[], photos: Tables<'photos'>[], sentences: Tables<'sentences'>[], dialects: Tables<'dialects'>[] }) {
  const $page = get(page)

  return entries.map((entry) => {
    const senses = entry.senses.map(sense => ({
      ...sense,
      parts_of_speech: sense.parts_of_speech?.map(pos => translate_part_of_speech(pos, $page.data.t)),
      parts_of_speech_abbreviations: sense.parts_of_speech?.map(pos => translate_part_of_speech_abbreviation(pos, $page.data.t)),
      semantic_domains: sense.semantic_domains?.map(domain => translate_semantic_domain_keys(domain, $page.data.t)),
      photo_urls: sense.photo_ids?.map((photo_id) => {
        const { storage_path } = photos.find(photo => photo.id === photo_id)
        return $page.data.url_from_storage_path(storage_path)
      }),
      sentences: sense.sentence_ids?.map(sentence_id => sentences.find(sentence => sentence.id === sentence_id)),
    }))

    return {
      ...entry,
      dialects: entry.dialect_ids?.map(dialect_id => dialects.find(dialect => dialect.id === dialect_id).name.default),
      senses,
    }
  })
}

export function getCsvHeaders(entries: ReturnType<typeof translate_entries>, { orthographies }: Tables<'dictionaries'>): EntryForCSV {
  const headers: EntryForCSV = { ...StandardEntryCSVFields }

  return {
    ...headers,
    ...get_orthography_headers(orthographies),
    ...get_sense_headers(entries),
  }
}

export function formatCsvEntries(
  entries: ReturnType<typeof translate_entries>,
  speakers: Tables<'speakers'>[],
  url_from_storage_path: (path: string) => string,
  { orthographies }: Tables<'dictionaries'>,
): EntryForCSV[] {
  return entries.map((entry) => {
    const speaker = get_first_speaker_from_first_sound_file(entry, speakers)

    const formatted_entry: EntryForCSV = {
      ID: entry.id,
      lexeme: entry.main.lexeme?.default,
      phonetic: entry.main?.phonetic,
      interlinearization: entry.main?.interlinearization,
      morphology: entry.main?.morphology,
      dialects: entry.dialects?.join(', '),
      notes: stripHTMLTags(entry.main.notes?.default),
      source: entry.main.sources?.join(' | '),
      soundSource: entry.audios ? url_from_storage_path(entry.audios?.[0]?.storage_path) : null,
      soundFile: entry.audios ? friendlyName(entry, entry.audios?.[0]?.storage_path) : null,
      speakerName: speaker?.name,
      speakerHometown: speaker?.birthplace,
      speakerAge: decades[speaker?.decade],
      speakerGender: display_speaker_gender(speaker?.gender),
    }

    return {
      ...formatted_entry,
      ...format_orthographies(orthographies, entry?.main?.lexeme),
      ...format_senses(entry),
    }
  })
}
