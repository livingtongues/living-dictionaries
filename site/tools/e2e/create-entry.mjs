// Minimal, robust: log in as admin, open an existing dict, add ONE entry via the
// modal (scoped form input + Enter), then STOP touching the page (verify the
// write+sync server-side to avoid post-submit protocol hangs).
import { execFileSync } from 'node:child_process'
import { launch } from '/home/jacob/.claude/skills/browser-tools/browser-launch.mjs'

const BASE = 'https://new.livingdictionaries.app'
const EMAIL = 'jwrunner7@gmail.com'
const DICT = process.argv[2]
const LEX = `mkentry-${Date.now().toString(36)}`
const sleep = ms => new Promise(r => setTimeout(r, ms))
function otp() {
  const js = `const db=require('better-sqlite3')('/data/shared.db',{readonly:true});const r=db.prepare("SELECT code FROM email_codes WHERE email=? ORDER BY created_at DESC LIMIT 1").get(${JSON.stringify(EMAIL)});process.stdout.write(r?r.code:'')`
  return execFileSync('ssh', ['living', 'docker exec -i sveltekit_blue node'], { input: js }).toString().trim()
}

const browser = await launch()
const page = await browser.newPage()
page.setDefaultTimeout(15000)
console.log('lexeme:', LEX, 'dict:', DICT)
await page.goto(`${BASE}/`, { waitUntil: 'networkidle2' }).catch(() => {})
await page.evaluate(async (email) => { await fetch('/api/auth/email/send-code', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ email }) }) }, EMAIL)
await sleep(500)
const code = otp()
await page.evaluate(async (email, code) => { await fetch('/api/auth/email/verify', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ email, code }) }) }, EMAIL, code)

await page.goto(`${BASE}/${DICT}/entries`, { waitUntil: 'networkidle2' }).catch(() => {})
await page.waitForSelector('.add-entry-button', { visible: true }).catch(() => {})
await sleep(2000)
// Open modal
const btn = await page.$$('.add-entry-button')
for (const b of btn) { if (await b.evaluate(e => e.offsetParent !== null)) { await b.click(); break } }
// The lexeme input is Keyman-attached (intercepts CDP keystrokes → main-thread
// block headless). Bypass keystrokes: set the value directly (save() reads
// inputEl.value) + submit the form in ONE evaluate that returns immediately.
const did = await page.waitForSelector('form input.form-input', { visible: true })
  .then(() => page.evaluate((lex) => {
    const input = document.querySelector('form input.form-input')
    if (!input) return 'no-input'
    const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set
    setter.call(input, lex)
    input.dispatchEvent(new Event('input', { bubbles: true }))
    const btn = document.querySelector('form button[type="submit"]')
    if (!btn) return 'no-submit'
    btn.click()
    return 'submitted'
  }, LEX))
  .catch(e => `err:${e.message.slice(0, 60)}`)
console.log('submit:', did)
// Do NOT evaluate the page after submit (main thread may block on the OPFS RPC);
// just give the local write + /changes push time, then close.
await sleep(9000)
await browser.close().catch(() => {})
console.log('done')
