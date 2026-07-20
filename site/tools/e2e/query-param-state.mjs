import assert from 'node:assert/strict'
import { launch } from '/home/jacob/.claude/skills/browser-tools/browser-launch.mjs'

const base = process.env.E2E_BASE || 'http://localhost:3043'
const entries_url = `${base}/achi/entries`
const browser = await launch()
const page = await browser.newPage()
const page_errors = []

page.on('pageerror', error => page_errors.push(error.message))
await page.setViewport({ width: 1280, height: 900 })

try {
  await page.goto(base, { waitUntil: 'networkidle2', timeout: 60_000 })
  await page.goto(entries_url, { waitUntil: 'networkidle2', timeout: 60_000 })
  await page.waitForSelector('input[type="search"]', { timeout: 60_000 })

  const query = 'query-param-no-results'
  await page.type('input[type="search"]', query)
  await page.waitForFunction((expected) => {
    const raw = new URL(location.href).searchParams.get('q')
    return raw && JSON.parse(raw).query === expected && document.body.textContent.includes('0 /')
  }, { timeout: 30_000 }, query)
  assert.equal(await page.$eval('input[type="search"]', input => input.value), query)
  console.log('PASS filters apply correctly')

  await page.goBack({ waitUntil: 'networkidle2', timeout: 60_000 })
  assert.equal(new URL(page.url()).pathname, '/')
  await page.goForward({ waitUntil: 'networkidle2', timeout: 60_000 })
  await page.waitForSelector('input[type="search"]', { timeout: 60_000 })
  assert.equal(await page.$eval('input[type="search"]', input => input.value), query)
  console.log('PASS back and forward navigation preserve state')

  await page.reload({ waitUntil: 'networkidle2', timeout: 60_000 })
  await page.waitForSelector('input[type="search"]', { timeout: 60_000 })
  assert.equal(await page.$eval('input[type="search"]', input => input.value), query)
  console.log('PASS page reload preserves state')

  await page.goto(`${entries_url}?q=hua`, { waitUntil: 'networkidle2', timeout: 60_000 })
  await page.waitForSelector('input[type="search"]', { timeout: 60_000 })
  assert.equal(await page.$eval('input[type="search"]', input => input.value), '')
  await page.type('input[type="search"]', 'safe')
  await page.waitForFunction(() => {
    const raw = new URL(location.href).searchParams.get('q')
    return raw && JSON.parse(raw).query === 'safe'
  }, { timeout: 30_000 })
  console.log('PASS malformed query values recover safely')

  assert.deepEqual(page_errors, [])
} finally {
  await browser.close()
}
