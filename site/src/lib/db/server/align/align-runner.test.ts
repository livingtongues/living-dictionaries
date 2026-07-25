import { execFileSync } from 'node:child_process'
import process from 'node:process'
import { afterEach, describe, expect, test } from 'vitest'
import { run_alignment, spawn_json } from './align-runner'

/**
 * Both aligner backends must give up — and let go of the machine — instead of
 * owning an align_jobs row forever (the July 24 review's B1 wedge).
 */

const original_fetch = globalThis.fetch
const original_modal_url = process.env.MODAL_ALIGN_URL

afterEach(() => {
  globalThis.fetch = original_fetch
  if (original_modal_url === undefined)
    delete process.env.MODAL_ALIGN_URL
  else
    process.env.MODAL_ALIGN_URL = original_modal_url
})

describe(spawn_json, () => {
  test('a hung subprocess rejects at the deadline and its whole tree is killed', async () => {
    // Nested like the real `uv run` → python tree: killing only the direct
    // child would orphan the marked grandchild and leave it burning CPU.
    const marker = `ld-align-test-${Date.now()}`

    await expect(spawn_json({
      command: 'sh',
      args: ['-c', `sh -c 'sleep 30 # ${marker}'; true`],
      cwd: process.cwd(),
      stdin: '{}',
      timeout_ms: 200,
    })).rejects.toThrow(/timed out/)

    await new Promise(resolve => setTimeout(resolve, 100))
    expect(find_processes(marker)).toEqual([])
  })

  test('a normal run still resolves with stdout', async () => {
    const stdout = await spawn_json({
      command: 'cat',
      args: [],
      cwd: process.cwd(),
      stdin: '{"timestamped_words":[]}',
      timeout_ms: 5000,
    })
    expect(stdout).toBe('{"timestamped_words":[]}')
  })

  test('a failing run rejects with the exit code and stderr', async () => {
    await expect(spawn_json({
      command: 'sh',
      args: ['-c', 'echo boom >&2; exit 3'],
      cwd: process.cwd(),
      stdin: '{}',
      timeout_ms: 5000,
    })).rejects.toThrow(/exited 3: boom/)
  })
})

describe(run_alignment, () => {
  test('a remote aligner that never answers rejects at the deadline', async () => {
    process.env.MODAL_ALIGN_URL = 'https://aligner.example/align'
    let seen_signal: AbortSignal | undefined
    // Mirrors real fetch: the request stays pending until the signal aborts.
    globalThis.fetch = ((_url: string, init: RequestInit) => {
      seen_signal = init.signal ?? undefined
      return new Promise((_resolve, reject) => {
        init.signal?.addEventListener('abort', () => reject(init.signal?.reason))
      })
    }) as typeof fetch

    await expect(run_alignment({ audio: { url: 'https://media.example/a.mp3' }, words: [{ text: 'hi' }], timeout_ms: 150 })).rejects.toThrow(/timed out after/)
    expect(seen_signal?.aborted).toBeTruthy()
  })

  test('a remote aligner that hangs mid-response body also rejects', async () => {
    process.env.MODAL_ALIGN_URL = 'https://aligner.example/align'
    globalThis.fetch = ((_url: string, init: RequestInit) => Promise.resolve({
      ok: true,
      status: 200,
      json: () => new Promise((_resolve, reject) => {
        init.signal?.addEventListener('abort', () => reject(init.signal?.reason))
      }),
    } as unknown as Response)) as typeof fetch

    await expect(run_alignment({ audio: { url: 'https://media.example/a.mp3' }, words: [{ text: 'hi' }], timeout_ms: 150 })).rejects.toThrow(/timed out after/)
  })
})

function find_processes(marker: string): string[] {
  try {
    return execFileSync('pgrep', ['-f', marker], { encoding: 'utf8' }).trim().split('\n').filter(Boolean)
  } catch {
    return [] // pgrep exits 1 when nothing matches
  }
}
