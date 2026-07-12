<script lang="ts">
  import IconKey from '~icons/fa-solid/key'
  import HeadlessButton from '$lib/components/ui/HeadlessButton.svelte'
  import Modal from '$lib/components/ui/Modal.svelte'
  import { page } from '$app/state'
  import { changeLocale, locales, unpublishedLocales } from '$lib/i18n/change-locale'

  interface Props {
    on_close: () => void
  }

  const { on_close }: Props = $props()

  const { auth_user } = $derived(page.data)
</script>

<Modal {on_close}>
  {#snippet heading()}
    <span>
      {page.data.t('header.select_language')}
    </span>
  {/snippet}

  <div>
    {#each locales as [bcp, name] (bcp)}
      <HeadlessButton
        class="{page.data.locale.includes(bcp) ? 'btn-primary' : 'btn-ghost'} btn-default locale-button"
        onclick={() => changeLocale(bcp)}>
        {name}
      </HeadlessButton>
    {/each}
    {#if auth_user.is_admin}
      {#each unpublishedLocales as [bcp, name] (bcp)}
        <HeadlessButton
          class="{page.data.locale.includes(bcp) ? 'btn-primary' : 'btn-ghost'} btn-default locale-button"
          onclick={() => changeLocale(bcp)}>
          {name}
          <IconKey />
        </HeadlessButton>
      {/each}
    {/if}
  </div>
</Modal>

<style>
  div :global(.locale-button) {
    margin-right: 0.25rem;
    margin-bottom: 0.25rem;
    text-transform: none !important;
  }
</style>
