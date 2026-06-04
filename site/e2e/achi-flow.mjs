#!/usr/bin/env node
// Deep end-to-end flow test of the achi dictionary editor, driven with puppeteer-core against the
// system Chrome (no binary download — same engine svelte-look uses). Self-contained: it boots its
// own production `node build` server, runs the manager edit flow, asserts, screenshots each step,
// then tears everything down. Set BASE_URL to point at an already-running server and skip booting.
//
//   pnpm -F site build && pnpm -F site test:flow        # build once, then run
//   BASE_URL=http://localhost:3041 pnpm -F site test:flow   # against a running server
//
// Relies on the M2b stub seeding dummy achi entries + a logged-in mock manager (can_edit=true).
/* eslint-disable no-console, node/prefer-global/process, unicorn/prefer-dom-node-text-content -- node CLI: console is the output channel + process drives the exit code; innerText (not textContent) is the right API for asserting on whitespace-normalized RENDERED text */

import { spawn } from 'node:child_process'
import { existsSync } from 'node:fs'
import { mkdir } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const dir = dirname(fileURLToPath(import.meta.url))
const site_dir = join(dir, '..')
const screenshot_dir = join(dir, 'screenshots')

// Dedicated var so an ambient PORT (e.g. a dev shell's) doesn't collide with our self-booted server.
const port = process.env.FLOW_PORT || '3095'
const provided_base = process.env.BASE_URL
const base = provided_base || `http://localhost:${port}`

let server
let browser
let active_page
let shot_index = 0

function run(command, args) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, { cwd: site_dir, stdio: 'inherit' })
    child.on('error', reject)
    child.on('close', code => (code === 0 ? resolve() : reject(new Error(`${command} ${args.join(' ')} exited ${code}`))))
  })
}

async function ensure_build() {
  if (existsSync(join(site_dir, 'build/index.js'))) return
  console.log('• build/ missing — running `pnpm build` (local, no download)…')
  await run('pnpm', ['build'])
}

function boot_server() {
  return new Promise((resolve, reject) => {
    console.log(`• booting \`node build\` on :${port}…`)
    server = spawn('node', ['build'], { cwd: site_dir, env: { ...process.env, PORT: port } })
    const timer = setTimeout(() => reject(new Error('server did not log "Listening on" within 30s')), 30000)
    server.stdout.on('data', (chunk) => {
      if (chunk.toString().includes('Listening on')) {
        clearTimeout(timer)
        resolve()
      }
    })
    server.stderr.on('data', chunk => process.stderr.write(chunk))
    server.on('error', reject)
    server.on('close', code => reject(new Error(`server exited early (code ${code})`)))
  })
}

async function shot(page, name) {
  shot_index += 1
  const path = join(screenshot_dir, `${String(shot_index).padStart(2, '0')}-${name}.png`)
  await page.screenshot({ path })
  console.log(`  ↳ screenshot ${path}`)
}

function step(message) {
  console.log(`✓ ${message}`)
}

async function main() {
  await mkdir(screenshot_dir, { recursive: true })

  if (!provided_base) {
    await ensure_build()
    await boot_server()
  } else {
    console.log(`• using BASE_URL=${base} (not booting a server)`)
  }

  const puppeteer = (await import('puppeteer-core')).default
  const { getChromePath } = await import('chrome-launcher')
  browser = await puppeteer.launch({
    executablePath: getChromePath(),
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--lang=en-US'],
  })
  const page = await browser.newPage()
  active_page = page
  // Force English UI — the app picks locale from accept-language and headless Chrome may default
  // to another locale (e.g. zh), which would break the English text assertions below.
  await page.setExtraHTTPHeaders({ 'Accept-Language': 'en-US,en;q=0.9' })
  await page.setViewport({ width: 1100, height: 900 })

  // 1 — entries list renders the seeded dummy entries
  await page.goto(`${base}/achi/entries`, { waitUntil: 'domcontentloaded' })
  await page.waitForFunction(() => document.body.innerText.includes('1-13 / 13'), { timeout: 25000 })
  const entry_count = await page.evaluate(() => document.querySelectorAll('a[href*="/entry/"]').length)
  if (entry_count !== 13) throw new Error(`expected 13 entry links, found ${entry_count}`)
  await shot(page, 'entries-list')
  step(`entries list shows 13 entries (${entry_count} links)`)

  // 2 — open an entry → overlay editor
  await page.evaluate(() => {
    const link = [...document.querySelectorAll('a')].find(a => a.href.includes('/entry/e_ja'))
    if (!link) throw new Error('entry link for e_ja not found')
    link.click()
  })
  await page.waitForFunction(() => location.pathname === '/achi/entry/e_ja')
  await page.waitForFunction(() => document.body.innerText.includes('Add Audio'))
  await shot(page, 'entry-overlay')
  step('clicked entry e_ja → overlay editor open')

  // 3 — edit the phonetic field via its EditFieldModal (IPA keyboard input)
  await page.evaluate(() => {
    const field = [...document.querySelectorAll('div,span,button')]
      .find(el => el.textContent.trim().startsWith('Phonetic') && el.textContent.trim().length < 30)
    if (!field) throw new Error('phonetic field not found')
    field.click()
  })
  await page.waitForFunction(() => [...document.querySelectorAll('input[type=text]')].some(i => i.value === 'haʔ'))
  await page.evaluate(() => {
    const input = [...document.querySelectorAll('input[type=text]')].find(i => i.value === 'haʔ')
    const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set
    setter.call(input, 'haʔ-EDITED')
    input.dispatchEvent(new Event('input', { bubbles: true }))
    input.dispatchEvent(new Event('change', { bubbles: true }))
  })
  await page.evaluate(() => {
    const save = [...document.querySelectorAll('button')].find(b => b.offsetParent !== null && b.textContent.trim() === 'Save')
    if (!save) throw new Error('Save button not found')
    save.click()
  })
  await page.waitForFunction(() => document.body.innerText.includes('haʔ-EDITED'))
  await shot(page, 'phonetic-edited')
  step('edited phonetic → [haʔ-EDITED] reflected in the UI')

  // 4 — add a sense
  await page.evaluate(() => {
    const add = [...document.querySelectorAll('button')]
      .find(b => b.offsetParent !== null && b.innerHTML.includes('i-system-uicons-versions'))
    if (!add) throw new Error('Add Sense button not found')
    add.click()
  })
  await page.waitForFunction(() => document.body.innerText.includes('Sense 2'))
  await shot(page, 'sense-added')
  step('Add Sense → Sense 2 appears')

  // 5 — delete the newly-added sense (the last ✕)
  await page.evaluate(() => {
    const deletes = [...document.querySelectorAll('button')]
      .filter(b => b.offsetParent !== null && b.innerHTML.includes('i-fa-solid-times'))
    if (!deletes.length) throw new Error('delete-sense (✕) button not found')
    deletes[deletes.length - 1].click()
  })
  await page.waitForFunction(() => !document.body.innerText.includes('Sense 2'))
  const survives = await page.evaluate(() => document.body.innerText.includes('water'))
  if (!survives) throw new Error('original sense (gloss "water") missing after delete')
  await shot(page, 'sense-deleted')
  step('deleted Sense 2 → back to 1 sense, original sense intact')

  console.log('\n✅ achi deep-flow PASS — all 5 steps verified')
}

async function cleanup() {
  if (browser) await browser.close().catch(() => {})
  if (server && !server.killed) server.kill('SIGTERM')
}

main()
  .catch(async (error) => {
    console.error(`\n❌ achi deep-flow FAIL — ${error.message}`)
    if (active_page) {
      try {
        const diagnostics = await active_page.evaluate(() => ({
          pathname: location.pathname,
          has_add_audio: document.body.innerText.includes('Add Audio'),
          body: document.body.innerText.replace(/\s+/g, ' ').slice(0, 400),
        }))
        console.error('  diagnostics:', JSON.stringify(diagnostics, null, 2))
        await active_page.screenshot({ path: join(screenshot_dir, 'failure.png') })
      } catch {}
    }
    process.exitCode = 1
  })
  .finally(cleanup)
