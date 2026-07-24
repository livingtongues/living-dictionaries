import type { EntryData, Tables } from '$lib/types'
import { build_entries_csv, build_entry_columns } from './entry-csv'
import { objects_to_csv_by_headers } from '$lib/export/csv'
import { mock_t } from '$lib/mocks/mock-t'

const dictionary = {
  id: 'example-dict',
  name: 'Example Dictionary',
  orthographies: [{ code: 'lo1', name: 'Script A' }, { code: 'lo2', name: 'Script B' }],
} as Tables<'dictionaries'>

const context = {
  dictionary,
  t: mock_t,
  url_from_storage_path: (path: string) => `https://media.livingdictionaries.app/${path}`,
}

function minimal_entry(overrides: Partial<EntryData> = {}): EntryData {
  return {
    id: 'e1',
    main: { lexeme: { default: 'word' } },
    senses: [],
    updated_at: '',
    ...overrides,
  } as EntryData
}

describe(build_entry_columns, () => {
  test('minimal entry emits only base columns with empty values', () => {
    const columns = build_entry_columns(minimal_entry(), context)
    expect(Object.fromEntries(columns.map(({ key, value }) => [key, value]))).toEqual({
      'id': 'e1',
      'lexeme': 'word',
      'localOrthography': '',
      'localOrthography.2': '',
      'homograph': '',
      'phonetic': '',
      'interlinearization': '',
      'morphology': '',
      'dialects': '',
      'notes': '',
      'linguistic_history': '',
      'sources': '',
      'scientific_names': '',
      'elicitation_id': '',
    })
  })

  test('headword falls back to first populated alternate orthography', () => {
    const entry = minimal_entry({ main: { lexeme: { lo2: 'ɸɔ' } } as unknown as EntryData['main'] })
    const columns = build_entry_columns(entry, context)
    const by_key = Object.fromEntries(columns.map(({ key, value }) => [key, value]))
    expect(by_key.lexeme).toBe('ɸɔ')
    expect(by_key['localOrthography.2']).toBe('ɸɔ')
  })

  test('alternate orthography headers use the orthography name', () => {
    const columns = build_entry_columns(minimal_entry(), context)
    const headers = Object.fromEntries(columns.map(({ key, header }) => [key, header]))
    expect(headers.localOrthography).toBe('Script A')
    expect(headers['localOrthography.2']).toBe('Script B')
  })

  test('media URLs come straight from storage paths — never renamed', () => {
    const entry = minimal_entry({
      audios: [
        { id: 'a1', storage_path: 'example-dict/audio/uuid-1.mp3' },
        { id: 'a2', storage_path: 'example-dict/audio/uuid-2.wav' },
      ] as EntryData['audios'],
      senses: [{
        id: 's1',
        photos: [{ id: 'p1', storage_path: 'example-dict/photo/uuid-3.jpg' }],
        videos: [
          { id: 'v1', storage_path: 'example-dict/video/uuid-4.mp4' },
          { id: 'v2', hosted_elsewhere: { type: 'youtube', video_id: 'abc123' } },
        ],
      }] as unknown as EntryData['senses'],
    })
    const by_key = Object.fromEntries(build_entry_columns(entry, context).map(({ key, value }) => [key, value]))
    expect(by_key.audio_url).toBe('https://media.livingdictionaries.app/example-dict/audio/uuid-1.mp3')
    expect(by_key['audio_url.2']).toBe('https://media.livingdictionaries.app/example-dict/audio/uuid-2.wav')
    expect(by_key.photo_url).toBe('https://media.livingdictionaries.app/example-dict/photo/uuid-3.jpg')
    expect(by_key.video_url).toBe('https://media.livingdictionaries.app/example-dict/video/uuid-4.mp4')
    expect(by_key['hosted_video_url.2']).toBe('https://www.youtube.com/watch?v=abc123')
  })

  test('vimeo hosted videos link to vimeo', () => {
    const entry = minimal_entry({
      senses: [{ id: 's1', videos: [{ id: 'v1', hosted_elsewhere: { type: 'vimeo', video_id: '789' } }] }] as unknown as EntryData['senses'],
    })
    const by_key = Object.fromEntries(build_entry_columns(entry, context).map(({ key, value }) => [key, value]))
    expect(by_key.hosted_video_url).toBe('https://vimeo.com/789')
  })

  test('first audio speaker columns', () => {
    const entry = minimal_entry({
      audios: [{
        id: 'a1',
        storage_path: 'example-dict/audio/uuid-1.mp3',
        speakers: [{ id: 'sp1', name: 'Ana', birthplace: 'Oaxaca', decade: 3, gender: 'f' }],
      }] as EntryData['audios'],
    })
    const by_key = Object.fromEntries(build_entry_columns(entry, context).map(({ key, value }) => [key, value]))
    expect(by_key.speaker_name).toBe('Ana')
    expect(by_key.speaker_birthplace).toBe('Oaxaca')
    expect(by_key.speaker_decade).toBe('31-40')
    expect(by_key.speaker_gender).toBe('female')
  })

  test('sense columns: glosses, definitions, domains, POS, sentences — second sense prefixed', () => {
    const sense = {
      id: 's1',
      glosses: { en: 'tree', es: 'árbol' },
      definition: { en: 'a woody plant' },
      semantic_domains: ['1.4'],
      write_in_semantic_domains: ['forest things'],
      parts_of_speech: ['n'],
      noun_class: '9',
      variant: { default: 'wari' },
      plural_form: { default: 'waris' },
      sentences: [{ id: 'x1', text: { default: 'ejemplo vernacular' }, translation: { en: 'an example' } }],
    }
    const entry = minimal_entry({
      senses: [sense, { ...sense, id: 's2', glosses: { en: 'log' } }] as unknown as EntryData['senses'],
    })
    const columns = build_entry_columns(entry, context)
    const by_key = Object.fromEntries(columns.map(({ key, value }) => [key, value]))
    const headers = Object.fromEntries(columns.map(({ key, header }) => [key, header]))

    expect(by_key.en_gloss).toBe('tree')
    expect(by_key.es_gloss).toBe('árbol')
    expect(headers.es_gloss).toBe('español Gloss')
    expect(by_key.en_definition).toBe('a woody plant')
    expect(by_key.semanticDomain).toBe('Plants, trees and other vegetation')
    expect(by_key.writeInSemanticDomain).toBe('forest things')
    expect(by_key.partOfSpeech).toBe('n')
    expect(by_key['partOfSpeech fullname']).toBe('noun')
    expect(by_key.nounClass).toBe('9')
    expect(by_key.variant).toBe('wari')
    expect(by_key.pluralForm).toBe('waris')
    expect(by_key.vernacular_exampleSentence).toBe('ejemplo vernacular')
    expect(headers.vernacular_exampleSentence).toBe('Example sentence in Example Dictionary')
    expect(by_key.en_exampleSentence).toBe('an example')

    expect(by_key['s2.en_gloss']).toBe('log')
    expect(headers['s2.en_gloss']).toBe('Sense 2: English Gloss')
    expect(by_key['s2.semanticDomain']).toBe('Plants, trees and other vegetation')
    expect(headers['s2.semanticDomain']).toBe('Sense 2: Semantic domain 1')
  })

  test('notes render markdown/HTML to plain text', () => {
    const entry = minimal_entry({
      main: { lexeme: { default: 'word' }, notes: { default: 'has **bold** text' } } as unknown as EntryData['main'],
    })
    const by_key = Object.fromEntries(build_entry_columns(entry, context).map(({ key, value }) => [key, value]))
    expect(by_key.notes).toBe('has bold text')
  })
})

describe(build_entries_csv, () => {
  test('headers are the stable base set plus first-seen data columns; rows align', () => {
    const entries: EntryData[] = [
      minimal_entry(),
      minimal_entry({
        id: 'e2',
        main: { lexeme: { default: 'tree' } } as unknown as EntryData['main'],
        senses: [{ id: 's1', glosses: { en: 'tree' } }] as unknown as EntryData['senses'],
      }),
    ]
    const { headers, rows } = build_entries_csv(entries, context)
    expect(Object.keys(headers)).toEqual([
      'id', 'lexeme', 'localOrthography', 'localOrthography.2', 'homograph', 'phonetic',
      'interlinearization', 'morphology', 'dialects', 'notes', 'linguistic_history',
      'sources', 'scientific_names', 'elicitation_id', 'en_gloss',
    ])
    expect(rows[0].en_gloss).toBe(undefined)
    expect(rows[1].en_gloss).toBe('tree')

    const csv = objects_to_csv_by_headers(headers, rows)
    const lines = csv.split('\n')
    expect(lines[0]).toBe('id,lexeme,localOrthography,localOrthography.2,homograph,phonetic,interlinearization,morphology,dialects,notes,linguistic_history,sources,scientific_names,elicitation_id,en_gloss')
    expect(lines[1]).toBe('Entry ID,Lexeme/Word/Phrase,Script A,Script B,Homograph Number,Phonetic (IPA),Interlinearization,Morphology,Dialects,Notes,Linguistic History,Source(s),Scientific name(s),Elicitation ID,English Gloss')
    expect(lines[2]).toBe('e1,word,,,,,,,,,,,,,')
    expect(lines[3]).toBe('e2,tree,,,,,,,,,,,,,tree')
  })
})
