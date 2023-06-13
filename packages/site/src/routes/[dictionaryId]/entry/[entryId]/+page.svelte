<script lang="ts">
  import { t } from 'svelte-i18n';
  import { Doc } from 'sveltefirets';
  import { Button, JSON } from 'svelte-pieces';
  import { share } from '$lib/helpers/share';
  import { deleteEntry, deleteImage, deleteVideo } from '$lib/helpers/delete';
  import { saveUpdateToFirestore } from '$lib/helpers/entry/update';
  import SeoMetaTags from '$lib/components/SeoMetaTags.svelte';
  import EntryDisplay from './EntryDisplay.svelte';
  import { seo_description } from './seo_description';
  import {
    admin,
    algoliaQueryParams,
    canEdit,
    dictionary,
    isContributor,
    isManager,
    user,
  } from '$lib/stores';
  import { convert_and_expand_entry } from '$lib/transformers/convert_and_expand_entry';
  import type { PageData } from './$types';
  export let data: PageData;
  $: entry = data.initialEntry;
</script>

{#if canEdit}
  <Doc
    path={`dictionaries/${$dictionary.id}/words/${data.initialEntry.id}`}
    startWith={data.initialEntry}
    on:data={({ detail: { data } }) => {
      entry = convert_and_expand_entry(data);
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
      <JSON obj={entry} />
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
  dictionary={$dictionary}
  videoAccess={$dictionary.videoAccess || $admin > 0}
  canEdit={$canEdit}
  on:deleteImage={() => deleteImage(entry)}
  on:deleteVideo={() => deleteVideo(entry)}
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
