<script context="module" lang="ts">
  import type { IEntry } from '@living-dictionaries/types';
  import { getDocument, Doc } from '$sveltefirets';

  import type { Load } from '@sveltejs/kit';
  export const load: Load = async ({ params }) => {
    try {
      const entry = await getDocument<IEntry>(
        `dictionaries/${params.dictionaryId}/words/${params.entryId}`
      );
      if (entry) {
        return {
          props: {
            initialEntry: entry,
            dictionaryId: params.dictionaryId,
          },
        };
      } else {
        return { status: 301, redirect: `/${params.dictionaryId}` };
      }
    } catch (err) {
      return { status: 500, err };
    }
  };
</script>

<script lang="ts">
  export let initialEntry: IEntry, dictionaryId: string;

  import { _ } from 'svelte-i18n';
  import {
    dictionary,
    algoliaQueryParams,
    isManager,
    isContributor,
    canEdit,
    admin,
    user,
  } from '$lib/stores';
  import { share } from '$lib/helpers/share';
  import Button from 'svelte-pieces/ui/Button.svelte';
  import { deleteEntry } from '$lib/helpers/delete';
  import { saveUpdateToFirestore } from '$lib/helpers/entry/update';
  import EntryMeta from './_EntryMeta.svelte';
  import { showEntryGlossLanguages } from '$lib/helpers/glosses';
  import EntryDisplay from './_EntryDisplay.svelte';
</script>

<Doc
  path={`dictionaries/${dictionaryId}/words/${initialEntry.id}`}
  startWith={initialEntry}
  let:data={entry}>
  <div
    class="flex justify-between items-center mb-3 md:top-12 sticky top-0 z-30
bg-white pt-1 -mt-1">
    <Button
      class="-ml-2 !px-2"
      color="black"
      form="simple"
      href="/{$dictionary.id}/entries/list{$algoliaQueryParams}">
      <i class="fas fa-arrow-left rtl-x-flip" />
      {$_('misc.back', { default: 'Back' })}
    </Button>

    <div>
      {#if $admin > 1}
        {#await import('svelte-pieces/data/JSON.svelte') then { default: JSON }}
          <JSON obj={entry} />
        {/await}
      {/if}
      {#if $isManager || ($isContributor && entry.cb === $user.uid)}
        <Button
          color="red"
          form="simple"
          onclick={() => deleteEntry(entry, $dictionary.id, $algoliaQueryParams)}>
          <span class="hidden md:inline">
            {$_('misc.delete', { default: 'Delete' })}
          </span>
          <i class="fas fa-trash ml-1" />
        </Button>
      {/if}
      <Button form="filled" onclick={() => share($dictionary.id, entry)}>
        <span>{$_('misc.share', { default: 'Share' })}</span>
        <i class="fas fa-share-square ml-1" />
      </Button>
    </div>
  </div>

  <EntryDisplay
    {entry}
    videoAccess={$dictionary.videoAccess || $admin > 0}
    canEdit={$canEdit}
    glossingLanguages={showEntryGlossLanguages(entry.gl, $dictionary.glossLanguages)}
    alternateOrthographies={$dictionary.alternateOrthographies || []}
    on:valueupdate={(e) => saveUpdateToFirestore(e, entry.id, $dictionary.id)} />

  <EntryMeta {entry} dictionary={$dictionary} />
</Doc>
