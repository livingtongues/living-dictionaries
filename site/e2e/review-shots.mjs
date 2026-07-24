#!/usr/bin/env node
/* eslint-disable no-console, node/prefer-global/process */
import { spawn } from 'node:child_process'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { mkdir } from 'node:fs/promises'
import { launch } from '/home/jacob/.claude/skills/browser-tools/browser-launch.mjs'

const dir = dirname(fileURLToPath(import.meta.url))
const site_dir = join(dir, '..')
const out = join(dir, 'review')
const port = process.env.REVIEW_PORT || '3103'
const base = `http://localhost:${port}`
let server, browser

function boot() {
  return new Promise((resolve, reject) => {
    server = spawn('node', ['build'], { cwd: site_dir, env: { ...process.env, PORT: port } })
    const t = setTimeout(() => reject(new Error('no boot')), 30000)
    server.stdout.on('data', c => c.toString().includes('Listening on') && (clearTimeout(t), resolve()))
    server.stderr.on('data', c => process.stderr.write(c))
    server.on('close', code => reject(new Error(`exit ${code}`)))
  })
}

async function shot(page, url, name, wait = 1500) {
  await page.goto(`${base}${url}`, { waitUntil: 'networkidle2' })
  await new Promise(r => setTimeout(r, wait))
  await page.screenshot({ path: join(out, `${name}.png`) })
  console.log(`  ${name}: ${page.url()}`)
}

async function main() {
  await mkdir(out, { recursive: true })
  await boot()
  browser = await launch()
  const page = await browser.newPage()
  await page.setViewport({ width: 1280, height: 900 })
  await shot(page, '/', 'home')
  await shot(page, '/dictionaries', 'dictionaries-list')
  await shot(page, '/torwali/entries', 'torwali-entries', 4500)
  await shot(page, '/torwali/about', 'torwali-about')
  await shot(page, '/dev/entries', 'dev-entries', 4500)
}
main().catch(e => { console.error(e); process.exitCode = 1 })
  .finally(async () => { try { await browser?.close() } catch {} try { server?.kill() } catch {} })
