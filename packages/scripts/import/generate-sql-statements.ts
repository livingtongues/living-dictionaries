import { randomUUID } from 'node:crypto'
import type { MultiString, TablesInsert } from '@living-dictionaries/types'
import { diego_ld_user_id } from '../constants'
import type { Number_Suffix, Row, Sense_Prefix } from './row.type'
import { sql_file_string } from './to-sql-string'
import { millisecond_incrementing_timestamp } from './incrementing-timestamp'

export interface Upload_Operations {
  upload_photo: (filepath: string, entry_id: string) => Promise<
  { storage_path: string, serving_url: string, error?: null } | { storage_path?: null, serving_url?: null, error: string }
  >
  upload_audio: (filepath: string, entry_id: string) => Promise<{ storage_path: string, error?: null } | { storage_path?: null, error: string }>
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
  dev_id,
}: {
  row: Row
  dictionary_id: string
  import_id: string
  speakers: { id: string, name: string }[]
  dialects: { id: string, name: MultiString }[]
  tags: { id: string, name: string }[]
  upload_operations: Upload_Operations
  dev_id: string | null
}) {
  try {
    let sql_statements = ''

    const entry_id = randomUUID()

    const c_meta = () => ({
      created_by: dev_id || diego_ld_user_id,
      created_at: millisecond_incrementing_timestamp(),
    })
    const c_u_meta = () => {
      const meta = c_meta()
      return {
        ...meta,
        updated_by: meta.created_by,
        updated_at: meta.created_at,
      }
    }

    const entry: TablesInsert<'entries'> = {
      id: entry_id,
      dictionary_id,
      ...c_u_meta(),
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
    if (row.interlinearization) entry.interlinearization = row.interlinearization
    if (row.source) entry.sources = row.source.split('|').map(source => source.trim()).filter(Boolean)
    if (row.scientificName) entry.scientific_names = [row.scientificName]
    if (row.ID) entry.elicitation_id = row.ID
    if (row.notes) entry.notes = { default: row.notes }

    sql_statements += sql_file_string('entries', entry)

    if (row.dialects) {
      const dialect_strings = row.dialects.split('|').map(dialect => dialect.trim()).filter(Boolean)
      for (const dialect_to_assign of dialect_strings) {
        let dialect_id = dialects.find(({ name }) => name.default === dialect_to_assign)?.id
        if (!dialect_id) {
          dialect_id = randomUUID()
          const dialect: TablesInsert<'dialects'> = {
            id: dialect_id,
            ...c_u_meta(),
            dictionary_id,
            name: { default: dialect_to_assign },
          }
          sql_statements += sql_file_string('dialects', dialect)
          dialects.push({ id: dialect.id, name: dialect.name })
        }

        sql_statements += sql_file_string('entry_dialects', {
          ...c_meta(),
          dialect_id,
          entry_id,
          dictionary_id,
        })
      }
    }

    const tag_strings = (row.tags || '').split('|').map(tag => tag.trim()).filter(Boolean)
    tag_strings.push(import_id)
    for (const tag_to_assign of tag_strings) {
      let tag_id = tags.find(({ name }) => name === tag_to_assign)?.id
      if (!tag_id) {
        tag_id = randomUUID()
        const tag: TablesInsert<'tags'> = {
          id: tag_id,
          ...c_u_meta(),
          dictionary_id,
          ...(tag_to_assign === import_id && { private: true }),
          name: tag_to_assign,
        }
        sql_statements += sql_file_string('tags', tag)
        tags.push({ id: tag.id, name: tag.name })
      }

      sql_statements += sql_file_string('entry_tags', {
        ...c_meta(),
        tag_id,
        entry_id,
        dictionary_id,
      })
    }

    const senses: TablesInsert<'senses'>[] = []
    const sentences: TablesInsert<'sentences'>[] = []
    const senses_in_sentences: TablesInsert<'senses_in_sentences'>[] = []

    const row_entries = (Object.entries(row) as [keyof Row, string][])
      .sort(([keyA], [keyB]) => keyA.localeCompare(keyB))

    type Sense_Label = 's1' | 's2' | 's3' | 's4'// etc, for type-safety we just need a few here
    const first_sense_label = 's1'
    const sense_labels = new Set<Sense_Label>([first_sense_label]) // always have at least one sense
    const sense_regex = /^(?<sense_index>s\d+)\./
    for (const key of Object.keys(row)) {
      const match = key.match(sense_regex)
      if (match) sense_labels.add(match.groups.sense_index as Sense_Label)
    }

    for (const sense_label of sense_labels) {
      const sense_id = randomUUID()

      const sense: TablesInsert<'senses'> = {
        entry_id,
        ...c_u_meta(),
        id: sense_id,
        glosses: {},
        dictionary_id,
      }

      const currently_on_first_sense = sense_label === first_sense_label
      const sense_prefix = currently_on_first_sense ? '' : `${sense_label}.` as Sense_Prefix

      for (const [key, value] of row_entries) {
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

      if (sense_label === 's1' || Object.keys(sense.glosses).length > 0) senses.push(sense) //* It only adds an additional sense if it has any glosses, otherwise it won't be added

      const sense_sentence_number_suffix = new Set<Number_Suffix>()

      for (const [key, value] of row_entries) {
        if (!key.includes('_exampleSentence')) continue
        if (!value) continue

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
          ...c_u_meta(),
          id: sentence_id,
          text: {},
        }

        for (const [key, value] of row_entries) {
          if (!key.includes('_exampleSentence')) continue
          if (!value) continue

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
          ...c_meta(),
          sentence_id,
          sense_id,
          dictionary_id,
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

    const audio_number_suffix = new Set<Number_Suffix>()

    for (const [key, value] of row_entries) {
      if (!key.startsWith('soundFile')) continue
      if (!value) continue

      const number_suffix_with_period = key.replace('soundFile', '') as Number_Suffix

      const { storage_path, error } = await upload_audio(value, entry_id)
      if (error) {
        console.log(error)
        continue
      }

      const audio_id = randomUUID()
      const audio: TablesInsert<'audio'> = {
        ...c_u_meta(),
        id: audio_id,
        dictionary_id,
        entry_id,
        storage_path,
      }
      sql_statements += sql_file_string('audio', audio)

      const speakerNameKey = `speakerName${number_suffix_with_period}`
      const speakerAgeKey = `speakerAge${number_suffix_with_period}`
      const speakerGenderKey = `speakerGender${number_suffix_with_period}`
      const speakerHometownKey = `speakerHometown${number_suffix_with_period}`

      const speakerName = row[speakerNameKey as keyof Row]
      if (speakerName) {
        let speaker_id = speakers.find(({ name }) => name === speakerName)?.id
        if (!speaker_id) {
          speaker_id = randomUUID()
          const speaker: TablesInsert<'speakers'> = {
            ...c_u_meta(),
            id: speaker_id,
            dictionary_id,
            name: speakerName,
            birthplace: row[speakerHometownKey as keyof Row] || '',
            decade: Number.parseInt(row[speakerAgeKey as keyof Row] as string) || null,
            gender: row[speakerGenderKey as keyof Row] as 'm' | 'f' | 'o' || null,
          }
          sql_statements += sql_file_string('speakers', speaker)
          speakers.push({ id: speaker_id, name: speakerName })
        }

        sql_statements += sql_file_string('audio_speakers', {
          ...c_meta(),
          audio_id,
          speaker_id,
          dictionary_id,
        })
      }
    }

    for (const [key, value] of row_entries) {
      if (!key.includes('photoFile')) continue
      if (!value) continue

      const { storage_path, serving_url, error } = await upload_photo(value, entry_id)
      if (error) {
        console.log(error)
        continue
      }
      const photo_id = randomUUID()
      const photo: TablesInsert<'photos'> = {
        ...c_u_meta(),
        id: photo_id,
        dictionary_id,
        storage_path,
        serving_url,
      }
      sql_statements += sql_file_string('photos', photo)
      const sense_id = senses[0].id
      const sense_photo: TablesInsert<'sense_photos'> = {
        ...c_meta(),
        photo_id,
        sense_id,
        dictionary_id,
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
