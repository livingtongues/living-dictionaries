import { randomUUID } from 'node:crypto'
import type { ActualDatabaseEntry, ContentUpdateRequestBody } from '@living-dictionaries/types'
import type { Timestamp } from 'firebase/firestore'
import type { Glossing_Languages } from '@living-dictionaries/site/src/lib/glosses/glossing-languages'

// TODO improve Writing Systems field
type Sense_Prefix = 's2' | 's3' | 's4' | 's5' | 's6' | 's7' | 's8' | 's9'
type Fields = 'lexeme' | 'dialects' | 'ID' | 'soundFile' | 'speakerName' | 'scientificName' | 'speakerHometown' | 'speakerAge' | 'speakerGender' | 'notes' | 'source' | 'morphology' | 'interlinearization' | 'photoFile' | 'vernacular_exampleSentence' | 'pluralForm' | 'nounClass' | 'variant' | 'phonetic'
type Special_Fields = 'localOrthography' | 'partOfSpeech' | 'semanticDomain'
type Multiple_Fields = `${Special_Fields}${Suffix}`
type Writing_Systems = 'default' | ''
type Translation_Fields = `${Glossing_Languages}_gloss` | `${Glossing_Languages}_exampleSentence` | `${Writing_Systems}_exampleSentence`
type Suffix = '2' | '3' | '4' | '5' | '6' | '7' | '8' | '9'

type Normal_Row = `${Fields | Special_Fields | Multiple_Fields | Translation_Fields}`
type Sense_Row = `${Sense_Prefix}.${Normal_Row}`
type Sentence_Row = `${Sense_Prefix}.${Normal_Row}.${Suffix}`
export type Row = {
  [key in (Sentence_Row | Sense_Row | Normal_Row)]?: string;
}
const my_row: Row = {
  's3.es_gloss': 'hi',
  'semanticDomain4': '2.3',
  's2.fr_exampleSentence.3': 'Bonjour docteur',
  's4.default_exampleSentence': 'foo bar',

}

export function convert_row_to_objects_for_databases({ row, dateStamp, timestamp, test = false }: {
  row: Record<string, string> // TODO: type this ===> how can I create a type for dynamic rows? starting with 's3_' in case it is sense three or ending with '_5' in case we had five example sentences that belong to the same sense.
  dateStamp?: number
  timestamp?: FirebaseFirestore.FieldValue
  test?: boolean
}): {
    firebase_entry: ActualDatabaseEntry
    supabase_senses: {
      sense_id: string
      sense: ContentUpdateRequestBody['change']['sense']
    }[]
    supabase_sentences: {
      sentence_id: string
      sense_id: string
      sentence: ContentUpdateRequestBody['change']['sentence']
    }[]
  } {
  const sense_regex = /^s\d+_/
  const multiple_sentence_regex = /_exampleSentence_\d+$/
  const has_multiple_sentence_regex_label = (key: string) => multiple_sentence_regex.test(key)
  const firebase_entry: ActualDatabaseEntry = { lx: row.lexeme, gl: {}, xs: {} }
  interface SupabaseSense {
    sense_id: string
    sense: ContentUpdateRequestBody['change']['sense']
  }
  interface SupabaseSentence {
    sentence_id: string
    sense_id: string
    sentence: ContentUpdateRequestBody['change']['sentence']
  }
  const uuid_template = '11111111-1111-1111-1111-111111111111'
  let current_uuid_index = 0
  function incremental_consistent_uuid() {
    return test ? uuid_template.slice(0, -2) + (current_uuid_index++).toString().padStart(2, '0') : randomUUID()
  }
  const supabase_sense: SupabaseSense = {
    sense_id: incremental_consistent_uuid(),
    sense: {},
  }
  const supabase_sentence: SupabaseSentence = {
    sentence_id: incremental_consistent_uuid(),
    sense_id: supabase_sense.sense_id,
    sentence: {},
  }
  const supabase_senses = []
  const supabase_sentences = []
  let old_key = 2
  let old_language_key
  let new_language_key

  if (row.phonetic) firebase_entry.ph = row.phonetic
  if (row.morphology) firebase_entry.mr = row.morphology
  if (row.interlinearization) firebase_entry.in = row.interlinearization
  if (row.partOfSpeech) firebase_entry.ps = returnArrayFromCommaSeparatedItems(row.partOfSpeech)
  if (row.dialects) firebase_entry.di = row.dialects.split(',').map(dialect => dialect.trim())
  if (row.variant) firebase_entry.va = row.variant
  if (row.nounClass) firebase_entry.nc = row.nounClass
  if (row.source) firebase_entry.sr = row.source.split('|')
  if (row.pluralForm) firebase_entry.pl = row.pluralForm
  if (row.scientificName) firebase_entry.scn = [row.scientificName]
  if (row.semanticDomain_custom) firebase_entry.sd = [row.semanticDomain_custom]
  if (row.ID) firebase_entry.ei = row.ID

  if (row.localOrthography) firebase_entry.lo1 = row.localOrthography
  if (row.localOrthography2) firebase_entry.lo2 = row.localOrthography2
  if (row.localOrthography3) firebase_entry.lo3 = row.localOrthography3
  if (row.localOrthography4) firebase_entry.lo4 = row.localOrthography4
  if (row.localOrthography5) firebase_entry.lo5 = row.localOrthography5

  if (row.notes) firebase_entry.nt = row.notes

  for (const [key, value] of Object.entries(row)) {
    if (!value) continue

    // gloss fields are labeled using bcp47 language codes followed by '_gloss' (e.g. es_gloss, tpi_gloss)
    if (key.includes('_gloss') && !sense_regex.test(key)) {
      const [language] = key.split('_gloss')
      firebase_entry.gl[language] = value
    }

    if (key.includes('vernacular_exampleSentence') && !sense_regex.test(key)) {
      firebase_entry.xs.vn = value
      continue // to keep next block from also adding
    }

    // example sentence fields are codes followed by '_exampleSentence'
    if (key.includes('_exampleSentence') && !sense_regex.test(key)) {
      const [language] = key.split('_exampleSentence')
      firebase_entry.xs[language] = value
    }

    if (sense_regex.test(key)) {
      if (key.includes('_gloss')) {
        let language_key = key.replace(sense_regex, '')
        language_key = language_key.replace('_gloss', '')

        if (key === `s${old_key}_${language_key}_gloss`) {
          supabase_sense.sense = { glosses: { new: { ...supabase_sense.sense?.glosses?.new, [language_key]: row[key] } } }
        } else {
          old_key++
          supabase_sense.sense_id = incremental_consistent_uuid()
          supabase_sense.sense = { glosses: { ...supabase_sense.sense.glosses, new: { [language_key]: row[key] } } }
        }
      }
      if (key.includes('_vernacular_exampleSentence')) {
        let writing_system = key.replace(sense_regex, '')
        writing_system = writing_system.replace('_vernacular_exampleSentence', '')
        if (has_multiple_sentence_regex_label(key)) writing_system = writing_system.slice(0, writing_system.lastIndexOf('_'))

        if (key === `s${old_key}_${writing_system}_vernacular_exampleSentence` || has_multiple_sentence_regex_label(key)) {
          supabase_sentence.sense_id = supabase_sense.sense_id
          supabase_sentence.sentence_id = incremental_consistent_uuid()
          if (key === `s${old_key}_${writing_system}_vernacular_exampleSentence` && !has_multiple_sentence_regex_label(key)) {
            supabase_sentence.sentence = { text: { new: { ...supabase_sentence?.sentence?.text?.new, [writing_system]: row[key] } } }
          } else if (has_multiple_sentence_regex_label(key)) {
            supabase_sentence.sentence = { text: { new: { [writing_system]: row[key] } } }
          }
        }
      }
      if (key.includes('_exampleSentence') && !key.includes('_vernacular')) { // when key is a translated example sentence
        new_language_key = key.replace(sense_regex, '')
        new_language_key = new_language_key.replace('_exampleSentence', '')
        if (has_multiple_sentence_regex_label(key)) new_language_key = new_language_key.slice(0, new_language_key.lastIndexOf('_'))
        if (old_language_key && old_language_key === new_language_key && !has_multiple_sentence_regex_label(key)) supabase_sentence.sentence_id = incremental_consistent_uuid()
        if (!old_language_key) old_language_key = new_language_key

        if (key === `s${old_key}_${new_language_key}_exampleSentence` || has_multiple_sentence_regex_label(key)) {
          supabase_sentence.sentence = { ...supabase_sentence.sentence, translation: { new: { ...supabase_sentence?.sentence?.translation?.new, [new_language_key]: row[key] } } }
        }
      }
      if (key.includes('_exampleSentence')) { // in this case this includes verncaular and traslated example sentences
        const sentence_index: number = supabase_sentences.findIndex(sentence => sentence.sentence_id === supabase_sentence.sentence_id)
        const sense_index: number = supabase_sentences.findIndex(sentence => sentence.sense_id === supabase_sentence.sense_id)
        const sense_index_exists = sense_index !== -1
        const sentence_index_exists = sentence_index !== -1
        if (sense_index_exists && !has_multiple_sentence_regex_label(key)) {
          supabase_sentences[sense_index] = { ...supabase_sentence }
        } else if (sentence_index_exists) {
          supabase_sentences[sentence_index] = { ...supabase_sentence }
        } else {
          supabase_sentences.push({ ...supabase_sentence })
        }
      }
      old_language_key = new_language_key
      if (key.includes('_partOfSpeech'))
        supabase_sense.sense = { ...supabase_sense.sense, parts_of_speech: { new: [row[key]] } }

      if (key.includes('_semanticDomains'))
        supabase_sense.sense = { ...supabase_sense.sense, semantic_domains: { new: [row[key]] } }

      if (key.includes('_nounClass'))
        supabase_sense.sense = { ...supabase_sense.sense, noun_class: { new: row[key] } }
    }

    if (sense_regex.test(key)) {
      const index: number = supabase_senses.findIndex(sense => sense.sense_id === supabase_sense.sense_id)
      const sense_index_exists = index !== -1
      if (sense_index_exists) {
        supabase_senses[index] = { ...supabase_sense }
      } else {
        supabase_senses.push({ ...supabase_sense })
      }
    }

    const semanticDomain_FOLLOWED_BY_OPTIONAL_DIGIT = /^semanticDomain\d*$/ // semanticDomain, semanticDomain2, semanticDomain<#>, but not semanticDomain_custom
    if (semanticDomain_FOLLOWED_BY_OPTIONAL_DIGIT.test(key)) {
      if (!firebase_entry.sdn) firebase_entry.sdn = []

      firebase_entry.sdn.push(value.toString())
    }
  }

  if (Object.keys(firebase_entry.xs).length === 0)
    delete firebase_entry.xs

  // if (!dateStamp) return firebase_entry

  firebase_entry.ii = `v4-${dateStamp}`
  firebase_entry.ca = timestamp as Timestamp
  firebase_entry.ua = timestamp as Timestamp

  return {
    firebase_entry,
    supabase_senses,
    supabase_sentences,
  }
}

export function returnArrayFromCommaSeparatedItems(string: string): string[] {
  return string?.split(',').map(item => item.trim()) || []
}
