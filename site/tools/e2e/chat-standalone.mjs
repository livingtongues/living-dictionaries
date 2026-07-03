/**
 * End-to-end check for the standalone /chat (membership-based, DB-managed channels):
 *  1. Partner user registers (email OTP; dev returns the code inline).
 *  2. Admin (Jacob) logs in, opens /chat, creates a channel, adds the partner via search.
 *  3. Partner opens /chat, sees the channel, posts a message.
 *  4. Admin's open thread receives the message via the 5s poll.
 *  5. Partner entry points: UserMenu "Chat" link on the home page.
 * Run: node tools/e2e/chat-standalone.mjs
 */
import { launch } from '/home/jacob/.claude/skills/browser-tools/browser-launch.mjs'

const BASE = 'http://localhost:3041'
const ts = Date.now()
const PARTNER_EMAIL = `e2e-partner+${ts}@example.com`
const CHANNEL_NAME = `Partner e2e ${ts}`
const failures = []

function check(label, ok, detail = '') {
  console.log(`${ok ? 'PASS' : 'FAIL'} ${label}${detail ? ` — ${detail}` : ''}`)
  if (!ok)
    failures.push(label)
}

async function login(page, email) {
  await page.goto(`${BASE}/`, { waitUntil: 'networkidle2' })
  const result = await page.evaluate(async (login_email) => {
    const send = await fetch('/api/auth/email/send-code', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ email: login_email }),
    })
    const { code } = await send.json()
    const verify = await fetch('/api/auth/email/verify', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ email: login_email, code }),
    })
    return { status: verify.status, body: await verify.json() }
  }, email)
  if (result.status !== 200)
    throw new Error(`login failed for ${email}: ${JSON.stringify(result)}`)
}

const browser_admin = await launch()
const browser_partner = await launch()

try {
  const admin = await browser_admin.newPage()
  const partner = await browser_partner.newPage()
  const page_errors = []
  admin.on('pageerror', error => page_errors.push(`admin: ${error.message}`))
  partner.on('pageerror', error => page_errors.push(`partner: ${error.message}`))
  admin.on('dialog', dialog => dialog.accept())
  partner.on('dialog', dialog => dialog.accept())

  // 1. Partner registers (creates the users row so admin search can find them).
  await login(partner, PARTNER_EMAIL)
  await partner.goto(`${BASE}/chat`, { waitUntil: 'networkidle2' })
  const invite_only = await partner.evaluate(() => document.body.innerText.includes('Chat is invite-only'))
  check('partner (no memberships) sees the invite-only gate', invite_only)

  // 2. Admin logs in and opens /chat.
  await login(admin, 'jwrunner7@gmail.com')
  await admin.goto(`${BASE}/chat`, { waitUntil: 'networkidle2' })
  await admin.waitForSelector('.room-btn', { timeout: 10000 })
  const admin_rooms = await admin.evaluate(() => [...document.querySelectorAll('.room-btn .room-name')].map(el => el.textContent.trim()))
  check('admin sees the seeded rooms', admin_rooms.includes('All Admins') && admin_rooms.includes('Notifications'), admin_rooms.join(', '))

  // 3. Create a channel.
  await admin.click('.new-channel-btn')
  await admin.waitForSelector('.new-channel-form input[type="text"]')
  await admin.type('.new-channel-form input[type="text"]', CHANNEL_NAME)
  await admin.click('.new-channel-form button[type="submit"]')
  await admin.waitForFunction(
    name => document.querySelector('.thread-title')?.textContent.trim() === name,
    { timeout: 10000 },
    CHANNEL_NAME,
  )
  check('channel created + selected', true)

  // 4. Add the partner from the members popover search.
  await admin.click('.members-btn')
  await admin.waitForSelector('.add-member input')
  await admin.type('.add-member input', PARTNER_EMAIL.slice(0, 20))
  await admin.waitForSelector('.search-result', { timeout: 10000 })
  await admin.click('.search-result')
  await admin.waitForFunction(
    () => document.querySelectorAll('.members-pop .member-row').length === 2,
    { timeout: 10000 },
  )
  check('partner added to the channel', true)
  await admin.keyboard.press('Escape')

  // 5. Partner reloads /chat → sees the channel, posts a message.
  await partner.goto(`${BASE}/chat`, { waitUntil: 'networkidle2' })
  await partner.waitForSelector('.room-btn', { timeout: 10000 })
  // First .group = the Channels section (later groups are DMs / Start-a-conversation).
  const partner_rooms = await partner.evaluate(() => [...document.querySelectorAll('.group')].map(group => ({
    label: group.querySelector('.group-label')?.textContent.trim(),
    items: [...group.querySelectorAll('.room-name')].map(el => el.textContent.trim()),
  })))
  const partner_channels = partner_rooms.find(group => group.label === 'Channels')?.items ?? []
  check('partner sees ONLY the new channel', partner_channels.length === 1 && partner_channels[0] === CHANNEL_NAME, JSON.stringify(partner_rooms))
  const partner_has_new_channel_btn = await partner.evaluate(() => !!document.querySelector('.new-channel-btn'))
  check('partner has no New-channel button', !partner_has_new_channel_btn)
  const partner_manage = await partner.evaluate(() => {
    document.querySelector('.members-btn')?.click()
    return new Promise((resolve) => {
      setTimeout(() => {
        const pop = document.querySelector('.members-pop')
        resolve({ open: !!pop, manage: !!document.querySelector('.members-pop .manage'), removes: document.querySelectorAll('.member-remove').length })
      }, 300)
    })
  })
  check('partner members popover is view-only', partner_manage.open && !partner_manage.manage && partner_manage.removes === 0, JSON.stringify(partner_manage))
  await partner.keyboard.press('Escape')

  const partner_message = `Hello from the partner! ${ts}`
  await partner.click('.composer-wrap [contenteditable="true"]')
  await partner.type('.composer-wrap [contenteditable="true"]', partner_message)
  await partner.keyboard.down('Control')
  await partner.keyboard.press('Enter')
  await partner.keyboard.up('Control')
  await partner.waitForFunction(
    text => document.body.innerText.includes(text),
    { timeout: 10000 },
    partner_message,
  )
  check('partner posted a message', true)

  // 6. Admin's open thread picks it up via the 5s poll, with the partner's name.
  await admin.waitForFunction(
    text => document.body.innerText.includes(text),
    { timeout: 15000 },
    partner_message,
  )
  // Registration derives users.name from the email prefix — that's what name_for shows.
  const admin_sees_author = await admin.evaluate(prefix => document.body.innerText.includes(prefix), `e2e-partner+${ts}`)
  check('admin receives the partner message via poll', true)
  check('author renders as the partner', admin_sees_author)

  // 7. Partner entry point: UserMenu Chat link on the home page.
  await partner.goto(`${BASE}/dictionaries`, { waitUntil: 'networkidle2' })
  await partner.waitForSelector('.avatar-button', { timeout: 10000 })
  await partner.click('.avatar-button')
  await new Promise(resolve => setTimeout(resolve, 400))
  const menu_chat_link = await partner.evaluate(() => {
    const links = [...document.querySelectorAll('a')]
    return links.some(a => a.getAttribute('href') === '/chat' && a.textContent.includes('Chat'))
  })
  check('partner UserMenu has the Chat link', menu_chat_link)

  // 8. /admin/team redirects to /chat.
  await admin.goto(`${BASE}/admin/team?room=all-admins`, { waitUntil: 'networkidle2' })
  const redirected = admin.url()
  check('/admin/team redirects to /chat preserving ?room', redirected.includes('/chat?room=all-admins'), redirected)

  await admin.screenshot({ path: '/tmp/chat-e2e-admin.png' })
  await partner.screenshot({ path: '/tmp/chat-e2e-partner.png' })

  const real_errors = page_errors.filter(message => !message.includes('Failed to load resource'))
  check('no page errors', real_errors.length === 0, real_errors.join(' | '))
} finally {
  await browser_admin.close()
  await browser_partner.close()
}

console.log(failures.length ? `\n${failures.length} FAILURE(S)` : '\nALL CHECKS PASSED')
process.exit(failures.length ? 1 : 0)
