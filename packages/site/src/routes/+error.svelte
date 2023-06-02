
<script lang="ts">
  import { t } from 'svelte-i18n';
  import { onMount } from 'svelte';
  import { firebaseConfig } from 'sveltefirets';
  import { Button, ShowHide } from 'svelte-pieces';
  import { page } from '$app/stores';

  onMount(async () => {
    const Sentry = await import('@sentry/browser');
    const eventId = Sentry.captureException($page.error);
    console.log('sent error', eventId);
    // https://docs.sentry.io/enriching-error-data/user-feedback
    // Sentry.showReportDialog({ eventId });
  });
</script>

<svelte:head>
  <title>{$t('misc.error', { default: 'Error' })}: {$page.status}</title>
</svelte:head>

<div class="p-4 bg-white relative z-20">
  <h2 class="text-xl sm:text-4xl font-bold mb-3">
    {$t('error.run_into_error', {
      default: "We're sorry, we've run into an error.",
    })}
  </h2>

  <p class="mb-3">
    {$t('error.error_recorded', {
      default: 'The error has been recorded and we will be looking into it.',
    })}

    <b>
      {$t('error.please_explain', {
        default: 'Can you please send us a short note to explain what happened?',
      })}
    </b>
  </p>

  <ShowHide let:show let:toggle>
    <Button form="filled" onclick={toggle}>{$t('header.contact_us', { default: 'Contact Us' })}</Button>
    {#if show}
      {#await import('$lib/components/modals/Contact.svelte') then { default: Contact }}
        <Contact on:close={toggle} />
      {/await}
    {/if}
  </ShowHide>

  <p class="text-gray-600 text-sm mt-6">
    {$t('misc.error', { default: 'Error' })}:
    {$page.status}
    -
    {$page.error.message}
  </p>

  {#if firebaseConfig.projectId === 'talking-dictionaries-dev' && $page.error.message}
    <div class="w-full overflow-x-auto">
      <pre>{JSON.stringify($page.error, null, 2)}</pre>
    </div>
  {/if}
</div>
