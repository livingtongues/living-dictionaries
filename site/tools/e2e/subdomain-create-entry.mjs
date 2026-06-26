// Verify the editor entry-WRITE + /changes push on the LIVE subdomain (real
// prod build) after the #writes proxy fix. Headless; OTP read from the VPS
// shared.db; server-side ground truth via ssh. Generates prod telemetry too.
//
// Run: node tools/e2e/subdomain-create-entry.mjs
import { execFileSync } from 'node:child_process'
import { launch } from '/home/jacob/.claude/skills/browser-tools/browser-launch.mjs'

const BASE = 'https://new.livingdictionaries.app'
const EMAIL = 'jwrunner7@gmail.com'
const sleep = ms => new Promise(r => setTimeout(r, ms))
const stamp = Date.now().toString(36)
const DICT_ID = `wfix-${stamp}`
const LEXEME = `wfixword-${stamp}`
const report = { base: BASE, dict_id: DICT_ID, lexeme: LEXEME, steps: {}, dialogs: [], page_errors: [] }

function ssh_node(js) { return execFileSync('ssh', ['living', 'docker exec -i sveltekit_blue node'], { input: js }).toString().trim() }
function otp() {
  return ssh_node(`const db=require('better-sqlite3')('/data/shared.db',{readonly:true});const r=db.prepare("SELECT code FROM email_codes WHERE email=? ORDER BY created_at DESC LIMIT 1").get(${JSON.stringify(EMAIL)});process.stdout.write(r?r.code:'')`)
}

const browser = await launch()
const page = await browser.newPage()
page.setDefaultTimeout(25000)
page.on('dialog', async (d) => { report.dialogs.push(d.message().slice(0, 200)); await d.dismiss().catch(() => {}) })
page.on('pageerror', e => report.page_errors.push(e.message.split('\n')[0]))

try {
  await page.goto(`${BASE}/`, { waitUntil: 'networkidle2' }).catch(() => {})
  await page.evaluate(async (email) => { await fetch('/api/auth/email/send-code', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ email }) }) }, EMAIL)
  await sleep(700)
  const code = otp()
  report.steps.login = await page.evaluate(async (email, c) => {
    const r = await fetch('/api/auth/email/verify', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ email, code: c }) })
    return { verify_status: r.status }
  }, EMAIL, code)

  report.steps.create_dict = await page.evaluate(async (id) => {
    const r = await fetch('/api/dictionaries/create', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ id, name: `Wfix ${id}`, gloss_languages: ['en'] }) })
    return { status: r.status }
  }, DICT_ID)

  await page.goto(`${BASE}/${DICT_ID}/entries`, { waitUntil: 'networkidle2' }).catch(() => {})
  const add_button = await page.waitForSelector('.add-entry-button', { visible: true, timeout: 40000 }).then(() => true).catch(() => false)
  await sleep(3000)
  report.steps.dict_opened = { add_button }

  // Open modal, set the lexeme value directly (save() reads inputEl.value), submit.
  await page.evaluate(() => { const b = [...document.querySelectorAll('.add-entry-button')].find(x => !x.disabled && x.offsetParent !== null); b?.click() })
  const input = await page.waitForSelector('form input.form-input', { visible: true, timeout: 12000 }).catch(() => null)
  let typed = null, submitted = false
  if (input) {
    typed = await page.$eval('form input.form-input', (el, val) => {
      const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set
      setter.call(el, val); el.dispatchEvent(new Event('input', { bubbles: true }))
      return el.value
    }, LEXEME)
    submitted = await page.evaluate(() => { const b = document.querySelector('form button[type="submit"]'); if (!b) return false; b.click(); return true })
  }
  report.steps.add_entry = { modal_opened: !!input, typed, submitted }
  await sleep(9000) // OPFS write + /changes push round-trip

  // Open the new entry detail if the write landed a link (entry_opened).
  await page.goto(`${BASE}/${DICT_ID}/entries`, { waitUntil: 'networkidle2' }).catch(() => {})
  await sleep(3000)
  const href = await page.evaluate(id => [...document.querySelectorAll('a')].find(a => a.getAttribute('href')?.startsWith(`/${id}/entry/`))?.getAttribute('href') ?? null, DICT_ID)
  if (href) {
    await page.goto(`${BASE}${href}`, { waitUntil: 'networkidle2' }).catch(() => {})
    await sleep(2500)
    report.steps.entry_opened = await page.evaluate(lex => ({ url: location.pathname, shows: document.body.innerText.includes(lex) }), LEXEME)
  } else { report.steps.entry_opened = { note: 'no entry link' } }
  await sleep(6000) // flush logs
} catch (err) { report.fatal = err.message } finally {
  // Server-side ground truth from the VPS.
  try {
    report.server_truth = JSON.parse(ssh_node(`const D='${DICT_ID}';const fs=require('fs');const Database=require('better-sqlite3');
const p='/data/dictionaries/'+D+'.db';let entries=null,lex=[];
try{const dd=new Database(p,{readonly:true});entries=dd.prepare('SELECT COUNT(*) c FROM entries').get().c;lex=dd.prepare('SELECT lexeme FROM entries LIMIT 3').all().map(r=>r.lexeme)}catch(e){entries='ERR:'+e.message}
const sh=new Database('/data/shared.db',{readonly:true});
const push=sh.prepare("SELECT context FROM client_logs WHERE message='dict_changes_pushed' AND context LIKE '%'||?||'%' ORDER BY received_at DESC LIMIT 2").all(D);
const ev=sh.prepare("SELECT message, COUNT(*) c FROM client_logs WHERE received_at > datetime('now','-10 minutes') AND message IN ('dict_changes_pushed','entry_opened','dictionary_opened','dictionary_created','auth_login') GROUP BY message").all();
process.stdout.write(JSON.stringify({dict_db_exists:fs.existsSync(p),entries,lexemes:lex,pushes:push,recent:ev}));`))
  } catch (e) { report.server_truth = { error: e.message } }
  console.log(JSON.stringify(report, null, 2))
  await browser.close().catch(() => {})
}
