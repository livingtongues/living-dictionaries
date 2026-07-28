/**
 * What a crawler burst does to the rest of the site.
 *
 * Fires N DISTINCT share cards at a running server (distinct `?v=`, so every one
 * is a genuine store miss and a real render) while sampling `/healthz` — the
 * exact request Caddy's active health check makes, with a 2 s timeout, and the
 * one that failed against BOTH containers during the 2026-07-27 outages.
 *
 *   node tools/og-load-check.mjs --base http://localhost:3055 --cards 20 --label after
 *
 * `--props` takes an lz-string-encoded props param (generate one with
 * `npx tsx tools/gen-og-props.ts`); without one the harness lifts the og:image
 * URL off the base URL's homepage.
 *
 * The health samples are taken by `curl` in a SEPARATE PROCESS on purpose. A
 * probe sharing this script's undici connection pool with the burst measures the
 * CLIENT's queueing, not the server's — it once reported `/healthz` at 14 s while
 * curl showed 1–6 ms at the same instant. See
 * `.knowledge/server/synchronous-work-on-the-request-thread.md`.
 */

import { spawn } from 'node:child_process'

const args = Object.fromEntries(process.argv.slice(2).reduce((pairs, arg, index, all) => {
  if (arg.startsWith('--')) pairs.push([arg.slice(2), all[index + 1]])
  return pairs
}, []))

const base = args.base || 'http://localhost:3055'
const cards = Number(args.cards || 20)
const label = args.label || 'run'
const health_interval = args.interval || '0.05'

async function props_param() {
  if (args.props) return args.props
  const html = await (await fetch(base)).text()
  const match = html.match(/property="og:image" content="[^"]*props=([^"&]+)/)
  if (!match) throw new Error('no og:image props found on the homepage — pass --props')
  return match[1]
}

function percentile(sorted, fraction) {
  return sorted[Math.min(sorted.length - 1, Math.floor(sorted.length * fraction))]
}

async function timed(url) {
  const started = Date.now()
  try {
    const response = await fetch(url)
    await response.arrayBuffer()
    return { ms: Date.now() - started, status: response.status, cache: response.headers.get('cache-control') || '' }
  } catch (error) {
    return { ms: Date.now() - started, status: 0, cache: '', error: error.message }
  }
}

/** `<http_code> <seconds>` per line, one curl process per sample. */
function start_health_sampler() {
  const script = `while true; do curl -s -o /dev/null -m 10 -w '%{http_code} %{time_total}\\n' ${base}/healthz; sleep ${health_interval}; done`
  const child = spawn('bash', ['-c', script])
  const samples = []
  let buffer = ''
  child.stdout.on('data', (chunk) => {
    buffer += chunk
    const lines = buffer.split('\n')
    buffer = lines.pop()
    for (const line of lines) {
      const [status, seconds] = line.trim().split(' ')
      if (seconds) samples.push({ status: Number(status), ms: Math.round(Number(seconds) * 1000) })
    }
  })
  return { samples, stop: () => child.kill('SIGKILL') }
}

const props = await props_param()

// Warm the process (the first request pays SvelteKit's lazy route load, not the card).
await timed(`${base}/healthz`)

const health = start_health_sampler()
await new Promise(resolve => setTimeout(resolve, 500)) // a few idle samples for a baseline

const started = Date.now()
const results = await Promise.all(
  Array.from({ length: cards }, (_, index) => timed(`${base}/og?props=${props}&v=${label}-${Date.now()}-${index}`)),
)
const burst_ms = Date.now() - started
health.stop()

const health_ms = health.samples.map(sample => sample.ms).sort((a, b) => a - b)
const real = results.filter(result => result.cache.includes('immutable')).length
const shed = results.filter(result => result.cache.includes('max-age=60')).length

console.log(JSON.stringify({
  label,
  cards,
  burst_ms,
  cards_rendered: real,
  cards_shed: shed,
  card_ms: { min: Math.min(...results.map(r => r.ms)), max: Math.max(...results.map(r => r.ms)) },
  healthz: {
    samples: health_ms.length,
    p50: percentile(health_ms, 0.5),
    p95: percentile(health_ms, 0.95),
    max: health_ms.at(-1),
    over_2s: health_ms.filter(ms => ms >= 2000).length,
    failures: health.samples.filter(sample => sample.status !== 200).length,
  },
}, null, 2))
