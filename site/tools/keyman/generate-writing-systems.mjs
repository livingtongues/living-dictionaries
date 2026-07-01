#!/usr/bin/env node
// Re-runnable: transform the Keyman keyboard catalog into a MINIMAL writing-systems
// map used by the orthography picker + Keyman auto-load.
//
//   node site/tools/keyman/generate-writing-systems.mjs          # from the vendored complete catalog (2204 tags)
//   node site/tools/keyman/generate-writing-systems.mjs --fetch  # from the live cloud API (curated ~533 tags)
//   node site/tools/keyman/generate-writing-systems.mjs some.json
//
// The live `cloud/4.0/keyboards` endpoint returns only Keyman's CURATED "current"
// set (~323 keyboards / 533 tags). The vendored `keyman-catalog.json` is the
// COMPLETE catalog (939 keyboards / 2204 tags) — its long tail of minority/
// indigenous scripts is exactly LD's audience, so it's the default source. Refresh
// it periodically by saving a fuller catalog export over `keyman-catalog.json`.
//
// Output: src/lib/components/keyboards/keyman/keyman-writing-systems.json
//   { "<bcp-ish tag>": { "id": "<keyboard id>", "name": "<language name>", "font"?: "<family>" } }
// The tag is the key an orthography's `bcp` matches; `id` is what KeymanWeb loads.
import { readFileSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const API = 'https://api.keyman.com/cloud/4.0/keyboards'
const here = dirname(fileURLToPath(import.meta.url))
const OUT = join(here, '../../src/lib/components/keyboards/keyman/keyman-writing-systems.json')
const DEFAULT_CATALOG = join(here, 'keyman-catalog.json')

const arg = process.argv[2]
const fetch_live = arg === '--fetch'
const local_file = fetch_live ? undefined : (arg ?? DEFAULT_CATALOG)

/** Higher = supports more device classes (phone/tablet/desktop), so a better default pick per tag. */
function device_score(keyboard) {
  const devices = keyboard.devices ?? {}
  return ['phone', 'tablet', 'desktop'].reduce((sum, device) => sum + (devices[device] ? 1 : 0), 0)
}

async function load_catalog() {
  if (fetch_live) {
    console.log(`Fetching ${API} …`)
    const res = await fetch(API)
    if (!res.ok) throw new Error(`Keyman API ${res.status}`)
    return res.json()
  }
  console.log(`Reading local catalog: ${local_file}`)
  return JSON.parse(readFileSync(local_file, 'utf8'))
}

const catalog = await load_catalog()

/** tag -> { keyboard, lang } best pick so far. */
const best = new Map()
for (const keyboard of catalog.keyboard ?? []) {
  const score = device_score(keyboard)
  for (const lang of keyboard.languages ?? []) {
    const existing = best.get(lang.id)
    if (!existing || score > existing.score)
      best.set(lang.id, { keyboard, lang, score })
  }
}

const map = {}
for (const tag of [...best.keys()].sort()) {
  const { keyboard, lang } = best.get(tag)
  const record = { id: keyboard.id, name: lang.name }
  if (lang.font?.family) record.font = lang.font.family
  map[tag] = record
}

const lines = Object.keys(map).map(tag => `  ${JSON.stringify(tag)}: ${JSON.stringify(map[tag])}`)
writeFileSync(OUT, `{\n${lines.join(',\n')}\n}\n`)
console.log(`Wrote ${lines.length} writing systems → ${OUT}`)
