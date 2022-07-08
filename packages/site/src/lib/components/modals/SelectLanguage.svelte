<script lang="ts">
  import { _, locale, locales } from 'svelte-i18n';
  import Modal from '$lib/components/ui/Modal.svelte';
  import { setCookie } from '$lib/helpers/cookies';
  import { ReadyLocales, UnpublishedLocales } from '@living-dictionaries/types';
  import Button from 'svelte-pieces/ui/Button.svelte';
  import { admin } from '$lib/stores';

  function setLocale(bcp) {
    $locale = bcp;
    setCookie('locale', bcp, { 'max-age': 31536000 });
  }
</script>

<Modal on:close>
  <span slot="heading">
    {$_('header.select_language', { default: 'Select Language' })}
  </span>

  <div>
    {#each $locales as bcp}
      {#if Object.keys(ReadyLocales).includes(bcp)}
        <Button
          class="mr-1 mb-1 !normal-case"
          color="black"
          form={$locale.includes(bcp) ? 'filled' : 'simple'}
          onclick={() => setLocale(bcp)}>
          {ReadyLocales[bcp]}
        </Button>
      {:else if $admin}
        <Button
          class="mr-1 mb-1 !normal-case"
          color="black"
          form={$locale.includes(bcp) ? 'filled' : 'simple'}
          onclick={() => setLocale(bcp)}>
          {UnpublishedLocales[bcp]}
          <i class="far fa-key" />
        </Button>
      {/if}
    {/each}
  </div>
</Modal>
