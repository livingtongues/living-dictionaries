<script lang="ts">
  import { t } from 'svelte-i18n';
  import { Button, ShowHide } from 'svelte-pieces';
  import EditFieldModal from '$lib/components/entry/EditFieldModal.svelte';
  import type { IEntry } from '@living-dictionaries/types';
  import { page } from '$app/stores';
  import { goto } from '$app/navigation';
  import { addOnline } from 'sveltefirets';

  async function addNewEntry(lx: string) {
    if (!lx) {
      return alert(`Missing: ${$t('entry.lx', { default: 'Lexeme/Word/Phrase' })}`);
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
      alert(`${$t('misc.error', { default: 'Error' })}: ${err}`);
    }
  }

  let online = true;
</script>

<svelte:window bind:online />

<ShowHide let:show let:toggle>
  <Button form="filled" onclick={toggle} disabled={!online}>
    {#if online}
      <span class="i-fa-solid-plus -mt-1" />
    {:else}
      Return online to
    {/if}
    {$t('entry.add_entry', { default: 'Add Entry' })}
  </Button>
  {#if show}
    <EditFieldModal
      field="lexeme"
      display={$t('entry.lx', { default: 'Lexeme/Word/Phrase' })}
      on:update={({detail}) => addNewEntry(detail)}
      on:close={toggle}
      addingLexeme />
  {/if}
</ShowHide>
