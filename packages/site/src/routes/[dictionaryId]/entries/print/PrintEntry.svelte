<script lang="ts">
  import { t } from 'svelte-i18n';
  import { StandardPrintFields, type ExpandedEntry, type IDictionary } from '@living-dictionaries/types';
  import { order_glosses } from '$lib/helpers/glosses';
  import QrCode from './QrCode.svelte';
  import sanitize from 'xss';
  import { defaultPrintFields } from './printFields';
  import { add_periods_and_comma_separate_parts_of_speech } from '$lib/helpers/entry/add_periods_and_comma_separate_parts_of_speech';
  import { get_local_orthographies } from '$lib/helpers/entry/get_local_orthagraphies';
  import { spaceSeparateSentences } from './separateSentences';
  import { tick } from 'svelte';

  export let entry: ExpandedEntry;
  export let selectedFields = defaultPrintFields;
  export let imagePercent = 50;
  export let fontSize = 12;
  export let headwordSize = 12;
  export let dictionary: IDictionary;
  export let showLabels = false;
  export let showQrCode = false;
</script>

<div style="font-size: {fontSize}pt;">
  <b style="font-size: {headwordSize}pt;">{entry.lexeme}</b>

  {#if selectedFields.alternateOrthographies}
    <b>{get_local_orthographies(entry).sort().join(' ')}</b>
  {/if}

  {#if selectedFields.ph && entry.phonetic}
    [${entry.phonetic}]
  {/if}

  {#if selectedFields.ps && entry.senses?.[0].parts_of_speech_keys}<i>{add_periods_and_comma_separate_parts_of_speech(entry.senses?.[0].parts_of_speech_keys)}</i>{/if}

  {#if selectedFields.gloss && entry.senses?.[0].glosses}
    <span>
      {@html sanitize(order_glosses({
        glosses: entry.senses?.[0].glosses,
        dictionary_gloss_languages: dictionary.glossLanguages,
        $t,
      }).join(' - '))}
    </span>
  {/if}

  {#if selectedFields.example_sentence}
    {@const example_sentences = entry.senses?.[0].example_sentences}
    {spaceSeparateSentences(example_sentences)}
  {/if}

  {#if selectedFields.sr && entry.sources}
    <div>
      {#if showLabels}
        <span class="italic text-[80%]">{$t('entry.sr', { default: 'Source' })}: </span>
      {/if}
      {entry.sources.join(', ')}
    </div>
  {/if}

  <div>
    {#if selectedFields.sdn}
      {@const semantic_domains = [...entry.senses?.[0].translated_ld_semantic_domains || [], ...entry.senses?.[0].write_in_semantic_domains || []]}
      {#if semantic_domains.length}
        {#if showLabels}
          <span class="italic text-[80%]">
            {$t('entry.sdn', { default: 'Semantic Domains' })}:
          </span>
        {/if}
        {semantic_domains.join(', ')}
      {/if}
    {/if}

    <!-- TODO -->
    {#each Object.keys(StandardPrintFields) as key}
      {#if entry[key] && selectedFields[key]}
        <p>
          {#if showLabels}
            <span class="italic text-[80%]"
            >{$t(`entry.${key}`, { default: StandardPrintFields[key] })}:</span>
          {/if}
          {#if key === 'nt'}
            {@html sanitize(entry[key])}
          {:else}
            {entry[key]}
          {/if}
        </p>
      {/if}
    {/each}
  </div>

  <!-- TODO: get speaker names from speaker_ids -->
  {#if selectedFields.speaker && entry.sound_files?.[0].speakerName}
    <div>
      {#if showLabels}
        <span class="italic text-[80%]">{$t('entry.speaker', { default: 'Speaker' })}: </span>
      {/if}
      {entry.sound_files?.[0].speakerName}
    </div>
  {/if}
</div>

{#if selectedFields.image && entry.senses?.[0].photo_files?.[0]}
  <!-- max-height keeps tall images from spilling onto 2nd page when printing single column w/ images at 100% width; -->
  <img
    class="block mb-1 mt-1px"
    style="width:{imagePercent}%; max-height: 100vh;"
    src="https://lh3.googleusercontent.com/{entry.senses[0].photo_files[0].specifiable_image_url}"
    alt={entry.lexeme} />
{/if}

{#if showQrCode}
  {#await tick()}
    <QrCode
      pixelsPerModule={2}
      value={`livingdictionaries.app/${dictionary.id}/entry/${entry.id}`} />
  {/await}
{/if}
