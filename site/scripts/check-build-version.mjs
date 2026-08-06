#!/usr/bin/env node
/**
 * Post-build guard: the page shell and the client chunks must carry the SAME
 * `__sveltekit_<hash>` global.
 *
 * SvelteKit djb2-hashes `kit.version.name` into that global name; the SSR'd HTML
 * defines it and the client bundle reads `globalThis.__sveltekit_<hash>.app`. If
 * two config loads inside one build produce two different names, every route
 * serves a BLANK PAGE with HTTP 200 and a
 * `TypeError: Cannot read properties of undefined` in the console. That is a
 * total outage with a green build log — poly.education, 2026-08-03, nine hours.
 *
 * `svelte.config.js` makes the mismatch impossible by deriving the name from the
 * commit. This is the belt to that fix's braces: it costs a directory walk and
 * turns a silent outage into a failed build. Run by `pnpm build` right after
 * `vite build`.
 *
 * THREE independent artifacts have to agree:
 *   1. the CLIENT chunks — the literal `__sveltekit_<hash>` they read;
 *   2. the SERVER bundle — `version_hash: "<hash>"`, which the SSR renderer
 *      interpolates into the shell it prints;
 *   3. `client/_app/version.json` — the string long-lived tabs poll, whose djb2
 *      must BE that hash. Checking it too means the three aren't merely equal,
 *      they're all provably derived from the same version name.
 *
 * …and each of those is checked in its PRECOMPRESSED form too. `adapter-node`
 * writes a `.br` and a `.gz` beside every compressible artifact and serves those
 * to any browser sending `Accept-Encoding` — which is all of them. A mismatch
 * that exists only in the compressed copy is invisible in the plain file and
 * reaches every real person. (Ported from tutor 2026-08-06, after the fleet
 * review measured this guard missing it on two consecutive nights.)
 *
 * The guard also rejects a version NAME that is a bare clock reading, even when
 * every artifact agrees. Such a build passed by luck: the name is SvelteKit's
 * default `Date.now().toString()`, re-read on each of this build's four config
 * loads across three realms, so the next build is the outage.
 *
 * NOT a mismatch, deliberately ignored: `server/index.js` contains the SSR
 * runtime's own source — the template `` `__sveltekit_${options.version_hash}` ``
 * and the literal `globalThis.__sveltekit_sw` used by the service-worker env
 * endpoint. Neither is a build stamp, so only `version_hash: "…"` is read from
 * the server side, and the fixed framework names are excluded by name as well —
 * belt and braces, because `__sveltekit_sw` reaches the CLIENT tree the moment
 * the service worker starts importing `$service-worker`'s `env`.
 *
 * Usage: node scripts/check-build-version.mjs [build_dir]   (default: ../build)
 * The argument exists so the test suite can point it at a synthetic build tree.
 */
import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join, relative, resolve } from 'node:path'
import process from 'node:process'
import { fileURLToPath } from 'node:url'
import { brotliDecompressSync, gunzipSync } from 'node:zlib'

const BUILD_DIR = resolve(process.argv[2] ?? join(fileURLToPath(new URL('..', import.meta.url)), 'build'))
const CLIENT_GLOBAL = /__sveltekit_([a-z0-9]+)/g
const SERVER_HASH = /version_hash: *"([a-z0-9]+)"/g

/**
 * `__sveltekit_<suffix>` globals whose suffix is a FIXED framework name, not a
 * djb2 of `kit.version.name`: `sw` is the service-worker `env` endpoint and
 * `dev` the dev-mode global. Counting either as a stamp rejects a healthy build.
 */
const NON_VERSION_GLOBALS = new Set(['sw', 'dev'])

/**
 * The pre-2026-08-03 shape — SvelteKit's default `kit.version.name`. A build
 * wearing one can agree with itself and still be one scheduling accident from
 * serving a blank page, because the value is re-read on every config load.
 */
const CLOCK_NAME = /^\d{10,}$/

/** SvelteKit's own djb2 (`@sveltejs/kit/src/utils/hash.js`). */
function djb2(value) {
  let hash = 5381
  let index = value.length
  while (index) hash = (hash * 33) ^ value.charCodeAt(--index)
  return (hash >>> 0).toString(36)
}

function* walk(dir) {
  let entries
  try {
    entries = readdirSync(dir)
  } catch {
    return // directory absent — the caller reports it
  }
  for (const name of entries) {
    const path = join(dir, name)
    if (statSync(path).isDirectory())
      yield* walk(path)
    else if (path.endsWith('.js') || path.endsWith('.html'))
      yield path
  }
}

/**
 * The `.br`/`.gz` copies adapter-node writes beside a compressible artifact —
 * the bytes a real browser receives. A stale one ships the wrong stamp to
 * everybody while the plain file next to it looks perfect.
 */
function compressed_siblings(path) {
  const siblings = []
  for (const [suffix, decompress] of [['.br', brotliDecompressSync], ['.gz', gunzipSync]]) {
    try {
      siblings.push({ path: path + suffix, text: decompress(readFileSync(path + suffix)).toString('utf8') })
    } catch {
      // absent (not precompressed) or unreadable — nothing to compare
    }
  }
  return siblings
}

/** hash → the first few files it appeared in, for a useful error. */
function collect({ dir, pattern, skip_fixed_names = false }) {
  const found = new Map()
  const record = (text, path) => {
    for (const [, hash] of text.matchAll(pattern)) {
      if (skip_fixed_names && NON_VERSION_GLOBALS.has(hash))
        continue
      const files = found.get(hash) ?? []
      if (files.length < 3 && !files.includes(path))
        files.push(path)
      found.set(hash, files)
    }
  }
  for (const path of walk(join(BUILD_DIR, dir))) {
    record(readFileSync(path, 'utf8'), path)
    for (const sibling of compressed_siblings(path))
      record(sibling.text, sibling.path)
  }
  return found
}

function fail(lines) {
  console.error(`\n\x1B[31m✗ build version check failed\x1B[0m\n${lines.join('\n')}\n`)
  process.exit(1)
}

const client = collect({ dir: 'client', pattern: CLIENT_GLOBAL, skip_fixed_names: true })
const server = collect({ dir: 'server', pattern: SERVER_HASH })
const all = new Map([...client, ...server])

if (!client.size || !server.size)
  fail([`No build stamp found (client: ${client.size}, server: ${server.size}) — did the build produce output in site/build?`])

if (all.size > 1) {
  fail([
    `${all.size} DIFFERENT build version stamps in one build — the page shell and its`,
    'JavaScript will not recognise each other and every route will render blank (HTTP 200).',
    '',
    ...[...all].map(([hash, files]) => `  ${hash}  ${files.map(file => relative(BUILD_DIR, file)).join(', ')}`),
    '',
    'Cause: `kit.version.name` was not constant across config loads. See svelte.config.js.',
  ])
}

const [hash] = [...all.keys()]

const version_file = join(BUILD_DIR, 'client/_app/version.json')
let version
try {
  ({ version } = JSON.parse(readFileSync(version_file, 'utf8')))
} catch (error) {
  fail([`Could not read build/client/_app/version.json: ${error.message}`])
}

if (CLOCK_NAME.test(version)) {
  fail([
    `kit.version.name is a bare clock reading ("${version}") — every artifact agrees, so this`,
    'build passed by luck. That value is SvelteKit\'s default and is re-read on each of this',
    'build\'s four config loads across three realms (vite build, postbuild/analyse,',
    'postbuild/prerender), which share process.env but not globalThis. Derive the name from',
    'the commit instead — see resolve_version_name() in svelte.config.js.',
  ])
}

for (const sibling of compressed_siblings(version_file)) {
  let compressed_version
  try {
    ({ version: compressed_version } = JSON.parse(sibling.text))
  } catch (error) {
    fail([`${relative(BUILD_DIR, sibling.path)} is not readable JSON: ${error.message}`])
  }
  if (compressed_version !== version) {
    fail([
      `${relative(BUILD_DIR, sibling.path)} says version "${compressed_version}" but version.json says "${version}".`,
      'Long-lived tabs poll this file for a changed string; the compressed copy is what they receive.',
    ])
  }
}

if (djb2(version) !== hash) {
  fail([
    `version.json says "${version}" (djb2 → ${djb2(version)}) but the bundle carries ${hash}.`,
    'The polled version file and the running code disagree about which build this is.',
  ])
}

console.info(`✓ build version check: one stamp — __sveltekit_${hash} = djb2("${version}"), including the .br/.gz copies`)
