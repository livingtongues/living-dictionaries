<script lang="ts">
  import { Button, Modal } from 'svelte-pieces';
  import { page } from '$app/stores'
  import { changeLocale, locales, unpublishedLocales } from '$lib/i18n/changeLocale';
  $: ({admin} = $page.data)
</script>

<Modal on:close>
  <span slot="heading">
    {$page.data.t('header.select_language')}
  </span>

  <div>
    {#each locales as [bcp, name]}
      <Button
        class="mr-1 mb-1 !normal-case"
        color="black"
        form={$page.data.locale.includes(bcp) ? 'filled' : 'simple'}
        onclick={() => changeLocale(bcp)}>
        {name}
      </Button>
    {/each}
    {#if $admin}
      {#each unpublishedLocales as [bcp, name]}
        <Button
          class="mr-1 mb-1 !normal-case"
          color="black"
          form={$page.data.locale.includes(bcp) ? 'filled' : 'simple'}
          onclick={() => changeLocale(bcp)}>
          {name}
          <i class="far fa-key" />
        </Button>
      {/each}
    {/if}
  </div>
</Modal>
