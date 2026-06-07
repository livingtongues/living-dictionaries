<script lang="ts">
  import { run } from 'svelte/legacy'

  import { onMount } from 'svelte'
  import { toast } from '$lib/svelte-pieces/toast.svelte'
  import { Button, Form, Modal } from '$lib/svelte-pieces'
  import { display_one_tap_button } from '$lib/auth/google-one-tap'
  import { get_auth_user } from '$lib/auth/user.svelte'
  import { page } from '$app/stores'
  import { invalidateAll } from '$app/navigation'
  import { dev } from '$app/environment'
  import { env as public_env } from '$env/dynamic/public'
  import { api_auth_email_send_code } from '$api/auth/email/send-code/_call'
  import { api_auth_email_verify } from '$api/auth/email/verify/_call'

  interface Props {
    context?: 'force'
    on_close: () => void
  }

  const { context = undefined, on_close }: Props = $props()

  let email = $state(dev ? 'jwrunner7@gmail.com' : '')
  let sixDigitCodeSent = $state(false)
  let sixDigitCode: string = $state()

  async function sendCode() {
    const { data, error } = await api_auth_email_send_code({ email })

    if (error)
      return toast.error(error.message, 10)

    // In dev the server returns the code inline — auto-fill so the effect below submits it.
    if (data.code) {
      sixDigitCode = data.code
      return
    }

    toast(`Sent code to: ${email}`, 4)
    sixDigitCodeSent = true
  }

  let submitting_code = $state(false)
  async function handleOTP(code: string) {
    submitting_code = true
    const { data, error } = await api_auth_email_verify({ email, code: code.toString() })

    sixDigitCode = null
    submitting_code = false
    if (error)
      return toast.error(error.message, 10)

    get_auth_user().set_session({ user: data.user })
    await invalidateAll()
    on_close()
  }

  const code_is_6_digits = $derived(/^\d{6}$/.test(sixDigitCode))
  run(() => {
    if (code_is_6_digits && !submitting_code) {
      handleOTP(sixDigitCode)
    }
  })

  function autofocus(node: HTMLInputElement) {
    setTimeout(() => node.focus(), 15)
  }

  let button_parent: HTMLDivElement = $state()
  // Gracefully no-op when Google isn't configured (no client id) — mirrors house's
  // `google_enabled` guard. Without this the GSI helper throws an uncaught rejection
  // and the email-OTP path is the only way to sign in.
  const can_google_authenticate = !location.origin.includes('vercel.app') && !!public_env.PUBLIC_GOOGLE_OAUTH_CLIENT_ID
  onMount(() => {
    if (can_google_authenticate && button_parent)
      display_one_tap_button(button_parent)
  })
</script>

<svelte:head>
  {#if can_google_authenticate}
    <script src="https://accounts.google.com/gsi/client" async></script>
  {/if}
</svelte:head>

<Modal on:close={on_close}>
  {#snippet heading()}
    <span>{$page.data.t('header.login')}
      {#if submitting_code}
        <span class="i-svg-spinners-3-dots-fade align--4px"></span>
      {/if}
    </span>
  {/snippet}
  {#if context === 'force'}
    <h4 class="text-green-700 mb-4">
      {$page.data.t('header.please_create_account')}
    </h4>
  {/if}

  {#if !sixDigitCodeSent}
    {#if can_google_authenticate}
      <div class="mb-3" bind:this={button_parent}></div>

      <div class="mb-3 text-gray-500/80 text-sm font-semibold">
        {$page.data.t('misc.disjunctive').toUpperCase()}
      </div>
    {/if}
    <Form onsubmit={sendCode}>
      {#snippet children({ loading })}
        <div class="flex">
          <input
            type="email"
            use:autofocus
            placeholder={$page.data.t('contact.email')}
            class="border border-gray-400 p-2 rounded w-full"
            required
            bind:value={email} />
          <Button class="text-nowrap ml-1" {loading} form="filled" type="submit">{$page.data.t('account.send_code')}</Button>
        </div>
      {/snippet}
    </Form>
  {:else}
    <div class="mb-2">
      {$page.data.t('account.enter_6_digit_code_sent_to')}: {email}
    </div>
    <input
      type="text"
      placeholder="_ _ _ _ _ _"
      class="border border-gray-400 p-2 rounded w-full"
      maxlength="6"
      bind:value={sixDigitCode} />
  {/if}
</Modal>
