import fs from 'node:fs'
import { chain } from 'stream-chain'
import { parser } from 'stream-json'
import { streamArray } from 'stream-json/streamers/StreamArray'
import type { ActualDatabaseEntry } from '@living-dictionaries/types'
import { convert_entry } from './convert-entries'
import entries_to_test from './entries_to_test.json'

let id_count = 0
function randomUUID() {
  id_count++
  return `use-crypto-uuid-in-real-thing_${id_count}`
}

test(convert_entry, () => {
  const converted_entries = entries_to_test.map((entry) => {
    const [processed_fb_entry_remains, supa_data] = convert_entry(JSON.parse(JSON.stringify(entry)), randomUUID)
    if (Object.keys(processed_fb_entry_remains).length !== 0)
      throw new Error('Entry not fully converted')
    return { entry, supa_data }
  },
  )
  expect(converted_entries).toMatchFileSnapshot('convert-entries-to-test.snap.json')
})

// Snapshotting 1-228 and specific entries moving beyond that point
// 229 - has write-in semantic domains (sd array)
// 231 - has no ab for audio and sf.ts is an object with seconds and nanoseconds
// 235 - rare xe for vernacular example sentence
// 252 - lo and di field
// 253 - pf
// 254 - ua, ca, nc
// 255 - ei, ii, sdn, sr (array)

// 1228 - created by OTD, sf.source (local_import), sf.speakerName
// 1718 - scn
// 1759 - sfs
// 4577 - xs.vernacular
// 4609 - photo.source
// 4945 - mr
// 5377 - pl
// 5394 - xs.vn
// 8005 - translations of sentences (xs.en and xs.hi)
// 14072 - in
// 15715 - va
// 16141 - xs.xv and xs.vn (both are vernacular and we are letting vn win)
// 23958 - lo and lo1 (birhor has a BUNCH of this)
// 29994 - co
// 36138 - vfs
// 39845 - sr string
// 39858 - xv
// 47304 - vfs[0].youtubeId
// 47829 - local_orthography_1 and . for lo1
// 85363 - sfs with a null sc and speakerName
// 128736 - sd string
// 166042 - both xv and xs.vn
// 166267 - has importId
// 167017 - deletedVfs with youtubeId (ignoring all but 2 deletedVfs)
// 172023 - source gives importId
// 200582 - startAt (vfs youtube start seconds)
// 234551 - useless pf.sc 'local_import' - skipping test
// 248444 - ei is number
// 251721 - dt = date and hm = homonym from FLEx - placing into unstructured
// 253088 - semdom FLEx semantic domain - placing into unstructured
// 266408 - deleted vfs date
const to_snapshot = [229, 231, 235, 252, 253, 254, 255, 1228, 1718, 1759, 4577, 4609, 4945, 5377, 5394, 8005, 14072, 15715, 16141, 23958, 29994, 36138, 39845, 39858, 47304, 47829, 85363, 128736, 166042, 167017, 172023, 200582, 248444, 251721, 253088, 266408]

// pnpm -F scripts test:migration convert-entries -- --ui
test.todo(convert_entry, { timeout: 16000 }, async () => {
  // const count = 300
  const count = 278631 // total entries
  const success: { entry: any, supa_data: any }[] = []
  const todo: any[] = []

  const result = new Promise<{ entry: any, supa_data: any }[]>((resolve, reject) => {
    const pipeline = chain([
      fs.createReadStream('./migrate-to-supabase/entries_full.json'),
      parser(),
      streamArray(),
    ])

    pipeline.on('data', ({ value: entry }) => {
      try {
        const [processed_fb_entry_remains, supa_data] = convert_entry(JSON.parse(JSON.stringify(remove_seconds_underscore(entry))))
        // accumlate results, create needed speakers, and then assign them. Then prepare to upload changes to database
        if (Object.keys(processed_fb_entry_remains).length === 0) {
          success.push({ entry, supa_data })
        } else {
          todo.push({ fb_entry: processed_fb_entry_remains, entry, supa_data })
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

  const first_chunk = converted_entries.slice(0, 228)
  expect(first_chunk).toMatchFileSnapshot('convert-entries.snap.json')

  const specific_entries = converted_entries.filter((_, index) => to_snapshot.includes(index + 1))
  expect(specific_entries).toMatchFileSnapshot('convert-entries.specific.snap.json')

  // const entries_to_test = [...first_chunk, ...specific_entries].map(({ entry }) => entry)
  // fs.writeFileSync('entries_to_test.json', JSON.stringify(entries_to_test, null, 2))
})

function remove_seconds_underscore(entry: ActualDatabaseEntry & Record<string, any>) {
  // @ts-expect-error
  if (entry.updatedAt?._seconds) {
    // @ts-expect-error
    entry.updatedAt = {
      // @ts-expect-error
      seconds: entry.updatedAt._seconds,
    }
  }
  // @ts-expect-error
  if (entry.createdAt?._seconds) {
    // @ts-expect-error
    entry.createdAt = {
      // @ts-expect-error
      seconds: entry.createdAt._seconds,
    }
  }
  // @ts-expect-error
  if (entry.ua?._seconds) {
    // @ts-expect-error
    entry.ua = {
      // @ts-expect-error
      seconds: entry.ua._seconds,
    }
  }
  // @ts-expect-error
  if (entry.ca?._seconds) {
    // @ts-expect-error
    entry.ca = {
      // @ts-expect-error
      seconds: entry.ca._seconds,
    }
  }
  return entry
}
