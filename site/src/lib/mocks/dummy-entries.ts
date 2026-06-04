import type { Tables } from '@living-dictionaries/types'
import { MOCK_MANAGED_DICTIONARY_ID, MOCK_USER_ID } from '$lib/mocks/mock-user'

/**
 * vps-migration M2b dev mock. Realistic dummy entries (+ senses, a few speakers/
 * audio/tags/dialects) for the `achi` dictionary so `/achi/entries` renders a real
 * list and entry/sense editor interactions can be tested while Supabase is stubbed.
 * The stub-client serves these for the per-dictionary `eq('dictionary_id','achi')`
 * queries the search worker issues. Typed against the generated `Tables<…>` rows so
 * they can't drift from the schema. Replace with a real read path in M4.
 */

const DICTIONARY_ID = MOCK_MANAGED_DICTIONARY_ID
const TIMESTAMP = '2024-06-01T00:00:00Z'

function entry(overrides: Partial<Tables<'entries'>>): Tables<'entries'> {
  return {
    coordinates: null,
    created_at: TIMESTAMP,
    created_by: MOCK_USER_ID,
    deleted: null,
    dictionary_id: DICTIONARY_ID,
    elicitation_id: null,
    id: '',
    interlinearization: null,
    lexeme: { default: '' },
    linguistic_history: null,
    morphology: null,
    notes: null,
    phonetic: null,
    scientific_names: null,
    sources: null,
    unsupported_fields: null,
    updated_at: TIMESTAMP,
    updated_by: MOCK_USER_ID,
    ...overrides,
  }
}

function sense(overrides: Partial<Tables<'senses'>>): Tables<'senses'> {
  return {
    created_at: TIMESTAMP,
    created_by: MOCK_USER_ID,
    definition: null,
    deleted: null,
    dictionary_id: DICTIONARY_ID,
    entry_id: '',
    glosses: null,
    id: '',
    noun_class: null,
    parts_of_speech: null,
    plural_form: null,
    semantic_domains: null,
    updated_at: TIMESTAMP,
    updated_by: MOCK_USER_ID,
    variant: null,
    write_in_semantic_domains: null,
    ...overrides,
  }
}

export const dummy_entries: Tables<'entries'>[] = [
  entry({ id: 'e_ja', lexeme: { default: 'jaʼ' }, phonetic: 'haʔ', notes: { default: 'Used in everyday speech for drinking water and rivers alike.' } }),
  entry({ id: 'e_chee', lexeme: { default: 'cheʼ' }, phonetic: 'tʃeʔ' }),
  entry({ id: 'e_abaj', lexeme: { default: 'abʼaj' }, phonetic: 'aɓaχ' }),
  entry({ id: 'e_tzi', lexeme: { default: 'tzʼiʼ' }, phonetic: 'tsiʔ' }),
  entry({ id: 'e_ak', lexeme: { default: 'akʼ' }, phonetic: 'akʼ' }),
  entry({ id: 'e_ixoq', lexeme: { default: 'ixoq' }, phonetic: 'iʃoq' }),
  entry({ id: 'e_achi', lexeme: { default: 'achi' }, phonetic: 'atʃi' }),
  entry({ id: 'e_saq', lexeme: { default: 'saq' }, phonetic: 'saq' }),
  entry({ id: 'e_qeq', lexeme: { default: 'qʼeq' }, phonetic: 'qʼeq' }),
  entry({ id: 'e_nim', lexeme: { default: 'nim' }, phonetic: 'nim' }),
  entry({ id: 'e_wa', lexeme: { default: 'wa' }, phonetic: 'wa', notes: { default: 'A staple food at every meal.' } }),
  entry({ id: 'e_kar', lexeme: { default: 'kär' }, phonetic: 'kɨr' }),
  entry({ id: 'e_kotzij', lexeme: { default: 'kotzʼij' }, phonetic: 'kotsʼiχ' }),
]

export const dummy_senses: Tables<'senses'>[] = [
  sense({ id: 's_ja', entry_id: 'e_ja', glosses: { en: 'water', es: 'agua' }, parts_of_speech: ['n'], semantic_domains: ['1.3'] }),
  sense({ id: 's_chee', entry_id: 'e_chee', glosses: { en: 'tree', es: 'árbol' }, parts_of_speech: ['n'], semantic_domains: ['1.4'] }),
  sense({ id: 's_chee_2', entry_id: 'e_chee', glosses: { en: 'wood', es: 'madera' }, parts_of_speech: ['n'], semantic_domains: ['1.4'], created_at: '2024-06-02T00:00:00Z' }),
  sense({ id: 's_abaj', entry_id: 'e_abaj', glosses: { en: 'stone', es: 'piedra' }, parts_of_speech: ['n'], semantic_domains: ['1.2'] }),
  sense({ id: 's_tzi', entry_id: 'e_tzi', glosses: { en: 'dog', es: 'perro' }, parts_of_speech: ['n'], semantic_domains: ['1.5'] }),
  sense({ id: 's_ak', entry_id: 'e_ak', glosses: { en: 'chicken', es: 'pollo' }, parts_of_speech: ['n'], semantic_domains: ['1.7'] }),
  sense({ id: 's_ixoq', entry_id: 'e_ixoq', glosses: { en: 'woman', es: 'mujer' }, parts_of_speech: ['n'], semantic_domains: ['2.6'] }),
  sense({ id: 's_achi', entry_id: 'e_achi', glosses: { en: 'man', es: 'hombre' }, parts_of_speech: ['n'], semantic_domains: ['2.6'] }),
  sense({ id: 's_saq', entry_id: 'e_saq', glosses: { en: 'white', es: 'blanco' }, parts_of_speech: ['adj'], semantic_domains: ['1.6'] }),
  sense({ id: 's_qeq', entry_id: 'e_qeq', glosses: { en: 'black', es: 'negro' }, parts_of_speech: ['adj'], semantic_domains: ['1.6'] }),
  sense({ id: 's_nim', entry_id: 'e_nim', glosses: { en: 'big, large', es: 'grande' }, parts_of_speech: ['adj'] }),
  sense({ id: 's_wa', entry_id: 'e_wa', glosses: { en: 'tortilla', es: 'tortilla' }, parts_of_speech: ['n'], semantic_domains: ['5.2'] }),
  sense({ id: 's_kar', entry_id: 'e_kar', glosses: { en: 'fish', es: 'pez, pescado' }, parts_of_speech: ['n'], semantic_domains: ['1.8'] }),
  sense({ id: 's_kotzij', entry_id: 'e_kotzij', glosses: { en: 'flower', es: 'flor' }, parts_of_speech: ['n'], semantic_domains: ['1.4'] }),
]

export const dummy_speakers: Tables<'speakers'>[] = [
  { birthplace: 'Rabinal', created_at: TIMESTAMP, created_by: MOCK_USER_ID, decade: 5, deleted: null, dictionary_id: DICTIONARY_ID, gender: 'f', id: 'spk_maria', name: 'María Xolop', updated_at: TIMESTAMP, updated_by: MOCK_USER_ID, user_id: null },
  { birthplace: 'Cubulco', created_at: TIMESTAMP, created_by: MOCK_USER_ID, decade: 6, deleted: null, dictionary_id: DICTIONARY_ID, gender: 'm', id: 'spk_diego', name: 'Diego Sis', updated_at: TIMESTAMP, updated_by: MOCK_USER_ID, user_id: null },
]

export const dummy_audio: Tables<'audio'>[] = [
  { created_at: TIMESTAMP, created_by: MOCK_USER_ID, deleted: null, dictionary_id: DICTIONARY_ID, entry_id: 'e_ja', id: 'aud_ja', sentence_id: null, source: null, storage_path: 'achi/audio/aud_ja.mp3', text_id: null, updated_at: TIMESTAMP, updated_by: MOCK_USER_ID },
  { created_at: TIMESTAMP, created_by: MOCK_USER_ID, deleted: null, dictionary_id: DICTIONARY_ID, entry_id: 'e_tzi', id: 'aud_tzi', sentence_id: null, source: null, storage_path: 'achi/audio/aud_tzi.mp3', text_id: null, updated_at: TIMESTAMP, updated_by: MOCK_USER_ID },
]

export const dummy_audio_speakers: Tables<'audio_speakers'>[] = [
  { audio_id: 'aud_ja', created_at: TIMESTAMP, created_by: MOCK_USER_ID, deleted: null, dictionary_id: DICTIONARY_ID, speaker_id: 'spk_maria' },
  { audio_id: 'aud_tzi', created_at: TIMESTAMP, created_by: MOCK_USER_ID, deleted: null, dictionary_id: DICTIONARY_ID, speaker_id: 'spk_diego' },
]

export const dummy_tags: Tables<'tags'>[] = [
  { created_at: TIMESTAMP, created_by: MOCK_USER_ID, deleted: null, dictionary_id: DICTIONARY_ID, id: 'tag_core', name: 'core vocabulary', private: null, updated_at: TIMESTAMP, updated_by: MOCK_USER_ID },
  { created_at: TIMESTAMP, created_by: MOCK_USER_ID, deleted: null, dictionary_id: DICTIONARY_ID, id: 'tag_nature', name: 'nature', private: null, updated_at: TIMESTAMP, updated_by: MOCK_USER_ID },
]

export const dummy_entry_tags: Tables<'entry_tags'>[] = [
  { created_at: TIMESTAMP, created_by: MOCK_USER_ID, deleted: null, dictionary_id: DICTIONARY_ID, entry_id: 'e_ja', tag_id: 'tag_core' },
  { created_at: TIMESTAMP, created_by: MOCK_USER_ID, deleted: null, dictionary_id: DICTIONARY_ID, entry_id: 'e_ja', tag_id: 'tag_nature' },
  { created_at: TIMESTAMP, created_by: MOCK_USER_ID, deleted: null, dictionary_id: DICTIONARY_ID, entry_id: 'e_chee', tag_id: 'tag_nature' },
]

export const dummy_dialects: Tables<'dialects'>[] = [
  { created_at: TIMESTAMP, created_by: MOCK_USER_ID, deleted: null, dictionary_id: DICTIONARY_ID, id: 'dia_rabinal', name: { default: 'Rabinal' }, updated_at: TIMESTAMP, updated_by: MOCK_USER_ID },
  { created_at: TIMESTAMP, created_by: MOCK_USER_ID, deleted: null, dictionary_id: DICTIONARY_ID, id: 'dia_cubulco', name: { default: 'Cubulco' }, updated_at: TIMESTAMP, updated_by: MOCK_USER_ID },
]

export const dummy_entry_dialects: Tables<'entry_dialects'>[] = [
  { created_at: TIMESTAMP, created_by: MOCK_USER_ID, deleted: null, dialect_id: 'dia_rabinal', dictionary_id: DICTIONARY_ID, entry_id: 'e_ja' },
  { created_at: TIMESTAMP, created_by: MOCK_USER_ID, deleted: null, dialect_id: 'dia_cubulco', dictionary_id: DICTIONARY_ID, entry_id: 'e_tzi' },
]
