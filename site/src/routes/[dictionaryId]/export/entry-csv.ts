import type { EntryData, Tables } from '$lib/types'
import type { TranslateFunction } from '$lib/i18n/types'
import { stripHTMLTags } from './strip-html-tags'
import { get_headword, get_orthographies } from '$lib/orthography/orthographies'
import { render_markdown_to_html } from '$lib/markdown/render'
import { decades } from '$lib/components/media/ages'
import { glossing_languages } from '$lib/glosses/glossing-languages'
import { translate_part_of_speech, translate_part_of_speech_abbreviation, translate_semantic_domain_keys } from '$lib/transformers/translate_keys_to_current_language'

/**
 * Single-pass CSV builder: each entry emits an ordered list of
 * `{ key, header, value }` columns exactly once, so headers and values can
 * never drift apart. Headers are the first-seen union across entries (base
 * columns are emitted for every entry, so they always lead in a stable order).
 *
 * Media columns are URLs to the file as stored — filenames are NEVER renamed,
 * so a downloaded file, the CSV link, and the SQLite snapshot's `storage_path`
 * all agree.
 */

export interface CsvColumn {
  key: string
  header: string
  value: string
}

export interface EntryCsvContext {
  dictionary: Tables<'dictionaries'>
  t: TranslateFunction
  url_from_storage_path: (path: string) => string
}

/** `'' | '.2' | '.3'…` for repeated columns of the same kind. */
function nth(index: number): string {
  return index > 0 ? `.${index + 1}` : ''
}

/** `'' | 's2.' | 's3.'…` key prefix for sense-scoped columns. */
function sense_key(sense_index: number): string {
  return sense_index > 0 ? `s${sense_index + 1}.` : ''
}

/** `'' | 'Sense 2: '…` header prefix for sense-scoped columns. */
function sense_label(sense_index: number): string {
  return sense_index > 0 ? `Sense ${sense_index + 1}: ` : ''
}

/** `'' | ' 2' | ' 3'…` header suffix for repeated columns of the same kind. */
function nth_label(index: number): string {
  return index > 0 ? ` ${index + 1}` : ''
}

function language_name(bcp: string): string {
  return glossing_languages[bcp]?.vernacularName || bcp
}

export function build_entry_columns(entry: EntryData, { dictionary, t, url_from_storage_path }: EntryCsvContext): CsvColumn[] {
  const columns: CsvColumn[] = []
  const add = (key: string, header: string, value: string | null | undefined) => {
    columns.push({ key, header, value: value ?? '' })
  }

  const { alternates } = get_orthographies({ orthographies: dictionary.orthographies })

  add('id', 'Entry ID', entry.id)
  // Falls back to the first populated alternate orthography when `default` is
  // absent; the alternate's own column stays faithful (value in both is honest).
  add('lexeme', 'Lexeme/Word/Phrase', get_headword({ lexeme: entry.main.lexeme, orthographies: dictionary.orthographies }).value)
  alternates.forEach((orthography, index) => {
    add(`localOrthography${nth(index)}`, orthography.name, entry.main.lexeme?.[orthography.code])
  })
  add('homograph', 'Homograph Number', entry.main.homograph)
  add('phonetic', 'Phonetic (IPA)', entry.main.phonetic)
  add('interlinearization', 'Interlinearization', entry.main.interlinearization)
  add('morphology', 'Morphology', entry.main.morphology)
  add('dialects', 'Dialects', entry.dialects?.map(({ name }) => name.default).join(', '))
  // markdown renders to HTML first so BOTH eras strip to plain text for CSV
  add('notes', 'Notes', stripHTMLTags(render_markdown_to_html(entry.main.notes?.default)))
  add('linguistic_history', 'Linguistic History', entry.main.linguistic_history?.default)
  add('sources', 'Source(s)', entry.main.sources?.join(' | '))
  add('scientific_names', 'Scientific name(s)', entry.main.scientific_names?.join(' | '))
  add('elicitation_id', 'Elicitation ID', entry.main.elicitation_id)

  const audios = entry.audios || []
  audios.forEach((audio, index) => {
    add(`audio_url${nth(index)}`, `Audio${nth_label(index)} URL`, url_from_storage_path(audio.storage_path))
  })
  const speaker = audios[0]?.speakers?.[0]
  if (speaker) {
    add('speaker_name', 'Speaker name', speaker.name)
    add('speaker_birthplace', 'Speaker birthplace', speaker.birthplace)
    add('speaker_decade', 'Speaker decade', decades[speaker.decade])
    add('speaker_gender', 'Speaker gender', speaker.gender === 'f' ? 'female' : speaker.gender === 'm' ? 'male' : speaker.gender)
  }

  const senses = entry.senses || []
  senses.forEach((sense, sense_index) => {
    const key = (suffix: string) => `${sense_key(sense_index)}${suffix}`
    const label = (suffix: string) => `${sense_label(sense_index)}${suffix}`

    Object.entries(sense.glosses || {}).forEach(([bcp, gloss]) => {
      add(key(`${bcp}_gloss`), label(`${language_name(bcp)} Gloss`), gloss)
    })
    Object.entries(sense.definition || {}).forEach(([bcp, definition]) => {
      add(key(`${bcp}_definition`), label(`${language_name(bcp)} Definition`), definition)
    })
    ;(sense.semantic_domains || []).forEach((domain, index) => {
      add(key(`semanticDomain${nth(index)}`), label(`Semantic domain${nth_label(index) || ' 1'}`), translate_semantic_domain_keys(domain, t))
    })
    ;(sense.write_in_semantic_domains || []).forEach((domain, index) => {
      add(key(`writeInSemanticDomain${nth(index)}`), label(`Write-in semantic domain${nth_label(index) || ' 1'}`), domain)
    })
    ;(sense.parts_of_speech || []).forEach((part_of_speech, index) => {
      add(key(`partOfSpeech${nth(index)}`), label(`Part of speech${nth_label(index) || ' 1'} (abbreviation)`), translate_part_of_speech_abbreviation(part_of_speech, t))
      add(key(`partOfSpeech fullname${nth(index)}`), label(`Part of speech${nth_label(index) || ' 1'}`), translate_part_of_speech(part_of_speech, t))
    })
    if (sense.noun_class)
      add(key('nounClass'), label('Noun class'), sense.noun_class)
    if (sense.variant?.default)
      add(key('variant'), label('Variant'), sense.variant.default)
    if (sense.plural_form?.default)
      add(key('pluralForm'), label('Plural form'), sense.plural_form.default)

    ;(sense.photos || []).forEach((photo, index) => {
      add(key(`photo_url${nth(index)}`), label(`Image${nth_label(index)} URL`), url_from_storage_path(photo.storage_path))
    })
    ;(sense.videos || []).forEach((video, index) => {
      if (video.storage_path)
        add(key(`video_url${nth(index)}`), label(`Video${nth_label(index)} URL`), url_from_storage_path(video.storage_path))
      else if (video.hosted_elsewhere)
        add(key(`hosted_video_url${nth(index)}`), label(`Hosted video${nth_label(index)} URL`), hosted_video_url(video.hosted_elsewhere))
    })

    const sentence = sense.sentences?.[0]
    if (sentence?.text)
      add(key('vernacular_exampleSentence'), label(`Example sentence in ${dictionary.name}`), sentence.text.default)
    Object.entries(sentence?.translation || {}).forEach(([bcp, translation]) => {
      add(key(`${bcp}_exampleSentence`), label(`Example sentence in ${language_name(bcp)}`), translation)
    })
  })

  return columns
}

function hosted_video_url(hosted: { type: 'youtube' | 'vimeo', video_id: string }): string {
  return hosted.type === 'youtube'
    ? `https://www.youtube.com/watch?v=${hosted.video_id}`
    : `https://vimeo.com/${hosted.video_id}`
}

export function build_entries_csv(entries: EntryData[], context: EntryCsvContext): { headers: Record<string, string>, rows: Record<string, string>[] } {
  const headers: Record<string, string> = {}
  const rows = entries.map((entry) => {
    const row: Record<string, string> = {}
    for (const { key, header, value } of build_entry_columns(entry, context)) {
      headers[key] ??= header
      row[key] = value
    }
    return row
  })
  return { headers, rows }
}
