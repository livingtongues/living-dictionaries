<script lang="ts">
  import { type EntryView, type IPrintFields, StandardPrintFields } from '@living-dictionaries/types'
  import type { createPersistedStore } from 'svelte-pieces'
  import { page } from '$app/stores'

  export let entries: EntryView[]
  export let preferredPrintFields: ReturnType<typeof createPersistedStore<IPrintFields>>
  export let showLabels: ReturnType<typeof createPersistedStore<boolean>>
  export let showQrCode: ReturnType<typeof createPersistedStore<boolean>>

  $: fieldsThatExist = (Object.keys($preferredPrintFields) as (keyof IPrintFields)[]).filter((field) => {
    if (field === 'gloss') return true
    return entries.find((entry) => {
      if (field === 'parts_of_speech') return !!entry.senses?.find(sense => sense.parts_of_speech?.length)
      if (field === 'local_orthography')
        return Object.keys(entry.main.lexeme).length > 1
      if (field === 'example_sentence') return !!entry.senses?.find(sense => sense.sentence_ids?.length)
      if (field === 'semantic_domains') return !!entry.senses?.find(sense => sense.semantic_domains?.length || sense.write_in_semantic_domains?.length)
      if (field === 'noun_class') return !!entry.senses?.find(sense => sense.noun_class)
      if (field === 'photo') return !!entry.senses?.find(sense => sense.photo_ids?.length)
      if (field === 'speaker') return !!entry.audios?.find(audio => audio.speaker_ids?.length)
      if (field === 'plural_form') return !!entry.senses?.find(sense => sense.plural_form?.default)
      if (field === 'variant') return !!entry.senses?.find(sense => sense.variant?.default)
      if (field === 'dialects') return !!entry.dialect_ids?.length
      return entry.main[field]
    })
  })
  $: activeFields = Object.keys($preferredPrintFields).filter(
    field => $preferredPrintFields[field],
  )
  $: showingFieldsWithLabels = activeFields.find(field =>
    Object.keys(StandardPrintFields).includes(field),
  )
</script>

{#each fieldsThatExist as field}
  <div class="flex items-center mr-3 mb-1">
    <input id={field} type="checkbox" bind:checked={$preferredPrintFields[field]} />
    <label class="ml-1 text-sm text-gray-700" for={field}>{$page.data.t(`entry_field.${field}`)}</label>
  </div>
{/each}

{#if showingFieldsWithLabels}
  <div class="flex items-center mr-3 mb-1">
    <input id="showLabels" type="checkbox" bind:checked={$showLabels} />
    <label class="ml-1 text-sm text-gray-700" for="showLabels">{$page.data.t('print.labels')}</label>
  </div>
{/if}

<div class="flex items-center mr-3 mb-1">
  <input id="showLabels" type="checkbox" bind:checked={$showQrCode} />
  <label class="ml-1 text-sm text-gray-700" for="showLabels">{$page.data.t('print.qr_code')}</label>
</div>
