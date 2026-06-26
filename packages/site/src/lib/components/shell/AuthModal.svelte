<script lang="ts">
  import { Button, Form, Modal } from 'svelte-pieces'
  import { onMount } from 'svelte'
  import { toast } from '../ui/Toasts.svelte'
  import { handle_sign_in_response } from '../../supabase/sign_in'
  import { display_one_tap_button } from '$lib/supabase/auth'
  import { page } from '$app/stores'
  import { dev } from '$app/environment'
  import { api_email_otp } from '$api/email/otp/_call'

  export let context: 'force' = undefined
  export let on_close: () => void

  let email = dev ? 'manual@mock.com' : ''
  let sixDigitCodeSent = false
  let sixDigitCode: string
  const TEN_SECONDS = 10000
  const FOUR_SECONDS = 4000

  async function sendCode() {
    const { data, error } = await api_email_otp({ email })

    if (data?.otp) {
      sixDigitCode = data.otp
      return
    }

    console.info({ data, error })
    if (error)
      return toast(error.message, TEN_SECONDS)
    toast(`Sent code to: ${email}`, FOUR_SECONDS)
    sixDigitCodeSent = true
  }

  let submitting_code = false
  async function handleOTP(code: string) {
    submitting_code = true
    const { data, error } = await $page.data.supabase.auth.verifyOtp({
      email,
      token: code.toString(),
      type: 'email',
    })

    sixDigitCode = null
    submitting_code = false
    handle_sign_in_response({ user: data?.user, error, supabase: $page.data.supabase })
    if (!error)
      on_close()
  }

  $: code_is_6_digits = /^\d{6}$/.test(sixDigitCode)
  $: if (code_is_6_digits && !submitting_code) {
    handleOTP(sixDigitCode)
  }

  function autofocus(node: HTMLInputElement) {
    setTimeout(() => node.focus(), 15)
  }

  let button_parent: HTMLDivElement
  const can_google_authenticate = !location.origin.includes('vercel.app')
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
  <span slot="heading">{$page.data.t('header.login')}
    {#if submitting_code}
      <span class="i-svg-spinners-3-dots-fade align--4px"></span>
    {/if}
  </span>
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
    <Form onsubmit={sendCode} let:loading>
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
