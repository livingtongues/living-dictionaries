import type { EntryData, Tables } from '$lib/types'
import type { TranslateFunction } from '$lib/i18n/types'
import { friendlyName } from './friendlyName'
import { get_orthographies } from '$lib/helpers/orthographies'
import { get_orthography_headers, get_sense_headers } from './assignHeadersForCsv'
import { display_speaker_gender, format_orthographies, format_senses } from './assignFormattedEntryValuesForCsv'
import { stripHTMLTags } from './stripHTMLTags'
import { rich_text_display_html } from '$lib/markdown/html-era-shim'
import { decades } from '$lib/components/media/ages'
import { translate_part_of_speech, translate_part_of_speech_abbreviation, translate_semantic_domain_keys } from '$lib/transformers/translate_keys_to_current_language'

export enum StandardEntryCSVFields {
  ID = 'Entry Id',
  lexeme = 'Lexeme/Word/Phrase',
  phonetic = 'Phonetic (IPA)',
  interlinearization = 'Interlinearization',
  morphology = 'Morphology',
  dialects = 'Dialects',
  notes = 'Notes',
  linguistic_history = 'Linguistic History',
  source = 'Source(s)',
  soundSource = 'Audio source',
  soundFile = 'Audio filename',
  speakerName = 'Speaker name',
  speakerHometown = 'Speaker birthplace',
  speakerAge = 'Speaker decade',
  speakerGender = 'Speaker gender',
}

export type EntryForCSVKeys = keyof typeof StandardEntryCSVFields

export type EntryForCSV = Partial<Record<EntryForCSVKeys, string>>

export function translate_entries({ entries, t, url_from_storage_path }: {
  entries: EntryData[]
  t: TranslateFunction
  url_from_storage_path: (path: string) => string
}) {
  return entries.map((entry) => {
    const senses = (entry.senses || []).map(sense => ({
      ...sense,
      parts_of_speech: sense.parts_of_speech?.map(pos => translate_part_of_speech(pos, t)),
      parts_of_speech_abbreviations: sense.parts_of_speech?.map(pos => translate_part_of_speech_abbreviation(pos, t)),
      semantic_domains: sense.semantic_domains?.map(domain => translate_semantic_domain_keys(domain, t)),
      photo_urls: (sense.photos || []).map(({ storage_path }) => {
        return url_from_storage_path(storage_path)
      }),
    }))

    return {
      ...entry,
      dialects: (entry.dialects || []).map(({ name }) => name.default),
      senses,
    }
  })
}

export function getCsvHeaders(entries: ReturnType<typeof translate_entries>, { orthographies, id: dictionary_id }: Tables<'dictionaries'>): EntryForCSV {
  const headers: EntryForCSV = { ...StandardEntryCSVFields }

  return {
    ...headers,
    ...get_orthography_headers(get_orthographies({ orthographies }).alternates),
    ...get_sense_headers(entries, dictionary_id),
  }
}

export function formatCsvEntries(
  entries: ReturnType<typeof translate_entries>,
  url_from_storage_path: (path: string) => string,
  { orthographies, id: dictionary_id }: Tables<'dictionaries'>,
): EntryForCSV[] {
  return entries.map((entry) => {
    const speaker = entry.audios?.[0].speakers?.[0]

    const formatted_entry: EntryForCSV = {
      ID: entry.id,
      lexeme: entry.main.lexeme?.default,
      phonetic: entry.main?.phonetic,
      interlinearization: entry.main?.interlinearization,
      morphology: entry.main?.morphology,
      dialects: entry.dialects?.join(', '),
      // markdown renders to HTML first so BOTH eras strip to plain text for CSV
      notes: stripHTMLTags(rich_text_display_html(entry.main.notes?.default)),
      linguistic_history: entry.main.linguistic_history?.default,
      source: entry.main.sources?.join(' | '),
      soundSource: entry.audios ? url_from_storage_path(entry.audios?.[0]?.storage_path) : null,
      soundFile: entry.audios ? friendlyName(entry as unknown as EntryData, entry.audios?.[0]?.storage_path) : null,
      speakerName: speaker?.name,
      speakerHometown: speaker?.birthplace,
      speakerAge: decades[speaker?.decade],
      speakerGender: display_speaker_gender(speaker?.gender),
    }

    return {
      ...formatted_entry,
      ...format_orthographies(get_orthographies({ orthographies }).alternates, entry?.main?.lexeme),
      ...format_senses(entry, dictionary_id),
    }
  })
}
