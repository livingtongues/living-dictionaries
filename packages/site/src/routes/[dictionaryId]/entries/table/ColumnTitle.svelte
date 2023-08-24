<script lang="ts">
  import { t } from 'svelte-i18n';
  import { EntryFields, type IColumn } from '@living-dictionaries/types';

  export let column: IColumn;
  export let verbose = false;
</script>

<span class:flex={!verbose}>
  {#if column.field === 'audio'}
    <span class="i-material-symbols-hearing text-lg mx-auto" />
    {#if verbose}{$t('entry.audio', { default: 'Audio' })}{/if}
  {:else if column.field === 'photo'}
    <span class="i-ic-outline-image text-xl mx-auto" />
    {#if verbose}{$t('entry.image', { default: 'Image' })}{/if}
    <!-- {:else if column.field === 'checked'} ✓ -->
  {:else if ['gloss', 'example_sentence', 'local_orthography'].includes(column.field)}
    <span class="capitalize" title={column.explanation}> {column.display || $t(`entry.${EntryFields[column.field]}`)} </span>
  {:else}
    {$t(`entry.${EntryFields[column.field]}`, { default: '~' })}
  {/if}
</span>
