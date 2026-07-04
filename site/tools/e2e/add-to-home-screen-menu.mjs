// Verifies the new "Add to Home Screen" UserMenu item: shows up on a mobile
// (coarse-pointer) viewport for a signed-in user when a native install prompt
// is available (Android/desktop Chrome `beforeinstallprompt`) or on iOS
// (Share-Sheet instructions toast) — and stays hidden on desktop.
//
// Run: node tools/e2e/add-to-home-screen-menu.mjs
import { launch } from '/home/jacob/.claude/skills/browser-tools/browser-launch.mjs'

const BASE = process.env.E2E_BASE || 'http://localhost:3041'
const EMAIL = process.env.E2E_EMAIL || 'e2e-a2hs-test@example.com'
const SHOTS = '/home/jacob/code/living-dictionaries/site/tools/e2e/shots'
const sleep = ms => new Promise(r => setTimeout(r, ms))

const report = { steps: {} }

async function login(page) {
  const send = await page.evaluate(async (email) => {
    const r = await fetch('/api/auth/email/send-code', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ email }) })
    return r.json()
  }, EMAIL)
  const verify_status = await page.evaluate(async (email, code) => {
    const r = await fetch('/api/auth/email/verify', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ email, code }) })
    return r.status
  }, EMAIL, send.code)
  return verify_status
}

async function open_menu(page) {
  await page.waitForSelector('.avatar-button', { timeout: 10000 })
  await page.click('.avatar-button')
  await sleep(400)
}

function menu_text(page) {
  return page.evaluate(() => document.querySelector('.menu')?.textContent?.trim() ?? null)
}

/** Simulates the browser having offered install (root layout's onMount already ran init_pwa_install()). */
async function dispatch_fake_install_prompt(page) {
  await page.evaluate(() => {
    const event = new Event('beforeinstallprompt', { cancelable: true })
    event.prompt = () => undefined
    event.userChoice = Promise.resolve({ outcome: 'dismissed' })
    window.dispatchEvent(event)
  })
}

const browser = await launch()

try {
  // --- Case A: Android-like mobile (coarse pointer + touch) + captured beforeinstallprompt ---
  {
    const page = await browser.newPage()
    await page.emulate({
      viewport: { width: 390, height: 844, isMobile: true, hasTouch: true, deviceScaleFactor: 2 },
      userAgent: 'Mozilla/5.0 (Linux; Android 14) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Mobile Safari/537.36',
    })
    await page.goto(BASE, { waitUntil: 'networkidle2' })
    report.steps.login_status = await login(page)
    await page.reload({ waitUntil: 'networkidle2' })
    await dispatch_fake_install_prompt(page)
    await open_menu(page)
    report.steps.android_menu_text = await menu_text(page)
    await page.screenshot({ path: `${SHOTS}/a2hs-android-menu.png` })
    await page.close()
  }

  // --- Case B: iOS Safari (coarse pointer + touch, iPhone UA, no beforeinstallprompt) ---
  {
    const page = await browser.newPage()
    await page.emulate({
      viewport: { width: 390, height: 844, isMobile: true, hasTouch: true, deviceScaleFactor: 2 },
      userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1',
    })
    await page.goto(BASE, { waitUntil: 'networkidle2' })
    report.steps.login_status_ios = await login(page)
    await page.reload({ waitUntil: 'networkidle2' })
    await open_menu(page)
    report.steps.ios_menu_text = await menu_text(page)
    await page.screenshot({ path: `${SHOTS}/a2hs-ios-menu.png` })

    const clicked = await page.evaluate(() => {
      const btn = [...document.querySelectorAll('.menu button')].find(b => b.textContent.includes('Add to Home Screen'))
      if (!btn) return false
      btn.click()
      return true
    })
    await sleep(400)
    report.steps.ios_clicked = clicked
    report.steps.ios_toast_text = await page.evaluate(() => document.body.textContent.includes('Tap the Share icon'))
    await page.screenshot({ path: `${SHOTS}/a2hs-ios-toast.png` })
    await page.close()
  }

  // --- Case C: Desktop (fine pointer) — should NOT show even with a captured prompt ---
  {
    const page = await browser.newPage()
    await page.setViewport({ width: 1280, height: 900 })
    await page.goto(BASE, { waitUntil: 'networkidle2' })
    report.steps.login_status_desktop = await login(page)
    await page.reload({ waitUntil: 'networkidle2' })
    await dispatch_fake_install_prompt(page)
    await open_menu(page)
    report.steps.desktop_menu_text = await menu_text(page)
    await page.screenshot({ path: `${SHOTS}/a2hs-desktop-menu.png` })
    await page.close()
  }
} catch (err) {
  report.fatal = err.message
} finally {
  console.info(JSON.stringify(report, null, 2))
  await browser.close()
}
