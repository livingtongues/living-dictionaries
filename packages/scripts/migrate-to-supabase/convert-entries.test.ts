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
  })
  // 229 - has write-in semantic domains
  // 231 - has no ab for audio
  // 235 - has rare xe for vernacular example sentence
  // 252 - lo and di field
  // 253 - pf
  // 254 - ua, ca, nc
  // 255
  const count = 255
  const { success, todo } = convert_entries(seconds_renamed_entries.slice(0, count))
  console.log({ success: `${success.length}/${count}`, todo: JSON.stringify(todo[0], null, 2), last_success: JSON.stringify(success[success.length - 1], null, 2) })
  expect(success).toHaveLength(count)
  expect(success).toMatchFileSnapshot('convert-entries.snap.json')
})
