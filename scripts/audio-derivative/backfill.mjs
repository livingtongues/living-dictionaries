#!/usr/bin/env node
/**
 * Corpus backfill for `_p1.mp3` playback derivatives. Streams each original from
 * the public CDN, encodes with the auditioned recipe, PUTs the derivative to R2.
 *
 * Worklist TSV: `key<TAB>trim(0|1)` (a bare key column defaults to trim=1, but
 * only key+trim worklists should be used for corpus runs — text/sentence/timed
 * clips must be trim=0 or karaoke desyncs).
 *
 * Dry-run by default; `--apply` writes. `--resume=<log>` skips keys already
 * recorded as `LEDGER` lines in a previous run's output log. Emits one line per
 * key: `LEDGER\t{derivative_key}\t{bytes}\t{duration_ms}` or `FAIL\t{key}\t{message}`.
 */
import { mkdtemp, readFile, rm } from 'node:fs/promises'
import { existsSync, readFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { basename, join } from 'node:path'
import { spawn } from 'node:child_process'
import { PutObjectCommand, S3Client } from '@aws-sdk/client-s3'

const args = new Map(process.argv.slice(2).map(value => value.split('=', 2)))
const input_file = args.get('--keys') || 'audio-sample.tsv'
const limit = Number(args.get('--limit') || 20)
const workers = Number(args.get('--workers') || 2)
const apply = args.has('--apply')
const resume_log = args.get('--resume')
const account_id = process.env.R2_ACCOUNT_ID
const access_key_id = process.env.R2_ACCESS_KEY_ID
const secret_access_key = process.env.R2_SECRET_ACCESS_KEY
if (apply && (!account_id || !access_key_id || !secret_access_key)) throw new Error('R2 credentials are required with --apply')
const client = apply ? new S3Client({ region: 'auto', endpoint: `https://${account_id}.r2.cloudflarestorage.com`, credentials: { accessKeyId: access_key_id, secretAccessKey: secret_access_key } }) : null

function run(command, command_args) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, command_args, { stdio: ['ignore', 'pipe', 'pipe'] })
    let output = ''
    child.stdout.on('data', chunk => output += chunk)
    child.stderr.on('data', chunk => output += chunk)
    child.on('close', code => code === 0 ? resolve(output) : reject(new Error(`${command} exited ${code}: ${output.slice(-800)}`)))
  })
}

function number(output, label, fallback) {
  const line = output.split('\n').filter(value => value.includes(label)).at(-1)
  const suffix = line?.slice(line.lastIndexOf(label) + label.length).trimStart()
  const value = suffix?.startsWith(':') ? suffix.slice(1).trimStart() : suffix
  const parsed = Number(value?.match(/^(-?inf|nan|-?\d+(?:\.\d+)?)/i)?.[1])
  return Number.isFinite(parsed) ? parsed : fallback
}

const done = new Set()
if (resume_log && existsSync(resume_log)) {
  for (const line of readFileSync(resume_log, 'utf8').split('\n')) {
    if (line.startsWith('LEDGER\t')) done.add(line.split('\t')[1])
  }
}

const jobs = (await readFile(input_file, 'utf8')).split('\n').filter(Boolean)
  .map((line) => {
    const columns = line.split('\t')
    const key = columns.find(value => value.includes('/audio/'))
    if (!key) return null
    const trim_column = columns[columns.indexOf(key) + 1]
    return { key, trim: trim_column === undefined ? true : trim_column.trim() === '1' }
  })
  .filter(Boolean)
  .filter(job => !done.has(job.key.replace(/\.[\w-]{1,10}$/, '_p1.mp3')))
  .slice(0, limit)

console.error(`[backfill] ${jobs.length} keys to process (${done.size} already done), workers=${workers}, apply=${apply}`)

async function process_key({ key, trim }) {
  const derivative_key = key.replace(/\.[\w-]{1,10}$/, '_p1.mp3')
  if (!apply) {
    console.log(`DRY\t${key}\t${derivative_key}\ttrim=${trim ? 1 : 0}`)
    return
  }
  const directory = await mkdtemp(join(tmpdir(), 'ld-audio-backfill-'))
  try {
    const input = join(directory, basename(key))
    const output = join(directory, 'output.mp3')
    await run('curl', ['--fail', '--silent', '--show-error', '--location', '--retry', '3', '--output', input, `https://media.livingdictionaries.app/${key}`])
    const mono = 'aformat=channel_layouts=mono'
    const loudness = await run('nice', ['-n', '19', 'ffmpeg', '-hide_banner', '-nostats', '-i', input, '-af', `${mono},ebur128=peak=true`, '-f', 'null', '-'])
    const peak = await run('nice', ['-n', '19', 'ffmpeg', '-hide_banner', '-nostats', '-i', input, '-af', `${mono},astats=measure_perchannel=none:measure_overall=Peak_level+Noise_floor`, '-f', 'null', '-'])
    const integrated = number(loudness, 'I:', -20)
    const sample_peak = number(peak, 'Peak level dB', -1)
    const noise_floor = number(peak, 'Noise floor dB', -70)
    const gain = Math.round(Math.min(-16 - integrated, -1 - sample_peak) * 100) / 100
    const threshold = Math.round(Math.max(-70, Math.min(-30, Math.min(noise_floor + 6, integrated - 20))) * 10) / 10
    const trim_filters = trim
      ? `,silenceremove=start_periods=1:start_duration=0:start_threshold=${threshold}dB:start_silence=0.08:detection=rms,areverse,silenceremove=start_periods=1:start_duration=0:start_threshold=${threshold}dB:start_silence=0.12:detection=rms,areverse`
      : ''
    await run('nice', ['-n', '19', 'ffmpeg', '-v', 'error', '-y', '-i', input, '-af', `${mono},volume=${gain}dB${trim_filters}`, '-c:a', 'libmp3lame', '-q:a', '6', '-ar', '32000', output])
    const duration_seconds = Number((await run('ffprobe', ['-v', 'error', '-show_entries', 'format=duration', '-of', 'default=nw=1:nk=1', output])).trim())
    const body = await readFile(output)
    await client.send(new PutObjectCommand({ Bucket: 'livingdictionaries-media', Key: derivative_key, Body: body, ContentType: 'audio/mpeg', CacheControl: 'public, max-age=31536000, immutable' }))
    console.log(`LEDGER\t${derivative_key}\t${body.length}\t${Number.isFinite(duration_seconds) ? Math.round(duration_seconds * 1000) : ''}`)
  } finally { await rm(directory, { recursive: true, force: true }) }
}

let next = 0
let completed = 0
let failed = 0
const started = Date.now()
async function worker() {
  while (next < jobs.length) {
    const job = jobs[next++]
    try {
      await process_key(job)
    } catch (error) {
      failed++
      console.log(`FAIL\t${job.key}\t${String(error.message).replaceAll('\n', ' ').slice(0, 300)}`)
    }
    completed++
    if (completed % 500 === 0) {
      const rate = completed / ((Date.now() - started) / 1000)
      console.error(`[backfill] ${completed}/${jobs.length} (${failed} failed) — ${rate.toFixed(1)}/s, ~${Math.round((jobs.length - completed) / rate / 60)} min left`)
    }
  }
}
await Promise.all(Array.from({ length: workers }, worker))
console.error(`[backfill] DONE ${completed}/${jobs.length}, ${failed} failed, ${Math.round((Date.now() - started) / 60000)} min`)
