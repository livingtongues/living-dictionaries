import fs from 'node:fs'
import Chain from 'stream-chain'
import Parser from 'stream-json'
import StreamArray from 'stream-json/streamers/StreamArray'
import { admin_supabase, jacob_ld_user_id } from '../config-supabase'

export async function create_rest_of_dictionary_placeholders() {
  const { data: dictionaries } = await admin_supabase.from('dictionaries')
    .select('id')

  const dictionary_ids = new Set(dictionaries.map(dict => dict.id))
  const dictionary_ids_needing_added = new Set<string>()

  const pipeline = Chain.chain([
    fs.createReadStream('./migrate-to-supabase/firestore-data/firestore-entries.json'),
    Parser.parser(),
    StreamArray.streamArray(),
  ])

  try {
    for await (const { value: fb_entry } of pipeline) {
      if (!dictionary_ids.has(fb_entry.dictionary_id)) {
        dictionary_ids_needing_added.add(fb_entry.dictionary_id)
      }
    }
    console.log('finished')
  } catch (err) {
    console.error(err)
    pipeline.destroy()
    pipeline.input.destroy()
  }

  const inserts = Array.from(dictionary_ids_needing_added).map(dictionary_id => ({
    created_by: jacob_ld_user_id,
    updated_by: jacob_ld_user_id,
    id: dictionary_id,
    name: 'CHANGE',
  }))

  console.log({ inserts })

  const { error } = await admin_supabase.from('dictionaries').insert(inserts)
  if (error) {
    console.info({ error })
    throw new Error(error.message)
  }
}
