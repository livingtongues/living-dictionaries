<script lang="ts">
  import { type EntryView, type IDictionary, type IPrintFields, StandardPrintFields } from '@living-dictionaries/types'
  import sanitize from 'xss'
  import { tick } from 'svelte'
  import QrCode from './QrCode.svelte'
  import { defaultPrintFields } from './printFields'
  import { page } from '$app/stores'
  import { order_example_sentences, order_glosses } from '$lib/helpers/glosses'
  import { add_periods_and_comma_separate_parts_of_speech } from '$lib/helpers/entry/add_periods_and_comma_separate_parts_of_speech'
  import { get_local_orthographies } from '$lib/helpers/entry/get_local_orthagraphies'

  export let entry: EntryView
  export let selectedFields = defaultPrintFields
  export let imagePercent = 50
  export let fontSize = 12
  export let headwordSize = 12
  export let dictionary: IDictionary
  export let showLabels = false
  export let showQrCode = false

  $: selectedPrintFields = (Object.keys(StandardPrintFields) as (keyof IPrintFields)[]).filter(key => entry[key] && selectedFields[key])
</script>

<div style="font-size: {fontSize}pt;">
  <b style="font-size: {headwordSize}pt;">{entry.main.lexeme.default}</b>

  {#if selectedFields.local_orthography}
    {#each get_local_orthographies(entry) as orthography}
      <b>{orthography}, </b>
    {/each}
  {/if}

  {#if selectedFields.phonetic && entry.main.phonetic}
    [{entry.main.phonetic}]
  {/if}

  {#each entry.senses || [] as sense}
    {#if selectedFields.parts_of_speech && sense.parts_of_speech}<i>{add_periods_and_comma_separate_parts_of_speech(sense.parts_of_speech)}</i>{/if}

    {#if selectedFields.gloss && sense.glosses}
      <span>
        {@html sanitize(order_glosses({
          glosses: sense.glosses,
          dictionary_gloss_languages: dictionary.glossLanguages,
          t: $page.data.t,
        }).join(', '))}{selectedFields.example_sentence && sense.sentence_ids?.length > 0 ? ';' : ''}
      </span>
    {/if}

    {#if selectedFields.example_sentence}
      <i>{order_example_sentences({
        example_sentences: sense.sentence_ids?.[0],
        dictionary_gloss_languages: dictionary.glossLanguages,
      }).join(' / ')}</i>
    {/if}

    {#if selectedFields.semantic_domains}
      {@const semantic_domains = [...sense.translated_ld_semantic_domains || [], ...sense.write_in_semantic_domains || []]}
      {#if semantic_domains.length}
        <div>
          {#if showLabels}
            <span class="italic text-[80%]">
              {$page.data.t('entry_field.semantic_domains')}:
            </span>
          {/if}
          {semantic_domains.join(', ')}
        </div>
      {/if}
    {/if}

    {#if selectedFields.noun_class && sense.noun_class}
      <p>
        {#if showLabels}
          <span class="italic text-[80%]">{$page.data.t('entry_field.noun_class')}: </span>
        {/if}
        {sense.noun_class}
      </p>
    {/if}
  {/each}

  <div>
    {#each selectedPrintFields as key}
      <p>
        {#if showLabels}
          <span class="italic text-[80%]">{$page.data.t(`entry_field.${key}`)}:</span>
        {/if}
        {#if key === 'notes'}
          {@html sanitize(entry[key])}
        {:else if key === 'dialects'}
          {entry[key].join(', ')}
        {:else}
          {entry[key]}
        {/if}
      </p>
    {/each}
  </div>

  {#if selectedFields.sources && entry.main.sources}
    <div>
      {#if showLabels}
        <span class="italic text-[80%]">{$page.data.t('entry_field.sources')}: </span>
      {/if}
      {entry.main.sources.join(', ')}
    </div>
  {/if}

  <!-- TODO: get speaker names from speaker_ids -->
  <!-- {#if selectedFields.speaker && entry.audios?.[0]}
    <div>
      {#if showLabels}
        <span class="italic text-[80%]">{$page.data.t('entry_field.speaker')}: </span>
      {/if}
      speaker name here
    </div>
  {/if} -->
</div>

{#if selectedFields.photo && entry.senses?.[0]?.photo_ids?.[0]}
  <!-- max-height keeps tall images from spilling onto 2nd page when printing single column w/ images at 100% width; -->
  <img
    class="block mb-1 mt-1px"
    style="width:{imagePercent}%; max-height: 100vh;"
    src="https://lh3.googleusercontent.com/{entry.senses[0].photo_files[0].specifiable_image_url}"
    alt={entry.main.lexeme.default} />
{/if}

{#if showQrCode}
  {#await tick() then _}
    <QrCode
      pixelsPerModule={2}
      value={`livingdictionaries.app/${dictionary.id}/entry/${entry.id}`} />
  {/await}
{/if}
