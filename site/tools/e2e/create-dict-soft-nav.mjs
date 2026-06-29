// Regression: the create-dictionary flow does a SOFT client-side `goto` (was
// window.location.replace) and a brand-new NON-admin manager can immediately
// edit — proving `dict_roles.refresh()` picked up the fresh manager grant before
// navigation, and that a snapshot-less new dict boots + writes through to a
// freshly-created server dictionaries/<id>.db.
//
// Uses a fresh @example.com user (NOT in the admin allow-list) so `can_edit`
// hinges entirely on the manager grant — a site-admin would mask the path.
//
// Run: node tools/e2e/create-dict-soft-nav.mjs   (needs the dev server on :3041)
// Exit code is non-zero if any assertion fails.
import Database from '/home/jacob/code/living-dictionaries/site/node_modules/better-sqlite3/lib/index.js'
import { launch } from '/home/jacob/.claude/skills/browser-tools/browser-launch.mjs'

const BASE = process.env.E2E_BASE || 'http://localhost:3041'
const DATA = '/home/jacob/code/living-dictionaries/site/.data'
const SHOTS = '/home/jacob/code/living-dictionaries/site/tools/e2e/shots'
const stamp = Date.now().toString(36)
const EMAIL = `softnav+${stamp}@example.com`
const LEXEME = `softnav-${stamp}`
const sleep = ms => new Promise(r => setTimeout(r, ms))
// Known ambient noise unrelated to this flow: Keyman on-screen-keyboard assets
// (kmwosk.css / .js) 404 + the occasional Keyman wrapper firstElementChild blip
// when the lexeme input mounts in headless — neither touches create/soft-nav.
const AMBIENT = [/osk\/kmw/i, /keyman/i, /firstElementChild/i]
const is_ambient = s => AMBIENT.some(re => re.test(s))

const report = { base: BASE, email: EMAIL, steps: {}, dialogs: [], page_errors: [], bad_responses: [] }
let phase = 'login'

function server_dict_entries(id) {
  try {
    const d = new Database(`${DATA}/dictionaries/${id}.db`, { readonly: true })
    const count = d.prepare('SELECT COUNT(*) c FROM entries').get().c
    d.close()
    return { exists: true, entries: count }
  } catch (e) { return { exists: false, error: e.message.split('\n')[0] } }
}

const browser = await launch()
const page = await browser.newPage()
page.setDefaultTimeout(30000)
page.on('dialog', async (d) => { report.dialogs.push({ phase, type: d.type(), message: d.message().slice(0, 120) }); await d.accept().catch(() => {}) })
page.on('pageerror', e => report.page_errors.push({ phase, msg: e.message.split('\n')[0] }))
page.on('response', r => { if (r.status() >= 400) report.bad_responses.push({ phase, status: r.status(), url: r.url().slice(0, 120) }) })
const shot = async n => { await page.screenshot({ path: `${SHOTS}/softnav-${n}.png` }).catch(() => {}) }
// Real document loads — a soft nav adds ZERO; a hard reload adds one.
await page.evaluateOnNewDocument(() => { window.__doc_loads = (window.__doc_loads || 0) + 1 })

try {
  // 1. Sign up + login (dev returns the OTP inline).
  await page.goto(`${BASE}/`, { waitUntil: 'domcontentloaded' })
  report.steps.login = await page.evaluate(async (email) => {
    const s = await fetch('/api/auth/email/send-code', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ email }) })
    const { code } = await s.json()
    const v = await fetch('/api/auth/email/verify', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ email, code }) })
    return { code_ok: !!code, verify_status: v.status }
  }, EMAIL)

  // 2. Full-load the create page (dev onMount prefills name/conlang/etc.).
  phase = 'create-page'
  await page.goto(`${BASE}/create-dictionary`, { waitUntil: 'networkidle2' })
  await page.waitForSelector('#name')
  await sleep(500)

  // 3. Fill the conlang=false branch to validity.
  const conlang_radios = await page.$$('input[name="conlang"]')
  await conlang_radios[1].click() // value={false} → renders the false-branch fields
  await page.waitForSelector('textarea[name="authorConnection"]', { visible: true })
  await page.$eval('textarea[name="authorConnection"]', (el) => {
    const setter = Object.getOwnPropertyDescriptor(window.HTMLTextAreaElement.prototype, 'value').set
    setter.call(el, 'We work directly with this language community as documented field linguists. '.repeat(3))
    el.dispatchEvent(new Event('input', { bubbles: true }))
  })
  await page.click('input[name="communityPermission"][value="no"]')
  await page.click('#citeAgreement')
  await page.click('#non-commercialAgreement')

  const slug = await page.$eval('#url', el => el.value)
  report.slug = slug
  // Soft-nav probes: a value on window + the live document-load count.
  await page.evaluate(() => { window.__probe = `alive-${Date.now()}`; window.__doc_loads_at_submit = window.__doc_loads })
  await shot('1-form-filled')

  // 4. Submit via the real submit button (as its submitter) and catch the spinner
  //    (the button goes disabled while Form `loading` is true through the goto).
  phase = 'submit-and-nav'
  await page.evaluate(() => document.querySelector('form').requestSubmit(document.querySelector('.submit-button')))
  report.steps.spinner_seen = await page.waitForFunction(
    () => document.querySelector('.submit-button')?.disabled === true,
    { polling: 'raf', timeout: 4000 },
  ).then(() => true).catch(() => false)

  // 5. Wait for the navigation to /<slug>/entries.
  await page.waitForFunction(s => location.pathname === `/${s}/entries`, { timeout: 30000 }, slug)

  // 6. SOFT-NAV assertions — JS context survived, no extra document load.
  report.steps.soft_nav = await page.evaluate(() => ({
    pathname: location.pathname,
    probe_survived: typeof window.__probe === 'string',
    doc_loads_before: window.__doc_loads_at_submit ?? null,
    doc_loads_after: window.__doc_loads ?? null,
  }))

  // 7. can_edit — the add-entry button (lazy import, gated by {#if can_edit})
  //    existing in the DOM proves the fresh non-admin manager grant was picked up.
  phase = 'entries-page'
  await page.waitForSelector('.add-entry-button', { timeout: 15000 }).catch(() => {})
  await sleep(1500)
  report.steps.can_edit = await page.evaluate(() => ({
    add_entry_button_count: document.querySelectorAll('.add-entry-button').length,
    reset_cache_present: document.body.innerText.includes('Reset Cache'),
  }))
  // Probe: did merely opening the dict (editor snapshot fetch via GET /db) already
  // create the server dictionaries/<id>.db, BEFORE any edit?
  report.steps.server_db_at_boot = server_dict_entries(slug)
  await shot('2-entries-page')

  // 8. Add an entry → first /changes push → server dictionaries/<id>.db is created.
  phase = 'add-entry'
  await page.evaluate(() => { const b = [...document.querySelectorAll('.add-entry-button')].find(x => !x.disabled && x.offsetParent !== null); b?.click() })
  const input = await page.waitForSelector('form input.form-input', { visible: true, timeout: 10000 }).catch(() => null)
  if (input) {
    await page.$eval('form input.form-input', (el, val) => {
      const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set
      setter.call(el, val)
      el.dispatchEvent(new Event('input', { bubbles: true }))
    }, LEXEME)
    await page.evaluate(() => document.querySelector('form button[type="submit"]')?.click())
  }
  let landed = { exists: false, entries: 0 }
  for (let i = 0; i < 30; i++) { await sleep(1000); landed = server_dict_entries(slug); if (landed.entries > 0) break }
  report.steps.server_write = landed
  await shot('3-after-add-entry')
  await sleep(3000) // flush logs
} catch (err) {
  report.fatal = err.message.split('\n')[0]
  await shot('fatal')
} finally {
  await browser.close().catch(() => {})

  // Drop ambient (Keyman) noise from the error gates.
  const real_page_errors = report.page_errors.filter(e => !is_ambient(e.msg))
  const real_bad = report.bad_responses.filter(r => !is_ambient(r.url))

  const a = []
  const ok = (name, cond) => a.push({ name, pass: !!cond })
  ok('logged_in', report.steps.login?.verify_status === 200)
  ok('soft_nav_no_full_reload', report.steps.soft_nav?.probe_survived === true && report.steps.soft_nav?.doc_loads_after === report.steps.soft_nav?.doc_loads_before)
  ok('landed_on_entries', report.steps.soft_nav?.pathname === `/${report.slug}/entries`)
  ok('spinner_shown', report.steps.spinner_seen === true)
  ok('non_admin_manager_can_edit', (report.steps.can_edit?.add_entry_button_count ?? 0) > 0)
  ok('server_db_created_with_entry', report.steps.server_write?.entries > 0)
  ok('no_real_page_errors', real_page_errors.length === 0)
  ok('no_real_bad_responses', real_bad.length === 0)

  report.assertions = a
  report.ambient_ignored = { page_errors: report.page_errors.filter(e => is_ambient(e.msg)), bad_responses: report.bad_responses.filter(r => is_ambient(r.url)) }
  const failed = a.filter(x => !x.pass)
  report.result = failed.length === 0 && !report.fatal ? 'PASS' : 'FAIL'
  console.log(JSON.stringify(report, null, 2))
  process.exit(report.result === 'PASS' ? 0 : 1)
}
