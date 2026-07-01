import { join } from 'node:path'
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
