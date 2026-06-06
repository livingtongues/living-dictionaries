#!/usr/bin/env node
// Proof for M4 media upload (legacy GCS, presigned PUT): a logged-in manager uploads a
// PHOTO and an AUDIO file; the bytes go to GCS via a presigned PUT (intercepted → 200 here,
// since the sandbox can't reach GCS), the image serving-url is minted via the GAE images
// service (mocked locally), and the resulting media ROW persists through the M4 write/sync
// path (wa-sqlite → POST /api/dictionary/[id]/changes → server SQLite) and renders on a
// fresh reload.
//
//   pnpm -F site build && pnpm -F site test:media
//
// "Mock all the image magic": real `getSignedUrl` (pure local crypto) runs with FAKE GCS
// creds, the GCS PUT + the lh3 image fetch are puppeteer-intercepted, and PROCESS_IMAGE_URL
// points at a tiny local stub that returns an lh3 serving id. Nothing leaves the machine.
/* eslint-disable no-console, node/prefer-global/process, unicorn/prefer-dom-node-text-content */

import { spawn } from 'node:child_process'
import { createServer } from 'node:http'
import { existsSync, mkdtempSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import Database from 'better-sqlite3'
import { launch } from '/home/jacob/.claude/skills/browser-tools/browser-launch.mjs'

const dir = dirname(fileURLToPath(import.meta.url))
const site_dir = join(dir, '..')
const port = process.env.MEDIA_PORT || '3105'
const image_mock_port = process.env.IMAGE_MOCK_PORT || '3106'
const base = process.env.BASE_URL || `http://localhost:${port}`
const dict_db_path = join(site_dir, '.data', 'dictionaries', 'achi.db')
const serving_id = `MOCK_SERVING_${Date.now()}`

let server
let image_mock
let browser

function run(command, args) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, { cwd: site_dir, stdio: 'inherit' })
    child.on('error', reject)
    child.on('close', code => (code === 0 ? resolve() : reject(new Error(`${command} ${args.join(' ')} exited ${code}`))))
  })
}

// Stand-in for the GAE images serving-url service (PROCESS_IMAGE_URL). The real one returns
// an `http://lh3.googleusercontent.com/<id>` line for a stored image; we return a fixed id.
function boot_image_mock() {
  return new Promise((resolve) => {
    image_mock = createServer((_req, res) => {
      res.writeHead(200, { 'content-type': 'text/plain' })
      res.end(`http://lh3.googleusercontent.com/${serving_id}\n`)
    })
    image_mock.listen(Number(image_mock_port), '127.0.0.1', resolve)
  })
}

function boot_server() {
  return new Promise((resolve, reject) => {
    console.log(`• booting \`node build\` on :${port}…`)
    server = spawn('node', ['build'], {
      cwd: site_dir,
      env: {
        ...process.env,
        PORT: port,
        JWT_SECRET: process.env.JWT_SECRET || 'e2e-test-secret-that-is-long-enough-for-hs256',
        E2E_EXPOSE_OTP: 'true',
        // Fake HMAC creds — getSignedUrl signs locally, never calls GCS.
        GCLOUD_MEDIA_BUCKET_ACCESS_KEY_ID: 'e2e-fake-access-key',
        GCLOUD_MEDIA_BUCKET_SECRET_ACCESS_KEY: 'e2e-fake-secret-key',
        PROCESS_IMAGE_URL: `http://127.0.0.1:${image_mock_port}`,
      },
    })
    const timer = setTimeout(() => reject(new Error('server did not log "Listening on" within 30s')), 30000)
    server.stdout.on('data', (chunk) => { if (chunk.toString().includes('Listening on')) { clearTimeout(timer); resolve() } })
    server.stderr.on('data', chunk => process.stderr.write(chunk))
    server.on('error', reject)
    server.on('close', code => reject(new Error(`server exited early (code ${code})`)))
  })
}

function read_server_media(entry_id) {
  const db = new Database(dict_db_path, { readonly: true })
  try {
    const audio = db.prepare('SELECT id, storage_path FROM audio WHERE entry_id = ?').all(entry_id)
    const photos = db.prepare('SELECT id, storage_path, serving_url FROM photos').all()
    const audio_speakers = db.prepare('SELECT COUNT(*) AS c FROM audio_speakers').get()
    return { audio, photos, audio_speaker_links: audio_speakers.c }
  } finally {
    db.close()
  }
}

function read_junction(table) {
  const db = new Database(dict_db_path, { readonly: true })
  try {
    return db.prepare(`SELECT id FROM "${table}"`).all()
  } finally {
    db.close()
  }
}

// The achi fixture seeds audio (reset each run) but NOT photos, so uploaded photos accumulate
// across runs — clear them so each run starts clean and `before.photos` is 0.
function clear_photos() {
  const db = new Database(dict_db_path)
  try {
    db.exec('DELETE FROM sense_photos; DELETE FROM photos;')
  } finally {
    db.close()
  }
}

async function login(page) {
  const result = await page.evaluate(async (email) => {
    const send = await fetch('/api/auth/email/send-code', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ email }) })
    const { code } = await send.json()
    const verify = await fetch('/api/auth/email/verify', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ email, code }) })
    return { status: verify.status }
  }, 'achi-manager@example.com')
  if (result.status !== 200) throw new Error(`login failed: ${result.status}`)
}

async function flush_sync(page) {
  await page.evaluate(async () => {
    const c = globalThis.__ld_dict_connections?.achi?.connection
    if (c) await c.sync_now().catch(() => {})
  })
}

// 1x1 transparent PNG.
const PNG_BYTES = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+M8AAAMBAQDJ/pLvAAAAAElFTkSuQmCC', 'base64')

async function main() {
  await boot_image_mock()
  if (!process.env.BASE_URL) {
    if (!existsSync(join(site_dir, 'build/index.js'))) await run('pnpm', ['build'])
    console.log('• re-seeding achi fixture…')
    await run('pnpm', ['seed:achi-fixture'])
    clear_photos()
    await boot_server()
  }

  const before = read_server_media('e_ja')
  console.log(`• server achi.db before: audio=${before.audio.length} photos=${before.photos.length}`)

  const tmp = mkdtempSync(join(tmpdir(), 'ld-media-'))
  const png_path = join(tmp, 'cat.png')
  const mp3_path = join(tmp, 'word.mp3')
  writeFileSync(png_path, PNG_BYTES)
  writeFileSync(mp3_path, Buffer.from([0xFF, 0xFB, 0x90, 0x00, 0, 0, 0, 0])) // tiny mp3 header bytes

  browser = await launch({ viewport: { width: 1100, height: 900 }, args: ['--lang=en-US'] })
  const page = await browser.newPage()
  await page.setExtraHTTPHeaders({ 'Accept-Language': 'en-US,en;q=0.9' })

  // Intercept the GCS PUT (bytes) and the lh3 image render — the only two things that would
  // leave the machine. Everything else continues normally.
  const cors_headers = {
    'access-control-allow-origin': '*',
    'access-control-allow-methods': 'GET, PUT, POST, OPTIONS',
    'access-control-allow-headers': '*',
    'access-control-max-age': '3600',
  }
  let gcs_put_count = 0
  await page.setRequestInterception(true)
  page.on('request', (req) => {
    const url = req.url()
    if (/storage\.googleapis\.com|\.appspot\.com\.storage/.test(url)) {
      // The browser sends a CORS preflight (OPTIONS) before the cross-origin PUT — answer it
      // with permissive CORS headers (prod GCS has a real CORS policy; see gcloud.ts) so the
      // actual PUT isn't blocked.
      if (req.method() === 'OPTIONS')
        return req.respond({ status: 204, headers: cors_headers, body: '' })
      gcs_put_count++
      console.log(`  [intercepted GCS ${req.method()}] ${url.slice(0, 80)}…`)
      return req.respond({ status: 200, headers: cors_headers, body: '' })
    }
    if (/lh3\.googleusercontent\.com/.test(url))
      return req.respond({ status: 200, contentType: 'image/png', body: PNG_BYTES })
    return req.continue()
  })

  const page_errors = []
  page.on('pageerror', (error) => { page_errors.push(error.message); console.log('  [pageerror]', error.message.slice(0, 200)) })
  page.on('dialog', (d) => { console.log('  [dialog]', d.message().slice(0, 200)); d.dismiss().catch(() => {}) })
  page.on('console', (m) => { if (m.type() === 'error') console.log(`  [console.error]`, m.text().slice(0, 200)) })

  await page.goto(`${base}/achi/entry/e_ja`, { waitUntil: 'domcontentloaded' })
  await page.waitForFunction(() => document.body.innerText.includes('water'))
  await login(page)
  await page.reload({ waitUntil: 'domcontentloaded' })
  await page.waitForFunction(() => document.body.innerText.includes('Add Audio'), { timeout: 25000 })
  console.log('✓ logged in as achi-manager; editor affordances present')

  // ─── PHOTO (exercises /api/upload + /api/gcs_serving_url) ───────────────────────────────
  await page.evaluate(() => {
    const el = [...document.querySelectorAll('div')].find(d => d.textContent.trim() === 'Photo' && d.offsetParent)
    el.click()
  })
  await page.waitForFunction(() => !!document.querySelector('textarea[name=photo_source]'), { timeout: 10000 })
  await page.evaluate(() => {
    const source = document.querySelector('textarea[name=photo_source]')
    const setter = Object.getOwnPropertyDescriptor(window.HTMLTextAreaElement.prototype, 'value').set
    setter.call(source, 'A clear photograph of the referenced item, contributed for documentation of the language during the e2e media upload verification flow.')
    source.dispatchEvent(new Event('input', { bubbles: true }))
    const rights = document.querySelector('input#rigths')
    rights.checked = true
    rights.dispatchEvent(new Event('change', { bubbles: true }))
  })
  const image_input = await page.waitForSelector('input[type=file][accept="image/*"]', { timeout: 10000 })
  await image_input.uploadFile(png_path)
  console.log('• photo file added → uploading…')
  await page.waitForFunction(() => !document.querySelector('textarea[name=photo_source]'), { timeout: 20000 })
  console.log('✓ photo upload flow completed (EditImage closed on serving_url)')
  await flush_sync(page)

  // ─── AUDIO (exercises /api/upload; storage_path only) ───────────────────────────────────
  await page.evaluate(() => {
    const btn = [...document.querySelectorAll('button,div,span')].find(el => el.textContent.trim() === 'Add Audio' && el.offsetParent)
    btn.click()
  })
  // Add a speaker (a real user flow that also exercises insert_speaker), which reveals the
  // SelectAudio file input. The speaker <select> carries the synthetic 'AddSpeaker' option.
  await page.waitForFunction(() => [...document.querySelectorAll('select')].some(s => [...s.options].some(o => o.value === 'AddSpeaker')), { timeout: 10000 })
  await page.$$eval('select', (selects) => {
    const speaker_select = selects.find(s => [...s.options].some(o => o.value === 'AddSpeaker'))
    speaker_select.setAttribute('data-e2e-speaker', '')
  })
  await page.select('select[data-e2e-speaker]', 'AddSpeaker')
  await page.waitForSelector('input#name', { timeout: 10000 })
  await page.evaluate(() => {
    const set_input = (el, value) => {
      const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set
      setter.call(el, value)
      el.dispatchEvent(new Event('input', { bubbles: true }))
    }
    set_input(document.querySelector('input#name'), 'E2E Speaker')
    const birthplace = [...document.querySelectorAll('input')].find(i => (i.type === 'text' || !i.type) && i.id !== 'name')
    if (birthplace) set_input(birthplace, 'Testville')
    const agree = document.querySelector('input#agree')
    if (agree && !agree.checked) { agree.checked = true; agree.dispatchEvent(new Event('change', { bubbles: true })) }
  })
  // Submit via a trusted puppeteer click so the svelte-pieces <Form onsubmit> fires.
  await page.$$eval('button', (buttons) => {
    const save = buttons.find(b => b.offsetParent !== null && b.textContent.trim() === 'Save')
    save.setAttribute('data-e2e-save', '')
  })
  await page.click('[data-e2e-save]')
  const audio_input = await page.waitForSelector('input[type=file][accept="audio/*"]', { timeout: 15000 })
  await audio_input.uploadFile(mp3_path)
  console.log('• audio file added → uploading…')
  await new Promise(r => setTimeout(r, 1500))
  await flush_sync(page)

  // ─── Assert SERVER persistence (run-specific: the photo carries THIS run's serving_id) ────
  let after = read_server_media('e_ja')
  for (let i = 0; i < 25 && (!after.photos.some(p => p.serving_url === serving_id) || after.audio.length <= before.audio.length); i++) {
    await new Promise(r => setTimeout(r, 1000))
    await flush_sync(page)
    after = read_server_media('e_ja')
  }
  console.log(`• server achi.db after: audio=${after.audio.length} photos=${after.photos.length} audio_speaker_links=${after.audio_speaker_links}`)

  if (gcs_put_count < 2) throw new Error(`expected ≥2 GCS PUTs (photo+audio), intercepted ${gcs_put_count}`)
  // The photo→sense and audio→speaker junctions must reach the server (they render the media).
  const sense_photos = read_junction('sense_photos')
  const audio_speakers = read_junction('audio_speakers')
  if (!sense_photos.length) throw new Error('sense_photos junction did not sync to server (photo unlinked)')
  if (audio_speakers.length <= before.audio_speaker_links) throw new Error('audio→speaker junction did not sync to server')
  const photo = after.photos.find(p => p.serving_url === serving_id)
  if (!photo) throw new Error(`PHOTO row with serving_url ${serving_id} did not persist to server SQLite`)
  if (!photo.storage_path) throw new Error('photo.storage_path empty')
  if (after.audio.length <= before.audio.length) throw new Error('AUDIO row did not persist to server SQLite')
  if (!after.audio.every(a => a.storage_path)) throw new Error('audio.storage_path empty')
  if (after.audio_speaker_links < 1) throw new Error('audio→speaker link did not persist')
  console.log('✓ photo + audio rows PERSISTED to the real server SQLite (serving_url + storage_path set)')

  // ─── Fresh context (no OPFS) must load the media from the server snapshot ────────────────
  const fresh = await browser.createBrowserContext()
  const fresh_page = await fresh.newPage()
  await fresh_page.setRequestInterception(true)
  fresh_page.on('request', (req) => {
    if (/lh3\.googleusercontent\.com/.test(req.url())) return req.respond({ status: 200, contentType: 'image/png', body: PNG_BYTES })
    return req.continue()
  })
  await fresh_page.setExtraHTTPHeaders({ 'Accept-Language': 'en-US,en;q=0.9' })
  await fresh_page.goto(`${base}/achi/entry/e_ja`, { waitUntil: 'domcontentloaded' })
  await fresh_page.waitForFunction(serving => [...document.querySelectorAll('img')].some(img => img.src.includes(serving)), { timeout: 25000 }, serving_id)
  console.log('✓ fresh (no-OPFS) context renders the uploaded photo from the server snapshot')
  await fresh.close()

  if (page_errors.length) throw new Error(`pageerror(s): ${page_errors.join(' | ')}`)
  console.log('✓ no uncaught page errors')

  console.log('\n✅ media-upload PASS — presigned PUT (intercepted) → media row → server SQLite → fresh render')
}

main()
  .catch((error) => { console.error(`\n❌ media-upload FAIL — ${error.message}`); process.exitCode = 1 })
  .finally(async () => {
    if (browser) await browser.close().catch(() => {})
    if (server && !server.killed) server.kill('SIGTERM')
    if (image_mock) image_mock.close()
  })
