<script lang="ts">
  import Button from '$lib/components/ui/Button.svelte'
  import ShowHide from '$lib/components/ui/ShowHide.svelte'
  import { page } from '$app/state'
  import EditFieldModal from '$lib/components/entry/EditFieldModal.svelte'
  import type { DbOperations } from '$lib/db-operations'
  import IconFaSolidPlus from '~icons/fa-solid/plus'

  interface Props {
    add_entry: DbOperations['insert_entry']
    [key: string]: any
  }

  const { ...props }: Props = $props()

  let online = $state(true)
</script>

<svelte:window bind:online />

<ShowHide>
  {#snippet children({ show, toggle })}
    <Button class="add-entry-button {props.class}" form="filled" onclick={toggle} disabled={!online}>
      {#if online}
        <IconFaSolidPlus class="icon-inline" style="margin-top: -0.25rem" />
      {:else}
        Return online to
      {/if}
      {page.data.t('entry.add_entry')}
    </Button>
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
