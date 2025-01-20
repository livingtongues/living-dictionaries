<script lang="ts">
  import { Button, JSON } from 'svelte-pieces'
  import EntryDisplay from './EntryDisplay.svelte'
  import { seo_description } from './seo_description'
  import { share } from '$lib/helpers/share'
  import SeoMetaTags from '$lib/components/SeoMetaTags.svelte'
  import { page } from '$app/stores'
  import { dev } from '$app/environment'

  export let data
  $: ({
    entry,
    photos,
    dialects,
    shallow,
    dictionary,
    admin,
    can_edit,
    dbOperations,
  } = data)

  $: first_photo_id = entry?.senses?.[0].photo_ids?.[0]
  $: first_photo = (first_photo_id && $photos.length) ? $photos.find(photo => photo.id === first_photo_id) : null
</script>

<div
  class:pt-1={!shallow}
  class:!-top-6={shallow}
  class="flex justify-between items-center mb-3 sticky  top-0 z-30 bg-white">
  <Button
    class="!px-2"
    color="black"
    form="simple"
    onclick={() => {
      if (history.length > 1) {
        history.back()
      } else {
        window.location.href = `/${dictionary.id}/entries`
      }
    }}>
    <i class="fas fa-arrow-left rtl-x-flip" />
    {$page.data.t('misc.back')}
  </Button>

  <div>
    {#if dev || $admin > 1}
      <JSON obj={entry} />
    {/if}
    {#if $can_edit}
      <Button
        color="red"
        form="simple"
        onclick={async () => {
          await dbOperations.update_entry({ entry: { deleted: 'true' } })
          history.back()
        }}>

        <span class="hidden md:inline">
          {$page.data.t('misc.delete')}
        </span>
        <i class="fas fa-trash ml-1" />
      </Button>
    {/if}
    {#if !shallow}
      <Button class="inline-flex! items-center" form="simple" onclick={() => share(dictionary.id, entry)}>
        <span>{$page.data.t('misc.share')}</span>
        <div class="w-2"></div>
        <i class="fas fa-share-square rtl-x-flip" />
      </Button>
    {/if}
  </div>
</div>

<EntryDisplay
  {entry}
  {dictionary}
  can_edit={$can_edit}
  {dbOperations} />

<SeoMetaTags
  imageTitle={entry.main.lexeme.default}
  imageDescription={seo_description({ entry, dialects: $dialects, gloss_languages: dictionary.gloss_languages, t: $page.data.t })}
  dictionaryName={dictionary.name}
  lng={dictionary.coordinates?.points?.[0]?.coordinates.longitude}
  lat={dictionary.coordinates?.points?.[0]?.coordinates.latitude}
  url="https://livingdictionaries.app/{dictionary.id}/entry/{entry.id}"
  gcsPath={first_photo?.serving_url}
  keywords="Minority Languages, Indigenous Languages, Language Documentation, Dictionary, Minority Community, Language Analysis, Language Education, Endangered Languages, Language Revitalization, Linguistics, Word Lists, Linguistic Analysis, Dictionaries, Living Dictionaries, Living Tongues, Under-represented Languages, Tech Resources, Language Sustainability, Language Resources, Diaspora Languages, Elicitation, Language Archives, Ancient Languages, World Languages, Obscure Languages, Little Known languages, Digital Dictionary, Dictionary Software, Free Software, Online Dictionary Builder" />
