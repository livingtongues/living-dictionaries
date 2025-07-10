<script lang="ts">
  import type { EntryData, Tables } from '@living-dictionaries/types'
  import sanitize from 'xss'
  import { tick } from 'svelte'
  import QrCode from './QrCode.svelte'
  import { defaultPrintFields } from './printFields'
  import { page } from '$app/stores'
  import { order_example_sentences, order_glosses } from '$lib/helpers/glosses'
  import { add_periods_and_comma_separate_parts_of_speech } from '$lib/helpers/entry/add_periods_and_comma_separate_parts_of_speech'
  import { get_local_orthographies } from '$lib/helpers/entry/get_local_orthagraphies'

  export let entry: EntryData
  export let selectedFields = defaultPrintFields
  export let imagePercent = 50
  export let fontSize = 12
  export let headwordSize = 12
  export let dictionary: Tables<'dictionaries'>
  export let showLabels = false
  export let showQrCode = false

  $: first_photo = entry.senses?.[0]?.photos?.[0]
  $: first_audio = entry.audios?.[0]
</script>

<div style="font-size: {fontSize}pt;">
  <b style="font-size: {headwordSize}pt;">{entry.main.lexeme.default}</b>

  {#if selectedFields.local_orthography}
    <b>{get_local_orthographies(entry.main.lexeme).join(', ')}</b>
  {/if}

  {#if selectedFields.phonetic && entry.main.phonetic}
    [{entry.main.phonetic}]
  {/if}

  {#each entry.senses || [] as sense, index}
    <div />
    {#if entry.senses.length > 1}<span class="text-sm">{index + 1}.</span>{/if}
    {#if selectedFields.parts_of_speech && sense.parts_of_speech}<i>{add_periods_and_comma_separate_parts_of_speech(sense.parts_of_speech)}</i>{/if}
    {#if selectedFields.gloss && sense.glosses}
      <span>
        {@html sanitize(order_glosses({
          glosses: sense.glosses,
          dictionary_gloss_languages: dictionary.gloss_languages,
          t: $page.data.t,
        }).join(', '))}{selectedFields.example_sentence && sense.sentences?.length > 0 ? ';' : ''}
      </span>
    {/if}

    {#if selectedFields.semantic_domains}
      {@const semantic_domains = [...sense.semantic_domains || [], ...sense.write_in_semantic_domains || []]}
      {#if semantic_domains.length}
        <div>
          {#if showLabels}
            <span class="italic text-[80%]">
              {$page.data.t('entry_field.semantic_domains')}:
            </span>
          {/if}
          {semantic_domains.map(domain => $page.data.t({ dynamicKey: `sd.${domain}`, fallback: domain })).join(', ')}
        </div>
      {/if}
    {/if}

    {#if selectedFields.noun_class && sense.noun_class}
      <div>
        {#if showLabels}
          <span class="italic text-[80%]">{$page.data.t('entry_field.noun_class')}: </span>
        {/if}
        {sense.noun_class}
      </div>
    {/if}

    {#if selectedFields.plural_form && sense.plural_form}
      <div>
        {#if showLabels}
          <span class="italic text-[80%]">{$page.data.t('entry_field.plural_form')}: </span>
        {/if}
        {sense.plural_form?.default}
      </div>
    {/if}

    {#if selectedFields.variant && sense.variant}
      <div>
        {#if showLabels}
          <span class="italic text-[80%]">{$page.data.t('entry_field.variant')}: </span>
        {/if}
        {sense.variant?.default}
      </div>
    {/if}

    {#if selectedFields.example_sentence && entry.senses?.[0].sentences?.[0]}
      <i>{order_example_sentences({
        sentence: entry.senses[0].sentences[0],
        dictionary_gloss_languages: dictionary.gloss_languages,
      }).join(' / ')}</i>
    {/if}
  {/each}

  {#if selectedFields.custom_tags && entry.tags?.length}
    <div>
      {#if showLabels}
        <!-- TODO translate -->
        <span class="italic text-[80%]">Tags:</span>
      {/if}
      {entry.tags.map(tag => tag.name).join(', ')}
    </div>
  {/if}

  {#if selectedFields.notes && entry.main.notes}
    <div>
      {#if showLabels}
        <span class="italic text-[80%]">{$page.data.t('entry_field.notes')}: </span>
      {/if}
      {@html sanitize(entry.main.notes.default)}
    </div>
  {/if}

  {#if selectedFields.dialects && entry.dialects?.length}
    <div>
      {#if showLabels}
        <span class="italic text-[80%]">{$page.data.t(`entry_field.dialects`)}:</span>
      {/if}
      {entry.dialects.map(dialect => dialect.name.default).join(', ')}
    </div>
  {/if}

  {#if selectedFields.interlinearization && entry.main.interlinearization}
    <div>
      {#if showLabels}
        <span class="italic text-[80%]">{$page.data.t(`entry_field.interlinearization`)}:</span>
      {/if}
      {entry.main.interlinearization}
    </div>
  {/if}

  {#if selectedFields.morphology && entry.main.morphology}
    <div>
      {#if showLabels}
        <span class="italic text-[80%]">{$page.data.t(`entry_field.morphology`)}:</span>
      {/if}
      {entry.main.morphology}
    </div>
  {/if}

  {#if selectedFields.sources && entry.main.sources}
    <div>
      {#if showLabels}
        <span class="italic text-[80%]">{$page.data.t('entry_field.sources')}: </span>
      {/if}
      {entry.main.sources.join(', ')}
    </div>
  {/if}

  {#if selectedFields.speaker && first_audio?.speakers?.[0].name}
    <div>
      {#if showLabels}
        <span class="italic text-[80%]">{$page.data.t('entry_field.speaker')}: </span>
      {/if}
      {first_audio.speakers[0].name}
    </div>
  {/if}
</div>

{#if selectedFields.photo && first_photo}
  <!-- max-height keeps tall images from spilling onto 2nd page when printing single column w/ images at 100% width; -->
  <img
    class="block mb-1 mt-1px"
    style="width:{imagePercent}%; max-height: 100vh;"
    src="https://lh3.googleusercontent.com/{first_photo.serving_url}"
    alt={entry.main.lexeme.default} />
{/if}

{#if showQrCode}
  {#await tick() then _}
    <QrCode
      pixelsPerModule={2}
      value={`livingdictionaries.app/${dictionary.id}/entry/${entry.id}`} />
  {/await}
{/if}
