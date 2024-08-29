<script lang="ts">
  import { Button, JSON } from 'svelte-pieces'
  import EntryDisplay from './EntryDisplay.svelte'
  import { seo_description } from './seo_description'
  import { share } from '$lib/helpers/share'
  import SeoMetaTags from '$lib/components/SeoMetaTags.svelte'
  import { page } from '$app/stores'
  import type { SupaEntry } from '$lib/supabase/database.types'
  import { browser } from '$app/environment'

  export let data
  $: ({
    entry,
    supa_entry: supa_entry_promise,
    shallow,
    dictionary,
    admin,
    can_edit,
    is_contributor,
    is_manager,
    user,
    dbOperations,
  } = data)
  let supaEntry: SupaEntry

  $: if (browser) {
    supa_entry_promise?.then(({ data: _data }) => {
      supaEntry = _data
    }).catch((supa_err) => {
      console.info({ supa_err })
    })
  }
</script>

<div
  class:pt-1={!shallow}
  class:!-top-6={shallow}
  class="flex justify-between items-center mb-3 sticky  top-0 z-30 bg-white">
  <Button class="!px-2" color="black" form="simple" onclick={history.back}>
    <i class="fas fa-arrow-left rtl-x-flip" />
    {$page.data.t('misc.back')}
  </Button>

  <div>
    {#if $admin > 1}
      <JSON obj={$entry} />
    {/if}
    {#if $is_manager || ($is_contributor && $entry.cb === $user.uid)}
      <Button
        color="red"
        form="simple"
        onclick={() =>
          dbOperations.deleteEntry($entry.id, $dictionary.id)}>
        <span class="hidden md:inline">
          {$page.data.t('misc.delete')}
        </span>
        <i class="fas fa-trash ml-1" />
      </Button>
    {/if}
    {#if !shallow}
      <Button class="inline-flex! items-center" form="simple" onclick={() => share($dictionary.id, $entry)}>
        <span>{$page.data.t('misc.share')}</span>
        <div class="w-2"></div>
        <i class="fas fa-share-square rtl-x-flip" />
      </Button>
    {/if}
  </div>
</div>

<EntryDisplay
  entry={$entry}
  {supaEntry}
  dictionary={$dictionary}
  videoAccess={$dictionary?.videoAccess || $admin > 0}
  can_edit={$can_edit}
  {dbOperations} />

<SeoMetaTags
  imageTitle={$entry.lexeme}
  imageDescription={seo_description($entry, $dictionary.glossLanguages, $page.data.t)}
  dictionaryName={$dictionary.name}
  lat={$dictionary.coordinates?.latitude}
  lng={$dictionary.coordinates?.longitude}
  url="https://livingdictionaries.app/{$dictionary.id}/entry/{$entry.id}"
  gcsPath={$entry.senses?.[0]?.photo_files?.[0]?.specifiable_image_url}
  keywords="Minority Languages, Indigenous Languages, Language Documentation, Dictionary, Minority Community, Language Analysis, Language Education, Endangered Languages, Language Revitalization, Linguistics, Word Lists, Linguistic Analysis, Dictionaries, Living Dictionaries, Living Tongues, Under-represented Languages, Tech Resources, Language Sustainability, Language Resources, Diaspora Languages, Elicitation, Language Archives, Ancient Languages, World Languages, Obscure Languages, Little Known languages, Digital Dictionary, Dictionary Software, Free Software, Online Dictionary Builder" />
