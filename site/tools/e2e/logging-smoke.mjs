// Headless puppeteer smoke that EXERCISES the live subdomain to generate real
// telemetry (and shake out OPFS/wa-sqlite + sync bugs), then we read the logs back.
//
// Flow: anonymous home → admin login (OTP read from the VPS shared.db) → verify
// the new analytics shape is deployed → create a dictionary → open it (boots the
// OPFS leader worker) → add an entry (OPFS write + /changes push) → search → open
// the entry → anonymous viewer of the (public) dict in a fresh context.
//
// Run: node tools/e2e/logging-smoke.mjs
import { execFileSync } from 'node:child_process'
import { launch } from '/home/jacob/.claude/skills/browser-tools/browser-launch.mjs'

const BASE = process.env.E2E_BASE || 'https://new.livingdictionaries.app'
const EMAIL = process.env.E2E_EMAIL || 'jwrunner7@gmail.com'
const SHOTS = '/home/jacob/code/living-dictionaries/site/tools/e2e/shots'
const sleep = ms => new Promise(r => setTimeout(r, ms))
const stamp = Date.now().toString(36)
const DICT_ID = `e2e-log-${stamp}`
const LEXEME = `smoketest-${stamp}`

const report = { base: BASE, dict_id: DICT_ID, lexeme: LEXEME, steps: {}, page_errors: [], console_errors: [] }

function read_latest_otp(email) {
  // Query the VPS shared.db for the freshest code for this email.
  const js = `const db=require('better-sqlite3')('/data/shared.db',{readonly:true});const r=db.prepare("SELECT code FROM email_codes WHERE email=? ORDER BY created_at DESC LIMIT 1").get(${JSON.stringify(email)});process.stdout.write(r?r.code:'')`
  return execFileSync('ssh', ['living', 'docker exec -i sveltekit_blue node'], { input: js }).toString().trim()
}

const browser = await launch()
const page = await browser.newPage()
await page.setViewport({ width: 1280, height: 900 })
page.on('pageerror', e => report.page_errors.push(e.message.split('\n')[0]))
page.on('console', (m) => { if (m.type() === 'error') report.console_errors.push(m.text().slice(0, 200)) })

async function shot(name) { await page.screenshot({ path: `${SHOTS}/${name}.png` }).catch(() => {}) }

try {
  // 1. Anonymous home (globe) — session_start + navigation.
  await page.goto(`${BASE}/`, { waitUntil: 'networkidle2' }).catch(() => {})
  await sleep(1500)
  report.steps.anon_home = await page.evaluate(() => ({ title: document.title, has_canvas: !!document.querySelector('canvas') }))
  await shot('1-anon-home')

  // 2. Admin login via API + OTP from DB.
  const send_status = await page.evaluate(async (email) => {
    const r = await fetch('/api/auth/email/send-code', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ email }) })
    return r.status
  }, EMAIL)
  await sleep(500)
  const otp = read_latest_otp(EMAIL)
  const verify_status = await page.evaluate(async (email, code) => {
    const r = await fetch('/api/auth/email/verify', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ email, code }) })
    return r.status
  }, EMAIL, otp)
  report.steps.login = { send_status, got_otp: !!otp, verify_status }

  // 3. Verify the new analytics shape is deployed (proves my commit is live).
  report.steps.analytics_shape = await page.evaluate(async () => {
    const r = await fetch('/api/admin/analytics')
    if (!r.ok) return { ok: false, status: r.status }
    const { analytics } = await r.json()
    return {
      ok: true,
      has_pipeline: !!analytics.pipeline,
      has_event_coverage: !!analytics.event_coverage,
      has_leader_health: !!analytics.leader_health,
      has_errors_by_version: !!analytics.errors_by_version,
      pipeline: analytics.pipeline,
      event_coverage: analytics.event_coverage,
    }
  })

  // 4. Create a dictionary (server: dictionary_created).
  report.steps.create_dict = await page.evaluate(async (id) => {
    const r = await fetch('/api/dictionaries/create', {
      method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ id, name: `E2E Log ${id}`, gloss_languages: ['en'] }),
    })
    return { status: r.status, body: await r.text() }
  }, DICT_ID)

  // 5. Open the dictionary entries page — boots the OPFS leader worker (client: dictionary_opened).
  await page.goto(`${BASE}/${DICT_ID}/entries`, { waitUntil: 'networkidle2' }).catch(() => {})
  const add_button_appeared = await page.waitForSelector('.add-entry-button', { timeout: 25000 }).then(() => true).catch(() => false)
  report.steps.dict_opened = await page.evaluate(() => {
    const btn = document.querySelector('.add-entry-button')
    return { url: location.pathname, has_add_button: !!btn, add_disabled: btn?.disabled ?? null, body_snippet: document.body.innerText.replace(/\s+/g, ' ').slice(0, 180) }
  })
  await shot('2-dict-opened')

  // 6. Add an entry with NATIVE interactions (OPFS write + /changes push).
  report.steps.add_button_appeared = add_button_appeared
  const add_clicked = await page.evaluate(() => {
    const btn = [...document.querySelectorAll('.add-entry-button')].find(b => !b.disabled && b.offsetParent !== null)
    if (!btn) return false
    btn.click()
    return true
  })
  // The modal input is the only one inside a <form> (the search box ALSO uses
  // .form-input but isn't in a form), so scope to `form input.form-input`.
  const input_handle = await page.waitForSelector('form input.form-input', { visible: true, timeout: 8000 }).catch(() => null)
  let typed_value = null
  let submit_clicked = false
  if (input_handle) {
    await input_handle.click({ clickCount: 3 })
    await input_handle.type(LEXEME, { delay: 25 })
    await sleep(200)
    typed_value = await page.evaluate(() => document.querySelector('form input.form-input')?.value ?? null)
    submit_clicked = await page.evaluate(() => {
      const btn = document.querySelector('form button[type="submit"]')
      if (!btn) return false
      btn.click()
      return true
    })
  }
  await sleep(6000) // local OPFS write + /changes round-trip
  report.steps.add_entry = { add_clicked, modal_opened: !!input_handle, typed_value, submit_clicked, ...await page.evaluate(lex => ({
    lexeme_visible: document.body.innerText.includes(lex),
  }), LEXEME) }
  await shot('3-entry-added')

  // 7. Search for the entry (client: search_performed + search timing).
  await page.goto(`${BASE}/${DICT_ID}/entries?q[query]=${encodeURIComponent(LEXEME)}`, { waitUntil: 'networkidle2' }).catch(() => {})
  await sleep(3000)
  report.steps.search = await page.evaluate(lex => ({ found: document.body.innerText.includes(lex) }), LEXEME)
  await shot('4-search')

  // 8. Open the entry detail (client: entry_opened). Find the first entry link.
  const entry_href = await page.evaluate((id) => {
    const a = [...document.querySelectorAll('a')].find(a => a.getAttribute('href')?.startsWith(`/${id}/entry/`))
    return a?.getAttribute('href') ?? null
  }, DICT_ID)
  if (entry_href) {
    await page.goto(`${BASE}${entry_href}`, { waitUntil: 'networkidle2' }).catch(() => {})
    await sleep(2500)
    report.steps.entry_opened = await page.evaluate(lex => ({ url: location.pathname, shows_lexeme: document.body.innerText.includes(lex) }), LEXEME)
    await shot('5-entry-detail')
  } else {
    report.steps.entry_opened = { url: null, note: 'no entry link found' }
  }

  // 9. Anonymous viewer of the dict in a FRESH context (no cookie) — viewer OPFS boot.
  const anon_ctx = await browser.createBrowserContext()
  const anon = await anon_ctx.newPage()
  const anon_errors = []
  anon.on('pageerror', e => anon_errors.push(e.message.split('\n')[0]))
  await anon.goto(`${BASE}/${DICT_ID}/entries`, { waitUntil: 'networkidle2' }).catch(() => {})
  await sleep(4000)
  report.steps.anon_viewer = { ...await anon.evaluate(lex => ({ url: location.pathname, status_hint: document.body.innerText.replace(/\s+/g, ' ').slice(0, 160), lexeme_visible: document.body.innerText.includes(lex) }), LEXEME), errors: anon_errors }
  await anon.screenshot({ path: `${SHOTS}/6-anon-viewer.png` }).catch(() => {})
  await anon_ctx.close()

  // 10. Let logs flush (flush interval 5s; beacon on pagehide).
  await sleep(8000)
} catch (err) {
  report.fatal = err.message
} finally {
  console.log(JSON.stringify(report, null, 2))
  await browser.close()
}
