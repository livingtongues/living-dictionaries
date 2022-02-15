<script context="module" lang="ts">
  import type { IEntry } from '$lib/interfaces';
  import { getDocument, Doc } from '$sveltefirets';

  import type { Load } from '@sveltejs/kit';
  export const load: Load = async ({ page: { params } }) => {
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
  import Audio from '../entries/_Audio.svelte';
  import AddImage from '../entries/_AddImage.svelte';
  import EntryField from './_EntryField.svelte';
  import EntryPartOfSpeech from './_EntryPartOfSpeech.svelte';
  import EntrySemanticDomains from './_EntrySemanticDomains.svelte';
  import Image from '$lib/components/image/Image.svelte';
  import { share } from '$lib/helpers/share';
  import BadgeArray from '$svelteui/data/BadgeArray.svelte';
  import Button from '$svelteui/ui/Button.svelte';
  import { deleteEntry } from '$lib/helpers/delete';
  import { saveUpdateToFirestore } from '$lib/helpers/entry/update';
  import EntryMeta from './_EntryMeta.svelte';
  import { showEntryGlossLanguages } from '$lib/helpers/glosses';
</script>

<Doc
  path={`dictionaries/${dictionaryId}/words/${initialEntry.id}`}
  startWith={initialEntry}
  let:data={entry}
  log>
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
      <Button form="primary" onclick={() => share($dictionary.id, entry)}>
        <span>{$_('misc.share', { default: 'Share' })}</span>
        <i class="fas fa-share-square ml-1" />
      </Button>
    </div>
  </div>

  <div class="flex flex-col md:flex-row-reverse mb-3">
    <div class="md:hidden" dir="ltr">
      <EntryField
        value={entry.lx}
        field="lx"
        canEdit={$canEdit}
        display={$_('entry.lx', { default: 'Lexeme/Word/Phrase' })}
        on:valueupdate={(e) => saveUpdateToFirestore(e, entry.id, $dictionary.id)} />
    </div>

    <div class="md:w-1/3 flex flex-col md:flex-col-reverse justify-end mt-2">
      {#if entry.pf}
        <div class="w-full overflow-hidden rounded relative mb-2" style="height: 25vh;">
          <Image width={400} {entry} canEdit={$canEdit} />
        </div>
      {:else if canEdit}
        <AddImage {entry} class="rounded-md h-20 bg-gray-100 mb-2">
          <div class="text-xs" slot="text">
            {$_('entry.upload_photo', { default: 'Upload Photo' })}
          </div>
        </AddImage>
      {/if}

      {#if entry.sf || canEdit}
        <Audio {entry} class="h-20 mb-2 rounded-md bg-gray-100 px-3" />
      {/if}
    </div>

    <div class="hidden md:block w-1" />

    <div class="md:w-2/3 flex flex-col">
      <div class="hidden md:block">
        <EntryField
          value={entry.lx}
          field="lx"
          canEdit={$canEdit}
          display={$_('entry.lx', { default: 'Lexeme/Word/Phrase' })}
          on:valueupdate={(e) => saveUpdateToFirestore(e, entry.id, $dictionary.id)} />
      </div>

      {#if $dictionary.alternateOrthographies}
        {#each $dictionary.alternateOrthographies as orthography, index}
          <EntryField
            value={entry[index === 0 ? 'lo' : `lo${index + 1}`]}
            field={index === 0 ? 'lo' : `lo${index + 1}`}
            canEdit={$canEdit}
            display={orthography}
            on:valueupdate={(e) => saveUpdateToFirestore(e, entry.id, $dictionary.id)} />
        {/each}
      {/if}

      {#each ['ph'] as field}
        <EntryField
          value={entry[field]}
          {field}
          canEdit={$canEdit}
          display={$_(`entry.${field}`)}
          on:valueupdate={(e) => saveUpdateToFirestore(e, entry.id, $dictionary.id)} />
      {/each}

      {#each showEntryGlossLanguages(entry.gl, $dictionary.glossLanguages) as bcp}
        <EntryField
          value={entry.gl[bcp]}
          field={`gl.${bcp}`}
          canEdit={$canEdit}
          display={`${$_(`gl.${bcp}`)} ${$_('entry.gloss', {
            default: 'Gloss',
          })}`}
          on:valueupdate={(e) => saveUpdateToFirestore(e, entry.id, $dictionary.id)} />
      {/each}

      {#if entry.de}
        <!-- Only in Bahasa Lani (id: jaRhn6MAZim4Blvr1iEv) -->
        <EntryField
          value={entry.de}
          field="de"
          canEdit={$canEdit}
          display="Definition (deprecated)"
          on:valueupdate={(e) => saveUpdateToFirestore(e, entry.id, $dictionary.id)} />
      {/if}

      <EntryPartOfSpeech
        value={entry.ps}
        canEdit={$canEdit}
        display={$_('entry.ps', { default: 'Part of Speech' })}
        on:valueupdate={(e) => saveUpdateToFirestore(e, entry.id, $dictionary.id)} />

      <EntrySemanticDomains
        canEdit={$canEdit}
        {entry}
        on:valueupdate={(e) => saveUpdateToFirestore(e, entry.id, $dictionary.id)} />

      {#each ['mr', 'in', 'di', 'nt'] as field}
        <EntryField
          value={entry[field]}
          {field}
          canEdit={$canEdit}
          display={$_(`entry.${field}`)}
          on:valueupdate={(e) => saveUpdateToFirestore(e, entry.id, $dictionary.id)} />
      {/each}

      {#if (entry.sr && entry.sr.length) || canEdit}
        <div class="md:px-2" class:order-2={!(entry.sr && entry.sr.length)}>
          <div class="rounded text-xs text-gray-500 mt-1 mb-2">{$_('entry.sr')}</div>
          <BadgeArray
            strings={entry.sr || []}
            canEdit={$canEdit}
            promptMessage={$_('entry.sr')}
            addMessage={$_('misc.add', { default: 'Add' })}
            on:valueupdated={(e) =>
              saveUpdateToFirestore(
                { detail: { field: 'sr', newValue: e.detail } },
                entry.id,
                $dictionary.id
              )} />
          <div class="border-dashed border-b-2  pb-1 mb-2" />
        </div>
      {/if}

      {#if entry.xv}
        <!-- used for old dictionary imports, needs refactored into entry.xs -->
        <EntryField
          value={entry.xv}
          field="xv"
          canEdit={$canEdit}
          display={$_('entry.example_sentence', { default: 'Example Sentence' })}
          on:valueupdate={(e) => saveUpdateToFirestore(e, entry.id, $dictionary.id)} />
      {/if}

      <EntryField
        value={entry.xs && entry.xs.vn}
        field="xs.vn"
        canEdit={$canEdit}
        display={$_('entry.example_sentence', { default: 'Example Sentence' })}
        on:valueupdate={(e) => saveUpdateToFirestore(e, entry.id, $dictionary.id)} />

      {#each showEntryGlossLanguages(entry.gl, $dictionary.glossLanguages) as bcp}
        <EntryField
          value={entry.xs && entry.xs[bcp]}
          field={`xs.${bcp}`}
          canEdit={$canEdit}
          display={`${$_(`gl.${bcp}`)} ${$_('entry.example_sentence', {
            default: 'Example Sentence',
          })}`}
          on:valueupdate={(e) => saveUpdateToFirestore(e, entry.id, $dictionary.id)} />
      {/each}

      <!-- <div class="order-1 mb-4" /> -->

      {#if $admin > 1}
        {#await import('$svelteui/data/JSON.svelte') then { default: JSON }}
          <div class="order-last">
            <JSON obj={entry} />
          </div>
        {/await}
      {/if}
    </div>
  </div>

  <EntryMeta {entry} dictionary={$dictionary} />
</Doc>
