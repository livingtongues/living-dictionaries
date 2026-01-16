// https://developers.google.com/identity/gsi/web/guides/overview

import type { CredentialResponse } from 'google-one-tap'
import { loadScriptOnce } from '$lib/svelte-pieces'
import { handle_sign_in_response } from './sign_in'
import { remove_cached_user } from './user'
import { getSupabase } from '$lib/supabase'
import { invalidateAll } from '$app/navigation'

const client_id = '215143435444-fugm4gpav71r3l89n6i0iath4m436qnv.apps.googleusercontent.com'

let loaded = false

async function load_google_sign_in() {
  if (loaded)
    return
  await loadScriptOnce('https://accounts.google.com/gsi/client')
  // @ts-expect-error
  google.accounts.id.initialize({
    client_id,
    callback: handleSignInWithGoogle,
    auto_select: true,
    itp_support: true,
    use_fedcm_for_prompt: true,
  })
  // eslint-disable-next-line require-atomic-updates
  loaded = true
}

async function handleSignInWithGoogle(response: CredentialResponse) {
  const supabase = getSupabase()

  const { data, error } = await supabase.auth.signInWithIdToken({
    provider: 'google',
    token: response.credential,
  })
  handle_sign_in_response({ user: data?.user, error, supabase })
}

export async function display_one_tap_popover() {
  await load_google_sign_in()
  // @ts-expect-error
  google.accounts.id.prompt()
}

export async function display_one_tap_button(button_parent: HTMLElement) {
  await load_google_sign_in()
  // @ts-expect-error
  google.accounts.id.renderButton(button_parent, {
    theme: 'outline',
    size: 'large',
    text: 'signin_with',
    logo_alignment: 'left',
    shape: 'rectangular',
    type: 'standard',
  })
}

export async function sign_out() {
  const supabase = getSupabase()
  const { error } = await supabase.auth.signOut()
  if (error) {
    remove_cached_user()
    console.error(error)
    alert('Error signing out - cleared user cache')
  } else {
    invalidateAll()
  }
}
