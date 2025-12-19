<script lang="ts">
  import { Button, ShowHide } from 'svelte-pieces'
  import { page } from '$app/stores'
  import EditFieldModal from '$lib/components/entry/EditFieldModal.svelte'
  import type { DbOperations } from '$lib/dbOperations'

  interface Props {
    add_entry: DbOperations['insert_entry'];
    [key: string]: any
  }

  let { ...props }: Props = $props();

  let online = $state(true)
</script>

<svelte:window bind:online />

<ShowHide  >
  {#snippet children({ show, toggle })}
    <Button class="text-nowrap {props.class}" form="filled" onclick={toggle} disabled={!online}>
      {#if online}
        <span class="i-fa-solid-plus -mt-1"></span>
      {:else}
        Return online to
      {/if}
      {$page.data.t('entry.add_entry')}
    </Button>
    {#if show}
      <EditFieldModal
        field="lexeme"
        display={$page.data.t('entry_field.lexeme')}
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
