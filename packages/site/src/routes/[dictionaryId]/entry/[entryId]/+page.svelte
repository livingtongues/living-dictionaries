<script lang="ts">
  import { t } from 'svelte-i18n';
  import { Doc } from 'sveltefirets';
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
  import SeoMetaTags from '$lib/components/SeoMetaTags.svelte';
  import { order_entry_and_dictionary_gloss_languages } from '$lib/helpers/glosses';
  import EntryDisplay from './EntryDisplay.svelte';
  import type { PageData } from './$types';
  import { seo_description } from './seo_description';
  import { convert_and_expand_entry } from '$lib/transformers/convert_and_expand_entry';

  export let data: PageData;
  $: entry = data.initialEntry;
</script>

{#if canEdit}
  <Doc
    path={`dictionaries/${$dictionary.id}/words/${data.initialEntry.id}`}
    startWith={data.initialEntry}
    on:data={(e) => {
      entry = convert_and_expand_entry(e.detail.data);
    }} />
{/if}

<div
  class="flex justify-between items-center mb-3 md:top-12 sticky top-0 z-30
bg-white pt-1 -mt-1">
  <Button
    class="-ml-2 !px-2"
    color="black"
    form="simple"
    href="/{$dictionary.id}/entries/list{$algoliaQueryParams}">
    <i class="fas fa-arrow-left rtl-x-flip" />
    {$t('misc.back', { default: 'Back' })}
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
          {$t('misc.delete', { default: 'Delete' })}
        </span>
        <i class="fas fa-trash ml-1" />
      </Button>
    {/if}
    <Button form="filled" onclick={() => share($dictionary.id, entry)}>
      <span>{$t('misc.share', { default: 'Share' })}</span>
      <i class="fas fa-share-square ml-1" />
    </Button>
  </div>
</div>

<EntryDisplay
  {entry}
  videoAccess={$dictionary.videoAccess || $admin > 0}
  canEdit={$canEdit}
  glossingLanguages={order_entry_and_dictionary_gloss_languages(
    entry.gl,
    $dictionary.glossLanguages
  )}
  alternateOrthographies={$dictionary.alternateOrthographies || []}
  on:valueupdate={(e) => saveUpdateToFirestore(e, entry.id, $dictionary.id)} />

<SeoMetaTags
  title={entry.lx}
  description={seo_description(entry, $dictionary.glossLanguages, $t)}
  dictionaryName={$dictionary.name}
  lat={$dictionary.coordinates?.latitude}
  lng={$dictionary.coordinates?.longitude}
  url="https://livingdictionaries.app/{$dictionary.id}/entry/{entry.id}"
  gcsPath={entry.pf?.gcs?.replace('\n', '')}
  keywords="Minority Languages, Indigenous Languages, Language Documentation, Dictionary, Minority Community, Language Analysis, Language Education, Endangered Languages, Language Revitalization, Linguistics, Word Lists, Linguistic Analysis, Dictionaries, Living Dictionaries, Living Tongues, Under-represented Languages, Tech Resources, Language Sustainability, Language Resources, Diaspora Languages, Elicitation, Language Archives, Ancient Languages, World Languages, Obscure Languages, Little Known languages, Digital Dictionary, Dictionary Software, Free Software, Online Dictionary Builder" />
