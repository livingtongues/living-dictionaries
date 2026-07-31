import { existsSync, readFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, test } from 'vitest'

/**
 * Cross-repo parity guard for the chat attachment-upload pipeline (see PARITY.md).
 * The pipeline is copy-paste-shared between LD and house — NOT a package — so
 * this test is what tells future agents drift from design without hand-diffing:
 *
 *   - `identical` files must match house byte-for-byte.
 *   - `divergent` files intentionally differ — only their existence in both
 *     repos is checked, so a file can't be quietly deleted on one side.
 *
 * It SKIPS GRACEFULLY when ../house isn't checked out (CI), so it never breaks
 * an LD-only build. Keep CHAT_UPLOAD_PARITY + PARITY.md in lockstep.
 */

const LD_SITE_SRC = resolve(dirname(fileURLToPath(import.meta.url)), '../..')
// ../house is a sibling of the living-dictionaries repo under the same parent
// (repos live in ~/code). From here: src→site→living-dictionaries→<parent>.
const HOUSE_SITE_SRC = resolve(LD_SITE_SRC, '../../../house/site/src')
const house_present = existsSync(HOUSE_SITE_SRC)

type ParityStatus = 'identical' | 'divergent'
interface ParityEntry { file: string, status: ParityStatus, reason: string }

/** Source of truth for the parity table — mirrored for humans in PARITY.md. */
const CHAT_UPLOAD_PARITY: ParityEntry[] = [
  { file: 'lib/chat/storage-key.ts', status: 'identical', reason: 'Room-scoped object key format + validation; app-agnostic.' },
  { file: 'lib/chat/chat-upload.ts', status: 'identical', reason: 'Presign → XHR PUT with progress → commit; app-agnostic.' },
  { file: 'lib/chat/chat-upload-progress.svelte', status: 'identical', reason: 'Progress panel; theme vars only.' },
  { file: 'lib/utils/http-range.ts', status: 'identical', reason: 'Range header parser; app-agnostic.' },
  { file: 'lib/utils/paste-files-from-clipboard.ts', status: 'identical', reason: 'Any-file clipboard paste; app-agnostic.' },
  { file: 'lib/components/ui/FileDropZone.svelte', status: 'identical', reason: 'Dropzone + overlay; app-agnostic.' },
  { file: 'lib/r2/attachment-storage.ts', status: 'identical', reason: 'Presign / head / ranged read with dev fallback.' },
  { file: 'routes/api/chat/upload/presign/+server.ts', status: 'identical', reason: 'Same gate + validation in both repos.' },
  { file: 'routes/api/chat/upload/presign/_call.ts', status: 'identical', reason: 'Thin post_request wrapper.' },
  { file: 'routes/api/chat/upload/commit/+server.ts', status: 'identical', reason: 'Same key check + HeadObject + insert.' },
  { file: 'routes/api/chat/upload/commit/_call.ts', status: 'identical', reason: 'Thin post_request wrapper.' },
  { file: 'routes/api/chat/attachments/[id]/+server.ts', status: 'identical', reason: 'Ranged gated serving + SVG-not-inline rule.' },
  { file: 'lib/chat/constants.ts', status: 'divergent', reason: 'Shared upload constants live beside each app\'s own room vocabulary.' },
  { file: 'lib/chat/attachments.ts', status: 'divergent', reason: 'house re-exports is_image_mimetype from $lib/utils.' },
  { file: 'lib/chat/chat-composer.svelte', status: 'divergent', reason: 'Pre-existing divergence (house drafts/bindable html).' },
  { file: 'lib/chat/ChatPage.svelte', status: 'divergent', reason: 'Pre-existing divergence (house drafts, toasts, room vocabulary).' },
  { file: 'lib/chat/chat-message-item.svelte', status: 'divergent', reason: 'Pre-existing divergence (ImageLightbox vs FullscreenImage).' },
  { file: 'routes/api/dev-media/[...path]/+server.ts', status: 'divergent', reason: 'Different media topologies; both take a DEV-only PUT.' },
]

function read(root: string, file: string): string {
  return readFileSync(join(root, file), 'utf8')
}

describe('chat attachment-upload cross-repo parity', () => {
  test.runIf(!house_present)('skips when ../house is not checked out', () => {
    expect(house_present).toBeFalsy()
  })

  for (const entry of CHAT_UPLOAD_PARITY.filter(candidate => candidate.status === 'identical')) {
    test.runIf(house_present)(`matches house byte-for-byte: ${entry.file}`, () => {
      expect(existsSync(join(LD_SITE_SRC, entry.file)), `missing in LD: ${entry.file}`).toBeTruthy()
      expect(existsSync(join(HOUSE_SITE_SRC, entry.file)), `missing in house: ${entry.file}`).toBeTruthy()
      expect(read(HOUSE_SITE_SRC, entry.file), `${entry.file} drifted — ${entry.reason}`).toBe(read(LD_SITE_SRC, entry.file))
    })
  }

  for (const entry of CHAT_UPLOAD_PARITY.filter(candidate => candidate.status === 'divergent')) {
    test.runIf(house_present)(`exists in both repos: ${entry.file}`, () => {
      expect(existsSync(join(LD_SITE_SRC, entry.file)), `missing in LD: ${entry.file}`).toBeTruthy()
      expect(existsSync(join(HOUSE_SITE_SRC, entry.file)), `missing in house: ${entry.file}`).toBeTruthy()
    })
  }

  test.runIf(house_present)('the old single-shot multipart upload endpoint is gone from BOTH repos', () => {
    // Its 20 MB ceiling and whole-file heap buffering are the thing this
    // pipeline replaced; a stray copy would silently keep that path alive.
    for (const root of [LD_SITE_SRC, HOUSE_SITE_SRC])
      expect(existsSync(join(root, 'routes/api/chat/upload/+server.ts'))).toBeFalsy()
  })
})
