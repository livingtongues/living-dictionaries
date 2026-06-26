// Local-dev repro of the new-dict entries crash — unminified stack.
import { launch } from '/home/jacob/.claude/skills/browser-tools/browser-launch.mjs'

const BASE = 'http://localhost:3041'
const EMAIL = 'jwrunner7@gmail.com'
const sleep = ms => new Promise(r => setTimeout(r, ms))
const DICT = `loc-${Date.now().toString(36)}`

const browser = await launch()
const page = await browser.newPage()
const out = { dict: DICT, console: [], page_errors: [], bad: [] }
page.on('pageerror', e => out.page_errors.push((e.stack || e.message).slice(0, 1200)))
page.on('console', async (m) => {
  if (m.type() !== 'error') return
  const parts = []
  for (const h of m.args()) {
    try { parts.push(await h.evaluate(v => (v instanceof Error ? `${v.message}\n${v.stack}` : (typeof v === 'object' ? JSON.stringify(v) : String(v))))) } catch { parts.push(m.text()) }
  }
  out.console.push(parts.join(' ').slice(0, 1200))
})
page.on('response', (r) => { if (r.status() >= 400) out.bad.push(`${r.status()} ${r.url().slice(0, 100)}`) })

try {
  await page.goto(`${BASE}/`, { waitUntil: 'networkidle2' }).catch(() => {})
  out.login = await page.evaluate(async (email) => {
    const s = await (await fetch('/api/auth/email/send-code', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ email }) })).json()
    const v = await fetch('/api/auth/email/verify', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ email, code: s.code }) })
    return { code: s.code, verify: v.status }
  }, EMAIL)
  out.create = await page.evaluate(async (id) => {
    const r = await fetch('/api/dictionaries/create', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ id, name: `Local ${id}`, gloss_languages: ['en'] }) })
    return { status: r.status, body: (await r.text()).slice(0, 120) }
  }, DICT)
  await page.goto(`${BASE}/${DICT}/entries`, { waitUntil: 'networkidle2' }).catch(e => out.goto = e.message)
  await sleep(5000)
  out.body = await page.evaluate(() => document.body.innerText.replace(/\s+/g, ' ').slice(0, 200))
} catch (e) { out.fatal = e.message } finally {
  console.log(JSON.stringify(out, null, 2))
  await browser.close()
}
