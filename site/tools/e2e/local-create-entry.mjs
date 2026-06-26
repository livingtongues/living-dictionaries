// Verify the editor entry-WRITE + /changes push path against LOCAL dev
// (headless, house-style). Local dev = same code, no Xvfb/WebGL/remote-snapshot
// noise. Sets the lexeme input value directly (save() reads inputEl.value) +
// submits — no keyboard, so the Keyman wrapper never intercepts keystrokes.
//
// Run: node tools/e2e/local-create-entry.mjs
import { execSync } from 'node:child_process'
import Database from '/home/jacob/code/living-dictionaries/site/node_modules/better-sqlite3/lib/index.js'
import { launch } from '/home/jacob/.claude/skills/browser-tools/browser-launch.mjs'

const BASE = process.env.E2E_BASE || 'http://localhost:3041'
const EMAIL = 'jwrunner7@gmail.com'
const DATA = '/home/jacob/code/living-dictionaries/site/.data'
const SHOTS = '/home/jacob/code/living-dictionaries/site/tools/e2e/shots'
const sleep = ms => new Promise(r => setTimeout(r, ms))
const stamp = Date.now().toString(36)
const DICT_ID = `local-${stamp}`
const LEXEME = `localtest-${stamp}`
const report = { base: BASE, dict_id: DICT_ID, lexeme: LEXEME, steps: {}, page_errors: [], console_errors: [] }

function dict_db_entries(id) {
  const path = `${DATA}/dictionaries/${id}.db`
  try {
    const d = new Database(path, { readonly: true })
    const c = d.prepare('SELECT COUNT(*) c FROM entries').get().c
    const lex = d.prepare('SELECT lexeme FROM entries LIMIT 3').all().map(r => r.lexeme)
    d.close()
    return { exists: true, count: c, lexemes: lex }
  } catch (e) { return { exists: false, error: e.message } }
}
function recent_events() {
  try {
    const d = new Database(`${DATA}/shared.db`, { readonly: true })
    const rows = d.prepare("SELECT json_extract(context,'$.event') ev, message, source, COUNT(*) c FROM client_logs WHERE received_at > datetime('now','-10 minutes') GROUP BY ev, message, source ORDER BY c DESC LIMIT 30").all()
    d.close()
    return rows
  } catch (e) { return { error: e.message } }
}

const browser = await launch()
const page = await browser.newPage()
page.setDefaultTimeout(20000)
report.dialogs = []
page.on('dialog', async (d) => { report.dialogs.push(d.message().slice(0, 200)); await d.dismiss().catch(() => {}) })
page.on('pageerror', e => report.page_errors.push(e.message.split('\n')[0]))
page.on('console', m => { if (m.type() === 'error') report.console_errors.push(m.text().slice(0, 200)) })
const shot = async n => { await page.screenshot({ path: `${SHOTS}/${n}.png` }).catch(() => {}) }

try {
  // 1. Login (dev returns OTP inline from send-code).
  await page.goto(`${BASE}/`, { waitUntil: 'domcontentloaded' }).catch(() => {})
  const login = await page.evaluate(async (email) => {
    const s = await fetch('/api/auth/email/send-code', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ email }) })
    const { code } = await s.json()
    const v = await fetch('/api/auth/email/verify', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ email, code }) })
    return { code_ok: !!code, verify_status: v.status }
  }, EMAIL)
  report.steps.login = login

  // 2. Create a dict (creator becomes manager/editor).
  report.steps.create_dict = await page.evaluate(async (id) => {
    const r = await fetch('/api/dictionaries/create', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ id, name: `Local ${id}`, gloss_languages: ['en'] }) })
    return { status: r.status, body: (await r.text()).slice(0, 200) }
  }, DICT_ID)

  // 3. Open entries page — +layout.ts open_dict awaits client.ready() before render.
  await page.goto(`${BASE}/${DICT_ID}/entries`, { waitUntil: 'networkidle2' }).catch(() => {})
  const add_button = await page.waitForSelector('.add-entry-button', { visible: true, timeout: 30000 }).then(() => true).catch(() => false)
  // Belt-and-braces: confirm the dict client reports ready.
  const ready = await page.evaluate(async (id) => {
    const c = globalThis.__ld_dict_clients?.[id]?.client
    if (!c) return 'no-client'
    try { await Promise.race([c.ready(), new Promise((_, rej) => setTimeout(() => rej(new Error('t')), 10000))]); return 'ready' } catch { return 'ready-timeout' }
  }, DICT_ID)
  report.steps.dict_opened = { add_button, ready }
  await shot('local-1-dict')

  // 4. Open modal, set lexeme value directly, submit.
  await page.evaluate(() => { const b = [...document.querySelectorAll('.add-entry-button')].find(x => !x.disabled && x.offsetParent !== null); b?.click() })
  const input = await page.waitForSelector('form input.form-input', { visible: true, timeout: 10000 }).catch(() => null)
  await shot('local-2-modal')
  let typed = null, submitted = false
  if (input) {
    typed = await page.$eval('form input.form-input', (el, val) => {
      const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set
      setter.call(el, val)
      el.dispatchEvent(new Event('input', { bubbles: true }))
      return el.value
    }, LEXEME)
    submitted = await page.evaluate(() => { const b = document.querySelector('form button[type="submit"]'); if (!b) return false; b.click(); return true })
  }
  report.steps.add_entry = { modal_opened: !!input, typed, submitted }

  // 5. Wait for the local OPFS write → /changes push → server per-dict DB.
  let landed = { exists: false, count: 0 }
  for (let i = 0; i < 30; i++) {
    await sleep(1000)
    landed = dict_db_entries(DICT_ID)
    if (landed.count > 0) break
  }
  report.steps.server_write = landed
  await shot('local-3-after')

  // 6. Open the entry detail (entry_opened) if it rendered a link.
  await page.goto(`${BASE}/${DICT_ID}/entries`, { waitUntil: 'networkidle2' }).catch(() => {})
  await sleep(2500)
  const href = await page.evaluate(id => [...document.querySelectorAll('a')].find(a => a.getAttribute('href')?.startsWith(`/${id}/entry/`))?.getAttribute('href') ?? null, DICT_ID)
  if (href) {
    await page.goto(`${BASE}${href}`, { waitUntil: 'networkidle2' }).catch(() => {})
    await sleep(2000)
    report.steps.entry_opened = await page.evaluate(lex => ({ url: location.pathname, shows: document.body.innerText.includes(lex) }), LEXEME)
  } else { report.steps.entry_opened = { note: 'no entry link' } }

  await sleep(6000) // flush logs
} catch (err) {
  report.fatal = err.message
} finally {
  report.recent_events = recent_events()
  console.log(JSON.stringify(report, null, 2))
  await browser.close().catch(() => {})
}
