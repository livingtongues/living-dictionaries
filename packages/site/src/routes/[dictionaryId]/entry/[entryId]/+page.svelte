<script lang="ts">
  import { t, locale } from 'svelte-i18n';
  import { Button, JSON } from 'svelte-pieces';
  import { share } from '$lib/helpers/share';
  import { deleteEntry, deleteImage, deleteVideo } from '$lib/helpers/delete';
  import { saveUpdateToFirestore } from '$lib/helpers/entry/update';
  import EntryDisplay from './EntryDisplay.svelte';
  import SeoMetaTags from '$lib/components/SeoMetaTags.svelte';
  import { seo_description } from './seo_description';
  import { convert_and_expand_entry } from '$lib/transformers/convert_and_expand_entry';
  import { navigating } from '$app/stores';
  import { onMount } from 'svelte';

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
  } = data);

  $: entry = $locale && convert_and_expand_entry($initialEntry); // adding locale triggers update of translated semantic domains and parts of speech
  let backUrl: string;
  onMount(() => {
    backUrl = $navigating?.from?.url.href
      ? `${$navigating.from.url.href}${$algoliaQueryParams}`
      : `/${$dictionary.id}/entries/list${$algoliaQueryParams}`;
  });
</script>

<div
  class="flex justify-between items-center mb-3 md:top-12 sticky top-0 z-30
    bg-white pt-1 -mt-1"
>
  <Button class="-ml-2 !px-2" color="black" form="simple" href={backUrl}>
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
        onclick={() =>
          deleteEntry($initialEntry, $dictionary.id, $algoliaQueryParams)}
      >
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
  on:deleteImage={() => deleteImage(entry, $dictionary.id)}
  on:deleteVideo={() => deleteVideo(entry, $dictionary.id)}
  on:valueupdate={({ detail: { field, newValue } }) =>
    saveUpdateToFirestore({
      field,
      value: newValue,
      entryId: entry.id,
      dictionaryId: $dictionary.id,
    })}
/>

<SeoMetaTags
  imageTitle={entry.lx}
  imageDescription={seo_description(entry, $dictionary.glossLanguages, $t)}
  dictionaryName={$dictionary.name}
  lat={$dictionary.coordinates?.latitude}
  lng={$dictionary.coordinates?.longitude}
  url="https://livingdictionaries.app/{$dictionary.id}/entry/{entry.id}"
  gcsPath={entry.senses?.[0]?.photo_files?.[0]?.specifiable_image_url}
  keywords="Minority Languages, Indigenous Languages, Language Documentation, Dictionary, Minority Community, Language Analysis, Language Education, Endangered Languages, Language Revitalization, Linguistics, Word Lists, Linguistic Analysis, Dictionaries, Living Dictionaries, Living Tongues, Under-represented Languages, Tech Resources, Language Sustainability, Language Resources, Diaspora Languages, Elicitation, Language Archives, Ancient Languages, World Languages, Obscure Languages, Little Known languages, Digital Dictionary, Dictionary Software, Free Software, Online Dictionary Builder"
/>
