import fs from 'node:fs'
import Chain from 'stream-chain'
import Parser from 'stream-json'
import StreamArray from 'stream-json/streamers/StreamArray'
import { admin_supabase, jacob_ld_user_id } from '../config-supabase'
import { remove_seconds_underscore } from './utils/remove-seconds-underscore'
import { convert_entry } from './convert-entries'

export async function ensure_all_current_senses_have_entry_placeholders() {
  // load
  const { data: senses } = await admin_supabase.from('senses')
    .select('id, entry_id')
  const { data: entries } = await admin_supabase.from('entries')
    .select('id')

  const entries_needing_added = new Set<string>()
  for (const sense of senses) {
    if (!entries.find(entry => entry.id === sense.entry_id)) {
      console.log(`need placeholder entry for sense ${sense.id}, entry ${sense.entry_id}`)
      entries_needing_added.add(sense.entry_id)
    }
  }
  console.log({ entries_to_add: entries_needing_added.size })

  const pipeline = Chain.chain([
    fs.createReadStream('./migrate-to-supabase/firestore-data/firestore-entries.json'),
    Parser.parser(),
    StreamArray.streamArray(),
  ])

  try {
    for await (const { value: fb_entry } of pipeline) {
      if (entries_needing_added.has(fb_entry.id)) {
        const corrected_fb_entry = remove_seconds_underscore(fb_entry)
        const [, supa_data] = convert_entry(JSON.parse(JSON.stringify(corrected_fb_entry)))
        const { entry } = supa_data

        const { data: dictionary } = await admin_supabase.from('dictionaries').select().eq('id', entry.dictionary_id).single()
        if (!dictionary) {
          console.log({ creating_dict: entry.dictionary_id })
          const { error } = await admin_supabase.from('dictionaries').insert({
            created_by: jacob_ld_user_id,
            updated_by: jacob_ld_user_id,
            id: entry.dictionary_id,
            name: 'CHANGE',
          })
          if (error) {
            console.info({ entry })
            throw new Error(error.message)
          }
        }

        const insert = {
          id: entry.id,
          dictionary_id: entry.dictionary_id,
          lexeme: {},
          created_by: entry.created_by,
          created_at: entry.created_at,
          updated_by: entry.updated_by,
          updated_at: entry.updated_at,
        }
        console.log({ insert })
        await admin_supabase.from('entries').insert(insert)
      }
    }
    console.log('finished')
  } catch (err) {
    console.error(err)
    pipeline.destroy()
    pipeline.input.destroy()
  }
}
