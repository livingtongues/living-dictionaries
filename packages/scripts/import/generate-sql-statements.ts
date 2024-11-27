import { randomUUID } from 'node:crypto'
import type { MultiString, TablesInsert } from '@living-dictionaries/types'
import type { ImportContentUpdate } from '@living-dictionaries/types/supabase/content-import.interface'
import { diego_ld_user_id } from '../config-supabase'
import type { Number_Suffix, Row, Sense_Prefix } from './row.type'
import { sql_file_string } from './to-sql-string'
import { millisecond_incrementing_timestamp } from './incrementing-timestamp'

export interface Upload_Operations {
  upload_photo: (filepath: string, entry_id: string) => Promise<{ storage_path: string, serving_url: string }>
  upload_audio: (filepath: string, entry_id: string) => Promise<{ storage_path: string }>
  // upload_video: (filepath: string) => Promise<{ storage_path: string }>
}

export async function generate_sql_statements({
  row,
  dictionary_id,
  import_id,
  speakers,
  dialects,
  tags,
  upload_operations: {
    upload_photo,
    upload_audio,
    // upload_video,
  },
}: {
  row: Row
  dictionary_id: string
  import_id: string
  speakers: { id: string, name: string }[]
  dialects: { id: string, name: MultiString }[]
  tags: { id: string, name: string }[]
  upload_operations: Upload_Operations
}) {
  try {
    let sql_statements = ''

    const entry_id = randomUUID()

    const c_meta = {
      created_by: diego_ld_user_id,
      created_at: millisecond_incrementing_timestamp(),
    }
    const c_u_meta = {
      ...c_meta,
      updated_by: c_meta.created_by,
      updated_at: c_meta.created_at,
    }
    const assemble_content_update = ({ data, ...rest }: ImportContentUpdate) => {
      const data_without_meta = { ...data }
      // @ts-expect-error
      delete data_without_meta.id
      // @ts-expect-error
      delete data_without_meta.dictionary_id
      delete data_without_meta.created_at
      // @ts-expect-error
      delete data_without_meta.created_by
      // @ts-expect-error
      delete data_without_meta.updated_at
      // @ts-expect-error
      delete data_without_meta.updated_by

      const content_update: TablesInsert<'content_updates'> = {
        ...rest,
        id: randomUUID(),
        import_id,
        dictionary_id,
        user_id: c_meta.created_by,
        timestamp: c_meta.created_at,
        data: data_without_meta,
      }
      return content_update
    }

    const entry: TablesInsert<'entries'> = {
      id: entry_id,
      dictionary_id,
      ...c_u_meta,
      lexeme: {
        default: row.lexeme,
        ...(row.localOrthography && { lo1: row.localOrthography }),
        ...(row['localOrthography.2'] && { lo2: row['localOrthography.2'] }),
        ...(row['localOrthography.3'] && { lo3: row['localOrthography.3'] }),
        ...(row['localOrthography.4'] && { lo4: row['localOrthography.4'] }),
        ...(row['localOrthography.5'] && { lo5: row['localOrthography.5'] }),
      },
    }
    if (row.phonetic) entry.phonetic = row.phonetic
    if (row.morphology) entry.morphology = row.morphology
    if (row.source) entry.sources = row.source.split('|').map(source => source.trim()).filter(Boolean)
    if (row.scientificName) entry.scientific_names = [row.scientificName]
    if (row.ID) entry.elicitation_id = row.ID
    if (row.notes) entry.notes = { default: row.notes }

    sql_statements += sql_file_string('entries', entry)
    sql_statements += sql_file_string('content_updates', assemble_content_update({ type: 'insert_entry', entry_id, data: entry }))

    if (row.dialects) {
      const dialect_strings = row.dialects.split('|').map(dialect => dialect.trim()).filter(Boolean)
      for (const dialect_to_assign of dialect_strings) {
        let dialect_id = dialects.find(({ name }) => name.default === dialect_to_assign)?.id
        if (!dialect_id) {
          dialect_id = randomUUID()
          const dialect: TablesInsert<'dialects'> = {
            id: dialect_id,
            ...c_u_meta,
            dictionary_id,
            name: { default: dialect_to_assign },
          }
          sql_statements += sql_file_string('dialects', dialect)
          dialects.push({ id: dialect.id, name: dialect.name })
        }

        sql_statements += sql_file_string('entry_dialects', {
          ...c_meta,
          dialect_id,
          entry_id,
        })
      }
    }

    if (row.tags) {
      const tag_strings = row.tags.split('|').map(tag => tag.trim()).filter(Boolean)
      for (const tag_to_assign of tag_strings) {
        let tag_id = tags.find(({ name }) => name === tag_to_assign)?.id
        if (!tag_id) {
          tag_id = randomUUID()
          const tag: TablesInsert<'tags'> = {
            id: tag_id,
            ...c_u_meta,
            dictionary_id,
            name: tag_to_assign,
          }
          sql_statements += sql_file_string('tags', tag)
          tags.push({ id: tag.id, name: tag.name })
        }

        sql_statements += sql_file_string('entry_tags', {
          ...c_meta,
          tag_id,
          entry_id,
        })
      }
    }

    const senses: TablesInsert<'senses'>[] = []
    const sentences: TablesInsert<'sentences'>[] = []
    const senses_in_sentences: TablesInsert<'senses_in_sentences'>[] = []

    const first_sense_label = 's1'
    const sense_labels = new Set([first_sense_label]) // always have at least one sense
    const sense_regex = /^(?<sense_index>s\d+)\./
    for (const key of Object.keys(row)) {
      const match = key.match(sense_regex)
      if (match) sense_labels.add(match.groups.sense_index)
    }

    for (const sense_label of sense_labels) {
      const sense_id = randomUUID()

      const sense: TablesInsert<'senses'> = {
        entry_id,
        ...c_u_meta,
        id: sense_id,
        glosses: {},
      }

      const currently_on_first_sense = sense_label === first_sense_label
      const sense_prefix = currently_on_first_sense ? '' : `${sense_label}.` as Sense_Prefix

      for (const [key, value] of Object.entries(row) as [keyof Row, string][]) {
        if (!value) continue

        if (currently_on_first_sense) {
          const key_has_secondary_sense_label = !!key.match(sense_regex)
          if (key_has_secondary_sense_label) continue
        } else if (!key.startsWith(sense_prefix)) {
          continue
        }

        if (key.endsWith('nounClass')) sense.noun_class = value
        if (key.endsWith('variant')) sense.variant = { default: value }
        if (key.endsWith('pluralForm')) sense.plural_form = { default: value }

        if (key.includes('partOfSpeech')) {
          if (!sense.parts_of_speech) sense.parts_of_speech = []
          sense.parts_of_speech.push(value)
        }
        if (key.includes('semanticDomain')) {
          if (!sense.semantic_domains) sense.semantic_domains = []
          sense.semantic_domains.push(value)
        }

        const key_without_prefix = key.replace(sense_prefix, '')
        if (key.endsWith('_gloss')) {
          const language = key_without_prefix.replace('_gloss', '')
          sense.glosses[language] = value
        }
      }

      senses.push(sense)

      const sense_sentence_number_suffix = new Set<Number_Suffix>()

      for (const [key, value] of Object.entries(row) as [keyof Row, string][]) {
        if (!value) continue
        if (!key.includes('_exampleSentence')) continue

        if (currently_on_first_sense) {
          const key_has_secondary_sense_label = !!key.match(sense_regex)
          if (key_has_secondary_sense_label) continue
        } else if (!key.startsWith(sense_prefix)) {
          continue
        }

        const number_suffix_with_period = key.replace(/.*_exampleSentence/, '') as Number_Suffix
        sense_sentence_number_suffix.add(number_suffix_with_period)
      }

      for (const sentence_suffix of sense_sentence_number_suffix) {
        const sentence_id = randomUUID()
        const sentence: TablesInsert<'sentences'> = {
          dictionary_id,
          ...c_u_meta,
          id: sentence_id,
          text: {},
        }

        for (const [key, value] of Object.entries(row) as [keyof Row, string][]) {
          if (!value) continue
          if (!key.includes('_exampleSentence')) continue

          // ensure key has sense_prefix
          if (currently_on_first_sense) {
            const key_has_secondary_sense_label = !!key.match(sense_regex)
            if (key_has_secondary_sense_label) continue
          } else if (!key.startsWith(sense_prefix)) {
            continue
          }

          // ensure key has sentence_suffix
          if (sentence_suffix === '') {
            if (!key.endsWith('_exampleSentence')) continue
          } else if (!key.endsWith(sentence_suffix)) {
            continue
          }

          const key_without_prefix = key.replace(sense_prefix, '')
          const key_without_prefix_nor_suffix = key_without_prefix.replace(sentence_suffix, '')
          if (key.includes('_vernacular_exampleSentence')) {
            const writing_system = key_without_prefix_nor_suffix.replace('_vernacular_exampleSentence', '')
            sentence.text[writing_system] = value
          } else if (key.endsWith('_exampleSentence')) {
            if (!sentence.translation) sentence.translation = {}
            const language = key_without_prefix_nor_suffix.replace('_exampleSentence', '')
            sentence.translation[language] = value
          }
        }

        sentences.push(sentence)
        senses_in_sentences.push({
          ...c_meta,
          sentence_id,
          sense_id,
        })
      }
    }

    for (const sense of senses) {
      sql_statements += sql_file_string('senses', sense)
    }

    for (const sentence of sentences) {
      sql_statements += sql_file_string('sentences', sentence)
    }

    for (const connection of senses_in_sentences) {
      sql_statements += sql_file_string('senses_in_sentences', connection)
    }

    if (row.soundFile) {
      const { storage_path } = await upload_audio(row.soundFile, entry_id)
      const audio_id = randomUUID()
      const audio: TablesInsert<'audio'> = {
        ...c_u_meta,
        id: audio_id,
        dictionary_id,
        entry_id,
        storage_path,
      }
      sql_statements += sql_file_string('audio', audio)

      if (row.speakerName) {
        let speaker_id = speakers.find(({ name }) => name === row.speakerName)?.id
        if (!speaker_id) {
          speaker_id = randomUUID()

          const speaker: TablesInsert<'speakers'> = {
            ...c_u_meta,
            id: speaker_id,
            dictionary_id,
            name: row.speakerName,
            birthplace: row.speakerHometown || '',
            decade: Number.parseInt(row.speakerAge) || null,
            gender: row.speakerGender as 'm' | 'f' | 'o' || null,
          }

          sql_statements += sql_file_string('speakers', speaker)
          speakers.push({ id: speaker_id, name: row.speakerName })
        }

        sql_statements += sql_file_string('audio_speakers', {
          ...c_meta,
          audio_id,
          speaker_id,
        })
      }
    }

    if (row.photoFile) {
      const { storage_path, serving_url } = await upload_photo(row.photoFile, entry_id)
      const photo_id = randomUUID()
      const photo: TablesInsert<'photos'> = {
        ...c_u_meta,
        id: photo_id,
        dictionary_id,
        storage_path,
        serving_url,
      }
      sql_statements += sql_file_string('photos', photo)
      const sense_id = senses[0].id
      const sense_photo: TablesInsert<'sense_photos'> = {
        ...c_meta,
        photo_id,
        sense_id,
      }
      sql_statements += sql_file_string('sense_photos', sense_photo)
    }

    // TablesInsert<'videos'>
    // TablesInsert<'video_speakers'>
    // TablesInsert<'sense_videos'>

    return `${sql_statements}\n`
  } catch (err) {
    console.log(`error with: ${row}: ${err}`)
    console.error(err)
  }
}

function returnArrayFromCommaSeparatedItems(string: string): string[] {
  return string?.split(',').map(item => item.trim()) || null
}
