<script lang="ts">
  import ShowHide from '$svelteui/functions/ShowHide.svelte';
  import Button from '$svelteui/ui/Button.svelte';
  import { _ } from 'svelte-i18n';
  import EditFieldModal from '../modals/EditFieldModal.svelte';
  import type { IEntry } from '$lib/interfaces';
  import { page } from '$app/stores';
  import { goto } from '$app/navigation';
  import { add } from '$sveltefire/firestorelite';

  async function addNewEntry(lx: string) {
    if (!lx) {
      return alert(`Missing: ${$_('entry.lx', { default: 'Lexeme/Word/Phrase' })}`);
    }
    try {
      const entryDoc = await add<IEntry>(`dictionaries/${$page.params.dictionaryId}/words`, {
        lx,
        gl: {},
      });
      goto(`/${$page.params.dictionaryId}/entry/${entryDoc.id}`);
    } catch (err) {
      console.error(err);
      alert(`${$_('misc.error', { default: 'Error' })}: ${err}`);
    }
  }

  let online = true;
</script>

<svelte:window bind:online />

<ShowHide let:show let:toggle>
  <Button form="primary" onclick={toggle} disabled={!online}>
    <i class="far fa-plus" />
    {#if !online}
      Return online to
    {/if}
    {$_('entry.add_entry', { default: 'Add Entry' })}
  </Button>
  {#if show}
    <EditFieldModal
      field="lx"
      display={$_('entry.lx', { default: 'Lexeme/Word/Phrase' })}
      on:valueupdate={(e) => addNewEntry(e.detail.newValue)}
      on:close={toggle}
      adding
    />
  {/if}
</ShowHide>
