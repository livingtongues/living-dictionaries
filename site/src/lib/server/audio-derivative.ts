import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { spawn } from 'node:child_process'
import { GetObjectCommand } from '@aws-sdk/client-s3'
import { record_media_object_by_key } from '$lib/db/server/media-ledger'
import { audio_playback_key } from '$lib/utils/media-path'
import { read_dev_media } from './dev-media-dir'
import { store_media_bytes } from './media-storage'
import { get_r2_media, r2_media_is_configured } from './r2-media'

export interface AudioMeasurements { integrated_lufs: number, sample_peak_dbfs: number, noise_floor_db: number }

export function normalize_audio_measurements(values: Partial<AudioMeasurements>): AudioMeasurements {
  const finite_or = (value: number | undefined, fallback: number) => Number.isFinite(value) ? value : fallback
  return {
    integrated_lufs: finite_or(values.integrated_lufs, -20),
    sample_peak_dbfs: finite_or(values.sample_peak_dbfs, -1),
    noise_floor_db: finite_or(values.noise_floor_db, -70),
  }
}

export function audio_derivative_settings(values: Partial<AudioMeasurements>): { gain_db: number, trim_threshold_db: number } {
  const { integrated_lufs, sample_peak_dbfs, noise_floor_db } = normalize_audio_measurements(values)
  return {
    gain_db: Math.round(Math.min(-16 - integrated_lufs, -1 - sample_peak_dbfs) * 100) / 100,
    trim_threshold_db: Math.round(Math.max(-70, Math.min(-30, Math.min(noise_floor_db + 6, integrated_lufs - 20))) * 10) / 10,
  }
}

export function audio_derivative_should_trim({ trim_hint, sentence_id, text_id, timings }: {
  trim_hint: boolean
  sentence_id?: string | null
  text_id?: string | null
  timings?: unknown
}): boolean {
  return trim_hint && !sentence_id && !text_id && !timings
}

function run_ffmpeg(args: string[]): Promise<string> {
  return new Promise((resolve, reject) => {
    const child = spawn('nice', ['-n', '19', 'ffmpeg', ...args], { stdio: ['ignore', 'ignore', 'pipe'] })
    let stderr = ''
    child.stderr.on('data', chunk => stderr += chunk)
    child.on('error', reject)
    child.on('close', code => code === 0 ? resolve(stderr) : reject(new Error(`ffmpeg exited ${code}: ${stderr.slice(-1000)}`)))
  })
}

function probe_duration_ms(path: string): Promise<number | null> {
  return new Promise((resolve) => {
    const child = spawn('ffprobe', ['-v', 'error', '-show_entries', 'format=duration', '-of', 'default=nw=1:nk=1', path], { stdio: ['ignore', 'pipe', 'ignore'] })
    let stdout = ''
    child.stdout.on('data', chunk => stdout += chunk)
    child.on('error', () => resolve(null))
    child.on('close', (code) => {
      const seconds = Number(stdout.trim())
      resolve(code === 0 && Number.isFinite(seconds) ? Math.round(seconds * 1000) : null)
    })
  })
}

export function ffmpeg_metric(output: string, label: string): number | undefined {
  const lines = output.split('\n').filter(line => line.includes(label))
  const line = lines[lines.length - 1]
  const suffix = line?.slice((line.lastIndexOf(label)) + label.length).trimStart()
  const value = suffix?.startsWith(':') ? suffix.slice(1).trimStart() : suffix
  const match = value?.match(/^(-?inf|nan|-?\d+(?:\.\d+)?)/i)
  return match ? Number(match[1]) : undefined
}

async function source_bytes(original_key: string): Promise<Uint8Array> {
  if (!r2_media_is_configured()) {
    const bytes = read_dev_media({ key: original_key })
    if (!bytes) throw new Error(`dev media missing: ${original_key}`)
    return bytes
  }
  const { client, bucket } = get_r2_media()
  const object = await client.send(new GetObjectCommand({ Bucket: bucket, Key: original_key }))
  return new Uint8Array(await object.Body.transformToByteArray())
}

export async function generate_and_store_audio_derivative({ original_key, trim }: { original_key: string, trim: boolean }): Promise<string> {
  const directory = await mkdtemp(join(tmpdir(), 'ld-audio-'))
  const input = join(directory, 'input')
  const output = join(directory, 'output.mp3')
  try {
    await writeFile(input, await source_bytes(original_key))
    const mono = 'aformat=channel_layouts=mono'
    const loudness = await run_ffmpeg(['-hide_banner', '-nostats', '-i', input, '-af', `${mono},ebur128=peak=true`, '-f', 'null', '-'])
    const peak = await run_ffmpeg(['-hide_banner', '-nostats', '-i', input, '-af', `${mono},astats=measure_perchannel=none:measure_overall=Peak_level+Noise_floor`, '-f', 'null', '-'])
    const settings = audio_derivative_settings({
      integrated_lufs: ffmpeg_metric(loudness, 'I:'),
      sample_peak_dbfs: ffmpeg_metric(peak, 'Peak level dB'),
      noise_floor_db: ffmpeg_metric(peak, 'Noise floor dB'),
    })
    const trim_filters = trim
      ? `,silenceremove=start_periods=1:start_duration=0:start_threshold=${settings.trim_threshold_db}dB:start_silence=0.08:detection=rms,areverse,silenceremove=start_periods=1:start_duration=0:start_threshold=${settings.trim_threshold_db}dB:start_silence=0.12:detection=rms,areverse`
      : ''
    await run_ffmpeg(['-v', 'error', '-y', '-i', input, '-af', `${mono},volume=${settings.gain_db}dB${trim_filters}`, '-c:a', 'libmp3lame', '-q:a', '6', '-ar', '32000', output])
    const bytes = new Uint8Array(await readFile(output))
    const duration_ms = await probe_duration_ms(output)
    const key = audio_playback_key({ original_key })
    await store_media_bytes({ file_type: 'audio/mpeg', bytes, r2_key: key })
    record_media_object_by_key({ key, bytes: bytes.length, duration_ms })
    return key
  } finally {
    await rm(directory, { recursive: true, force: true })
  }
}

const pending: { original_key: string, trim: boolean }[] = []
let running = 0
const MAX_CONCURRENCY = 2
const MAX_PENDING = 40

function drain(): void {
  while (running < MAX_CONCURRENCY && pending.length) {
    const job = pending.shift()
    if (!job) return
    running++
    void generate_and_store_audio_derivative(job)
      .catch(error => console.error(`[audio-derivative] ${job.original_key}:`, error))
      .finally(() => { running--; drain() })
  }
}

export function store_audio_derivative_in_background(job: { original_key: string, trim: boolean }): boolean {
  if (pending.length >= MAX_PENDING) return false
  pending.push(job)
  drain()
  return true
}

if (import.meta.vitest) {
  test(audio_derivative_settings, () => {
    expect(audio_derivative_settings({ integrated_lufs: -30, sample_peak_dbfs: -5, noise_floor_db: -60 })).toEqual({ gain_db: 4, trim_threshold_db: -54 })
    expect(audio_derivative_settings({ integrated_lufs: -10, sample_peak_dbfs: -3, noise_floor_db: -20 })).toEqual({ gain_db: -6, trim_threshold_db: -30 })
    expect(audio_derivative_settings({ integrated_lufs: Number.NaN, sample_peak_dbfs: Infinity, noise_floor_db: -Infinity })).toEqual({ gain_db: 0, trim_threshold_db: -64 })
  })
  test(audio_derivative_should_trim, () => {
    expect(audio_derivative_should_trim({ trim_hint: true })).toBe(true)
    expect(audio_derivative_should_trim({ trim_hint: true, text_id: 't' })).toBe(false)
    expect(audio_derivative_should_trim({ trim_hint: true, sentence_id: 's' })).toBe(false)
    expect(audio_derivative_should_trim({ trim_hint: true, timings: { s: '1,2' } })).toBe(false)
  })
  test(ffmpeg_metric, () => {
    const stderr = `
[Parsed_ebur128_1 @ 0x1] Summary:

  Integrated loudness:
    I:         -21.8 LUFS
[Parsed_astats_1 @ 0x2] Peak level dB: -3.442119
[Parsed_astats_1 @ 0x2] Noise floor dB: -67.201172
`
    expect(ffmpeg_metric(stderr, 'I:')).toBe(-21.8)
    expect(ffmpeg_metric(stderr, 'Peak level dB')).toBe(-3.442119)
    expect(ffmpeg_metric(stderr, 'Noise floor dB')).toBe(-67.201172)
  })
}
