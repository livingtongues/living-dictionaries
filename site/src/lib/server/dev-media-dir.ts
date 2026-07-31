import { existsSync, mkdirSync, readFileSync, statSync, unlinkSync, writeFileSync } from 'node:fs'
import { dirname, join, resolve, sep } from 'node:path'
import process from 'node:process'

/**
 * Root of the DEV-only local media store (`<DATA_DIR>/dev-media`). Shared by the
 * `api/dev-media/[...path]` route (GET/PUT) and the server-side media-storage
 * helper (v1 media uploads) so both agree on where dev bytes live. Never used in
 * prod (guarded by `import.meta.env.DEV` at each call site).
 */
export function dev_media_dir(): string {
  return join(process.env.DATA_DIR || '.data', 'dev-media')
}

function dev_media_path({ key }: { key: string }): string {
  const root = resolve(dev_media_dir())
  const full = resolve(root, key)
  if (!full.startsWith(`${root}${sep}`))
    throw new Error('Invalid dev-media key')
  return full
}

/** Idempotently remove one object from the local DEV-only media store. */
export function delete_dev_media({ key }: { key: string }): boolean {
  const full = dev_media_path({ key })
  if (!existsSync(full))
    return false
  unlinkSync(full)
  return true
}

/** Write bytes into the local DEV-only media store, creating parent folders. */
export function write_dev_media({ key, content }: { key: string, content: Buffer | string }): void {
  const full = dev_media_path({ key })
  mkdirSync(dirname(full), { recursive: true })
  writeFileSync(full, content)
}

/** Read bytes back out of the local DEV-only media store, or null when absent. */
export function read_dev_media({ key }: { key: string }): Buffer | null {
  const full = dev_media_path({ key })
  return existsSync(full) ? readFileSync(full) : null
}

/** Byte size of one object in the local DEV-only store, or null when absent — the dev stand-in for HeadObject. */
export function dev_media_size({ key }: { key: string }): number | null {
  const full = dev_media_path({ key })
  return existsSync(full) ? statSync(full).size : null
}

if (import.meta.vitest) {
  test('delete_dev_media removes bytes and is idempotent', async () => {
    const { mkdtempSync, rmSync } = await import('node:fs')
    const { tmpdir } = await import('node:os')
    const test_data_dir = mkdtempSync(join(tmpdir(), 'ld-dev-media-'))
    const previous_data_dir = process.env.DATA_DIR
    process.env.DATA_DIR = test_data_dir
    try {
      const key = 'import/demo/file-1'
      const full = join(dev_media_dir(), key)
      write_dev_media({ key, content: 'bytes' })
      expect(read_dev_media({ key })?.toString()).toBe('bytes')
      expect(delete_dev_media({ key })).toBe(true)
      expect(existsSync(full)).toBe(false)
      expect(read_dev_media({ key })).toBe(null)
      expect(delete_dev_media({ key })).toBe(false)
      expect(() => delete_dev_media({ key: '../outside' })).toThrow('Invalid dev-media key')
    } finally {
      if (previous_data_dir === undefined)
        delete process.env.DATA_DIR
      else
        process.env.DATA_DIR = previous_data_dir
      rmSync(test_data_dir, { recursive: true, force: true })
    }
  })
}
