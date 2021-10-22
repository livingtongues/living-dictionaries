<script lang="ts">
  import ShowHide from '$svelteui/functions/ShowHide.svelte';
  import Button from '$svelteui/ui/Button.svelte';
  import { _ } from 'svelte-i18n';
  import EditFieldModal from '../modals/EditFieldModal.svelte';
  import { getFirestore, addDoc, collection, serverTimestamp } from '@firebase/firestore/lite';
  // import type { IEntry } from '$lib/interfaces';
  import { page } from '$app/stores';
  import { goto } from '$app/navigation';
  import { getUid } from '$sveltefire/firestore';

  async function addNewEntry(lx: string) {
    if (!lx) {
      return alert(`Missing: ${$_('entry.lx', { default: 'Lexeme/Word/Phrase' })}`);
    }
    try {
      const data = {
        lx,
        gl: {},
        ua: serverTimestamp(),
        ca: serverTimestamp(),
        ub: getUid(),
        cb: getUid(),
      };
      const firestore = getFirestore();
      const entryDoc = await addDoc(
        collection(firestore, `dictionaries/${$page.params.dictionaryId}/words`),
        data
      );
      console.log({ entryDoc });
      goto(`/${$page.params.dictionaryId}/entry/${entryDoc.id}`);
    } catch (err) {
      console.error(err);
      alert(`${$_('misc.error', { default: 'Error' })}: ${err}`);
    }
  }
</script>

<ShowHide let:show let:toggle>
  <Button form="primary" onclick={toggle}>
    <i class="far fa-plus" />
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
