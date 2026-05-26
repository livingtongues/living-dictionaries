<script lang="ts">
  import { dev } from '$app/environment'
  import { goto } from '$app/navigation'
  import { page } from '$app/state'
  import { api_auth_email_send_code } from '$api/auth/email/send-code/_call.js'
  import { api_auth_email_verify } from '$api/auth/email/verify/_call.js'
  import { ADMINS } from '$lib/admins'
  import { display_one_tap_button } from '$lib/auth/google-one-tap'
  import { get_auth_user } from '$lib/auth/user.svelte.js'

  // In dev, pre-fill the first admin's email so single-click signs in.
  let email = $state(dev ? ADMINS[0]?.email ?? '' : '')
  let code = $state('')
  let stage = $state<'email' | 'code'>('email')
  let error: string | null = $state(null)
  let loading = $state(false)
  let google_button_parent = $state<HTMLDivElement | undefined>(undefined)

  $effect(() => {
    if (google_button_parent)
      display_one_tap_button(google_button_parent).catch(err => console.error('Google sign-in init failed:', err))
  })

  async function send_code(event: SubmitEvent) {
    event.preventDefault()
    error = null
    loading = true
    const { data, error: err } = await api_auth_email_send_code({ email })
    if (err) {
      loading = false
      error = err.message
      return
    }
    // In dev the server returns the code inline; auto-submit verify so the
    // user doesn't have to copy/paste — mirrors house's UX.
    if (data.code) {
      ({ code } = data)
      await complete_verify()
      return
    }
    loading = false
    stage = 'code'
  }

  async function verify_code(event: SubmitEvent) {
    event.preventDefault()
    error = null
    loading = true
    await complete_verify()
  }

  async function complete_verify() {
    const { data, error: err } = await api_auth_email_verify({ email, code })
    loading = false
    if (err) {
      error = err.message
      return
    }
    get_auth_user().set_session({ user: data.user })
    const redirect = page.url.searchParams.get('redirect') || '/'
    await goto(redirect)
  }
</script>

<svelte:head>
  <title>Sign in — Living Dictionaries</title>
</svelte:head>

<div class="min-h-screen bg-[var(--background)] text-[var(--color)] flex items-center justify-center px-4">
  <div class="w-full max-w-sm">
    <h1 class="text-2xl font-bold mb-1">Sign in</h1>
    <p class="text-sm text-[var(--color-secondary)] mb-6">Living Dictionaries</p>

    {#if stage === 'email'}
      <div bind:this={google_button_parent} class="mb-4 flex justify-center"></div>

      <div class="mb-4 flex items-center gap-3 text-xs uppercase tracking-wider text-[var(--color-secondary)]">
        <span class="h-px flex-1 bg-[var(--surface)]"></span>
        <span>or</span>
        <span class="h-px flex-1 bg-[var(--surface)]"></span>
      </div>

      <form onsubmit={send_code} class="flex flex-col gap-4">
        <label class="flex flex-col gap-1 text-sm">
          <span class="text-[var(--color-secondary)]">Email</span>
          <input
            type="email"
            required
            autocomplete="email"
            bind:value={email}
            disabled={loading}
            class="px-3 py-2 rounded-lg bg-[var(--surface)] text-[var(--color)] border-none outline-none focus:ring-2 focus:ring-[var(--primary)] disabled:opacity-50" />
        </label>
        <button type="submit" disabled={loading || !email} class="btn btn-default">
          {#if loading}
            <span class="i-mdi-loading animate-spin mr-1"></span>Sending…
          {:else}
            <span class="i-mdi-email-arrow-right mr-1"></span>Send code
          {/if}
        </button>
      </form>
    {:else}
      <form onsubmit={verify_code} class="flex flex-col gap-4">
        <p class="text-sm text-[var(--color-secondary)]">
          Enter the code sent to <strong class="text-[var(--color)]">{email}</strong>.
        </p>
        <label class="flex flex-col gap-1 text-sm">
          <span class="text-[var(--color-secondary)]">Code</span>
          <input
            type="text"
            required
            inputmode="numeric"
            autocomplete="one-time-code"
            maxlength="6"
            bind:value={code}
            disabled={loading}
            class="px-3 py-2 rounded-lg bg-[var(--surface)] text-[var(--color)] border-none outline-none focus:ring-2 focus:ring-[var(--primary)] disabled:opacity-50 text-center text-lg tracking-widest font-mono" />
        </label>
        <button type="submit" disabled={loading || !code} class="btn btn-default">
          {#if loading}
            <span class="i-mdi-loading animate-spin mr-1"></span>Verifying…
          {:else}
            <span class="i-mdi-key mr-1"></span>Verify
          {/if}
        </button>
        <button type="button" class="btn-ghost btn-sm" onclick={() => { stage = 'email'; code = ''; error = null }}>
          Use a different email
        </button>
      </form>
    {/if}

    {#if error}
      <p class="mt-4 text-sm text-[var(--danger)] flex items-center gap-1">
        <span class="i-mdi-alert-circle"></span>{error}
      </p>
    {/if}

    <p class="mt-6 text-xs text-[var(--color-secondary)]">
      By signing in you agree to our <a href="/terms" class="underline">Terms</a>
      and <a href="/privacy" class="underline">Privacy Policy</a>.
    </p>
  </div>
</div>
