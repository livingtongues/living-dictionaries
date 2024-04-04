<script lang="ts">
  import type { IColumn, i18nEntryFieldKey } from '@living-dictionaries/types'
  import { page } from '$app/stores'

  export let column: IColumn
  export let verbose = false

  $: i18nKey = `entry_field.${column.field}` as i18nEntryFieldKey
</script>

<span class:flex={!verbose}>
  {#if column.field === 'audio'}
    <span class="i-material-symbols-hearing text-lg mx-auto" />
    {#if verbose}{$page.data.t('entry_field.audio')}{/if}
  {:else if column.field === 'photo'}
    <span class="i-ic-outline-image text-xl mx-auto" />
    {#if verbose}{$page.data.t('entry.image')}{/if}
    <!-- {:else if column.field === 'checked'} ✓ -->
  {:else if ['gloss', 'example_sentence', 'local_orthography'].includes(column.field)}
    <span class="capitalize" title={column.explanation}> {column.display || $page.data.t(i18nKey)} </span>
  {:else}
    {$page.data.t(i18nKey)}
  {/if}
</span>
