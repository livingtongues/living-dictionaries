<script lang="ts">
  import type { IColumn } from '@living-dictionaries/types';
  export let column: IColumn,
    verbose = false;
  import { _ } from 'svelte-i18n';
</script>

<span class:flex={!verbose}>
  {#if column.field === 'soundFile'}
    <!-- <i class="far fa-volume-up fa-fw mx-auto" /> -->
    <i class="far fa-ear fa-fw mx-auto" />
    {#if verbose}{$_('entry.audio', { default: 'Audio' })}{/if}
  {:else if column.field === 'photoFile'}
    <i class="far fa-image fa-fw mx-auto" />
    {#if verbose}{$_('entry.image', { default: 'Image' })}{/if}
    <!-- // TODO: add videos to columns -->
    <!-- {:else if column.field === 'videoFile'}
    <i class="far fa-film-alt fa-fw mx-auto" />
    {#if verbose}video{/if} -->
  {:else if column.field === 'checked'}
    ✓
  {:else if column.gloss === true || column.exampleSentence === true || column.orthography === true}
    <span class="capitalize" title={column.explanation}> {column.display} </span>
  {:else}{$_('entry.' + column.field, { default: '~' })}{/if}
</span>
