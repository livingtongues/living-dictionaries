// Tracks whether the browser has a native "install this app" prompt ready
// (Android Chrome/Samsung Internet, desktop Chrome/Edge fire `beforeinstallprompt`)
// so UI (e.g. UserMenu's "Add to Home Screen" item) can offer it without each
// call site re-implementing the capture/replay dance. iOS Safari has no such
// event — `is_ios` lets callers fall back to manual Share-Sheet instructions.
let deferred_prompt = $state<any>(null)
let installed = $state(false)
let initialized = false

function is_standalone() {
  return window.matchMedia('(display-mode: standalone)').matches
    || (window.navigator as any).standalone === true
}

export function init_pwa_install() {
  if (initialized)
    return
  initialized = true

  installed = is_standalone()

  window.addEventListener('beforeinstallprompt', (event) => {
    event.preventDefault()
    deferred_prompt = event
  })
  window.addEventListener('appinstalled', () => {
    installed = true
    deferred_prompt = null
  })
}

export const pwa_install = {
  /** True once the browser has fired `beforeinstallprompt` and we haven't used/lost it yet. */
  get can_prompt() { return !!deferred_prompt && !installed },
  /** iOS has no install prompt API — Add to Home Screen only exists via the Share Sheet. */
  get is_ios() { return typeof navigator !== 'undefined' && /iphone|ipad|ipod/i.test(navigator.userAgent) },
  get installed() { return installed },
  /** Replays the captured browser prompt. No-ops if there isn't one (call site should check `can_prompt` first). */
  async prompt() {
    if (!deferred_prompt)
      return
    const event = deferred_prompt
    deferred_prompt = null
    event.prompt()
    await event.userChoice
  },
}
