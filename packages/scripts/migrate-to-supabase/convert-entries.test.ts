import { convert_entries } from './convert-entries'
import entries from './entries.json'

test(convert_entries, () => {
  const seconds_renamed_entries = entries.map((entry) => {
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
    return entry
  })
  // 229 - has write-in semantic domains
  // 231 - has no ab for audio
  const count = 235
  const { success, todo } = convert_entries(seconds_renamed_entries.slice(0, count))
  console.log({ success: success.length, count, todo: todo[0] })
  expect(success).toHaveLength(count)
  expect(success).toMatchFileSnapshot('convert-entries.snap.json')
})
