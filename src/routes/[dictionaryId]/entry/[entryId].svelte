<script context="module" lang="ts">
  import type { IEntry } from '$lib/interfaces';
  import { fetchDoc } from '$sveltefire/REST';

  import type { Load } from '@sveltejs/kit';
  export const load: Load = async ({ page: { params } }) => {
    try {
      const entry = await fetchDoc<IEntry>(
        `dictionaries/${params.dictionaryId}/words/${params.entryId}`
      );
      if (entry) {
        return {
          props: {
            entry,
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
  import { update } from '$sveltefire/firestore';
  import { serverTimestamp } from 'firebase/firestore';
  import { _ } from 'svelte-i18n';
  export let entry: IEntry, dictionaryId: string;

  import {
    dictionary,
    algoliaQueryParams,
    isManager,
    isContributor,
    canEdit,
    admin,
  } from '$lib/stores';
  import Audio from '../entries/_Audio.svelte';
  import AddImage from '../entries/_AddImage.svelte';
  import EntryField from './_EntryField.svelte';
  import EntryPartOfSpeech from './_EntryPartOfSpeech.svelte';
  import EntrySemanticDomains from './_EntrySemanticDomains.svelte';
  import Image from '$lib/components/image/Image.svelte';
  import { share } from '$lib/helpers/share';
  import BadgeArray from '$svelteui/data/BadgeArray.svelte';

  function printGlosses(obj) {
    Object.keys(obj).forEach((key) => !obj[key] && delete obj[key]);
    const keys = Object.keys(obj).sort();
    if (keys.length > 1) {
      return keys.map((bcp) => {
        if (obj[bcp]) {
          return `${$_('gl.' + bcp)}: ${obj[bcp]}`;
        }
      });
    } else {
      return [obj[keys[0]]];
    }
  }

  const title = `${entry.lx} (${$dictionary.name} Living Dictionary)`;
  const description = printGlosses(entry.gl).join(', ');
  const url = `https://livingdictionaries.app/${$dictionary.id}/entry/${entry.id}`;
  let shareImage = `https://i2.wp.com/livingtongues.org/wp-content/uploads/2015/03/LT-logo-1.png?w=987&ssl=1`;
  if (entry.pf) {
    shareImage = `https://lh3.googleusercontent.com/${entry.pf.gcs}=w1200`;
  }

  import { goto } from '$app/navigation';
  // not using i18n translation anymore: entry.signed_in_as_manager
  async function deleteEntry() {
    if (
      confirm(
        `${$_('entry.delete_entry', {
          default: 'Delete entry?',
        })} - note that it will still remain in the list view until you refresh the page`
      )
    ) {
      try {
        goto(`/${$dictionary.id}/entries/list${$algoliaQueryParams}`);
        await update<IEntry>(`dictionaries/${$dictionary.id}/words/${entry.id}`, {
          // @ts-ignore
          deletedAt: serverTimestamp(),
        });
      } catch (err) {
        alert(`${$_('misc.error', { default: 'Error' })}: ${err}`);
      }
    }
  }

  import Doc from '$sveltefire/components/Doc.svelte';
  import Button from '$svelteui/ui/Button.svelte';
  import { user } from '$sveltefire/user';
  async function saveUpdateToFirestore(e: {
    detail: { field: string; newValue: string | string[] };
  }) {
    try {
      await update(
        `dictionaries/${$dictionary.id}/words/${entry.id}`,
        {
          [e.detail.field]: e.detail.newValue,
        },
        true
      );
    } catch (err) {
      alert(`${$_('misc.error', { default: 'Error' })}: ${err}`);
    }
  }

  // new Set([...$dictionary.glossLanguages, ...Object.keys(entry.gl)]);
  let glossLanguages = new Set($dictionary.glossLanguages);
  for (const bcp of Object.keys(entry.gl)) {
    glossLanguages.add(bcp);
  }
</script>

<!-- TODO: wrap around component -->
<Doc
  path={`dictionaries/${dictionaryId}/words/${entry.id}`}
  startWith={entry}
  on:data={(e) => (entry = e.detail.data)} />

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
      <Button color="red" form="simple" onclick={deleteEntry}>
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
      {canEdit}
      display={$_('entry.lx', { default: 'Lexeme/Word/Phrase' })}
      on:valueupdate={saveUpdateToFirestore} />
  </div>

  <div class="md:w-1/3 flex flex-col md:flex-col-reverse justify-end mt-2">
    {#if entry.pf}
      <div class="w-full overflow-hidden rounded relative mb-2" style="height: 25vh;">
        <Image width={400} {entry} {canEdit} />
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
        {canEdit}
        display={$_('entry.lx', { default: 'Lexeme/Word/Phrase' })}
        on:valueupdate={saveUpdateToFirestore} />
    </div>

    {#if $dictionary.alternateOrthographies}
      {#each $dictionary.alternateOrthographies as orthography, index}
        <EntryField
          value={entry[index === 0 ? 'lo' : `lo${index + 1}`]}
          field={index === 0 ? 'lo' : `lo${index + 1}`}
          {canEdit}
          display={orthography}
          on:valueupdate={saveUpdateToFirestore} />
      {/each}
    {/if}

    {#each ['ph'] as field}
      <EntryField
        value={entry[field]}
        {field}
        {canEdit}
        display={$_(`entry.${field}`)}
        on:valueupdate={saveUpdateToFirestore} />
    {/each}

    {#each [...glossLanguages] as bcp}
      <EntryField
        value={entry.gl[bcp]}
        field={`gl.${bcp}`}
        {canEdit}
        display={`${$_(`gl.${bcp}`)} ${$_('entry.gloss', {
          default: 'Gloss',
        })}`}
        on:valueupdate={saveUpdateToFirestore} />
    {/each}

    {#if entry.de}
      <!-- Only in Bahasa Lani (id: jaRhn6MAZim4Blvr1iEv) -->
      <EntryField
        value={entry.de}
        field="de"
        {canEdit}
        display="Definition (deprecated)"
        on:valueupdate={saveUpdateToFirestore} />
    {/if}

    <EntryPartOfSpeech
      value={entry.ps}
      {canEdit}
      display={$_('entry.ps', { default: 'Part of Speech' })}
      on:valueupdate={saveUpdateToFirestore} />

    <EntrySemanticDomains {canEdit} {entry} on:valueupdate={saveUpdateToFirestore} />

    {#each ['mr', 'in', 'di', 'nt'] as field}
      <EntryField
        value={entry[field]}
        {field}
        {canEdit}
        display={$_(`entry.${field}`)}
        on:valueupdate={saveUpdateToFirestore} />
    {/each}

    {#if (entry.sr && entry.sr.length) || canEdit}
      <div class="md:px-2" class:order-2={!(entry.sr && entry.sr.length)}>
        <div class="rounded text-xs text-gray-500 mt-1 mb-2">{$_('entry.sr')}</div>
        <BadgeArray
          strings={entry.sr || []}
          {canEdit}
          promptMessage={$_('entry.sr')}
          addMessage={$_('misc.add', { default: 'Add' })}
          on:valueupdated={(e) =>
            saveUpdateToFirestore({ detail: { field: 'sr', newValue: e.detail } })} />
        <div class="border-dashed border-b-2  pb-1 mb-2" />
      </div>
    {/if}

    {#if entry.xv}
      <!-- used for old dictionary imports, needs refactored into entry.xs -->
      <EntryField
        value={entry.xv}
        field="xv"
        {canEdit}
        display={$_('entry.example_sentence', { default: 'Example Sentence' })}
        on:valueupdate={saveUpdateToFirestore} />
    {/if}

    <EntryField
      value={entry.xs && entry.xs.vn}
      field="xs.vn"
      {canEdit}
      display={$_('entry.example_sentence', { default: 'Example Sentence' })}
      on:valueupdate={saveUpdateToFirestore} />

    {#each [...glossLanguages] as bcp}
      <EntryField
        value={entry.xs && entry.xs[bcp]}
        field={`xs.${bcp}`}
        {canEdit}
        display={`${$_(`gl.${bcp}`)} ${$_('entry.example_sentence', {
          default: 'Example Sentence',
        })}`}
        on:valueupdate={saveUpdateToFirestore} />
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

<svelte:head>
  <title>{title}</title>
  <meta name="title" content={title} />
  <meta name="description" content={description} />

  <meta property="og:title" content={title} />
  <meta property="og:description" content={description} />
  <meta property="og:image" content={shareImage} />
  <meta property="og:url" content={url} />
  <meta property="og:site_name" content={$_('misc.LD', { default: 'Living Dictionaries' })} />

  <meta name="twitter:card" content="summary_large_image" />
  <meta property="twitter:url" content={url} />
  <meta property="twitter:title" content={title} />
  <meta property="twitter:description" content={description} />
  <meta property="twitter:image" content={shareImage} />
  <meta name="twitter:image:alt" content={title} />
</svelte:head>
