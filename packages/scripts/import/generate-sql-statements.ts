import { randomUUID } from 'node:crypto'
import type { MultiString, TablesInsert } from '@living-dictionaries/types'
import { diego_ld_user_id } from '../config-supabase'
import type { Row } from './row.type'
import { sql_file_string } from './to-sql-string'
import { millisecond_incrementing_timestamp } from './incrementing-timestamp'

const sense_regex = /^s\d+\./
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

    const sense_id = randomUUID()
    if (row.lexeme === 'jun')
      console.log({ var: row.variant })
    const first_sense: TablesInsert<'senses'> = {
      entry_id,
      ...c_u_meta,
      id: sense_id,
      glosses: { },
    }
    if (row.nounClass) first_sense.noun_class = row.nounClass
    if (row.partOfSpeech) first_sense.parts_of_speech = returnArrayFromCommaSeparatedItems(row.partOfSpeech)
    if (row.semanticDomain_custom) first_sense.write_in_semantic_domains = [row.semanticDomain_custom]
    if (row.variant) first_sense.variant = { default: row.variant }
    if (row.pluralForm) first_sense.plural_form = { default: row.pluralForm }

    // TODO: detect additional senses from the CSV row data
    for (const [key, value] of Object.entries(row) as [keyof Row, string][]) {
      if (!value) continue

      // gloss fields are labeled using bcp47 language codes followed by '_gloss' (e.g. es_gloss, tpi_gloss)
      if (key.includes('_gloss') && !sense_regex.test(key)) {
        const [language] = key.split('_gloss')
        first_sense.glosses[language] = value
      }

      // TODO: Diego, the below code is copied over from old method, please update to new format that can handle many senses and many example sentences

      // if (key.includes('vernacular_exampleSentence') && !sense_regex.test(key)) {
      //   firebase_entry.xs.vn = value
      //   continue // to keep next block from also adding
      // }

      // // example sentence fields are codes followed by '_exampleSentence'
      // if (key.includes('_exampleSentence') && !sense_regex.test(key)) {
      //   const [language] = key.split('_exampleSentence')
      //   firebase_entry.xs[language] = value
      // }

      // if (sense_regex.test(key)) {
      //   if (key.includes('_gloss')) {
      //     let language_key = key.replace(sense_regex, '')
      //     language_key = language_key.replace('_gloss', '')

      //     if (key === `s${old_key}.${language_key}_gloss`) {
      //       supabase_sense.sense = { glosses: { new: { ...supabase_sense.sense?.glosses?.new, [language_key]: row[key] } } }
      //     } else {
      //       old_key++
      //       supabase_sense.sense_id = incremental_consistent_uuid()
      //       supabase_sense.sense = { glosses: { ...supabase_sense.sense.glosses, new: { [language_key]: row[key] } } }
      //     }
      //   }
      //   if (key.includes('_vernacular_exampleSentence')) {
      //     let writing_system = key.replace(sense_regex, '')
      //     writing_system = writing_system.replace('_vernacular_exampleSentence', '')
      //     if (has_multiple_sentence_regex_label(key)) writing_system = writing_system.slice(0, writing_system.lastIndexOf('.'))

      //     if (key === `s${old_key}.${writing_system}_vernacular_exampleSentence` || has_multiple_sentence_regex_label(key)) {
      //       supabase_sentence.sense_id = supabase_sense.sense_id
      //       supabase_sentence.sentence_id = incremental_consistent_uuid()
      //       if (key === `s${old_key}.${writing_system}_vernacular_exampleSentence` && !has_multiple_sentence_regex_label(key)) {
      //         supabase_sentence.sentence = { text: { new: { ...supabase_sentence?.sentence?.text?.new, [writing_system]: row[key] } } }
      //       } else if (has_multiple_sentence_regex_label(key)) {
      //         supabase_sentence.sentence = { text: { new: { [writing_system]: row[key] } } }
      //       }
      //     }
      //   }
      //   if (key.includes('_exampleSentence') && !key.includes('_vernacular')) { // when key is a translated example sentence
      //     new_language_key = key.replace(sense_regex, '')
      //     new_language_key = new_language_key.replace('_exampleSentence', '')
      //     if (has_multiple_sentence_regex_label(key)) new_language_key = new_language_key.slice(0, new_language_key.lastIndexOf('.'))
      //     if (old_language_key && old_language_key === new_language_key && !has_multiple_sentence_regex_label(key)) supabase_sentence.sentence_id = incremental_consistent_uuid()
      //     if (!old_language_key) old_language_key = new_language_key
      //     if (key === `s${old_key}.${new_language_key}_exampleSentence` || has_multiple_sentence_regex_label(key)) {
      //       supabase_sentence.sentence = { ...supabase_sentence.sentence, translation: { new: { ...supabase_sentence?.sentence?.translation?.new, [new_language_key]: row[key] } } }
      //     }
      //   }
      //   if (key.includes('_exampleSentence')) { // in this case this includes verncaular and traslated example sentences
      //     const sentence_index: number = supabase_sentences.findIndex(sentence => sentence.sentence_id === supabase_sentence.sentence_id)
      //     const sense_index: number = supabase_sentences.findIndex(sentence => sentence.sense_id === supabase_sentence.sense_id)
      //     const sense_index_exists = sense_index !== -1
      //     const sentence_index_exists = sentence_index !== -1
      //     if (sense_index_exists && !has_multiple_sentence_regex_label(key)) {
      //       supabase_sentences[sense_index] = { ...supabase_sentence }
      //     } else if (sentence_index_exists) {
      //       supabase_sentences[sentence_index] = { ...supabase_sentence }
      //     } else {
      //       supabase_sentences.push({ ...supabase_sentence })
      //     }
      //   }
      //   old_language_key = new_language_key
      //   if (key.includes('.partOfSpeech'))
      //     supabase_sense.sense = { ...supabase_sense.sense, parts_of_speech: { new: [row[key]] } }

      //   if (key.includes('.semanticDomain'))
      //     supabase_sense.sense = { ...supabase_sense.sense, semantic_domains: { new: [row[key]] } }

      //   if (key.includes('.nounClass'))
      //     supabase_sense.sense = { ...supabase_sense.sense, noun_class: { new: row[key] } }
      // }

      // if (sense_regex.test(key)) {
      //   const index: number = supabase_senses.findIndex(sense => sense.sense_id === supabase_sense.sense_id)
      //   const sense_index_exists = index !== -1
      //   if (sense_index_exists) {
      //     supabase_senses[index] = { ...supabase_sense }
      //   } else {
      //     supabase_senses.push({ ...supabase_sense })
      //   }
      // }

      // const semanticDomain_FOLLOWED_BY_OPTIONAL_DIGIT = /^semanticDomain(?:\.\d)*$/ // semanticDomain, semanticDomain2, semanticDomain<#>, but not semanticDomain_custom
      // if (semanticDomain_FOLLOWED_BY_OPTIONAL_DIGIT.test(key)) {
      //   if (!firebase_entry.sdn) firebase_entry.sdn = []

      //   firebase_entry.sdn.push(value.toString())
      // }
    }
    senses.push(first_sense)

    for (const sense of senses) {
      sql_statements += sql_file_string('senses', sense, 'INSERT')
    }

    const sentence_id = randomUUID()
    sentences.push({
      dictionary_id,
      ...c_u_meta,
      id: sentence_id,
      text: { default: 'I am the vernacular' },
      translation: { en: 'I am the translation' },
    })
    senses_in_sentences.push({
      ...c_meta,
      sentence_id,
      sense_id,
    })

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
