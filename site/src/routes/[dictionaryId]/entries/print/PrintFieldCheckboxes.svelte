<script lang="ts">
  import { StandardPrintFields } from '$lib/types'
  import type { EntryData, IPrintFields } from '$lib/types'

  import type { PersistedState } from '$lib/state/persisted-state.svelte'
  import { page } from '$app/state'

  interface Props {
    entries: EntryData[]
    preferredPrintFields: PersistedState<IPrintFields>
    showLabels: PersistedState<boolean>
    showQrCode: PersistedState<boolean>
  }

  const {
    entries,
    preferredPrintFields,
    showLabels,
    showQrCode,
  }: Props = $props()

  const fieldsThatExist = $derived((Object.keys(preferredPrintFields.value) as (keyof IPrintFields)[]).filter((field) => {
    if (field === 'gloss') return true
    return entries.find((entry) => {
      if (field === 'definition') return !!entry.senses?.find(sense => Object.values(sense.definition || {}).some(Boolean))
      if (field === 'parts_of_speech') return !!entry.senses?.find(sense => sense.parts_of_speech?.length)
      if (field === 'local_orthography')
        return Object.keys(entry.main.lexeme).length > 1
      if (field === 'example_sentence') return !!entry.senses?.find(sense => sense.sentences?.length)
      if (field === 'semantic_domains') return !!entry.senses?.find(sense => sense.semantic_domains?.length || sense.write_in_semantic_domains?.length)
      if (field === 'noun_class') return !!entry.senses?.find(sense => sense.noun_class)
      if (field === 'photo') return !!entry.senses?.find(sense => sense.photos?.length)
      if (field === 'speaker') return !!entry.audios?.find(audio => audio.speakers?.length)
      if (field === 'plural_form') return !!entry.senses?.find(sense => sense.plural_form?.default)
      if (field === 'variant') return !!entry.senses?.find(sense => sense.variant?.default)
      if (field === 'dialects') return !!entry.dialects?.length
      if (field === 'custom_tags') return !!entry.tags?.length
      return entry.main[field]
    })
  }))
  const activeFields = $derived(Object.keys(preferredPrintFields.value).filter(
    field => preferredPrintFields.value[field],
  ))
  const showingFieldsWithLabels = $derived(activeFields.find(field =>
    Object.keys(StandardPrintFields).includes(field),
  ))
</script>

{#each fieldsThatExist as field (field)}
  <div class="checkbox-row">
    <input id={field} type="checkbox" bind:checked={preferredPrintFields.value[field]} />
    <label for={field}>{page.data.t(`entry_field.${field}`)}</label>
  </div>
{/each}

{#if showingFieldsWithLabels}
  <div class="checkbox-row">
    <input id="showLabels" type="checkbox" bind:checked={showLabels.value} />
    <label for="showLabels">{page.data.t('print.labels')}</label>
  </div>
{/if}

<div class="checkbox-row">
  <input id="showLabels" type="checkbox" bind:checked={showQrCode.value} />
  <label for="showLabels">{page.data.t('print.qr_code')}</label>
</div>

<style>
  .checkbox-row {
    display: flex;
    align-items: center;
    margin-right: 0.75rem;
    margin-bottom: 0.25rem;
  }

  label {
    margin-left: 0.25rem;
    font-size: 0.875rem;
    line-height: 1.25rem;
    color: color-mix(in srgb, var(--color) 85%, var(--background)); /* ≈ gray-700 */
  }
</style>
