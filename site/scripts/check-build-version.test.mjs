/**
 * The broken-build matrix for `check-build-version.mjs`.
 *
 * Seven synthetic build trees — one healthy, six broken in a different way — are
 * written to a temp dir and the guard is spawned against each exactly as
 * `pnpm build` spawns it. Testing it any other way would test a refactor of the
 * guard rather than the guard: what ships is a script that walks bytes on disk
 * and sets an exit code.
 *
 * The matrix comes from the 2026-08-04 fleet review, which built these trees in
 * /tmp, ran all three sibling repos' guards against them, and measured that each
 * guard was missing a different row. This repo was missing rows 5 and 6, on two
 * consecutive nights. Committing the matrix is what stops that drifting again.
 *
 * Scenario 1 also covers the compound `<sha>-<BUILD_ID>` build name this repo
 * adopted on 2026-08-06 so that two builds of one commit stop colliding: the
 * guard must accept it exactly as it accepts a bare sha.
 */

import { execFileSync } from 'node:child_process'
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import process from 'node:process'
import { fileURLToPath } from 'node:url'
import { brotliCompressSync, gzipSync } from 'node:zlib'

const GUARD = fileURLToPath(new URL('./check-build-version.mjs', import.meta.url))
/** A real commit sha — what `kit.version.name` carries since 2026-08-04. */
const COMMIT = 'b4b47e55ac6c866e5c9bcb91d7ea18234d5642e2'
/** The shape since 2026-08-06: commit plus a per-build discriminator. */
const COMPOUND = `${COMMIT}-20260805144153`
/** The pre-2026-08-04 shape: SvelteKit's default `Date.now().toString()`. */
const CLOCK = '1783526000580'

/** SvelteKit's djb2 (`src/utils/hash.js`) — kept independent of the guard's copy. */
function djb2(value) {
  let hash = 5381
  let index = value.length
  while (index) hash = (hash * 33) ^ value.charCodeAt(--index)
  return (hash >>> 0).toString(36)
}

/**
 * Write `text` to `path`, plus the `.br`/`.gz` siblings adapter-node emits.
 * `compressed_text` lets a scenario make the compressed copy disagree with the
 * plain one — the shape a browser sending `Accept-Encoding` actually receives.
 */
function emit(path, text, { precompress = true, compressed_text } = {}) {
  mkdirSync(dirname(path), { recursive: true })
  writeFileSync(path, text)
  if (!precompress)
    return
  const compressed = compressed_text ?? text
  writeFileSync(`${path}.br`, brotliCompressSync(Buffer.from(compressed)))
  writeFileSync(`${path}.gz`, gzipSync(Buffer.from(compressed)))
}

/**
 * A minimal but faithful `adapter-node` build tree: the three artifacts that
 * have to agree (client chunks, server bundle, polled version file) plus their
 * precompressed siblings.
 */
function write_build(root, options = {}) {
  const {
    version = COMMIT,
    client_stamp = djb2(version),
    server_stamp = djb2(version),
    compressed_client_stamp,
    sveltekit_sw = false,
    stamps_renamed = false,
  } = options

  const client_chunk = stamps_renamed
    ? 'const app = globalThis.__svelte_build_id_9.app;\n'
    : `const app = globalThis.__sveltekit_${client_stamp}.app;\n`
  const compressed_chunk = compressed_client_stamp === undefined
    ? undefined
    : `const app = globalThis.__sveltekit_${compressed_client_stamp}.app;\n`

  emit(join(root, 'client/_app/version.json'), JSON.stringify({ version }))
  emit(join(root, 'client/_app/immutable/entry/start.8WGNJpXX.js'), client_chunk, { compressed_text: compressed_chunk })
  emit(join(root, 'client/_app/immutable/nodes/9.CsDktvmt.js'), client_chunk)

  if (sveltekit_sw) {
    // @sveltejs/kit >= 2.58 injects this into the CLIENT service worker as soon
    // as the app imports `$service-worker`'s `env`
    // (`src/exports/vite/build/build_service_worker.js`). This tree is the one
    // this guard scans for client globals, so a healthy build lands the fixed
    // name right where a naive scan would call it a second build stamp.
    emit(join(root, 'client/service-worker.js'), 'importScripts("/_app/env.script.js"); const env = globalThis.__sveltekit_sw.env;\n')
  }

  const server_lines = [
    stamps_renamed
      ? 'const options = { build_id: "renamed" };\n'
      : `const options = { version_hash: "${server_stamp}" };\n`,
    // The SSR runtime's own source is in this file in every real build; the
    // template below is not a stamp and must never be counted as one.
    // eslint-disable-next-line no-template-curly-in-string
    'const shell = `<script>globalThis.__sveltekit_${options.version_hash} = {};</script>`;\n',
  ]
  if (sveltekit_sw) {
    // eslint-disable-next-line no-template-curly-in-string
    server_lines.push('return new Response(`globalThis.__sveltekit_sw={env:${payload}}`, { headers });\n')
  }
  emit(join(root, 'server/index.js'), server_lines.join(''), { precompress: false })
  emit(join(root, 'index.js'), 'import "./server/index.js";\n', { precompress: false })
}

function run_guard(build_dir) {
  try {
    const stdout = execFileSync(process.execPath, [GUARD, build_dir], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] })
    return { status: 0, output: stdout }
  } catch (error) {
    return { status: error.status ?? 1, output: `${error.stdout ?? ''}${error.stderr ?? ''}` }
  }
}

describe('check-build-version — the broken-build matrix', () => {
  let root
  beforeEach(() => {
    root = mkdtempSync(join(tmpdir(), 'build-version-'))
  })
  afterEach(() => {
    rmSync(root, { recursive: true, force: true })
  })

  test('1. accepts a healthy build', () => {
    write_build(root)
    const { status, output } = run_guard(root)
    expect({ status, output }).toMatchObject({ status: 0 })
    expect(output).toContain(`__sveltekit_${djb2(COMMIT)}`)
  })

  test('1b. accepts the compound `<sha>-<BUILD_ID>` name', () => {
    // Adopted 2026-08-06 so two builds of ONE commit stop wearing one name.
    // It is still one constant string per build, so the guard's contract is
    // unchanged — but it has to actually accept it.
    write_build(root, { version: COMPOUND })
    const { status, output } = run_guard(root)
    expect({ status, output }).toMatchObject({ status: 0 })
    expect(output).toContain(COMPOUND)
  })

  test('2. rejects a client and a server that name different stamps — the outage that actually happened', () => {
    write_build(root, { server_stamp: djb2('a-different-commit') })
    const { status, output } = run_guard(root)
    expect(status).toBe(1)
    expect(output).toContain('DIFFERENT build version stamps')
  })

  test('3. rejects a polled version file that disagrees with the bundle', () => {
    // Every artifact agrees with itself, but version.json names a build whose
    // djb2 is not the stamp the bundle carries — long-lived tabs would poll a
    // string that no longer describes the code they are running.
    write_build(root, { client_stamp: djb2('some-other-commit'), server_stamp: djb2('some-other-commit') })
    const { status, output } = run_guard(root)
    expect(status).toBe(1)
    expect(output).toContain('disagree about which build this is')
  })

  test('4. rejects a build where the framework renamed both stamps, so the guard can see nothing', () => {
    // A vacuous pass is the failure mode that matters most for a guard: if a kit
    // upgrade changes how either stamp is emitted, finding nothing must FAIL.
    write_build(root, { stamps_renamed: true })
    const { status, output } = run_guard(root)
    expect(status).toBe(1)
    expect(output).toContain('No build stamp found')
  })

  test('5. rejects a mismatch that exists ONLY in the precompressed copy', () => {
    // The plain file is perfect. Every browser that sends `Accept-Encoding: br`
    // — i.e. all of them — gets the broken one.
    write_build(root, { compressed_client_stamp: djb2('a-stale-commit') })
    const { status, output } = run_guard(root)
    expect(status).toBe(1)
    expect(output).toContain('.br')
  })

  test('6. rejects a bare clock version name even though every artifact agrees', () => {
    // This build passes every equality check — by luck. `kit.version.name` is
    // re-read on each of this build's four config loads, so the next build with
    // this scheme is the blank-page outage.
    write_build(root, { version: CLOCK })
    const { status, output } = run_guard(root)
    expect(status).toBe(1)
    expect(output).toContain('bare clock reading')
  })

  test('7. accepts a healthy build carrying the framework\'s fixed __sveltekit_sw global', () => {
    write_build(root, { sveltekit_sw: true })
    const { status, output } = run_guard(root)
    expect({ status, output }).toMatchObject({ status: 0 })
  })
})
