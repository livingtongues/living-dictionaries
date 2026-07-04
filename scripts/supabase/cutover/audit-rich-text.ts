import type { PoolClient } from 'pg'
import { mkdirSync, writeFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import process from 'node:process'
import { fileURLToPath } from 'node:url'
import { postgres } from '../config-supabase'
import { register_dom } from './register-dom'

register_dom()

// eslint-disable-next-line import/first
import { looks_like_html } from './looks-like-html'

/**
 * Pre-conversion content audit (cutover runbook A3): scan ALL rich-text HTML —
 * `dictionary_info.about`, `dictionary_info.grammar`, every locale value of
 * `entries.notes` — and report tag / attribute / class / inline-style
 * frequency, plus the specific things we decide extensions on:
 * underline (Jacob wants the number), text-align, small-caps, tables, iframes,
 * data-URIs, image hosts. Read-only. Examples carry row ids for eyeballing.
 *
 *   tsx supabase-cutover/audit-rich-text.ts -e prod [--out ~/ld-cutover/richtext-audit.json]
 */

const here = dirname(fileURLToPath(import.meta.url))

function get_flag(name: string, fallback?: string): string | undefined {
  const index = process.argv.indexOf(name)
  if (index !== -1 && process.argv[index + 1] && !process.argv[index + 1].startsWith('--'))
    return process.argv[index + 1]
  return fallback
}

interface Tally {
  count: number
  values: number
  examples: string[]
}

const MAX_EXAMPLES = 8

function bump(map: Map<string, Tally>, key: string, where: string, occurrences = 1) {
  let tally = map.get(key)
  if (!tally) {
    tally = { count: 0, values: 0, examples: [] }
    map.set(key, tally)
  }
  tally.count += occurrences
  tally.values += 1
  if (tally.examples.length < MAX_EXAMPLES && !tally.examples.includes(where))
    tally.examples.push(where)
}

const tags = new Map<string, Tally>()
const attributes = new Map<string, Tally>()
const classes = new Map<string, Tally>()
const style_props = new Map<string, Tally>()
const image_hosts = new Map<string, Tally>()
const flags = new Map<string, Tally>()

let html_values = 0
let plain_values = 0
let empty_values = 0

function scan_value(html: unknown, where: string) {
  if (html === null || html === undefined)
    return
  const text = String(html)
  if (!text.trim()) {
    empty_values++
    return
  }
  if (!looks_like_html(text)) {
    plain_values++
    return
  }
  html_values++

  const parser = new DOMParser()
  const doc = parser.parseFromString(text, 'text/html')
  const elements: Element[] = Array.from(doc.body?.querySelectorAll('*') ?? [])
  const tag_counts = new Map<string, number>()
  for (const element of elements) {
    const tag = element.tagName.toLowerCase()
    tag_counts.set(tag, (tag_counts.get(tag) ?? 0) + 1)

    for (const attribute of Array.from(element.attributes)) {
      if (attribute.name === 'class') {
        for (const token of String(attribute.value).split(/\s+/).filter(Boolean))
          bump(classes, token, where)
      } else if (attribute.name === 'style') {
        for (const declaration of String(attribute.value).split(';')) {
          const prop = declaration.split(':')[0]?.trim().toLowerCase()
          if (prop)
            bump(style_props, prop, where)
          if (prop === 'text-align')
            bump(flags, 'text-align', where)
          if (prop === 'font-variant' || prop === 'font-variant-caps')
            bump(flags, 'small-caps-style', where)
        }
      } else {
        bump(attributes, `${tag}[${attribute.name}]`, where)
      }
    }

    if (tag === 'img') {
      const src = element.getAttribute('src') ?? ''
      if (src.startsWith('data:'))
        bump(image_hosts, 'data-uri', where)
      else
        bump(image_hosts, safe_host(src), where)
    }
    if (tag === 'iframe')
      bump(flags, 'iframe', where)
    if (tag === 'table')
      bump(flags, 'table', where)
    if (tag === 'u')
      bump(flags, 'underline', where)
  }
  for (const [tag, occurrences] of tag_counts)
    bump(tags, tag, where, occurrences)
}

function safe_host(src: string): string {
  try {
    return new URL(src).host || 'relative'
  } catch {
    return 'relative'
  }
}

async function scan_entries_notes(client: PoolClient) {
  await client.query('BEGIN')
  try {
    await client.query(`DECLARE notes_cur NO SCROLL CURSOR FOR
      SELECT id, dictionary_id, notes FROM entries WHERE notes IS NOT NULL AND deleted IS NULL`)
    let scanned = 0
    for (;;) {
      const result = await client.query('FETCH 2000 FROM notes_cur')
      for (const row of result.rows) {
        const notes = typeof row.notes === 'string' ? JSON.parse(row.notes) : row.notes
        if (notes && typeof notes === 'object') {
          for (const [locale, value] of Object.entries(notes))
            scan_value(value, `${row.dictionary_id}/${row.id}.notes.${locale}`)
        }
        scanned++
      }
      if (result.rows.length < 2000)
        break
      if (scanned % 50000 < 2000)
        process.stdout.write(`  …entries scanned: ${scanned}\n`)
    }
    await client.query('CLOSE notes_cur')
    await client.query('COMMIT')
    return scanned
  } catch (error) {
    await client.query('ROLLBACK').catch(() => {})
    throw error
  }
}

function to_object(map: Map<string, Tally>) {
  return Object.fromEntries([...map.entries()].sort((a, b) => b[1].count - a[1].count))
}

async function main() {
  const out_path = get_flag('--out', resolve(here, '../../.local-audit/richtext-audit.json'))!

  const client = await postgres.get_db_connection()
  try {
    const info_rows = (await client.query(`SELECT id, about, grammar FROM dictionary_info`)).rows
    for (const row of info_rows) {
      scan_value(row.about, `${row.id}.about`)
      scan_value(row.grammar, `${row.id}.grammar`)
    }
    process.stdout.write(`dictionary_info scanned: ${info_rows.length} rows\n`)

    const entries_scanned = await scan_entries_notes(client)
    process.stdout.write(`entries with notes scanned: ${entries_scanned}\n`)

    const report = {
      generated_at: new Date().toISOString(),
      totals: { html_values, plain_values, empty_values },
      flags: to_object(flags),
      tags: to_object(tags),
      attributes: to_object(attributes),
      classes: to_object(classes),
      style_props: to_object(style_props),
      image_hosts: to_object(image_hosts),
    }
    mkdirSync(dirname(out_path), { recursive: true })
    writeFileSync(out_path, JSON.stringify(report, null, 1))

    process.stdout.write(`\n=== SUMMARY ===\n`)
    process.stdout.write(`values: ${html_values} html · ${plain_values} plain · ${empty_values} empty\n`)
    process.stdout.write(`tags: ${JSON.stringify(Object.fromEntries(Object.entries(report.tags).map(([tag, tally]) => [tag, (tally as Tally).count])))}\n`)
    process.stdout.write(`flags (underline/text-align/small-caps/table/iframe/data-uri):\n`)
    for (const [flag, tally] of Object.entries(report.flags))
      process.stdout.write(`  ${flag}: ${(tally as Tally).count} occurrences in ${(tally as Tally).values} values — e.g. ${(tally as Tally).examples.slice(0, 3).join(', ')}\n`)
    process.stdout.write(`image hosts: ${JSON.stringify(Object.fromEntries(Object.entries(report.image_hosts).map(([host, tally]) => [host, (tally as Tally).count])))}\n`)
    process.stdout.write(`full report: ${out_path}\n`)
  } finally {
    client.release()
    await postgres.end()
  }
}

main().catch((error) => {
  console.error(error)
  process.exitCode = 1
})
