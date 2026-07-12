<script lang="ts">
  import type { i18nEntryFieldKey, IColumn } from '$lib/types'
  import { page } from '$app/state'
  import IconMaterialSymbolsHearing from '~icons/material-symbols/hearing'
  import IconIcOutlineImage from '~icons/ic/outline-image'

  interface Props {
    column: IColumn
    verbose?: boolean
  }

  const { column, verbose = false }: Props = $props()

  const i18nKey = $derived(`entry_field.${column.field}` as i18nEntryFieldKey)
</script>

<span class:icon-row={!verbose}>
  {#if column.field === 'audio'}
    <IconMaterialSymbolsHearing style="font-size: 1.125rem; margin-left: auto; margin-right: auto" />
    {#if verbose}{page.data.t('entry_field.audio')}{/if}
  {:else if column.field === 'photo'}
    <IconIcOutlineImage style="font-size: 1.25rem; margin-left: auto; margin-right: auto" />
    {#if verbose}{page.data.t('entry.image')}{/if}
    <!-- {:else if column.field === 'checked'} ✓ -->
  {:else if ['gloss', 'example_sentence', 'local_orthography'].includes(column.field)}
    <span style="text-transform: capitalize" title={column.explanation}> {column.display || page.data.t(i18nKey)} </span>
  {:else}
    {page.data.t(i18nKey)}
  {/if}
</span>

<style>
  .icon-row {
    display: flex;
  }
</style>
