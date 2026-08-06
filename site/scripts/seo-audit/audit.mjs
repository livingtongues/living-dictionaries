#!/usr/bin/env node
// SEO/GEO discoverability audit — crawls production page-types, asserts the SEO invariants,
// and benchmarks the committed target queries against Brave (proxy answer-engine index) and
// Google Search Console (real Google position). Read-only: it never writes to the site.
//
//   node scripts/seo-audit/audit.mjs [--base https://livingdictionaries.app] [--no-search] [--no-gsc]
//     [--json ../.cron/seo-reviews/data/YYYY-MM-DD.json]
//
// Requires (optional, each degrades gracefully): BRAVE_API_KEY env, `gsc` CLI on PATH.

import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { execFile } from 'node:child_process'
import { promisify } from 'node:util'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const exec_file = promisify(execFile)
const here = dirname(fileURLToPath(import.meta.url))

const BROWSER_UA = 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36'
const AI_CRAWLER_UAS = {
  GPTBot: 'Mozilla/5.0 AppleWebKit/537.36 (KHTML, like Gecko); compatible; GPTBot/1.1; +https://openai.com/gptbot',
  PerplexityBot: 'Mozilla/5.0 (compatible; PerplexityBot/1.0; +https://perplexity.ai/perplexitybot)',
  ClaudeBot: 'Mozilla/5.0 (compatible; ClaudeBot/1.0; +claudebot@anthropic.com)',
  Googlebot: 'Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)',
  Bingbot: 'Mozilla/5.0 (compatible; bingbot/2.0; +http://www.bing.com/bingbot.htm)',
}
const GENERIC_TITLES = new Set(['Living Dictionaries', 'Living Dictionaries | Living Dictionaries', ''])
const SITE_BOILERPLATE_DESCRIPTION_START = 'Living Dictionaries are language documentation tools'
const GSC_PROPERTY = 'sc-domain:livingdictionaries.app'

function parse_args(argv) {
  const args = { base: 'https://livingdictionaries.app', search: true, gsc: true, json: '' }
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i]
    if (arg === '--base') args.base = argv[++i]
    else if (arg === '--no-search') args.search = false
    else if (arg === '--no-gsc') args.gsc = false
    else if (arg === '--json') args.json = argv[++i]
  }
  return args
}

async function fetch_page({ url, user_agent = BROWSER_UA }) {
  try {
    const response = await fetch(url, { headers: { 'user-agent': user_agent, 'accept': 'text/html' }, redirect: 'follow' })
    const body = await response.text()
    return { status: response.status, final_url: response.url, body }
  } catch (error) {
    return { status: 0, final_url: url, body: '', error: error.message }
  }
}

async function image_status({ url }) {
  try {
    const response = await fetch(url, { method: 'HEAD', headers: { 'user-agent': BROWSER_UA } })
    if (response.status !== 405) return response.status
  } catch {
    return 0
  }
  try {
    const response = await fetch(url, { headers: { 'user-agent': BROWSER_UA, 'range': 'bytes=0-2048' } })
    return response.status === 206 ? 200 : response.status
  } catch {
    return 0
  }
}

function decode_entities(value) {
  return value
    .replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"').replace(/&#39;/g, '\'').replace(/&nbsp;/g, ' ')
}

function attribute({ tag, name }) {
  const match = tag.match(new RegExp(`${name}=["']([^"']*)["']`, 'i'))
  return match ? decode_entities(match[1]) : null
}

function parse_head({ html }) {
  const title_match = html.match(/<title>([\s\S]*?)<\/title>/i)
  const metas = [...html.matchAll(/<meta\b[^>]*>/gi)].map(match => match[0])
  const links = [...html.matchAll(/<link\b[^>]*>/gi)].map(match => match[0])
  const meta_value = (key) => {
    const tag = metas.find(candidate => (attribute({ tag: candidate, name: 'name' }) === key) || (attribute({ tag: candidate, name: 'property' }) === key))
    return tag ? attribute({ tag, name: 'content' }) : null
  }
  const json_ld = [...html.matchAll(/<script[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi)]
    .map((match) => {
      try {
        return { ok: true, value: JSON.parse(decode_entities(match[1])) }
      } catch (error) {
        return { ok: false, error: error.message }
      }
    })
  return {
    title: title_match ? decode_entities(title_match[1]).trim() : null,
    description: meta_value('description'),
    robots: meta_value('robots'),
    og_image: meta_value('og:image'),
    og_title: meta_value('og:title'),
    twitter_image: meta_value('twitter:image'),
    canonicals: links.filter(tag => /rel=["']canonical["']/i.test(tag)).map(tag => attribute({ tag, name: 'href' })),
    json_ld,
  }
}

function body_text({ html }) {
  const body_start = html.indexOf('<body')
  const body = body_start === -1 ? html : html.slice(body_start)
  return decode_entities(body
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]+>/g, ' '))
    .replace(/\s+/g, ' ')
    .trim()
}

// Everything before the site nav's last landmark is chrome that every page repeats; what
// follows is the page's own crawlable content — the thing a search/answer engine can quote.
function content_text({ text }) {
  const close_marker = text.lastIndexOf('Close ')
  if (close_marker !== -1) return text.slice(close_marker + 6)
  const sign_in_marker = text.lastIndexOf('Sign In ')
  if (sign_in_marker !== -1) return text.slice(sign_in_marker + 8)
  return text
}

// `n., English: family` → `family`; `English: He, she, it goes out` → `He, she, it goes out`.
function description_answer({ description }) {
  if (!description) return ''
  const labelled = description.match(/^[^:]{1,40}:(.+)$/)
  return (labelled ? labelled[1] : description).trim()
}

function json_ld_types({ blocks }) {
  const types = []
  const walk = (node) => {
    if (!node || typeof node !== 'object') return
    if (Array.isArray(node)) return node.forEach(walk)
    if (node['@type']) types.push(node['@type'])
    for (const value of Object.values(node)) walk(value)
  }
  blocks.filter(block => block.ok).forEach(block => walk(block.value))
  return types
}

function parse_robots({ text }) {
  const lines = text.split('\n').map(line => line.trim())
  const disallows = []
  let in_star_group = false
  for (const line of lines) {
    const [raw_key, ...rest] = line.split(':')
    const key = raw_key.trim().toLowerCase()
    const value = rest.join(':').trim()
    if (key === 'user-agent') in_star_group = value === '*'
    else if (key === 'disallow' && in_star_group && value) disallows.push(value)
  }
  return disallows
}

function robots_allows({ path, disallows }) {
  return !disallows.some(rule => path.startsWith(rule))
}

async function collect_sitemap_urls({ base, dictionaries }) {
  const index = await fetch_page({ url: `${base}/sitemap.xml` })
  const children = [...index.body.matchAll(/<loc>([^<]+)<\/loc>/g)].map(match => match[1])
  const wanted = children.filter(child => child.endsWith('/site.xml') || dictionaries.some(dict => child.endsWith(`/${dict}.xml`)))
  const urls = new Set()
  for (const child of wanted) {
    const page = await fetch_page({ url: child })
    for (const match of page.body.matchAll(/<loc>([^<]+)<\/loc>/g)) urls.add(match[1])
  }
  return { children, urls }
}

async function sitemap_entry_urls({ base, dictionary, count }) {
  const page = await fetch_page({ url: `${base}/sitemaps/${dictionary}.xml` })
  const all = [...page.body.matchAll(/<loc>([^<]+)<\/loc>/g)].map(match => match[1])
  const entries = all.filter(url => url.includes('/entry/'))
  const step = Math.max(1, Math.floor(entries.length / (count + 1)))
  return Array.from({ length: count }, (_, index) => entries[step * (index + 1)]).filter(Boolean)
}

const EXPECTED_JSON_LD = {
  home: ['WebSite', 'Organization'],
  dictionary: ['Dictionary', 'DefinedTermSet', 'Dataset'],
  entry: ['DefinedTerm'],
}

async function audit_url({ url, page_type, base, sitemap_urls, disallows, expects_json_ld }) {
  const page = await fetch_page({ url })
  const checks = []
  const add = ({ id, ok, detail }) => checks.push({ id, ok, detail })

  add({ id: 'http_200', ok: page.status === 200, detail: `${page.status}${page.error ? ` ${page.error}` : ''}` })
  if (page.status !== 200) return { url, page_type, status: page.status, checks, head: null }

  const head = parse_head({ html: page.body })
  const path = new URL(url).pathname

  add({ id: 'title_present', ok: !!head.title, detail: head.title || 'missing' })
  add({ id: 'title_specific', ok: !!head.title && !GENERIC_TITLES.has(head.title), detail: head.title || '' })
  add({ id: 'description_present', ok: !!head.description, detail: head.description ? `${head.description.slice(0, 90)}` : 'missing' })
  const boilerplate_description = !!head.description?.startsWith(SITE_BOILERPLATE_DESCRIPTION_START)
  add({
    id: 'description_specific',
    ok: page_type === 'home' || (!!head.description && !boilerplate_description),
    detail: boilerplate_description ? 'site boilerplate' : 'page-specific',
  })

  const noindex = /noindex/i.test(head.robots || '')
  add({ id: 'canonical_single', ok: head.canonicals.length === 1 || (noindex && head.canonicals.length === 0), detail: `${head.canonicals.length} canonical, robots=${head.robots || 'none'}` })
  const [canonical] = head.canonicals
  add({ id: 'canonical_clean', ok: !!canonical && !canonical.includes('?'), detail: canonical || 'none' })
  add({
    id: 'canonical_self',
    ok: !!canonical && canonical.replace(/\/$/, '') === url.replace(/\/$/, ''),
    detail: canonical === url ? 'self' : `${canonical} != ${url}`,
  })
  add({ id: 'not_noindex', ok: !noindex, detail: head.robots || 'no robots meta' })

  const parsed_ld = head.json_ld.filter(block => block.ok)
  const types = json_ld_types({ blocks: head.json_ld })
  if (expects_json_ld) {
    add({ id: 'jsonld_parses', ok: head.json_ld.length > 0 && head.json_ld.every(block => block.ok), detail: `${parsed_ld.length}/${head.json_ld.length} blocks parse` })
    const expected = EXPECTED_JSON_LD[page_type] || []
    add({ id: 'jsonld_type', ok: expected.some(type => types.includes(type)), detail: types.join(', ') || 'none' })
  }

  const og_status = head.og_image ? await image_status({ url: head.og_image }) : 0
  add({ id: 'og_image_200', ok: og_status === 200, detail: head.og_image ? `${og_status}` : 'missing og:image' })
  add({ id: 'twitter_image', ok: !!head.twitter_image, detail: head.twitter_image ? 'present' : 'missing' })

  add({ id: 'in_sitemap', ok: sitemap_urls.has(url) || sitemap_urls.has(`${url}/`), detail: sitemap_urls.has(url) ? 'listed' : 'absent' })
  add({ id: 'robots_allows', ok: robots_allows({ path, disallows }), detail: path })

  const text = body_text({ html: page.body })
  const content = content_text({ text })
  if (page_type === 'entry') {
    const headword = parsed_ld.map(block => block.value?.name).find(Boolean) || ''
    const answer = description_answer({ description: head.description })
    const has_headword = !!headword && content.toLowerCase().includes(headword.toLowerCase())
    const has_answer = !!answer && content.toLowerCase().includes(answer.toLowerCase())
    add({ id: 'answer_first', ok: has_headword && has_answer, detail: `headword ${has_headword ? '✓' : '✗'}, gloss "${answer.slice(0, 30)}" ${has_answer ? '✓' : '✗'} in crawlable text` })
  } else if (page_type === 'dictionary') {
    const name = parsed_ld.map(block => block.value?.name).find(Boolean) || ''
    add({ id: 'answer_first', ok: !!name && content.includes(name.replace(' Living Dictionary', '')), detail: name || 'no JSON-LD name' })
  }
  const minimum_content = page_type === 'entry' ? 60 : 300
  add({ id: 'ssr_content', ok: content.length >= minimum_content, detail: `${content.length} chars of page-own text (min ${minimum_content})` })

  const crawler_results = {}
  for (const [name, user_agent] of Object.entries(AI_CRAWLER_UAS)) {
    const crawl = await fetch_page({ url, user_agent })
    crawler_results[name] = { status: crawl.status, bytes: crawl.body.length }
  }
  const blocked = Object.entries(crawler_results).filter(([, result]) => result.status !== 200).map(([name]) => name)
  add({ id: 'ai_crawlers_allowed', ok: blocked.length === 0, detail: blocked.length ? `blocked: ${blocked.join(', ')}` : Object.keys(crawler_results).join(', ') })

  return { url, page_type, status: page.status, checks, head: { title: head.title, description: head.description, canonical, json_ld_types: types }, crawler_results, text_length: text.length }
}

async function brave_rank({ query, host }) {
  const key = process.env.BRAVE_API_KEY
  if (!key) return { available: false }
  const url = `https://api.search.brave.com/res/v1/web/search?q=${encodeURIComponent(query)}&count=20`
  const response = await fetch(url, { headers: { 'accept': 'application/json', 'x-subscription-token': key } })
  if (!response.ok) return { available: true, error: `${response.status}` }
  const data = await response.json()
  const results = (data.web?.results || []).map(result => result.url)
  const index = results.findIndex(result => result.includes(host))
  return { available: true, rank: index === -1 ? null : index + 1, hit: index === -1 ? null : results[index], total: results.length }
}

async function gsc_query_rows({ start_date, end_date }) {
  try {
    const { stdout } = await exec_file('gsc', ['analytics', GSC_PROPERTY, start_date, end_date, 'query,page', '25000'], { maxBuffer: 200 * 1024 * 1024 })
    const data = JSON.parse(stdout)
    return data.rows || []
  } catch (error) {
    return null
  }
}

function gsc_lookup({ rows, query }) {
  const matching = rows.filter(row => row.keys[0] === query)
  if (!matching.length) return null
  const impressions = matching.reduce((total, row) => total + row.impressions, 0)
  const clicks = matching.reduce((total, row) => total + row.clicks, 0)
  const position = matching.reduce((total, row) => total + row.position * row.impressions, 0) / impressions
  const [best] = matching.slice().sort((a, b) => b.impressions - a.impressions)
  return { impressions, clicks, position, top_page: best.keys[1] }
}

function date_range({ days = 28, lag = 3 }) {
  const end = new Date(Date.now() - lag * 86400000)
  const start = new Date(end.getTime() - (days - 1) * 86400000)
  const iso = date => date.toISOString().slice(0, 10)
  return { start_date: iso(start), end_date: iso(end) }
}

function status_icon({ checks }) {
  const failed = checks.filter(check => !check.ok)
  if (!failed.length) return '✅'
  const blockers = ['http_200', 'not_noindex', 'canonical_single', 'robots_allows', 'in_sitemap', 'jsonld_parses']
  return failed.some(check => blockers.includes(check.id)) ? '❌' : '🟡'
}

async function main() {
  const args = parse_args(process.argv.slice(2))
  const targets = JSON.parse(await readFile(join(here, 'targets.json'), 'utf8'))
  const { host } = new URL(args.base)

  const robots_response = await fetch_page({ url: `${args.base}/robots.txt` })
  const disallows = parse_robots({ text: robots_response.body })
  const { children, urls: sitemap_urls } = await collect_sitemap_urls({ base: args.base, dictionaries: targets.dictionaries })

  const to_audit = []
  for (const path of targets.site_pages)
    to_audit.push({ url: `${args.base}${path}`, page_type: path === '/' ? 'home' : 'site', expects_json_ld: path === '/' })
  for (const dictionary of targets.dictionaries) {
    to_audit.push({ url: `${args.base}/${dictionary}`, page_type: 'dictionary', expects_json_ld: true })
    to_audit.push({ url: `${args.base}/${dictionary}/about`, page_type: 'about', expects_json_ld: false })
    const entries = await sitemap_entry_urls({ base: args.base, dictionary, count: targets.entries_per_dictionary })
    for (const entry of entries) to_audit.push({ url: entry, page_type: 'entry', expects_json_ld: true })
  }

  const pages = []
  for (const target of to_audit) {
    process.stderr.write(`crawl ${target.url}\n`)
    pages.push(await audit_url({ ...target, base: args.base, sitemap_urls, disallows }))
  }

  const { start_date, end_date } = date_range({})
  const gsc_rows = args.gsc ? await gsc_query_rows({ start_date, end_date }) : null

  const benchmark = []
  for (const target of targets.queries) {
    process.stderr.write(`query ${target.query}\n`)
    const brave = args.search ? await brave_rank({ query: target.query, host }) : { available: false }
    const google = gsc_rows ? gsc_lookup({ rows: gsc_rows, query: target.query }) : null
    benchmark.push({ ...target, brave, google })
    if (args.search) await new Promise(resolve => setTimeout(resolve, 1100))
  }

  const report = {
    generated_at: new Date().toISOString(),
    base: args.base,
    sitemap_children: children.length,
    robots_disallows: disallows,
    gsc_window: gsc_rows ? { start_date, end_date, rows: gsc_rows.length } : null,
    pages,
    benchmark,
  }

  console.log(`\n## Per-URL technical check (${pages.length} URLs)\n`)
  console.log('| URL | verdict | failing checks |')
  console.log('|---|---|---|')
  for (const page of pages) {
    const failed = page.checks.filter(check => !check.ok)
    const path = page.url.replace(args.base, '') || '/'
    console.log(`| \`${path}\` | ${status_icon({ checks: page.checks })} | ${failed.map(check => `${check.id} (${check.detail})`).join('; ') || '—'} |`)
  }

  console.log(`\n## Query benchmark (Google window ${start_date}→${end_date})\n`)
  console.log('| query | Google pos | impr | clicks | Brave rank |')
  console.log('|---|---|---|---|---|')
  for (const row of benchmark) {
    const google = row.google ? `${row.google.position.toFixed(1)} | ${row.google.impressions} | ${row.google.clicks}` : '— | — | —'
    console.log(`| ${row.query} | ${google} | ${row.brave.available ? (row.brave.rank ?? 'not in top 20') : 'n/a'} |`)
  }

  if (args.json) {
    await mkdir(dirname(args.json), { recursive: true })
    await writeFile(args.json, JSON.stringify(report, null, 2))
    process.stderr.write(`\nwrote ${args.json}\n`)
  }
}

main()
