<script context="module" lang="ts">
  export function load({ error, status }) {
    return {
      props: { error, status },
    };
  }
</script>

<script lang="ts">
  import { _ } from 'svelte-i18n';
  import { onMount } from 'svelte';
  import { firebaseConfig } from '$lib/firebaseConfig';
  import Button from 'svelte-pieces/ui/Button.svelte';
  import ShowHide from 'svelte-pieces/functions/ShowHide.svelte';

  export let status;
  export let error;

  onMount(async () => {
    const Sentry = await import('@sentry/browser');
    const eventId = Sentry.captureException(error);
    console.log('sent error', eventId);
    // https://docs.sentry.io/enriching-error-data/user-feedback
    // Sentry.showReportDialog({ eventId });
  });
</script>

<svelte:head>
  <title>{$_('misc.error', { default: 'Error' })}: {status}</title>
</svelte:head>

<div class="p-4 bg-white relative z-20">
  <h2 class="text-xl sm:text-4xl font-bold mb-3">
    {$_('error.run_into_error', {
      default: "We're sorry, we've run into an error.",
    })}
  </h2>

  <p class="mb-3">
    {$_('error.error_recorded', {
      default: 'The error has been recorded and we will be looking into it.',
    })}

    <b>
      {$_('error.please_explain', {
        default: 'Can you please send us a short note to explain what happened?',
      })}
    </b>
  </p>

  <ShowHide let:show let:toggle>
    <Button form="filled" onclick={toggle}>Contact Us</Button>
    {#if show}
      {#await import('$lib/components/modals/Contact.svelte') then { default: Contact }}
        <Contact on:close={toggle} />
      {/await}
    {/if}
  </ShowHide>

  <p class="text-gray-600 text-sm mt-6">
    {$_('misc.error', { default: 'Error' })}:
    {status}
    -
    {error.message}
  </p>

  {#if firebaseConfig.projectId === 'talking-dictionaries-dev' && error.stack}
    <div class="w-full overflow-x-auto">
      <pre>{error.stack}</pre>
    </div>
  {/if}
</div>
