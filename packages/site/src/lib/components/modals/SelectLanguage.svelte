<script lang="ts">
  import { Button, Modal } from '$lib/svelte-pieces';
  import { page } from '$app/state'
  import { changeLocale, locales, unpublishedLocales } from '$lib/i18n/changeLocale';

  interface Props {
    on_close: () => void;
  }

  let { on_close }: Props = $props();
  let {admin} = $derived(page.data)
</script>

<Modal {on_close}>
  {#snippet heading()}
    <span >
      {page.data.t('header.select_language')}
    </span>
  {/snippet}

  <div>
    {#each locales as [bcp, name]}
      <Button
        class="mr-1 mb-1 !normal-case"
        color="black"
        form={page.data.locale.includes(bcp) ? 'filled' : 'simple'}
        onclick={() => changeLocale(bcp)}>
        {name}
      </Button>
    {/each}
    {#if admin}
      {#each unpublishedLocales as [bcp, name]}
        <Button
          class="mr-1 mb-1 !normal-case"
          color="black"
          form={page.data.locale.includes(bcp) ? 'filled' : 'simple'}
          onclick={() => changeLocale(bcp)}>
          {name}
          <i class="far fa-key"></i>
        </Button>
      {/each}
    {/if}
  </div>
</Modal>
