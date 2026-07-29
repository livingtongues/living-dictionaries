// ffprobe every key over the public media CDN and write JSONL rows of
// `{ key, duration_ms?, width?, height? }`. Resumable: already-probed keys in an
// existing output file are skipped, failures land in `<output>.failures` for review.
// Usage: node probe.mjs /tmp/media-keys.json /tmp/media-metadata.jsonl
import { execFile } from 'node:child_process'
import { appendFileSync, existsSync, readFileSync } from 'node:fs'

const CDN = 'https://media.livingdictionaries.app'
const CONCURRENCY = Number(process.env.CONCURRENCY ?? 48)

const [keys_path, output_path] = process.argv.slice(2)
if (!keys_path || !output_path) {
  console.error('usage: node probe.mjs <keys.json> <output.jsonl>')
  process.exit(1)
}

const rows = JSON.parse(readFileSync(keys_path, 'utf8'))
const already_probed = new Set()
if (existsSync(output_path)) {
  for (const line of readFileSync(output_path, 'utf8').split('\n')) {
    if (line.trim())
      already_probed.add(JSON.parse(line).key)
  }
}
const pending = rows.filter(row => !already_probed.has(row.key))
console.error(`${rows.length} keys, ${already_probed.size} already probed, ${pending.length} to go`)

function ffprobe(url) {
  return new Promise((resolve, reject) => {
    execFile('ffprobe', [
      '-v', 'error',
      '-show_entries', 'format=duration:stream=width,height',
      '-of', 'json',
      url,
    ], { timeout: 60_000 }, (err, stdout) => {
      if (err)
        return reject(err)
      resolve(JSON.parse(stdout))
    })
  })
}

// MediaRecorder webm carries no header duration — full-decode to measure it.
function ffmpeg_decode_duration_ms(url) {
  return new Promise((resolve, reject) => {
    execFile('ffmpeg', ['-v', 'error', '-i', url, '-f', 'null', '-', '-progress', 'pipe:1'], { timeout: 300_000 }, (err, stdout) => {
      if (err)
        return reject(err)
      const times = [...stdout.matchAll(/out_time_us=(\d+)/g)]
      const last = times.at(-1)
      if (!last)
        return reject(new Error('no out_time_us in ffmpeg progress'))
      resolve(Math.round(Number(last[1]) / 1000))
    })
  })
}

let done = 0
let failed = 0
const started_at = Date.now()

async function probe_one({ key, media_type }) {
  try {
    const result = await ffprobe(`${CDN}/${encodeURI(key)}`)
    const record = { key }
    if (media_type === 'photo') {
      const stream = (result.streams ?? []).find(entry => entry.width > 0)
      if (!stream)
        throw new Error('no dimensions')
      record.width = stream.width
      record.height = stream.height
    } else {
      const duration = Number(result.format?.duration)
      record.duration_ms = Number.isFinite(duration) && duration > 0
        ? Math.round(duration * 1000)
        : await ffmpeg_decode_duration_ms(`${CDN}/${encodeURI(key)}`)
    }
    appendFileSync(output_path, `${JSON.stringify(record)}\n`)
  } catch (err) {
    failed++
    appendFileSync(`${output_path}.failures`, `${JSON.stringify({ key, error: err.message?.slice(0, 200) })}\n`)
  }
  done++
  if (done % 500 === 0) {
    const rate = done / ((Date.now() - started_at) / 1000)
    console.error(`${done}/${pending.length} (${failed} failed, ${rate.toFixed(1)}/s, ~${Math.round((pending.length - done) / rate / 60)} min left)`)
  }
}

const queue = [...pending]
await Promise.all(Array.from({ length: CONCURRENCY }, async () => {
  while (queue.length)
    await probe_one(queue.shift())
}))
console.error(`done: ${done - failed} probed, ${failed} failed`)
