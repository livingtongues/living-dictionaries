// pnpm -F scripts create-entry-caches
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { access, constants, writeFile } from 'node:fs/promises'
import { create, insertMultiple, save } from '@orama/orama'
import { PutObjectCommand, S3Client } from '@aws-sdk/client-s3'
import type { EntryData } from '@living-dictionaries/types'
import { augment_entry_for_search } from '../../site/src/lib/search/augment-entry-for-search'
import { entries_index_schema } from '../../site/src/lib/search/entries-schema'
import { createMultilingualTokenizer } from '../../site/src/lib/search/multilingual-tokenizer'
import { admin_supabase } from '../config-supabase'

const r2_account_id = process.env.CLOUDFLARE_R2_ACCOUNT_ID
const s3_api = `https://${r2_account_id}.r2.cloudflarestorage.com`

const cache_client = new S3Client({
  region: 'auto',
  endpoint: s3_api,
  credentials: {
    accessKeyId: process.env.CLOUDFLARE_R2_CACHE_ACCESS_KEY_ID,
    secretAccessKey: process.env.CLOUDFLARE_R2_CACHE_SECRET_ACCESS_KEY,
  },
})

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const order_field = 'updated_at'

const date_for_updating_all_indexs = '1970-01-01T00:00:00Z'
const indexes_last_updated = date_for_updating_all_indexs
// const indexes_last_updated = '2024-11-15T00:00:00Z' // do this next time

await write_caches()
async function write_caches() {
  let current_dict = ''
  try {
    const { data: dictionary_ids } = await admin_supabase.from('dictionaries').select('id').order('id')

    for (const { id: dictionary_id } of dictionary_ids) {
      const format = 'json'
      const folder = './search-indexes'
      const filename = `${dictionary_id}.${format}`
      const filepath = path.join(__dirname, folder, filename)

      // if (await file_exists(filepath)) {
      //   continue
      // }

      current_dict = dictionary_id

      const { data: fresh_entries, error: fresh_entries_error } = await admin_supabase
        .from('materialized_entries_view')
        .select('id')
        .limit(1)
        .eq('dictionary_id', dictionary_id)
        .is('deleted', null)
        .order(order_field, { ascending: true })
        .gt(order_field, indexes_last_updated)
      if (fresh_entries_error) {
        console.error({ fresh_entries_error })
        throw fresh_entries_error
      }
      if (indexes_last_updated !== date_for_updating_all_indexs) {
        if (fresh_entries?.length) {
          console.log(`${dictionary_id} being updated...`)
        } else {
          console.log(`   Skipping ${dictionary_id}, no fresh entries`)
          continue
        }
      }

      const entries: EntryData[] = []
      let timestamp_from_which_to_fetch_data = '1970-01-01T00:00:00Z'

      while (true) {
        if (entries.length)
          timestamp_from_which_to_fetch_data = entries[entries.length - 1][order_field] as string

        const { data: batch, error: batch_error } = await admin_supabase
          .from('materialized_entries_view')
          .select()
          .eq('dictionary_id', dictionary_id)
          .is('deleted', null)
          .limit(1000)
          .order(order_field, { ascending: true })
          .gt(order_field, timestamp_from_which_to_fetch_data)

        if (batch_error)
          console.info({ batch_error })
        if (batch?.length) {
          entries.push(...batch)
          if (batch.length < 1000) {
            break
          }
        } else {
          break
        }
      }

      if (entries.length === 0) {
        console.log(`${dictionary_id}: none`)
        continue
      }

      const search_index = await create_index(entries, dictionary_id)
      const index_json = save(search_index)
      const index_json_string = JSON.stringify(index_json)
      await writeFile(filepath, index_json_string)
      await upload_to_cloudflare(filename, index_json_string)
    }

    console.log({ result: dictionary_ids })
  } catch (err) {
    console.error(`Error with building ${current_dict}: ${err}`)
  }
}

async function create_index(entries: EntryData[], dictionary_id: string) {
  console.log({ [dictionary_id]: entries.length })
  const entries_augmented_for_search = entries.map(augment_entry_for_search)
  const index = create({
    schema: entries_index_schema,
    components: { tokenizer: createMultilingualTokenizer() },
  })
  await insertMultiple(index, entries_augmented_for_search)
  return index
}

async function file_exists(filepath: string): Promise<boolean> {
  try {
    await access(filepath, constants.F_OK)
    return true
  } catch {
    return false
  }
}

async function upload_to_cloudflare(filename: string, index_json_string: string) {
  const params = {
    Bucket: 'search-index',
    Key: `indexes/${filename}`,
    Body: index_json_string,
    ContentType: 'application/json',
  }

  try {
    const command = new PutObjectCommand(params)
    await cache_client.send(command)
    console.log(`Uploaded ${filename} to Cloudflare R2`)
  } catch (err) {
    console.error(`Error uploading ${filename} to Cloudflare R2: ${err}`)
  }
}
