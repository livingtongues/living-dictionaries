import fs from 'node:fs'
import { chain } from 'stream-chain'
import { parser } from 'stream-json'
import { streamArray } from 'stream-json/streamers/StreamArray'
import type { ActualDatabaseEntry } from '@living-dictionaries/types'
import { convert_entry } from './convert-entries'

// 229 - has write-in semantic domains
// 231 - has no ab for audio
// 235 - has rare xe for vernacular example sentence
// 252 - lo and di field
// 253 - pf
// 254 - ua, ca, nc
// 255 - ei, ii, sdn, sr

test(convert_entry, { timeout: 15000 }, async () => {
  const count = 423
  const success: any[] = []
  const todo: any[] = []

  await new Promise<void>((resolve, reject) => {
    const pipeline = chain([
      fs.createReadStream('./packages/scripts/migrate-to-supabase/entries_full.json'),
      parser(),
      streamArray(),
    ])

    pipeline.on('data', ({ value: entry }) => {
      const [processed_fb_entry_remains, supa_data] = convert_entry(JSON.parse(JSON.stringify(remove_seconds_underscore(entry))))
      if (Object.keys(processed_fb_entry_remains).length === 0) {
        success.push({ entry, supa_data })
      } else {
        todo.push({ fb_entry: processed_fb_entry_remains, supa_data })
      }
      if (success.length >= count) {
        pipeline.destroy()
        // pipeline.input.destroy()
      }
    })

    pipeline.on('close', () => {
      console.log({
        success: `${success.length}/${count}`,
        todo: JSON.stringify(todo[0], null, 2),
        last_success: JSON.stringify(success[success.length - 1], null, 2),
      })
      try {
        expect(success).toHaveLength(count)
        expect(success).toMatchFileSnapshot('convert-entries.snap.json')
        resolve()
      } catch (error) {
        reject(error)
      }
    })

    pipeline.on('error', (err: any) => {
      reject(err)
    })
  })

  // const { success, todo } = convert_entries(seconds_renamed_entries.slice(0, count))
  // console.log({ success: `${success.length}/${count}`, todo: JSON.stringify(todo[0], null, 2), last_success: JSON.stringify(success[success.length - 1], null, 2) })
  // expect(success).toHaveLength(count)
  // expect(success).toMatchFileSnapshot('convert-entries.snap.json')
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
