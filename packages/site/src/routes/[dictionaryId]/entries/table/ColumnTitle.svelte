<script lang="ts">
  import { page } from '$app/stores';
  import { EntryFields, type IColumn } from '@living-dictionaries/types';

  export let column: IColumn;
  export let verbose = false;
</script>

<span class:flex={!verbose}>
  {#if column.field === 'audio'}
    <span class="i-material-symbols-hearing text-lg mx-auto" />
    {#if verbose}{$page.data.t('entry.audio')}{/if}
  {:else if column.field === 'photo'}
    <span class="i-ic-outline-image text-xl mx-auto" />
    {#if verbose}{$page.data.t('entry.image')}{/if}
    <!-- {:else if column.field === 'checked'} ✓ -->
  {:else if ['gloss', 'example_sentence', 'local_orthography'].includes(column.field)}
    <span class="capitalize" title={column.explanation}> {column.display || $page.data.t({dynamicKey: `entry.${EntryFields[column.field]}`, fallback: column.field})} </span>
  {:else}
    {$page.data.t({dynamicKey: `entry.${EntryFields[column.field]}`, fallback: column.field})}
  {/if}
</span>
