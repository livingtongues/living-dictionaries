// https://developers.google.com/identity/gsi/web/guides/overview

import type * as GoogleOneTap from 'google-one-tap'
import type { CredentialResponse } from 'google-one-tap'
import { api_auth_google } from '$api/auth/google/_call.js'
import { goto, invalidateAll } from '$app/navigation'
import { env as public_env } from '$env/dynamic/public'
import { load_script_once } from './load-script-once'
import { get_auth_user } from './user.svelte.js'

// `google` is injected as a UMD global by the GSI client script we lazy-load
// in `load_google_sign_in`. The `@types/google-one-tap` package only ships
// types (no runtime), so explicit re-declare here keeps TS happy in this
// module-scoped file.
declare const google: typeof GoogleOneTap

/**
 * Lazy-load the GSI client and initialize it once. Idempotent — calling
 * either `display_one_tap_button` or `display_one_tap_popover` multiple
 * times only loads the script and runs `initialize` on the first call.
 */
let loaded = false

async function load_google_sign_in() {
  if (loaded)
    return
  const client_id = public_env.PUBLIC_GOOGLE_OAUTH_CLIENT_ID
  if (!client_id)
    throw new Error('PUBLIC_GOOGLE_OAUTH_CLIENT_ID is not set')

  await load_script_once('https://accounts.google.com/gsi/client')
  google.accounts.id.initialize({
    client_id,
    callback: handle_google_credential,
    auto_select: true,
    itp_support: true,
    use_fedcm_for_prompt: true,
  })
  // eslint-disable-next-line require-atomic-updates
  loaded = true
}

async function handle_google_credential(response: CredentialResponse) {
  const { data, error } = await api_auth_google({ id_token: response.credential })
  if (error) {
    // TODO(L9): replace with toast once svelte-pieces lands in LD.
    console.error('[google-sign-in]', error.message)
    return
  }
  get_auth_user().set_session({ user: data.user })

  // If the user kicked this off from /login (clicked the GSI button), navigate
  // them onward to ?redirect= or the homepage — same UX contract as the
  // email-OTP flow. Otherwise (one-tap popover fired on another page), just
  // invalidate so the page re-renders with the freshly-signed-in shell.
  const url = new URL(window.location.href)
  if (url.pathname === '/login') {
    const redirect = url.searchParams.get('redirect') || '/'
    await goto(redirect)
  } else {
    await invalidateAll()
  }
}

/**
 * Render the official Google-branded sign-in button inside the given parent
 * element. Suitable for the `/login` route's auth form.
 */
export async function display_one_tap_button(button_parent: HTMLElement) {
  await load_google_sign_in()
  google.accounts.id.renderButton(button_parent, {
    theme: 'outline',
    size: 'large',
    text: 'signin_with',
    logo_alignment: 'left',
    shape: 'rectangular',
    type: 'standard',
  })
}

/**
 * Trigger the floating "Continue as …" one-tap prompt. Best called from
 * customer-facing pages where the user is likely signed-out and signed into
 * Google in the same browser — GSI quietly no-ops if they aren't.
 */
export async function display_one_tap_popover() {
  await load_google_sign_in()
  google.accounts.id.prompt()
}
