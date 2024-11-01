<script lang="ts">
  import { Button, ShowHide } from 'svelte-pieces'
  import DownloadMedia from './DownloadMedia.svelte'
  import { type EntryForCSV, formatCsvEntries, getCsvHeaders } from './prepareEntriesForCsv'
  import SeoMetaTags from '$lib/components/SeoMetaTags.svelte'
  import Progress from '$lib/export/Progress.svelte'
  import { page } from '$app/stores'
  import { downloadObjectsAsCSV } from '$lib/export/csv'
  import { translate_part_of_speech, translate_part_of_speech_abbreviation, translate_semantic_domain_keys } from '$lib/transformers/translate_keys_to_current_language'

  export let data
  $: ({ is_manager, dictionary, admin, entries, speakers, dialects, photos, sentences, url_from_storage_path } = data)
  $: ({ loading: entries_loading } = entries)
  $: ({ loading: speakers_loading } = speakers)
  $: ({ loading: dialects_loading } = dialects)
  $: ({ loading: photos_loading } = photos)
  $: ({ loading: sentences_loading } = sentences)

  let includeImages = false
  let includeAudio = false

  let entryHeaders: EntryForCSV = {}
  let formattedEntries: EntryForCSV[] = []
  const entriesWithImages: EntryForCSV[] = []
  const entriesWithAudio: EntryForCSV[] = []

  let ready = false

  $: if (!$entries_loading && !$speakers_loading && !$dialects_loading && !$photos_loading && !$sentences_loading) {
    const translated_entries = $entries.map((entry) => {
      const senses = entry.senses.map(sense => ({
        ...sense,
        parts_of_speech: sense.parts_of_speech?.map(pos => translate_part_of_speech(pos, $page.data.t)),
        parts_of_speech_abbreviations: sense.parts_of_speech?.map(pos => translate_part_of_speech_abbreviation(pos, $page.data.t)), // TODO: this is not part of the EntryView type but we need it for the CSV export
        semantic_domains: sense.semantic_domains?.map(domain => translate_semantic_domain_keys(domain, $page.data.t)),
        photo_urls: sense.photo_ids?.map((photo_id) => {
          const { storage_path } = $photos.find(photo => photo.id === photo_id)
          return url_from_storage_path(storage_path)
        }),
        sentences: sense.sentence_ids?.map(sentence_id => $sentences.find(sentence => sentence.id === sentence_id)),
      }))

      return {
        ...entry,
        dialects: entry.dialect_ids?.map(dialect_id => $dialects.find(dialect => dialect.id === dialect_id).name.default),
        senses,
      }
    })
    entryHeaders = getCsvHeaders(translated_entries, $dictionary)
    formattedEntries = formatCsvEntries(translated_entries, $speakers, url_from_storage_path)
    console.info({ translated_entries, entryHeaders })
    // entriesWithImages = formattedEntries.filter(entry => entry.image_filename) // TODO: bring these back in - but you can do this in whatever manner you decide best
    // entriesWithAudio = formattedEntries.filter(entry => entry.sound_filename) // TODO: same

    ready = true
  }
</script>

<h3 class="text-xl font-semibold mb-4">{$page.data.t('misc.export')}</h3>
<pre>{JSON.stringify(formattedEntries, null, 2)}</pre>

{#if $is_manager}
  <div class="mb-6">
    <div>
      <i class="far fa-check" />
      {$page.data.t('export.csv_data')})
    </div>
    <div
      class="flex items-center mt-2 {entriesWithImages.length
        ? ''
        : 'opacity-50 cursor-not-allowed'}">
      <input
        disabled={!entriesWithImages.length}
        id="images"
        type="checkbox"
        bind:checked={includeImages} />
      <label for="images" class="mx-2 block leading-5 text-gray-900">
        {$page.data.t('misc.images')} ({entriesWithImages.length})</label>
    </div>
    {#if !ready}
      <p class="text-xs italic text-orange-400 p-2">
        {$page.data.t('export.checking_images')}
      </p>
    {:else if !entriesWithImages.length}
      <p class="text-sm text-red-700 p-3">
        {$page.data.t('export.no_images')}
      </p>
    {/if}

    <div
      class="flex items-center mt-2 {entriesWithAudio.length
        ? ''
        : 'opacity-50 cursor-not-allowed'}">
      <input id="audio" type="checkbox" bind:checked={includeAudio} />
      <label for="audio" class="mx-2 block leading-5 text-gray-900">
        {$page.data.t('entry_field.audio')} ({entriesWithAudio.length})</label>
    </div>
    {#if !ready}
      <p class="text-xs italic text-orange-400 p-2">
        {$page.data.t('export.checking_audios')}
      </p>
    {:else if !entriesWithAudio.length}
      <p class="text-sm text-red-700 p-3">
        {$page.data.t('export.no_audios')}
      </p>
    {/if}
  </div>

  {#if includeImages || includeAudio}
    <ShowHide let:show let:toggle>
      {#if !show}
        <Button onclick={toggle} form="filled">
          {$page.data.t('export.download_csv')}
          {#if includeImages}
            + {$page.data.t('misc.images')}
          {/if}
          {#if includeAudio}
            + {$page.data.t('entry_field.audio')}
          {/if}
        </Button>
      {:else}
        <DownloadMedia
          dictionary={$dictionary}
          {entryHeaders}
          finalizedEntries={formattedEntries}
          entriesWithImages={includeImages ? entriesWithImages : []}
          entriesWithAudio={includeAudio ? entriesWithAudio : []}
          on:completed={toggle}
          let:progress>
          <Progress {progress} />
          {#if progress < 1}
            <Button onclick={toggle} color="red">{$page.data.t('misc.cancel')}</Button>
          {:else}
            <Button onclick={toggle}>{$page.data.t('misc.reset')}</Button>
          {/if}
        </DownloadMedia>
      {/if}
    </ShowHide>
  {:else}
    <Button
      loading={!formattedEntries.length}
      onclick={() => {
        downloadObjectsAsCSV(entryHeaders, formattedEntries, $dictionary.id)
      }}
      form="filled">
      {$page.data.t('export.download_csv')}
    </Button>
  {/if}
{:else}
  <p>{$page.data.t('export.availability')}</p>
{/if}

{#if $admin}
  <div class="mt-5">
    <Button form="filled" href="entries/print">{$page.data.t('export.download_pdf')}</Button>
  </div>
{/if}

<SeoMetaTags
  title={$page.data.t('misc.export')}
  dictionaryName={$dictionary.name}
  description="Dictionary managers can easily export their Living Dictionary\'s text data as a .CSV spreadsheet as well as export their images and audio files in convenient ZIP folders."
  keywords="How to print a dictionary, How to create lessons for endangered languages, Language Documentation, Language Revitalization, Build a Dictionary, Online Dictionary, Digital Dictionary, Dictionary Software, Free Software, Online Dictionary Builder, Living Dictionaries, Living Dictionary, Edit a dictionary, Search a dictionary, Browse a dictionary, Explore a Dictionary" />
