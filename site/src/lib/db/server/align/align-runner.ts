import { spawn } from 'node:child_process'
import { existsSync } from 'node:fs'
import { resolve } from 'node:path'
import { env } from '$env/dynamic/private'

/**
 * The pluggable aligner backend — one contract, two runtimes (see
 * `alignment/README.md`):
 * - `MODAL_ALIGN_URL` set (prod) → POST to the `ld-forced-aligner` Modal app
 *   with a public R2 `audio_url`.
 * - unset (dev / self-host) → spawn the local CPU CLI
 *   (`alignment/scripts/align_words.py`) with a local `audio_path`.
 */

export interface AlignRunnerWord {
  text: string
  align_form?: string
}

export interface TimestampedWord {
  text: string
  start_ms?: number
  end_ms?: number
}

export type AlignAudioRef = { url: string } | { path: string }

export async function run_alignment({ audio, words }: {
  audio: AlignAudioRef
  words: AlignRunnerWord[]
}): Promise<TimestampedWord[]> {
  if (env.MODAL_ALIGN_URL)
    return await run_modal({ audio, words })
  return await run_local({ audio, words })
}

async function run_modal({ audio, words }: { audio: AlignAudioRef, words: AlignRunnerWord[] }): Promise<TimestampedWord[]> {
  if (!('url' in audio))
    throw new Error('Modal aligner needs a public audio url')
  const response = await fetch(env.MODAL_ALIGN_URL, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ audio_url: audio.url, words }),
  })
  if (!response.ok)
    throw new Error(`Modal aligner failed (${response.status}): ${(await response.text()).slice(0, 500)}`)
  const { timestamped_words } = await response.json() as { timestamped_words: TimestampedWord[] }
  if (!Array.isArray(timestamped_words) || (words.length && !timestamped_words.length))
    throw new Error('Modal aligner returned no words')
  return timestamped_words
}

/** Locate the repo's `alignment/` uv project (cwd is `site/` in dev, repo root in some tools). */
export function local_align_dir(): string {
  if (env.LOCAL_ALIGN_DIR)
    return env.LOCAL_ALIGN_DIR
  for (const candidate of [resolve(process.cwd(), '../alignment'), resolve(process.cwd(), 'alignment')]) {
    if (existsSync(candidate))
      return candidate
  }
  throw new Error('alignment/ project not found — set LOCAL_ALIGN_DIR or MODAL_ALIGN_URL')
}

async function run_local({ audio, words }: { audio: AlignAudioRef, words: AlignRunnerWord[] }): Promise<TimestampedWord[]> {
  const request = 'path' in audio ? { audio_path: audio.path, words } : { audio_url: audio.url, words }
  const stdout = await spawn_json({
    command: 'uv',
    args: ['run', '--extra', 'local', 'scripts/align_words.py'],
    cwd: local_align_dir(),
    stdin: JSON.stringify(request),
  })
  const { timestamped_words } = JSON.parse(stdout) as { timestamped_words: TimestampedWord[] }
  if (!Array.isArray(timestamped_words) || (words.length && !timestamped_words.length))
    throw new Error('Local aligner returned no words')
  return timestamped_words
}

function spawn_json({ command, args, cwd, stdin }: { command: string, args: string[], cwd: string, stdin: string }): Promise<string> {
  return new Promise((resolve_promise, reject) => {
    const child = spawn(command, args, { cwd, stdio: ['pipe', 'pipe', 'pipe'] })
    let stdout = ''
    let stderr = ''
    child.stdout.on('data', (chunk: Buffer) => { stdout += chunk })
    child.stderr.on('data', (chunk: Buffer) => { stderr += chunk })
    child.on('error', reject)
    child.on('close', (code) => {
      if (code === 0)
        resolve_promise(stdout)
      else
        reject(new Error(`local aligner exited ${code}: ${stderr.slice(-500)}`))
    })
    child.stdin.write(stdin)
    child.stdin.end()
  })
}
