<script lang="ts">
  import EntryField from './_EntryField.svelte';

  import { _ } from 'svelte-i18n';
  import { page } from '$app/stores';
  import { canEdit, algoliaQueryParams, dictionary } from '$lib/stores';

  import type { IEntry } from '$lib/interfaces';
  let entry: IEntry = {
    lx: '',
    gl: {},
  };

  import { add } from '$sveltefire/firestore';
  import { goto } from '$app/navigation';
  import Button from '$svelteui/ui/Button.svelte';
  async function addNewEntry() {
    if (!entry.lx) {
      return alert(`Missing: ${$_('entry.lx', { default: 'Lexeme/Word/Phrase' })}`);
    }
    if (!$canEdit) {
      return alert(
        `${$_('entry.signed_in_as_manager', {
          default: 'You must be signed in as a manager of this dictionary to make changes.',
        })}`
      );
    }
    try {
      const entryDoc = await add<IEntry>(
        `dictionaries/${$page.params.dictionaryId}/words`,
        entry,
        true
      );
      goto(`/${$page.params.dictionaryId}/entry/${entryDoc.id}`);
    } catch (err) {
      console.error(err);
      alert(`${$_('misc.error', { default: 'Error' })}: ${err}`);
    }
  }
</script>

<form on:submit|preventDefault={addNewEntry}>
  <div class="flex items-center mb-1 md:px-2">
    <span class="sm:text-lg font-semibold"
      >{$_('entry.add_entry', {
        default: 'Add Entry',
      })}</span>
    <div class="flex-grow" />

    <Button
      form="simple"
      color="black"
      href="/{$page.params.dictionaryId}/entries/list{$algoliaQueryParams}">
      {$_('misc.cancel', { default: 'Cancel' })}
    </Button>
    <div class="w-1" />
    <Button form="primary" type="submit">
      {$_('misc.next', { default: 'Next' })}
      <i class="far fa-chevron-right rtl-x-flip" />
    </Button>
  </div>

  <!-- TODO: add IPA keyboard and Keyman keyboards -->
  <EntryField
    value={entry.lx}
    display={$_('entry.lx', { default: 'Lexeme/Word/Phrase' })}
    on:valueupdate={(e) => (entry.lx = e.detail.newValue)}
    canEdit={true} />

  {#each $dictionary.glossLanguages as bcp}
    <EntryField
      value={entry.gl[bcp]}
      display={$_(`gl.${bcp}`, {
        default: bcp,
      }) +
        ' ' +
        $_('entry.gloss', { default: 'Gloss' })}
      on:valueupdate={(e) => (entry.gl[bcp] = e.detail.newValue)}
      canEdit={true} />
  {/each}
</form>
