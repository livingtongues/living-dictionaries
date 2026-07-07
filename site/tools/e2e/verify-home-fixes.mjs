import { launch } from '/home/jacob/.claude/skills/browser-tools/browser-launch.mjs'

const BASE = 'http://localhost:3041'
const log = (...a) => console.log(...a)

const browser = await launch()
const page = await browser.newPage()
const errors = []
page.on('pageerror', e => errors.push(e.message))
page.on('console', m => { if (m.type() === 'error') errors.push(`console.error: ${m.text()}`) })

async function eval_fn(fn, ...args) { return page.evaluate(fn, ...args) }

try {
  // ── 1. homepage loads clean ────────────────────────────────────────────────
  await page.goto(BASE, { waitUntil: 'networkidle2' })
  await new Promise(r => setTimeout(r, 1500)) // let the canvas map hydrate
  log('1. homepage title:', await page.title())
  log('   featured cards on strip:', await eval_fn(() => document.querySelectorAll('[class*="card"]').length))

  // ── 2. map dev hook present + zoom to a dict so labels/dots appear ──────────
  const has_hook = await eval_fn(() => !!window.__ld_worldmap)
  log('2. __ld_worldmap hook present:', has_hook)

  // zoom deep + declustered so single-dot name labels get laid out
  await eval_fn(() => window.__ld_worldmap.zoom_to({ lng: 80, lat: 30, k: 6, depth: 2 }))
  await new Promise(r => setTimeout(r, 900)) // settle + force-layout debounce
  const map_state = await eval_fn(() => window.__ld_worldmap.state())
  log('   map state after zoom:', JSON.stringify(map_state))
  const label_boxes = await eval_fn(() => window.__ld_worldmap.label_boxes())
  log('   drawn dict-label boxes:', label_boxes.length)
  await page.screenshot({ path: '/tmp/home-map-zoomed.png' })

  // ── 3. Issue 3: clicking a dict-name LABEL opens its popover ────────────────
  if (label_boxes.length) {
    const box = label_boxes[0]
    const canvas = await page.$('canvas')
    const rect = await eval_fn(() => { const c = document.querySelector('canvas'); const r = c.getBoundingClientRect(); return { left: r.left, top: r.top } })
    const cx = rect.left + box.x + box.width / 2
    const cy = rect.top + box.y + box.height / 2
    await page.mouse.click(cx, cy)
    await new Promise(r => setTimeout(r, 400))
    const popover = await eval_fn(() => {
      const el = document.querySelector('.popover')
      if (!el) return null
      const r = el.getBoundingClientRect()
      return {
        in_body_portal: el.closest('.map') === null, // portaled OUT of the map
        position: getComputedStyle(el).position,
        name: el.querySelector('.popover-name')?.textContent?.trim(),
        rect: { left: Math.round(r.left), top: Math.round(r.top), right: Math.round(r.right), bottom: Math.round(r.bottom) },
        within_viewport_x: r.left >= 0 && r.right <= window.innerWidth,
      }
    })
    log('3. label-click popover:', JSON.stringify(popover))
    await page.screenshot({ path: '/tmp/home-map-label-popover.png' })
    // close it
    await eval_fn(() => document.querySelector('.popover-close')?.click())
    await new Promise(r => setTimeout(r, 200))
  } else {
    log('3. no label boxes drawn — skipping label-click test (increase zoom target)')
  }

  // ── 4. Issue 2: popover on a mobile viewport stays fully visible ────────────
  await page.setViewport({ width: 390, height: 780, isMobile: true, hasTouch: true, deviceScaleFactor: 2 })
  await page.goto(BASE, { waitUntil: 'networkidle2' })
  await new Promise(r => setTimeout(r, 1500))
  await eval_fn(() => window.__ld_worldmap.zoom_to({ lng: 80, lat: 30, k: 6, depth: 2 }))
  await new Promise(r => setTimeout(r, 900))
  // find the lowest-on-screen label (worst case for bottom-truncation) and tap it
  const mobile_boxes = await eval_fn(() => window.__ld_worldmap.label_boxes())
  log('4. mobile drawn label boxes:', mobile_boxes.length)
  if (mobile_boxes.length) {
    const lowest = mobile_boxes.slice().sort((a, b) => b.y - a.y)[0]
    const rect = await eval_fn(() => { const c = document.querySelector('canvas'); const r = c.getBoundingClientRect(); return { left: r.left, top: r.top } })
    await page.mouse.click(rect.left + lowest.x + lowest.width / 2, rect.top + lowest.y + lowest.height / 2)
    await new Promise(r => setTimeout(r, 400))
    const mobile_popover = await eval_fn(() => {
      const el = document.querySelector('.popover')
      if (!el) return null
      const r = el.getBoundingClientRect()
      return {
        fully_visible: r.top >= 0 && r.bottom <= window.innerHeight && r.left >= 0 && r.right <= window.innerWidth,
        not_clipped_by_map: el.closest('.map') === null,
        rect: { left: Math.round(r.left), top: Math.round(r.top), right: Math.round(r.right), bottom: Math.round(r.bottom) },
        viewport: { w: window.innerWidth, h: window.innerHeight },
      }
    })
    log('   mobile popover (tapped lowest label):', JSON.stringify(mobile_popover))
    await page.screenshot({ path: '/tmp/home-map-mobile-popover.png' })
  }

  // ── 5. Issue 1: instant nav into a dict (achi has local data) ───────────────
  await page.setViewport({ width: 1200, height: 900, deviceScaleFactor: 1 })
  const t0 = Date.now()
  await page.goto(`${BASE}/achi/entries`, { waitUntil: 'domcontentloaded' })
  // measure how fast the page SHELL (search bar / spinner) shows up
  await page.waitForSelector('.search-bar, [class*="EntriesEmptyState"], input', { timeout: 15000 }).catch(() => {})
  const shell_ms = Date.now() - t0
  log('5. /achi/entries shell rendered in ~', shell_ms, 'ms')
  // then wait for entries to actually fill in
  await page.waitForFunction(() => {
    const meta = document.querySelector('.results-meta')?.textContent || ''
    return /\d/.test(meta) || document.querySelectorAll('[class*="entry"], a[href*="/entry/"]').length > 3
  }, { timeout: 20000 }).catch(() => {})
  const entries_seen = await eval_fn(() => ({
    meta: document.querySelector('.results-meta')?.textContent?.trim()?.slice(0, 60),
    entry_links: document.querySelectorAll('a[href*="/entry/"]').length,
  }))
  log('   entries loaded:', JSON.stringify(entries_seen))
  await page.screenshot({ path: '/tmp/achi-entries.png' })

  // ── 6. entry page renders (cold-window server fetch) ────────────────────────
  await page.goto(`${BASE}/achi/entry/06Tmb3jM1atoGNQvlxIY`, { waitUntil: 'networkidle2' })
  await new Promise(r => setTimeout(r, 800))
  const entry_ok = await eval_fn(() => document.body.textContent.length > 200 && !document.body.textContent.includes('Entry not found'))
  log('6. /achi/entry renders content:', entry_ok)
  await page.screenshot({ path: '/tmp/achi-entry.png' })

  log('\nPAGE ERRORS (', errors.length, '):')
  for (const e of errors.slice(0, 15)) log('  -', e)
} catch (err) {
  log('SCRIPT ERROR:', err.message)
} finally {
  await browser.close()
}
