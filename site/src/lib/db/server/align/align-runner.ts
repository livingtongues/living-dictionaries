import type { ChildProcess } from 'node:child_process'
import { spawn } from 'node:child_process'
import { existsSync } from 'node:fs'
import process from 'node:process'
import { resolve } from 'node:path'
import { env } from '$env/dynamic/private'
import { ALIGN_EXECUTION_DEADLINE_MS } from '$lib/constants'

/**
 * The pluggable aligner backend — one contract, two runtimes (see
 * `alignment/README.md`):
 * - `MODAL_ALIGN_URL` set (prod) → POST to the `ld-forced-aligner` Modal app
 *   with a public R2 `audio_url`.
 * - unset (dev / self-host) → spawn the local CPU CLI
 *   (`alignment/scripts/align_words.py`) with a local `audio_path`.
 *
 * BOTH runtimes are bounded by `ALIGN_EXECUTION_DEADLINE_MS` so a stalled
 * network call or a wedged subprocess can never own an align_jobs row forever
 * (`align-job.ts` sweeps rows whose owner outlived that bound). In dev the very
 * first local run downloads the ~1.2 GB MMS_FA checkpoint — pre-warm it by
 * running `scripts/align_words.py` once by hand rather than through a job.
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

export async function run_alignment({ audio, words, timeout_ms = ALIGN_EXECUTION_DEADLINE_MS }: {
  audio: AlignAudioRef
  words: AlignRunnerWord[]
  /** Override the execution deadline — tests only. */
  timeout_ms?: number
}): Promise<TimestampedWord[]> {
  if (env.MODAL_ALIGN_URL)
    return await run_modal({ audio, words, timeout_ms })
  return await run_local({ audio, words, timeout_ms })
}

async function run_modal({ audio, words, timeout_ms }: { audio: AlignAudioRef, words: AlignRunnerWord[], timeout_ms: number }): Promise<TimestampedWord[]> {
  if (!('url' in audio))
    throw new Error('Modal aligner needs a public audio url')
  // One signal covers the request AND the body read — a Modal container that
  // accepts the POST and then hangs mid-response is just as fatal as one that
  // never answers.
  const signal = AbortSignal.timeout(timeout_ms)
  try {
    const response = await fetch(env.MODAL_ALIGN_URL, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ audio_url: audio.url, words }),
      signal,
    })
    if (!response.ok)
      throw new Error(`Modal aligner failed (${response.status}): ${(await response.text()).slice(0, 500)}`)
    const { timestamped_words } = await response.json() as { timestamped_words: TimestampedWord[] }
    if (!Array.isArray(timestamped_words) || (words.length && !timestamped_words.length))
      throw new Error('Modal aligner returned no words')
    return timestamped_words
  } catch (err) {
    if (signal.aborted || (err as Error).name === 'TimeoutError' || (err as Error).name === 'AbortError')
      throw Object.assign(new Error(`Modal aligner timed out after ${Math.round(timeout_ms / 1000)}s`), { cause: err })
    throw err
  }
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

async function run_local({ audio, words, timeout_ms }: { audio: AlignAudioRef, words: AlignRunnerWord[], timeout_ms: number }): Promise<TimestampedWord[]> {
  const request = 'path' in audio ? { audio_path: audio.path, words } : { audio_url: audio.url, words }
  const stdout = await spawn_json({
    command: 'uv',
    args: ['run', '--extra', 'local', 'scripts/align_words.py'],
    cwd: local_align_dir(),
    stdin: JSON.stringify(request),
    timeout_ms,
  })
  const { timestamped_words } = JSON.parse(stdout) as { timestamped_words: TimestampedWord[] }
  if (!Array.isArray(timestamped_words) || (words.length && !timestamped_words.length))
    throw new Error('Local aligner returned no words')
  return timestamped_words
}

/**
 * Run a child process to completion, rejecting (and SIGKILLing it) at
 * `timeout_ms` — a python aligner that wedges on a model download or a corrupt
 * audio file must not outlive its job row. `detached` puts the child in its own
 * process group so the kill reaches the whole `uv run` → python tree instead of
 * orphaning the compute-heavy grandchild. Exported for lifecycle tests.
 */
export function spawn_json({ command, args, cwd, stdin, timeout_ms = ALIGN_EXECUTION_DEADLINE_MS }: { command: string, args: string[], cwd: string, stdin: string, timeout_ms?: number }): Promise<string> {
  return new Promise((resolve_promise, reject) => {
    const child = spawn(command, args, { cwd, stdio: ['pipe', 'pipe', 'pipe'], detached: true })
    let stdout = ''
    let stderr = ''
    let timed_out = false
    const timer = setTimeout(() => {
      timed_out = true
      kill_process_tree(child)
      reject(new Error(`local aligner timed out after ${Math.round(timeout_ms / 1000)}s`))
    }, timeout_ms)
    const settle = (finish: () => void) => {
      clearTimeout(timer)
      if (!timed_out)
        finish()
    }
    child.stdout.on('data', (chunk: Buffer) => { stdout += chunk })
    child.stderr.on('data', (chunk: Buffer) => { stderr += chunk })
    child.on('error', err => settle(() => reject(err)))
    child.on('close', (code) => {
      settle(() => {
        if (code === 0)
          resolve_promise(stdout)
        else
          reject(new Error(`local aligner exited ${code}: ${stderr.slice(-500)}`))
      })
    })
    child.stdin.on('error', () => { /* the child may exit before stdin drains */ })
    child.stdin.write(stdin)
    child.stdin.end()
  })
}

function kill_process_tree(child: ChildProcess): void {
  try {
    if (child.pid)
      process.kill(-child.pid, 'SIGKILL')
  } catch {
    child.kill('SIGKILL')
  }
}
