#!/usr/bin/env node
/* eslint-disable no-console, node/prefer-global/process */
// Parity screenshots for the UnoCSS → scoped-CSS conversion (.issues/drop-unocss.md).
// Shoots the main-site routes against the running dev server (:3041 by default).
//
//   node e2e/uno-parity-shots.mjs <out_dir> [only_prefix[,only_prefix2…]]
//
// Run once before converting a phase (e.g. → /tmp/uno-parity/before) and once after
// (→ /tmp/uno-parity/after-1), then diff with ImageMagick:
//   compare -metric AE before/x.png after-1/x.png diff/x.png
// The home globe (Mapbox tiles/animation) is expected to drift — eyeball it instead.
import { mkdir } from 'node:fs/promises'
import { join } from 'node:path'
import { launch } from '/home/jacob/.claude/skills/browser-tools/browser-launch.mjs'

const base = process.env.BASE_URL || 'http://localhost:3041'
const out = process.argv[2] || '/tmp/uno-parity/shots'
const only = process.argv[3] ? process.argv[3].split(',') : null

const sleep = ms => new Promise(resolve => setTimeout(resolve, ms))

/** @type {Array<{ name: string, url: string, wait?: number, width?: number, login?: boolean, setup?: (page: import('puppeteer-core').Page) => Promise<void> }>} */
const shots = [
  { name: 'home', url: '/', wait: 3500 },
  { name: 'home-narrow', url: '/', wait: 3500, width: 480 },
  { name: 'auth-modal', url: '/', wait: 2500, setup: async (page) => {
    await click_button_with_text(page, '登录') // dev locale is zh; falls through to English
    await click_button_with_text(page, 'Sign in')
    await sleep(600)
  } },
  { name: 'dictionaries', url: '/dictionaries', wait: 2500 },
  { name: 'about', url: '/about', wait: 1500 },
  { name: 'tutorials', url: '/tutorials', wait: 1500 },
  { name: 'terms', url: '/terms', wait: 1200 },
  { name: 'account', url: '/account', wait: 1500, login: true },
  { name: 'create-dictionary', url: '/create-dictionary', wait: 2000, login: true },
  { name: 'entries-list', url: '/achi/entries', wait: 5000, login: true },
  { name: 'entries-list-narrow', url: '/achi/entries', wait: 5000, width: 480, login: true },
  { name: 'entries-table', url: '/achi/entries?view=table', wait: 5000, login: true },
  { name: 'entries-gallery', url: '/achi/entries?view=gallery', wait: 5000, login: true },
  { name: 'entries-print', url: '/achi/entries?view=print', wait: 5000, login: true },
  { name: 'entry-detail', url: '/achi/entry/e_abaj', wait: 4500, login: true },
  { name: 'entry-detail-narrow', url: '/achi/entry/e_abaj', wait: 4500, width: 480, login: true },
  { name: 'dict-about', url: '/achi/about', wait: 3000, login: true },
  { name: 'dict-contributors', url: '/achi/contributors', wait: 3000, login: true },
  { name: 'dict-settings', url: '/achi/settings', wait: 3500, login: true },
  { name: 'dict-export', url: '/achi/export', wait: 3000, login: true },
  { name: 'dict-import', url: '/achi/import', wait: 3000, login: true },
  { name: 'dict-grammar', url: '/achi/grammar', wait: 3000, login: true },
  { name: 'dict-synopsis', url: '/achi/synopsis', wait: 3000, login: true },
]

async function click_button_with_text(page, text) {
  await page.evaluate((text) => {
    const els = [...document.querySelectorAll('button, a')]
    els.find(el => el.textContent?.toLowerCase().includes(text.toLowerCase()))?.click()
  }, text)
}

async function api_login(page, email) {
  return page.evaluate(async (email) => {
    const send = await (await fetch('/api/auth/email/send-code', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ email }) })).json()
    const verify = await fetch('/api/auth/email/verify', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ email, code: send.code }) })
    return verify.status
  }, email)
}

async function main() {
  await mkdir(out, { recursive: true })
  const browser = await launch()
  const page = await browser.newPage()
  const errors = []
  page.on('pageerror', event => errors.push(event.message.split('\n')[0]))
  // Google avatars intermittently ERR_BLOCKED_BY_ORB in headless — block them outright so
  // the avatar fallback renders deterministically in every run (no false diffs).
  await page.setRequestInterception(true)
  page.on('request', (request) => {
    if (request.url().includes('googleusercontent.com'))
      return request.abort()
    request.continue()
  })
  let logged_in = false

  for (const shot of shots) {
    if (only && !only.some(prefix => shot.name.startsWith(prefix)))
      continue
    if (shot.login && !logged_in) {
      await page.goto(`${base}/`, { waitUntil: 'domcontentloaded' })
      const status = await api_login(page, 'jwrunner7@gmail.com')
      if (status !== 200)
        throw new Error(`login failed: ${status}`)
      logged_in = true
    }
    await page.setViewport({ width: shot.width || 1280, height: 900 })
    await page.goto(`${base}${shot.url}`, { waitUntil: 'networkidle2', timeout: 45000 }).catch(() => {})
    await sleep(shot.wait || 1500)
    if (shot.setup)
      await shot.setup(page)
    await page.screenshot({ path: join(out, `${shot.name}.png`) })
    console.log(`  ${shot.name}: ${page.url()}`)
  }

  console.log(JSON.stringify({ out, page_errors: [...new Set(errors)] }, null, 2))
  await browser.close()
}

main().catch((error) => { console.error(error); process.exitCode = 1 })
