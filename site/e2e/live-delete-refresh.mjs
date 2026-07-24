#!/usr/bin/env node
// Verifies the stale-entries-view fix (.issues/stale-entries-view-after-live-delete.md):
// after create → delete → auto-navigation back to /dev/entries, the list must correct
// itself (count back to baseline, lexeme gone) WITHOUT any user input — driven purely by
// the search_index_updated counter pulse.
//
//   BASE_URL=http://localhost:3041 node e2e/live-delete-refresh.mjs
/* eslint-disable no-console, node/prefer-global/process -- node CLI */

import { launch } from '/home/jacob/.claude/skills/browser-tools/browser-launch.mjs'

const base = process.env.BASE_URL || 'http://localhost:3041'
const wait = ms => new Promise(resolve => setTimeout(resolve, ms))
const lexeme = `stale-fix-${Date.now()}`

let browser
let failed = false
function assert(condition, label) {
  console.log(`${condition ? '✅' : '❌'} ${label}`)
  if (!condition) failed = true
}

async function results_total(page) {
  return page.evaluate(() => {
    const meta = document.querySelector('.results-meta')?.textContent ?? ''
    const match = meta.match(/\/\s*([\d,]+)/)
    return match ? Number(match[1].replace(/,/g, '')) : null
  })
}

try {
  browser = await launch()
  const page = await browser.newPage()
  const page_errors = []
  page.on('pageerror', error => page_errors.push(error.message))
  page.on('dialog', dialog => dialog.accept()) // the delete confirm()

  // dev-auth: any email + dev_admin_level 3
  await page.goto(`${base}/`, { waitUntil: 'networkidle2' })
  await page.evaluate(async () => {
    const email = 'stale-view-e2e@test.com'
    const { code } = await (await fetch('/api/auth/email/send-code', {
      method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ email }),
    })).json()
    await fetch('/api/auth/email/verify', {
      method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ email, code }),
    })
    await fetch('/api/auth/dev-admin-level', {
      method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ level: 3 }),
    })
  })

  await page.goto(`${base}/dev/entries`, { waitUntil: 'networkidle2' })
  await page.waitForFunction(() => /\/\s*[\d,]+/.test(document.querySelector('.results-meta')?.textContent ?? ''), { timeout: 30000 })
  const baseline = await results_total(page)
  console.log(`• baseline total: ${baseline}`)
  assert(baseline > 0, 'baseline count present')

  // create: Add Entry → type lexeme → submit (navigates to the new entry page)
  // two placements render (mobile/desktop) — click the visible one
  await page.evaluate(() => {
    const visible = [...document.querySelectorAll('.add-entry-button')].find(button => button.offsetParent !== null)
    visible.click()
  })
  await page.waitForSelector('.modal input, [role="dialog"] input', { timeout: 10000 })
  await page.type('.modal input, [role="dialog"] input', lexeme)
  await Promise.all([
    page.waitForNavigation({ waitUntil: 'networkidle2', timeout: 20000 }),
    page.click('.modal button[type="submit"], [role="dialog"] button[type="submit"]'),
  ])
  assert(page.url().includes('/dev/entry/'), `created "${lexeme}" and navigated to its page (${page.url()})`)

  // delete (confirm() auto-accepted) → app navigates back to /dev/entries
  await page.waitForSelector('.delete-label', { timeout: 10000 })
  await Promise.all([
    page.waitForNavigation({ waitUntil: 'networkidle2', timeout: 20000 }),
    page.evaluate(() => document.querySelector('.delete-label').closest('button').click()),
  ])
  assert(page.url().endsWith('/dev/entries'), 'navigated back to the entries list')

  // THE assertion: no keystrokes, no reload — the view must self-correct.
  let final_total = await results_total(page)
  const deadline = Date.now() + 10000
  while (final_total !== baseline && Date.now() < deadline) {
    await wait(250)
    final_total = await results_total(page)
  }
  assert(final_total === baseline, `count self-corrected to ${baseline} without input (got ${final_total})`)
  const still_listed = await page.evaluate(text => document.body.textContent.includes(text), lexeme)
  assert(!still_listed, 'deleted lexeme no longer rendered in the list')

  const real_errors = page_errors.filter(message => !/mapbox|tile|403/i.test(message))
  assert(real_errors.length === 0, `no page errors (${real_errors.join(' | ') || 'clean'})`)
} catch (error) {
  console.error('❌ flow error:', error)
  failed = true
} finally {
  await browser?.close()
}
process.exit(failed ? 1 : 0)
