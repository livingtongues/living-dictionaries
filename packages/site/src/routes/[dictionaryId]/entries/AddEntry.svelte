<script lang="ts">
  import { Button, ShowHide } from 'svelte-pieces'
  import { page } from '$app/stores'
  import EditFieldModal from '$lib/components/entry/EditFieldModal.svelte'
  import type { DbOperations } from '$lib/dbOperations'

  export let add_entry: DbOperations['insert_entry']
  let online = true
</script>

<svelte:window bind:online />

<ShowHide let:show let:toggle>
  <Button class="text-nowrap {$$props.class}" form="filled" onclick={toggle} disabled={!online}>
    {#if online}
      <span class="i-fa-solid-plus -mt-1" />
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
          await add_entry({ default: new_value })
        }
      }}
      on_close={toggle}
      addingLexeme />
  {/if}
</ShowHide>
