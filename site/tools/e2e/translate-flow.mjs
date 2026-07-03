/**
 * End-to-end check for the /translate translator backend:
 *  1. Fresh user registers (email OTP; dev returns the code inline) → /translate shows the invite-only gate.
 *  2. Admin (Jacob) assigns them Spanish via the admin endpoint; /admin/users/[id] shows the card.
 *  3. Translator reloads /translate → editor with Español; UserMenu shows the Translate link.
 *  4. Translator types a translation + blurs → saved (verified via the API, source='human').
 *  5. A pre-seeded AI-flagged row shows "please review"; "Looks good" approves it.
 *  6. Cleanup: test rows removed (empty-save delete path exercised on the way).
 * Run: node tools/e2e/translate-flow.mjs   (dev server on 3041)
 */
import { createRequire } from 'node:module'
import { launch } from '/home/jacob/.claude/skills/browser-tools/browser-launch.mjs'

const require = createRequire(import.meta.url)
const Database = require('better-sqlite3')

const BASE = 'http://localhost:3041'
const ts = Date.now()
const TRANSLATOR_EMAIL = `e2e-translator+${ts}@example.com`
const HUMAN_KEY = 'misc.appearance' // untranslated in es (post-sheet key); cleaned up at the end
const AI_KEY = 'misc.reload' // gets a pre-seeded flagged AI row
const failures = []

function check(label, ok, detail = '') {
  console.log(`${ok ? 'PASS' : 'FAIL'} ${label}${detail ? ` — ${detail}` : ''}`)
  if (!ok)
    failures.push(label)
}

async function login(page, email) {
  await page.goto(`${BASE}/`, { waitUntil: 'networkidle2' })
  const result = await page.evaluate(async (login_email) => {
    const send = await fetch('/api/auth/email/send-code', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ email: login_email }),
    })
    const { code } = await send.json()
    const verify = await fetch('/api/auth/email/verify', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ email: login_email, code }),
    })
    return { status: verify.status, body: await verify.json() }
  }, email)
  if (result.status !== 200)
    throw new Error(`login failed for ${email}: ${JSON.stringify(result)}`)
  return result.body
}

// Pre-seed a flagged AI translation directly in the dev DB (the fill-translations
// slash command's write shape).
const db = new Database('.data/shared.db')
db.prepare(`INSERT INTO i18n_translations (id, key_id, locale, value, source, needs_review, updated_by_name)
  VALUES (?, ?, 'es', 'Recargar (AI)', 'ai', 'ai', 'AI (e2e)')
  ON CONFLICT (key_id, locale) DO UPDATE SET value = excluded.value, source = 'ai', needs_review = 'ai'`)
  .run(crypto.randomUUID(), AI_KEY)
db.close()

const browser_admin = await launch()
const browser_tr = await launch()

try {
  const admin = await browser_admin.newPage()
  const translator = await browser_tr.newPage()
  const page_errors = []
  admin.on('pageerror', error => page_errors.push(`admin: ${error.message}`))
  translator.on('pageerror', error => page_errors.push(`translator: ${error.message}`))
  admin.on('dialog', dialog => dialog.accept())
  translator.on('dialog', dialog => dialog.accept())

  // 1. Fresh user → invite-only gate.
  const me = await login(translator, TRANSLATOR_EMAIL)
  const translator_user_id = me.user?.id ?? me.id
  await translator.goto(`${BASE}/translate`, { waitUntil: 'networkidle2' })
  const gate = await translator.evaluate(() => document.body.innerText.includes('Translation is invite-only'))
  check('unassigned user sees the invite-only gate', gate)

  // 2. Admin assigns Spanish via the endpoint.
  await login(admin, 'jwrunner7@gmail.com')
  const assign = await admin.evaluate(async (user_id) => {
    const response = await fetch(`/api/admin/users/${user_id}/translator-languages`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ locale: 'es', action: 'add' }),
    })
    return { status: response.status, body: await response.json() }
  }, translator_user_id)
  check('admin assigns Spanish', assign.status === 200 && assign.body.locales.includes('es'), JSON.stringify(assign))

  // Admin user page shows the card (needs the users row in the admin's local mirror via sync).
  await admin.goto(`${BASE}/admin/users/${translator_user_id}`, { waitUntil: 'networkidle2' })
  const card_ok = await admin.waitForFunction(
    () => document.body.innerText.includes('Translator languages') && document.body.innerText.includes('Español'),
    { timeout: 20000 },
  ).then(() => true).catch(() => false)
  check('admin user page shows the Translator languages card with Español', card_ok)

  // 3. Translator reloads → editor. UserMenu link on home page.
  await translator.goto(`${BASE}/translate`, { waitUntil: 'networkidle2' })
  await translator.waitForSelector('.row textarea', { timeout: 15000 })
  const heading = await translator.evaluate(() => document.body.innerText.includes('Español'))
  check('translator sees the Español editor', heading)
  const no_admin_panel = await translator.evaluate(() => !document.body.innerText.includes('Notify translators'))
  check('translator does NOT see the admin panel', no_admin_panel)

  await translator.goto(`${BASE}/`, { waitUntil: 'networkidle2' })
  await translator.waitForSelector('.avatar-button', { timeout: 10000 })
  await translator.click('.avatar-button')
  const has_menu_link = await translator.waitForSelector('a[href="/translate"]', { timeout: 5000 }).then(() => true).catch(() => false)
  check('UserMenu shows the Translate link', has_menu_link)

  // 4. Save a human translation for HUMAN_KEY via the UI.
  await translator.goto(`${BASE}/translate?locale=es`, { waitUntil: 'networkidle2' })
  await translator.waitForSelector('.row textarea', { timeout: 15000 })
  const typed = await translator.evaluate((key) => {
    const rows = [...document.querySelectorAll('.row')]
    const target = rows.find(row => row.querySelector('.key')?.textContent === key)
    if (!target)
      return false
    const textarea = target.querySelector('textarea')
    textarea.focus()
    return true
  }, HUMAN_KEY)
  check('found the target row', typed)
  await translator.keyboard.type(`Prueba e2e ${ts}`)
  await translator.evaluate(() => document.activeElement.blur())
  const saved = await translator.waitForFunction(
    key => [...document.querySelectorAll('.row')].find(row => row.querySelector('.key')?.textContent === key)?.innerText.includes('Saved'),
    { timeout: 10000 },
    HUMAN_KEY,
  ).then(() => true).catch(() => false)
  check('blur saved the translation (Saved flash)', saved)

  const api_row = await translator.evaluate(async (key) => {
    const response = await fetch('/api/translate/data?locale=es')
    const { rows } = await response.json()
    return rows.find(entry => entry.key_id === key)
  }, HUMAN_KEY)
  check('API confirms source=human + attribution', api_row?.source === 'human' && !!api_row?.updated_by_name, JSON.stringify(api_row))

  // 5. The AI-flagged row shows in "To review" and approves.
  await translator.goto(`${BASE}/translate?locale=es&filter=flagged`, { waitUntil: 'networkidle2' })
  await translator.waitForSelector('.row textarea', { timeout: 15000 })
  const flagged_visible = await translator.evaluate(key => [...document.querySelectorAll('.row')].some(row => row.querySelector('.key')?.textContent === key && row.innerText.includes('AI translation')), AI_KEY)
  check('AI-flagged row shows under "To review"', flagged_visible)
  await translator.evaluate((key) => {
    const row = [...document.querySelectorAll('.row')].find(entry => entry.querySelector('.key')?.textContent === key)
    const approve = [...row.querySelectorAll('button')].find(button => button.innerText.includes('Looks good'))
    approve.click()
  }, AI_KEY)
  const approved = await translator.waitForFunction(
    key => ![...document.querySelectorAll('.row')].some(row => row.querySelector('.key')?.textContent === key && row.innerText.includes('AI translation')),
    { timeout: 10000 },
    AI_KEY,
  ).then(() => true).catch(() => false)
  check('"Looks good" clears the review flag', approved)

  // 6. Cleanup via the empty-save delete path.
  const cleanup = await translator.evaluate(async (keys) => {
    const results = []
    for (const key_id of keys) {
      const response = await fetch('/api/translate/save', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ key_id, locale: 'es', value: '' }),
      })
      results.push((await response.json()).row)
    }
    return results
  }, [HUMAN_KEY, AI_KEY])
  check('empty-save deletes both test rows', cleanup.every(row => row === null))

  check('no page errors', page_errors.length === 0, page_errors.join(' | '))
} finally {
  await browser_admin.close()
  await browser_tr.close()
}

console.log(failures.length ? `\n${failures.length} FAILURES` : '\nALL PASS')
process.exit(failures.length ? 1 : 0)
