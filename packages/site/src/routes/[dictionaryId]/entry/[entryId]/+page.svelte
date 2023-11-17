<script lang="ts">
  import { Button, JSON } from 'svelte-pieces';
  import { share } from '$lib/helpers/share';
  import { deleteEntry, deleteImage, deleteVideo } from '$lib/helpers/delete';
  import EntryDisplay from './EntryDisplay.svelte';
  import SeoMetaTags from '$lib/components/SeoMetaTags.svelte';
  import { seo_description } from './seo_description';
  import { convert_and_expand_entry } from '$lib/transformers/convert_and_expand_entry';
  import { goto } from '$app/navigation';
  import { lastEntriesUrl } from '$lib/stores/lastEntriesUrl';
  import { page } from '$app/stores';

  export let data;
  $: ({
    admin,
    algoliaQueryParams,
    canEdit,
    dictionary,
    isContributor,
    isManager,
    user,
    initialEntry,
    saveUpdateToFirestore,
    updateSense: insertSense,
  } = data);

  $: entry = convert_and_expand_entry($initialEntry, $page.data.t);

  // saved algoliaQueryParams will be overwritten by the gallery view as it turns on the images only facet
  function backToEntries() {
    if ($lastEntriesUrl)
      goto($lastEntriesUrl);
    else
      history.back()
  }
</script>

<div class="flex justify-between items-center mb-3 sticky top-0 z-30 bg-white pt-1">
  <Button class="!px-2" color="black" form="simple" onclick={() => insertSense({column: 'definition_english_deprecated', entry_id: entry.id, new_value: 'Hello!', old_value: null, sense_id: window.crypto.randomUUID()})}>
    Trigger Sense Change
  </Button>

  <Button class="!px-2" color="black" form="simple" onclick={backToEntries}>
    <i class="fas fa-arrow-left rtl-x-flip" />
    {$page.data.t('misc.back')}
  </Button>

  <div>
    {#if $admin > 1}
      <JSON obj={entry} />
    {/if}
    {#if $isManager || ($isContributor && entry.cb === $user.uid)}
      <Button
        color="red"
        form="simple"
        onclick={() =>
          deleteEntry($initialEntry, $dictionary.id, $algoliaQueryParams)}>
        <span class="hidden md:inline">
          {$page.data.t('misc.delete')}
        </span>
        <i class="fas fa-trash ml-1" />
      </Button>
    {/if}
    <Button class="inline-flex items-center" form="simple" onclick={() => share($dictionary.id, entry)}>
      <span>{$page.data.t('misc.share')}</span>
      <div class="w-2"></div>
      <i class="fas fa-share-square rtl-x-flip" />
    </Button>
  </div>
</div>

<EntryDisplay
  {entry}
  dictionary={$dictionary}
  videoAccess={$dictionary.videoAccess || $admin > 0}
  admin={$admin}
  canEdit={$canEdit}
  on:deleteImage={() => deleteImage(entry, $dictionary.id)}
  on:deleteVideo={() => deleteVideo(entry, $dictionary.id)}
  on:valueupdate={({ detail: { field, newValue } }) =>
    saveUpdateToFirestore({
      field,
      value: newValue,
      entryId: entry.id,
    })} />

<SeoMetaTags
  imageTitle={entry.lx}
  imageDescription={seo_description(entry, $dictionary.glossLanguages, $page.data.t)}
  dictionaryName={$dictionary.name}
  lat={$dictionary.coordinates?.latitude}
  lng={$dictionary.coordinates?.longitude}
  url="https://livingdictionaries.app/{$dictionary.id}/entry/{entry.id}"
  gcsPath={entry.senses?.[0]?.photo_files?.[0]?.specifiable_image_url}
  keywords="Minority Languages, Indigenous Languages, Language Documentation, Dictionary, Minority Community, Language Analysis, Language Education, Endangered Languages, Language Revitalization, Linguistics, Word Lists, Linguistic Analysis, Dictionaries, Living Dictionaries, Living Tongues, Under-represented Languages, Tech Resources, Language Sustainability, Language Resources, Diaspora Languages, Elicitation, Language Archives, Ancient Languages, World Languages, Obscure Languages, Little Known languages, Digital Dictionary, Dictionary Software, Free Software, Online Dictionary Builder" />
