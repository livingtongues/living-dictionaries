<script lang="ts">
  import BaseLayout from './BaseLayout.svelte'

  interface Props {
    code: string
    minutes: number
  }

  const { code, minutes }: Props = $props()

  const code_bg = '#f3f4f6'
  const code_color = '#111827'
  const code_border = '#e5e7eb'
</script>

<BaseLayout
  preheader="{code} is your sign-in code for Living Dictionaries."
  title="Your Living Dictionaries sign-in code">

  <h1 style="margin: 0 0 12px; font-size: 22px; line-height: 1.3; font-weight: 700; color: inherit;">
    Your sign-in code
  </h1>

  <p style="margin: 0 0 20px;">
    Enter this code on the sign-in screen to finish logging in to Living Dictionaries.
  </p>

  <div
    class="surface border text"
    style="background-color: {code_bg}; border: 1px solid {code_border}; border-radius: 10px; padding: 18px 24px; text-align: center; font-family: 'SFMono-Regular', Consolas, 'Liberation Mono', Menlo, monospace; font-size: 32px; letter-spacing: 8px; font-weight: 700; color: {code_color}; margin-bottom: 20px;">

    {code}
  </div>

  <p class="muted" style="margin: 0; font-size: 13px; color: #6b7280;">
    This code expires in {minutes} {minutes === 1 ? 'minute' : 'minutes'}. If you didn't request it, you can safely ignore this email.
  </p>
</BaseLayout>

<svelte:options css="injected" />
