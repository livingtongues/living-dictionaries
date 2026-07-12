<script lang="ts">
  import { onMount } from 'svelte'
  import { toast } from '$lib/state/toast.svelte'
  import HeadlessButton from '$lib/components/ui/HeadlessButton.svelte'
  import Form from '$lib/components/ui/Form.svelte'
  import Modal from '$lib/components/ui/Modal.svelte'
  import { display_one_tap_button } from '$lib/auth/google-one-tap'
  import { get_auth_user } from '$lib/auth/user.svelte'
  import { page } from '$app/state'
  import { invalidateAll } from '$app/navigation'
  import { dev } from '$app/environment'
  import { env as public_env } from '$env/dynamic/public'
  import { api_auth_email_send_code } from '$api/auth/email/send-code/_call'
  import { api_auth_email_verify } from '$api/auth/email/verify/_call'
  import IconSvgSpinners3DotsFade from '~icons/svg-spinners/3-dots-fade'

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
  $effect(() => {
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

<Modal on_close={on_close}>
  {#snippet heading()}
    <span>{page.data.t('header.login')}
      {#if submitting_code}
        <IconSvgSpinners3DotsFade style="vertical-align: -4px" />
      {/if}
    </span>
  {/snippet}
  {#if context === 'force'}
    <h4 class="create-account-nudge">
      {page.data.t('header.please_create_account')}
    </h4>
  {/if}

  {#if !sixDigitCodeSent}
    {#if can_google_authenticate}
      <div class="google-button" bind:this={button_parent}></div>

      <div class="or-divider">
        {page.data.t('misc.disjunctive').toUpperCase()}
      </div>
    {/if}
    <Form onsubmit={sendCode}>
      {#snippet children({ loading })}
        <div class="send-row">
          <input
            type="email"
            use:autofocus
            placeholder={page.data.t('contact.email')}
            class="text-input"
            required
            bind:value={email} />
          <HeadlessButton class="btn-primary btn-default send-code-button" {loading} type="submit">{page.data.t('account.send_code')}</HeadlessButton>
        </div>
      {/snippet}
    </Form>
  {:else}
    <div class="code-sent-note">
      {page.data.t('account.enter_6_digit_code_sent_to')}: {email}
    </div>
    <input
      type="text"
      placeholder="_ _ _ _ _ _"
      class="text-input"
      maxlength="6"
      bind:value={sixDigitCode} />
  {/if}
</Modal>

<style>
  .create-account-nudge {
    color: rgb(21 128 61); /* green-700 */
    margin-bottom: 1rem;
  }

  .google-button {
    margin-bottom: 0.75rem;
  }

  .or-divider {
    margin-bottom: 0.75rem;
    color: rgb(107 114 128 / 0.8); /* gray-500/80 — visibly lighter than var(--color-secondary); kept literal for parity */
    font-size: 0.875rem;
    line-height: 1.25rem;
    font-weight: 600;
  }

  .send-row {
    display: flex;
  }

  .text-input {
    border: 1px solid color-mix(in srgb, var(--background), var(--color) 38%); /* ≈ gray-400 */
    padding: 0.5rem;
    border-radius: 0.25rem;
    width: 100%;
  }

  .send-row :global(.send-code-button) {
    text-wrap: nowrap;
    margin-left: 0.25rem;
  }

  .code-sent-note {
    margin-bottom: 0.5rem;
  }
</style>
