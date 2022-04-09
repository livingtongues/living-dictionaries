<script lang="ts">
  import ShowHide from 'svelte-pieces/functions/ShowHide.svelte';
  import Button from 'svelte-pieces/ui/Button.svelte';
  import { _ } from 'svelte-i18n';
  import EditFieldModal from '../modals/EditFieldModal.svelte';
  import type { IEntry } from '@ld/types';
  import { page } from '$app/stores';
  import { goto } from '$app/navigation';
  import { addOnline } from '$sveltefirets';

  async function addNewEntry(lx: string) {
    if (!lx) {
      return alert(`Missing: ${$_('entry.lx', { default: 'Lexeme/Word/Phrase' })}`);
    }
    try {
      const entryDoc = await addOnline<IEntry>(
        `dictionaries/${$page.params.dictionaryId}/words`,
        {
          lx,
          gl: {},
        },
        { abbreviate: true }
      );
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
  <Button form="filled" onclick={toggle} disabled={!online}>
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
      adding />
  {/if}
</ShowHide>
