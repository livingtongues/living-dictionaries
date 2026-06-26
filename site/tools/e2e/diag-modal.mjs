// Dump the add-entry modal DOM (buttons + form) to see how to submit it.
import { execFileSync } from 'node:child_process'
import { launch } from '/home/jacob/.claude/skills/browser-tools/browser-launch.mjs'

const BASE = 'https://new.livingdictionaries.app'
const EMAIL = 'jwrunner7@gmail.com'
const DICT = process.argv[2]
const sleep = ms => new Promise(r => setTimeout(r, ms))
function otp() {
  const js = `const db=require('better-sqlite3')('/data/shared.db',{readonly:true});const r=db.prepare("SELECT code FROM email_codes WHERE email=? ORDER BY created_at DESC LIMIT 1").get(${JSON.stringify(EMAIL)});process.stdout.write(r?r.code:'')`
  return execFileSync('ssh', ['living', 'docker exec -i sveltekit_blue node'], { input: js }).toString().trim()
}

const browser = await launch()
const page = await browser.newPage()
await page.setViewport({ width: 1280, height: 900 })
const out = {}
await page.goto(`${BASE}/`, { waitUntil: 'networkidle2' }).catch(() => {})
await page.evaluate(async (email) => { await fetch('/api/auth/email/send-code', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ email }) }) }, EMAIL)
await sleep(500)
const code = otp()
await page.evaluate(async (email, code) => { await fetch('/api/auth/email/verify', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ email, code }) }) }, EMAIL, code)

await page.goto(`${BASE}/${DICT}/entries`, { waitUntil: 'networkidle2' }).catch(() => {})
await page.waitForSelector('.add-entry-button', { timeout: 25000 }).catch(() => {})
await sleep(1000)
out.before_click_buttons = await page.evaluate(() => [...document.querySelectorAll('button')].map(b => ({ t: b.type, txt: b.textContent.trim().slice(0, 20), cls: b.className.slice(0, 30) })).slice(0, 30))
await page.evaluate(() => { const b = [...document.querySelectorAll('.add-entry-button')].find(x => x.offsetParent !== null); b?.click() })
await sleep(1500)
out.modal = await page.evaluate(() => {
  const inputs = [...document.querySelectorAll('input')].map(i => ({ cls: i.className.slice(0, 30), type: i.type }))
  const buttons = [...document.querySelectorAll('button')].map(b => ({ t: b.type, txt: b.textContent.trim().slice(0, 20), vis: b.offsetParent !== null }))
  const forms = document.querySelectorAll('form').length
  return { inputs, buttons, forms }
})
console.log(JSON.stringify(out, null, 2))
await browser.close()
