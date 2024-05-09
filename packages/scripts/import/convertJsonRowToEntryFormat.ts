import { randomUUID } from 'node:crypto'
import type { ActualDatabaseEntry } from '@living-dictionaries/types'
import type { Timestamp } from 'firebase/firestore'

interface StandardData {
  row: Record<string, string>
  dateStamp?: number
  timestamp?: FirebaseFirestore.FieldValue
}

interface SenseData {
  entry_id: string
  dictionary_id: string
}

export function convertJsonRowToEntryFormat(
  standard: StandardData,
  senseData?: SenseData,
): ActualDatabaseEntry {
  const { row, dateStamp, timestamp } = standard
  const entry: ActualDatabaseEntry = { lx: row.lexeme, gl: {}, xs: {} }
  const sense_regex = /^s\d+_/
  let glossObject: Record<string, string> = {}
  const exampleSentenceObject: Record<string, string> = {}
  const exampleSentenceTranslationObject: Record<string, string> = {}
  let sense_id = randomUUID()
  let sentence_id = randomUUID()
  let old_key = 2

  if (row.phonetic) entry.ph = row.phonetic
  if (row.morphology) entry.mr = row.morphology
  if (row.interlinearization) entry.in = row.interlinearization
  if (row.partOfSpeech) entry.ps = returnArrayFromCommaSeparatedItems(row.partOfSpeech)
  if (row.dialects) entry.di = row.dialects.split(',').map(dialect => dialect.trim())
  if (row.variant) entry.va = row.variant
  if (row.nounClass) entry.nc = row.nounClass
  if (row.source) entry.sr = row.source.split('|')
  if (row.pluralForm) entry.pl = row.pluralForm
  if (row.scientificName) entry.scn = [row.scientificName]
  if (row.semanticDomain_custom) entry.sd = [row.semanticDomain_custom]
  if (row.ID) entry.ei = row.ID

  if (row.localOrthography) entry.lo1 = row.localOrthography
  if (row.localOrthography2) entry.lo2 = row.localOrthography2
  if (row.localOrthography3) entry.lo3 = row.localOrthography3
  if (row.localOrthography4) entry.lo4 = row.localOrthography4
  if (row.localOrthography5) entry.lo5 = row.localOrthography5

  if (row.notes) entry.nt = row.notes

  for (const [key, value] of Object.entries(row)) {
    if (!value) continue

    // gloss fields are labeled using bcp47 language codes followed by '_gloss' (e.g. es_gloss, tpi_gloss)
    if (key.includes('_gloss') && !sense_regex.test(key)) {
      const [language] = key.split('_gloss')
      entry.gl[language] = value
    }

    if (key.includes('vernacular_exampleSentence')) {
      entry.xs.vn = value
      continue // to keep next block from also adding
    }

    // example sentence fields are codes followed by '_exampleSentence'
    if (key.includes('_exampleSentence')) {
      const [language] = key.split('_exampleSentence')
      entry.xs[language] = value
    }

    if (senseData) {
      console.log(`key: ${key}`)
      if (key === 'lexeme')
        console.log(`lexeme: ${value}`)
      const { entry_id, dictionary_id } = senseData
      if (sense_regex.test(key)) {
        if (key.includes('_gloss')) {
          let language_key = key.replace(sense_regex, '')
          language_key = language_key.replace('_gloss', '')
          console.log(`language key: ${language_key}`)

          if (key === `s${old_key}_${language_key}_gloss`) {
            glossObject[language_key] = row[key]
          } else {
            old_key++
            sense_id = randomUUID()
            glossObject = {}
            glossObject[language_key] = row[key]
          }
          console.log(`old key: ${old_key}`)
          console.log(`sense id: ${sense_id}`)
          update_sense(entry_id, dictionary_id, { glosses: { new: glossObject } }, sense_id)
          console.log(`gloss object: ${JSON.stringify(glossObject)}`)
        }

        console.log(`sentence id before vernacular example sentence: ${sentence_id}`)
        if (key.includes('_vn_ES')) {
          let writing_system = key.replace(sense_regex, '')
          writing_system = writing_system.replace('_vn_ES', '')

          if (key === `s${old_key}_${writing_system}_vn_ES`) {
            sentence_id = randomUUID()
            exampleSentenceObject[writing_system] = row[key]
            update_sentence(entry_id, dictionary_id, { text: { new: exampleSentenceObject } }, sense_id, sentence_id)
          }
        }
        console.log(`sentence id before translation example sentence: ${sentence_id}`)
        if (key.includes('_GES')) {
          let language_key = key.replace(sense_regex, '')
          language_key = language_key.replace('_GES', '')

          exampleSentenceTranslationObject[language_key] = row[key]
          // if (key === `s${old_key}_${language_key}_GES`) {
          //   console.log('Is it getting here at all??')
          // }
          update_sentence(entry_id, dictionary_id, { translation: { new: exampleSentenceTranslationObject } }, sense_id, sentence_id)
        }

        console.log(`sense id before pos: ${sense_id}`)
        if (key.includes('_partOfSpeech'))
          update_sense(entry_id, dictionary_id, { parts_of_speech: { new: [row[key]] } }, sense_id)

        if (key.includes('_semanticDomains'))
          update_sense(entry_id, dictionary_id, { semantic_domains: { new: [row[key]] } }, sense_id)

        if (key.includes('_nounClass'))
          update_sense(entry_id, dictionary_id, { noun_class: { new: [row[key]] } }, sense_id)
      }
    }

    const semanticDomain_FOLLOWED_BY_OPTIONAL_DIGIT = /^semanticDomain\d*$/ // semanticDomain, semanticDomain2, semanticDomain<#>, but not semanticDomain_custom
    if (semanticDomain_FOLLOWED_BY_OPTIONAL_DIGIT.test(key)) {
      if (!entry.sdn) entry.sdn = []

      entry.sdn.push(value.toString())
    }
  }

  if (Object.keys(entry.xs).length === 0)
    delete entry.xs

  if (!dateStamp) return entry

  entry.ii = `v4-${dateStamp}`
  entry.ca = timestamp as Timestamp
  entry.ua = timestamp as Timestamp

  return entry
}

export function returnArrayFromCommaSeparatedItems(string: string): string[] {
  return string?.split(',').map(item => item.trim()) || []
}
