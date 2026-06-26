// Focused diagnostic: open an existing dict's entries page and capture the REAL
// client error (resolve console JSHandles, failed requests, 4xx/5xx responses).
import { launch } from '/home/jacob/.claude/skills/browser-tools/browser-launch.mjs'

const BASE = process.env.E2E_BASE || 'https://new.livingdictionaries.app'
const DICT = process.argv[2] || 'e2e-log-mqu8bd7x'
const sleep = ms => new Promise(r => setTimeout(r, ms))

const browser = await launch()
const page = await browser.newPage()
const out = { dict: DICT, console: [], page_errors: [], bad_responses: [], failed: [] }

page.on('pageerror', e => out.page_errors.push(e.stack?.slice(0, 600) || e.message))
page.on('console', async (m) => {
  if (m.type() !== 'error' && m.type() !== 'warning') return
  const parts = []
  for (const h of m.args()) {
    try { parts.push(await h.evaluate(v => (v instanceof Error ? `${v.message}\n${v.stack}` : (typeof v === 'object' ? JSON.stringify(v) : String(v))))) } catch { parts.push(m.text()) }
  }
  out.console.push(`[${m.type()}] ${parts.join(' ').slice(0, 600)}`)
})
page.on('response', (r) => { if (r.status() >= 400) out.bad_responses.push(`${r.status()} ${r.request().method()} ${r.url().slice(0, 120)}`) })
page.on('requestfailed', r => out.failed.push(`${r.failure()?.errorText} ${r.url().slice(0, 120)}`))

await page.goto(`${BASE}/${DICT}/entries`, { waitUntil: 'networkidle2' }).catch(e => out.goto_err = e.message)
await sleep(6000)
out.body = await page.evaluate(() => document.body.innerText.replace(/\s+/g, ' ').slice(0, 220))
console.log(JSON.stringify(out, null, 2))
await browser.close()
