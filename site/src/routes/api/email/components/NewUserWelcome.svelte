<script lang="ts">
  import BaseLayout from './BaseLayout.svelte'

  /**
   * Living Dictionaries welcome email — sent fire-and-forget on first signup
   * (`created === true` from `find_or_create_auth_user`). Copy adapted from
   * legacy `packages/old-site/src/routes/api/email/html/newUserWelcome.ts`.
   */

  interface Props {
    name: string | null
  }

  const { name }: Props = $props()

  const home_url = 'https://livingdictionaries.app/?utm_source=transactional&utm_medium=email&utm_campaign=welcome'
  const living_tongues_url = 'https://livingtongues.org/'
  const diego_email = 'diego@livingtongues.org'
</script>

<BaseLayout
  preheader="Welcome to the Living Dictionaries community."
  title="Welcome to Living Dictionaries">

  <h1 style="margin: 0 0 16px; font-size: 22px; line-height: 1.3; font-weight: 700; color: inherit;">
    Welcome{name ? `, ${name}` : ''}!
  </h1>

  <p style="margin: 0 0 16px;">
    Hello and welcome to the Living Dictionaries community.
  </p>

  <p style="margin: 0 0 16px;">
    Visit
    <a href={home_url} style="color: #546e7a;">livingdictionaries.app</a>
    anytime — we recommend bookmarking it so you can easily return and continue working on your Living Dictionary project.
    The website works on desktop as well as any mobile device. We recommend using Chrome as a browser.
  </p>

  <p style="margin: 0 0 16px;">
    We continue to improve the site and roll out new features as they are completed. The interface
    is available in over 13 languages (switch in the upper-right corner) and we keep adding more.
    We will also publish tutorials on how to use the site — stay tuned.
  </p>

  <p style="margin: 0 0 16px;">
    Visit the Living Tongues website to learn more about the background and usefulness of Living Dictionaries:
    <a href={living_tongues_url} style="color: #546e7a;">{living_tongues_url}</a>
  </p>

  <p style="margin: 0 0 16px;">
    If you have any questions about building your Living Dictionary, please email Diego at
    <a href="mailto:{diego_email}" style="color: #546e7a;">{diego_email}</a>
    or just reply to this email.
  </p>

  <p style="margin: 0 0 16px;">
    On behalf of everyone at Living Tongues Institute for Endangered Languages, thank you for
    registering and we look forward to seeing your Living Dictionary come to life.
  </p>

  <p style="margin: 0;">
    Best wishes,<br />
    The Living Tongues team
  </p>
</BaseLayout>

<svelte:options css="injected" />
