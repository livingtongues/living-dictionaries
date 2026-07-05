import { create, insertMultiple, remove, update } from '@orama/orama'
import type { EntryData } from '$lib/types'
import { augment_entry_for_search } from './augment-entry-for-search'
import { entries_index_schema } from './entries-schema'
import type { EntriesIndex } from './entries-schema'
import { search_entries } from './search-entries'
import type { SearchEntriesOptions } from './search-entries'
import { sentences_index_schema, texts_index_schema } from './corpus-schemas'
import type { SentencesIndex, TextsIndex } from './corpus-schemas'
import { search_sentences, search_texts } from './search-corpus'
import type { SearchCorpusOptions } from './search-corpus'
import type { augment_sentence_for_search, augment_text_for_search } from './augment-sentence-for-search'
import { createMultilingualTokenizer } from './multilingual-tokenizer'

let orama_index: Record<string, EntriesIndex>
let sentences_index: Record<string, SentencesIndex>
let texts_index: Record<string, TextsIndex>

export type SentenceDoc = ReturnType<typeof augment_sentence_for_search>
export type TextDoc = ReturnType<typeof augment_text_for_search>

export async function create_index(entries: EntryData[], dictionary_id: string) {
  console.time('Augment Entries Time')
  const entries_augmented_for_search = entries.map(augment_entry_for_search)
  console.timeEnd('Augment Entries Time')

  console.time('Index Entries Time')
  const index = create({
    schema: entries_index_schema,
    components: { tokenizer: createMultilingualTokenizer() },
  })
  await insertMultiple(index, entries_augmented_for_search)
  orama_index = { [dictionary_id]: index }
  console.timeEnd('Index Entries Time')
}

function get_index(dictionary_id: string): Promise<EntriesIndex> {
  return new Promise((resolve) => {
    const index = orama_index?.[dictionary_id]
    if (index) return resolve(index)

    const interval = setInterval(() => {
      const index = orama_index?.[dictionary_id]
      if (index) {
        clearInterval(interval)
        resolve(index)
      }
    }, 50)
  })
}

// async function update_index_entries(entries: EntryData[]) {
//   const index = await get_index()
//   await updateMultiple(index, entries.map(({ id }) => id), entries.map(augment_entry_for_search))
// }

export async function update_index_entry(entry: EntryData, dictionary_id: string) {
  const index = await get_index(dictionary_id)
  if (entry.deleted)
    await remove(index, entry.id)
  else
    await update(index, entry.id, augment_entry_for_search(entry))
}

export async function _search_entries(options: SearchEntriesOptions) {
  const index = await get_index(options.dictionary_id)
  return search_entries(options, index)
}

// ─── Corpus indexes (sentences + texts) — parallel to the entries index, same
// worker, same tokenizer, own schemas (see corpus-schemas.ts) ─────────────────

export async function create_corpus_indexes({ sentence_docs, text_docs, dictionary_id }: {
  sentence_docs: SentenceDoc[]
  text_docs: TextDoc[]
  dictionary_id: string
}) {
  console.time('Index Corpus Time')
  const s_index = create({
    schema: sentences_index_schema,
    components: { tokenizer: createMultilingualTokenizer() },
  })
  await insertMultiple(s_index, sentence_docs)
  sentences_index = { [dictionary_id]: s_index }

  const t_index = create({
    schema: texts_index_schema,
    components: { tokenizer: createMultilingualTokenizer() },
  })
  await insertMultiple(t_index, text_docs)
  texts_index = { [dictionary_id]: t_index }
  console.timeEnd('Index Corpus Time')
}

function get_corpus_index<T>(store: () => Record<string, T> | undefined, dictionary_id: string): Promise<T> {
  return new Promise((resolve) => {
    const index = store()?.[dictionary_id]
    if (index) return resolve(index)

    const interval = setInterval(() => {
      const index = store()?.[dictionary_id]
      if (index) {
        clearInterval(interval)
        resolve(index)
      }
    }, 50)
  })
}

export async function update_index_sentence({ doc, sentence_id, deleted, dictionary_id }: {
  doc: SentenceDoc | null
  sentence_id: string
  deleted: boolean
  dictionary_id: string
}) {
  const index = await get_corpus_index(() => sentences_index, dictionary_id)
  if (deleted || !doc)
    await remove(index, sentence_id)
  else
    await update(index, sentence_id, doc)
}

export async function update_index_text({ doc, text_id, deleted, dictionary_id }: {
  doc: TextDoc | null
  text_id: string
  deleted: boolean
  dictionary_id: string
}) {
  const index = await get_corpus_index(() => texts_index, dictionary_id)
  if (deleted || !doc)
    await remove(index, text_id)
  else
    await update(index, text_id, doc)
}

export async function _search_sentences(options: SearchCorpusOptions & { dictionary_id: string }) {
  const index = await get_corpus_index(() => sentences_index, options.dictionary_id)
  return search_sentences(options, index)
}

export async function _search_texts(options: SearchCorpusOptions & { dictionary_id: string }) {
  const index = await get_corpus_index(() => texts_index, options.dictionary_id)
  return search_texts(options, index)
}
