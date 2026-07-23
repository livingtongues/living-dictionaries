#!/usr/bin/env node
// Proof for media upload on the R2 key convention (post GCS→R2 migration, 2026-07):
// a logged-in manager uploads a PHOTO and an AUDIO file.
//   photo → multipart POST /api/photo-upload → original stored + WebP variants generated
//           AFTER the response (real sharp) → row (serving_url '') syncs to server SQLite
//   audio → /api/upload presign (dev-media mock) → XHR PUT → row syncs to server SQLite
//
//   pnpm -F site test:media
//
// Runs against `vite dev` (not `node build`): the dev-media store keeps every byte local —
// no interception, no fake cloud creds — while the sync path (wa-sqlite → /changes →
// server SQLite) and the sharp variant pipeline are fully real.
/* eslint-disable no-console, node/prefer-global/process, unicorn/prefer-dom-node-text-content */

import { spawn } from 'node:child_process'
import { existsSync, mkdtempSync, readdirSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import Database from 'better-sqlite3'
import { launch } from '/home/jacob/.claude/skills/browser-tools/browser-launch.mjs'

const dir = dirname(fileURLToPath(import.meta.url))
const site_dir = join(dir, '..')
const port = process.env.MEDIA_PORT || '3105'
const base = process.env.BASE_URL || `http://localhost:${port}`
const dict_db_path = join(site_dir, '.data', 'dictionaries', 'achi.db')
const dev_media_dir = join(site_dir, '.data', 'dev-media')
const UUID_RE = /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/

let server
let browser

function run(command, args) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, { cwd: site_dir, stdio: 'inherit' })
    child.on('error', reject)
    child.on('close', code => (code === 0 ? resolve() : reject(new Error(`${command} ${args.join(' ')} exited ${code}`))))
  })
}

function boot_dev_server() {
  return new Promise((resolve, reject) => {
    console.log(`• booting \`vite dev\` on :${port}…`)
    server = spawn('pnpm', ['dev', '--port', port, '--strictPort'], {
      cwd: site_dir,
      detached: true, // own process group — teardown kills pnpm AND the vite child
      env: { ...process.env, E2E_EXPOSE_OTP: 'true' },
    })
    const timer = setTimeout(() => reject(new Error('vite did not report ready within 60s')), 60000)
    server.stdout.on('data', (chunk) => {
      const text = chunk.toString()
      if (text.includes('Local:') || text.includes('ready in')) { clearTimeout(timer); setTimeout(resolve, 500) }
    })
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

// 24x24 solid PNG — a realistic (non-1x1) image so the sharp resize→webp variant
// pipeline runs cleanly (a 1x1 PNG trips a `vipspng: libpng read error` in the
// cover-resize on some libpng builds, which has nothing to do with the upload path).
const REAL_PNG = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAABgAAAAYCAIAAABvFaqvAAAACXBIWXMAAAPoAAAD6AG1e1JrAAAAKElEQVQ4jWOI6rlEFcQwalDUaBhFjaajntEs0jNajFwaLSEvDWQtAgBnTd4uzY9DTAAAAABJRU5ErkJggg==', 'base64')

async function main() {
  if (!process.env.BASE_URL) {
    console.log('• re-seeding achi fixture…')
    await run('pnpm', ['seed:achi-fixture'])
    clear_photos()
    await boot_dev_server()
  }

  const before = read_server_media('e_ja')
  console.log(`• server achi.db before: audio=${before.audio.length} photos=${before.photos.length}`)

  const tmp = mkdtempSync(join(tmpdir(), 'ld-media-'))
  const png_path = join(tmp, 'cat.png')
  const mp3_path = join(tmp, 'word.mp3')
  writeFileSync(png_path, REAL_PNG)
  writeFileSync(mp3_path, Buffer.from([0xFF, 0xFB, 0x90, 0x00, 0, 0, 0, 0])) // tiny mp3 header bytes

  browser = await launch({ viewport: { width: 1100, height: 900 }, args: ['--lang=en-US'] })
  const page = await browser.newPage()
  await page.setExtraHTTPHeaders({ 'Accept-Language': 'en-US,en;q=0.9' })

  const page_errors = []
  page.on('pageerror', (error) => { page_errors.push(error.message); console.log('  [pageerror]', error.message.slice(0, 200)) })
  page.on('dialog', (d) => { console.log('  [dialog]', d.message().slice(0, 200)); d.dismiss().catch(() => {}) })
  page.on('console', (m) => { if (m.type() === 'error') console.log(`  [console.error]`, m.text().slice(0, 200)) })

  await page.goto(`${base}/achi/entry/e_ja`, { waitUntil: 'domcontentloaded', timeout: 90000 })
  // vite dev compiles the page + the wa-sqlite worker on first hit — generous wait.
  await page.waitForFunction(() => document.body.innerText.includes('water'), { timeout: 90000 })
  await login(page)
  await page.reload({ waitUntil: 'domcontentloaded' })
  await page.waitForFunction(() => document.body.innerText.includes('Add Audio'), { timeout: 30000 })
  // Edits are blocked (guarded-writes `still_loading`) until the entries bundle finishes
  // loading from the wa-sqlite leader worker — slower to boot in headless CI than the app's
  // click cadence. Wait for readiness so the media inserts don't race the read-model.
  await page.waitForFunction(() => globalThis.__ld_entries_loading?.achi === false, { timeout: 90000 })
  console.log('✓ logged in as achi-manager; editor affordances present + writes ready')

  // ─── PHOTO (exercises multipart POST /api/photo-upload + background variants) ────────────
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
  console.log('✓ photo upload flow completed (EditImage closed on storage_path)')
  await flush_sync(page)

  // ─── AUDIO (exercises /api/upload presign; storage_path only) ───────────────────────────
  await page.evaluate(() => {
    const btn = [...document.querySelectorAll('button,div,span')].find(el => el.textContent.trim() === 'Add Audio' && el.offsetParent)
    btn.click()
  })
  // Add a speaker (a real user flow that also exercises insert_speaker), which reveals the
  // SelectAudio file input. The picker (SelectSpeaker.svelte) is fixture-agnostic: with NO
  // speakers seeded it's a "+Add" button; with existing speakers it's a <select> whose
  // synthetic 'AddSpeaker' option opens the same AddSpeaker form. Handle both.
  await page.waitForFunction(() =>
    [...document.querySelectorAll('select')].some(s => [...s.options].some(o => o.value === 'AddSpeaker'))
    || !!document.querySelector('.select-prompt'), { timeout: 10000 })
  await page.evaluate(() => {
    const select = [...document.querySelectorAll('select')].find(s => [...s.options].some(o => o.value === 'AddSpeaker'))
    if (select) {
      const setter = Object.getOwnPropertyDescriptor(window.HTMLSelectElement.prototype, 'value').set
      setter.call(select, 'AddSpeaker')
      select.dispatchEvent(new Event('change', { bubbles: true }))
    } else {
      // No speakers seeded → the SelectSpeaker "+Add" button (first button beside the
      // ".select-prompt" — scoped so we don't hit the entry's Source "+Add").
      document.querySelector('.select-prompt').parentElement.querySelector('button').click()
    }
  })
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

  // ─── Assert SERVER persistence on the R2 key convention ──────────────────────────────────
  const photo_key_re = new RegExp(`^achi/photo/${UUID_RE.source}\\.png$`)
  const audio_key_re = new RegExp(`^achi/audio/${UUID_RE.source}\\.`)
  let after = read_server_media('e_ja')
  for (let i = 0; i < 25 && (!after.photos.some(p => photo_key_re.test(p.storage_path)) || after.audio.length <= before.audio.length); i++) {
    await new Promise(r => setTimeout(r, 1000))
    await flush_sync(page)
    after = read_server_media('e_ja')
  }
  console.log(`• server achi.db after: audio=${after.audio.length} photos=${after.photos.length} audio_speaker_links=${after.audio_speaker_links}`)

  const photo = after.photos.find(p => photo_key_re.test(p.storage_path))
  if (!photo) throw new Error(`PHOTO row with an R2-convention storage_path did not persist (have: ${after.photos.map(p => p.storage_path).join(', ') || 'none'})`)
  if (photo.serving_url !== '') throw new Error(`expected empty serving_url on the R2 convention, got '${photo.serving_url}'`)
  if (photo.storage_path.split('/')[2].split('.')[0] !== photo.id) throw new Error(`photo key uuid ${photo.storage_path} != row id ${photo.id} (key must be the row uuid)`)
  const sense_photos = read_junction('sense_photos')
  if (!sense_photos.length) throw new Error('sense_photos junction did not sync to server (photo unlinked)')
  const new_audio = after.audio.filter(a => audio_key_re.test(a.storage_path))
  if (after.audio.length <= before.audio.length || !new_audio.length) throw new Error('AUDIO row on the R2 convention did not persist to server SQLite')
  if (after.audio_speaker_links < 1) throw new Error('audio→speaker link did not persist')
  console.log('✓ photo + audio rows PERSISTED to the real server SQLite on R2-convention keys')

  // ─── Variants: the post-response sharp pipeline must land all three WebPs locally ─────────
  const photo_dir = join(dev_media_dir, 'achi', 'photo')
  const base_name = photo.storage_path.split('/')[2].split('.')[0]
  for (let i = 0; i < 20; i++) {
    const files = existsSync(photo_dir) ? readdirSync(photo_dir) : []
    if (['thumb', 'w900', 'w1600'].every(v => files.includes(`${base_name}_${v}.webp`))) break
    await new Promise(r => setTimeout(r, 500))
  }
  const files = existsSync(photo_dir) ? readdirSync(photo_dir) : []
  for (const variant of ['thumb', 'w900', 'w1600']) {
    if (!files.includes(`${base_name}_${variant}.webp`))
      throw new Error(`variant ${variant} missing in dev-media store (have: ${files.join(', ')})`)
  }
  console.log('✓ all three WebP variants generated by the background sharp pipeline')

  // ─── Fresh context (no OPFS) must load the media from the server snapshot ────────────────
  const fresh = await browser.createBrowserContext()
  const fresh_page = await fresh.newPage()
  await fresh_page.setExtraHTTPHeaders({ 'Accept-Language': 'en-US,en;q=0.9' })
  await fresh_page.goto(`${base}/achi/entry/e_ja`, { waitUntil: 'domcontentloaded' })
  await fresh_page.waitForFunction(key => [...document.querySelectorAll('img')].some(img => img.src.includes(key)), { timeout: 30000 }, base_name)
  console.log('✓ fresh (no-OPFS) context renders the uploaded photo from the server snapshot')
  await fresh.close()

  if (page_errors.length) throw new Error(`pageerror(s): ${page_errors.join(' | ')}`)
  console.log('✓ no uncaught page errors')

  console.log('\n✅ media-upload PASS — photo POST + variants + audio presign → media rows → server SQLite → fresh render')
}

main()
  .catch((error) => { console.error(`\n❌ media-upload FAIL — ${error.message}`); process.exitCode = 1 })
  .finally(async () => {
    if (browser) await browser.close().catch(() => {})
    if (server && !server.killed) {
      try { process.kill(-server.pid, 'SIGTERM') } catch { server.kill('SIGTERM') }
    }
    setTimeout(() => process.exit(process.exitCode ?? 0), 2000).unref() // orphaned child pipes must not hold node open
  })
