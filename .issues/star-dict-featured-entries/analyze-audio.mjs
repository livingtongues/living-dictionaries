import { execFile } from 'node:child_process'
import { promisify } from 'node:util'
import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'

const exec_file = promisify(execFile)

const BUCKET = 'talking-dictionaries-alpha.appspot.com'
const CONCURRENCY = 12

function audio_url(storage_path) {
  return `https://firebasestorage.googleapis.com/v0/b/${BUCKET}/o/${encodeURIComponent(storage_path)}?alt=media`
}

async function analyze_one(candidate, tmp_dir) {
  const file = path.join(tmp_dir, `${candidate.entry_id}.audio`)
  try {
    const url = audio_url(candidate.audio_path)
    await exec_file('curl', ['-sL', '--max-time', '20', '-o', file, url])
    const stat = await fs.stat(file).catch(() => null)
    if (!stat || stat.size < 500)
      return { ...candidate, rejected: 'download_failed_or_empty' }

    const { stdout: dur_out } = await exec_file('ffprobe', ['-v', 'error', '-show_entries', 'format=duration', '-of', 'default=noprint_wrappers=1:nokey=1', file])
    const duration = Number.parseFloat(dur_out.trim())
    if (!Number.isFinite(duration))
      return { ...candidate, rejected: 'no_duration' }

    const { stderr: vol_out } = await exec_file('ffmpeg', ['-i', file, '-af', 'volumedetect', '-f', 'null', '-'])
    const mean_match = vol_out.match(/mean_volume:\s*(-?[\d.]+)\s*dB/)
    const max_match = vol_out.match(/max_volume:\s*(-?[\d.]+)\s*dB/)
    const mean_volume = mean_match ? Number.parseFloat(mean_match[1]) : null
    const max_volume = max_match ? Number.parseFloat(max_match[1]) : null

    return { ...candidate, duration, mean_volume, max_volume }
  } catch (err) {
    return { ...candidate, rejected: `error:${String(err).slice(0, 200)}` }
  } finally {
    await fs.rm(file, { force: true })
  }
}

function score(c) {
  if (c.rejected) return -Infinity
  if (c.duration < 0.3 || c.duration > 25) return -Infinity
  if (c.mean_volume === null || c.max_volume === null) return -Infinity
  if (c.mean_volume < -45) return -Infinity // near silent
  if (c.max_volume < -35) return -Infinity // no real peak at all

  let s = 0
  // duration sweet spot ~0.5-6s
  if (c.duration >= 0.5 && c.duration <= 6) s += 3
  else if (c.duration > 6 && c.duration <= 12) s += 1
  else s -= 1 // very short (<0.5) or very long (12-25)

  // mean volume sweet spot -30..-12 dB (clear, not clipping, not whisper-quiet)
  if (c.mean_volume >= -30 && c.mean_volume <= -12) s += 3
  else if (c.mean_volume >= -40 && c.mean_volume < -30) s += 1
  else s -= 1

  // max volume shouldn't be clipping (0 dB) or too quiet
  if (c.max_volume >= -18 && c.max_volume <= -1) s += 2
  else if (c.max_volume > -1) s -= 1 // possible clipping

  if (c.sentence_count > 0) s += 1
  if (c.phonetic) s += 0.5

  return s
}

async function run_pool(items, worker, concurrency) {
  const results = new Array(items.length)
  let idx = 0
  async function next_worker() {
    while (idx < items.length) {
      const my_idx = idx++
      results[my_idx] = await worker(items[my_idx], my_idx)
    }
  }
  await Promise.all(Array.from({ length: concurrency }, next_worker))
  return results
}

async function main() {
  const harvest = JSON.parse(await fs.readFile(new URL('./harvest.json', import.meta.url), 'utf8'))
  const audio_only_dicts = harvest.filter(d => d.tier === 'audio_only')

  const tmp_dir = await fs.mkdtemp(path.join(os.tmpdir(), 'ld-audio-'))
  console.error(`Analyzing ${audio_only_dicts.length} audio-only dicts, tmp dir ${tmp_dir}`)

  const picks = []
  let dict_num = 0
  for (const dict of audio_only_dicts) {
    dict_num++
    const analyzed = await run_pool(dict.candidates, c => analyze_one(c, tmp_dir), CONCURRENCY)
    const scored = analyzed.map(c => ({ ...c, _score: score(c) })).filter(c => c._score > -Infinity)
    scored.sort((a, b) => b._score - a._score)
    const chosen = scored.slice(0, 3)
    console.error(`[${dict_num}/${audio_only_dicts.length}] ${dict.id}: ${dict.candidates.length} candidates -> ${scored.length} passed -> chose ${chosen.length}`)
    picks.push({
      id: dict.id,
      name: dict.name,
      tier: dict.tier,
      chosen: chosen.map(c => ({ entry_id: c.entry_id, lexeme: c.lexeme, gloss: c.gloss, duration: c.duration, mean_volume: c.mean_volume, max_volume: c.max_volume, score: c._score })),
    })
  }

  await fs.rm(tmp_dir, { recursive: true, force: true })
  await fs.writeFile(new URL('./audio-only-picks.json', import.meta.url), JSON.stringify(picks, null, 2))
  const total_chosen = picks.reduce((s, p) => s + p.chosen.length, 0)
  const zero_chosen = picks.filter(p => p.chosen.length === 0)
  console.error(`Done. ${picks.length} dicts processed, ${total_chosen} entries chosen, ${zero_chosen.length} dicts got 0 (all candidates rejected: ${zero_chosen.map(p => p.id).join(', ')})`)
}

main()
