import { randomUUID } from 'node:crypto'
import type { MultiString, TablesInsert } from '@living-dictionaries/types'
import { diego_ld_user_id } from '../config-supabase'
import type { Number_Suffix, Row, Sense_Prefix } from './row.type'
import { sql_file_string } from './to-sql-string'
import { millisecond_incrementing_timestamp } from './incrementing-timestamp'

// const multiple_sentence_regex = /_exampleSentence\.\d+$/
// const has_multiple_sentence_regex_label = (key: string) => multiple_sentence_regex.test(key)

export function generate_sql_statements({ row, dictionary_id, import_id, speakers, dialects }: { row: Row, dictionary_id: string, import_id: string, speakers: { id: string, name: string }[], dialects: { id: string, name: MultiString }[] }) {
  try {
    let sql_statements = ''

    const entry_id = randomUUID()

    const c_meta = {
      created_by: diego_ld_user_id,
      created_at: millisecond_incrementing_timestamp(),
    }
    const c_u_meta = {
      ...c_meta,
      updated_by: diego_ld_user_id,
      updated_at: millisecond_incrementing_timestamp(),
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
    if (row.source) entry.sources = row.source.split('|').map(source => source.trim())
    if (row.scientificName) entry.scientific_names = [row.scientificName]
    if (row.ID) entry.elicitation_id = row.ID
    if (row.notes) entry.notes = { default: row.notes }

    sql_statements += sql_file_string('entries', entry, 'INSERT')

    // TODO: Jacob will continue working on dialects and speakers and media
    // if (row.dialects) dialects = row.dialects.split(',').map(dialect => dialect.trim())

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
        if (key.endsWith('partOfSpeech')) sense.parts_of_speech = returnArrayFromCommaSeparatedItems(value)
        if (key.endsWith('variant')) sense.variant = { default: value }
        if (key.endsWith('pluralForm')) sense.plural_form = { default: value }

        if (key.includes('semanticDomain')) {
          if (key.endsWith('semanticDomain_custom')) {
            sense.write_in_semantic_domains = [value]
            continue
          }

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
          text: { },
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
      sql_statements += sql_file_string('senses', sense, 'INSERT')
    }

    for (const sentence of sentences) {
      sql_statements += sql_file_string('sentences', sentence, 'INSERT')
    }

    for (const connection of senses_in_sentences) {
      sql_statements += sql_file_string('senses_in_sentences', connection, 'INSERT')
    }

    // TODO: Jacob continue to pull from packages\scripts\migrate-to-supabase\save-content-update.ts for these
    // photos: TablesInsert<'photos'>[]
    // sense_photos: TablesInsert<'sense_photos'>[]
    // audios: TablesInsert<'audio'>[]
    // audio_speakers: TablesInsert<'audio_speakers'>[]
    // videos: TablesInsert<'videos'>[]
    // video_speakers: TablesInsert<'video_speakers'>[]
    // sense_videos: TablesInsert<'sense_videos'>[]

    return `${sql_statements}\n`
  } catch (err) {
    console.log(`error with: ${row}: ${err}`)
    console.error(err)
  }
}

function returnArrayFromCommaSeparatedItems(string: string): string[] {
  return string?.split(',').map(item => item.trim()) || null
}

// TODO: placed here for Jacob to continue working on
// if (row.photoFile) {
//   const pf = await uploadImageFile(row.photoFile, universal_entry_id, dictionary_id, live)
//   if (pf) firebase_entry.pf = pf
// }

// if (row.soundFile) {
//   const audioFilePath = await uploadAudioFile(row.soundFile, universal_entry_id, dictionary_id, live)
//   firebase_entry.sf = {
//     path: audioFilePath,
//     ts: Date.now(),
//   }

//   if (row.speakerName) {
//     const speaker: ISpeaker = speakers.find(speaker => speaker.displayName === row.speakerName)
//     if (speaker) {
//       firebase_entry.sf.sp = speaker.id
//     } else {
//       const new_speaker: ISpeaker = {
//         displayName: row.speakerName,
//         birthplace: row.speakerHometown || '',
//         decade: Number.parseInt(row.speakerAge) || null,
//         gender: row.speakerGender as 'm' | 'f' | 'o' || null,
//         contributingTo: [dictionary_id],
//         createdAt: timestamp as Timestamp,
//         createdBy: developer_in_charge_firebase_uid,
//         updatedAt: timestamp as Timestamp,
//         updatedBy: developer_in_charge_firebase_uid,
//       }
//       if (live) {
//         const new_speaker_id = await db.collection('speakers').add(new_speaker).then(ref => ref.id)
//         firebase_entry.sf.sp = new_speaker_id
//         speakers.push({ id: new_speaker_id, ...new_speaker })
//       }
//     }
//   }
// }
