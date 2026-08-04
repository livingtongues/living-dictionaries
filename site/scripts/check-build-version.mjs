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
 * NOT a mismatch, deliberately ignored: `server/index.js` contains the SSR
 * runtime's own source — the template `` `__sveltekit_${options.version_hash}` ``
 * and the literal `globalThis.__sveltekit_sw` used by the service-worker env
 * endpoint. Neither is a build stamp, so only `version_hash: "…"` is read from
 * the server side.
 */
import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join } from 'node:path'
import process from 'node:process'
import { fileURLToPath } from 'node:url'

const BUILD_DIR = join(fileURLToPath(new URL('..', import.meta.url)), 'build')
const CLIENT_GLOBAL = /__sveltekit_([a-z0-9]+)/g
const SERVER_HASH = /version_hash: *"([a-z0-9]+)"/g

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

/** hash → the first few files it appeared in, for a useful error. */
function collect({ dir, pattern }) {
  const found = new Map()
  for (const path of walk(join(BUILD_DIR, dir))) {
    for (const [, hash] of readFileSync(path, 'utf8').matchAll(pattern)) {
      const files = found.get(hash) ?? []
      if (files.length < 3 && !files.includes(path))
        files.push(path)
      found.set(hash, files)
    }
  }
  return found
}

function fail(lines) {
  console.error(`\n[31m✗ build version check failed[0m\n${lines.join('\n')}\n`)
  process.exit(1)
}

const client = collect({ dir: 'client', pattern: CLIENT_GLOBAL })
const server = collect({ dir: 'server', pattern: SERVER_HASH })
const all = new Map([...client, ...server])

if (!client.size || !server.size)
  fail([`No build stamp found (client: ${client.size}, server: ${server.size}) — did the build produce output in site/build?`])

if (all.size > 1) {
  fail([
    `${all.size} DIFFERENT build version stamps in one build — the page shell and its`,
    'JavaScript will not recognise each other and every route will render blank (HTTP 200).',
    '',
    ...[...all].map(([hash, files]) => `  ${hash}  ${files.map(file => file.slice(BUILD_DIR.length + 1)).join(', ')}`),
    '',
    'Cause: `kit.version.name` was not constant across config loads. See svelte.config.js.',
  ])
}

const [hash] = [...all.keys()]

let version
try {
  ({ version } = JSON.parse(readFileSync(join(BUILD_DIR, 'client/_app/version.json'), 'utf8')))
} catch (error) {
  fail([`Could not read build/client/_app/version.json: ${error.message}`])
}

if (djb2(version) !== hash) {
  fail([
    `version.json says "${version}" (djb2 → ${djb2(version)}) but the bundle carries ${hash}.`,
    'The polled version file and the running code disagree about which build this is.',
  ])
}

console.info(`✓ build version check: one stamp — __sveltekit_${hash} = djb2("${version}")`)
