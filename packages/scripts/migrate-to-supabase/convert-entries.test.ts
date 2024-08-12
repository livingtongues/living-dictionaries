import fs from 'node:fs'
import { chain } from 'stream-chain'
import { parser } from 'stream-json'
import { streamArray } from 'stream-json/streamers/StreamArray'
import type { ActualDatabaseEntry } from '@living-dictionaries/types'
import { convert_entry } from './convert-entries'

// Snapshotting 1-255 and specific entries moving beyond that point
// 229 - has write-in semantic domains
// 231 - has no ab for audio and sf.ts is an object with seconds and nanoseconds
// 235 - has rare xe for vernacular example sentence
// 252 - lo and di field
// 253 - pf
// 254 - ua, ca, nc
// 255 - ei, ii, sdn, sr

// 1228 - created by OTD, sf.source (local_import), sf.speakerName
// 1718 - scn
// 1759 - sfs
// 4577 - xs.vernacular
// 4609 - photo.source
// 4945 - mr
// 5377 - pl
// 5394 - xs.xv
const to_snapshot = [1228, 1718, 1759, 4577, 4609, 4945, 5377, 5394, 8005]

test(convert_entry, { timeout: 10000 }, async () => {
  const count = 8005
  const success: any[] = []
  const todo: any[] = []

  const result: Promise<any[]> = new Promise<void>((resolve, reject) => {
    const pipeline = chain([
      fs.createReadStream('./packages/scripts/migrate-to-supabase/entries_full.json'),
      parser(),
      streamArray(),
    ])

    pipeline.on('data', ({ value: entry }) => {
      try {
        const [processed_fb_entry_remains, supa_data] = convert_entry(JSON.parse(JSON.stringify(remove_seconds_underscore(entry))))
        if (Object.keys(processed_fb_entry_remains).length === 0) {
          success.push({ entry, supa_data })
        } else {
          todo.push({ fb_entry: processed_fb_entry_remains, supa_data })
        }
        if (success.length >= count || todo.length) {
          pipeline.destroy()
          pipeline.input.destroy()
        }
      } catch (err) {
        console.error(err)
        pipeline.destroy()
        pipeline.input.destroy()
      }
    })

    pipeline.on('close', () => {
      console.log({
        success: `${success.length}/${count}`,
        todo: JSON.stringify(todo[0], null, 2),
        last_success: JSON.stringify(success[success.length - 1], null, 2),
      })
      resolve(success)
    })

    pipeline.on('error', (err: any) => {
      console.log(err)
      reject(err)
    })
  })

  const converted_entries = await result
  expect(converted_entries).toHaveLength(count)

  const first_chunk = converted_entries.slice(0, 255)
  expect(first_chunk).toMatchFileSnapshot('convert-entries.snap.json')

  const specific_entries = converted_entries.filter((_, index) => to_snapshot.includes(index + 1))
  expect(specific_entries).toMatchFileSnapshot('convert-entries.specific.snap.json')
})

function remove_seconds_underscore(entry: Partial<ActualDatabaseEntry> & Record<string, any>) {
  if (entry.updatedAt?._seconds) {
    entry.updatedAt = {
      seconds: entry.updatedAt._seconds,
    }
  }
  if (entry.createdAt?._seconds) {
    entry.createdAt = {
      seconds: entry.createdAt._seconds,
    }
  }
  if (entry.ua?._seconds) {
    entry.ua = {
      seconds: entry.ua._seconds,
    }
  }
  if (entry.ca?._seconds) {
    entry.ca = {
      seconds: entry.ca._seconds,
    }
  }
  return entry
}
