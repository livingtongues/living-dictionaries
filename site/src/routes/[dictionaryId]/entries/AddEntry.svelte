<script lang="ts">
  import HeadlessButton from '$lib/components/ui/HeadlessButton.svelte'
  import ShowHide from '$lib/components/ui/ShowHide.svelte'
  import { page } from '$app/state'
  import EditFieldModal from '$lib/components/entry/EditFieldModal.svelte'
  import type { MultiString } from '$lib/types'
  import IconFaSolidPlus from '~icons/fa-solid/plus'

  interface Props {
    add_entry: (lexeme: MultiString) => Promise<void>
    [key: string]: any
  }

  const { ...props }: Props = $props()

  let online = $state(true)
</script>

<svelte:window bind:online />

<ShowHide>
  {#snippet children({ show, toggle })}
    <HeadlessButton class="btn-primary btn-default add-entry-button {props.class}" onclick={toggle} disabled={!online}>
      {#if online}
        <IconFaSolidPlus style="margin-top: -0.25rem" />
      {:else}
        Return online to
      {/if}
      {page.data.t('entry.add_entry')}
    </HeadlessButton>
    {#if show}
      <EditFieldModal
        field="lexeme"
        display={page.data.t('entry_field.lexeme')}
        on_update={async (new_value) => {
          if (new_value) {
            await props.add_entry({ default: new_value })
          }
        }}
        on_close={toggle}
        addingLexeme />
    {/if}
  {/snippet}
</ShowHide>

<style>
  /* on the Button's element (rendered inside the Button component) */
  :global(.add-entry-button) {
    text-wrap: nowrap;
  }
</style>
