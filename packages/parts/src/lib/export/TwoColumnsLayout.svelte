<script lang="ts">
  import type { IEntry } from '@living-dictionaries/types';
  import Button from 'svelte-pieces/ui/Button.svelte';
  import HTMLTemplate4 from './HTMLTemplate4.svelte';

  export let entries: IEntry[];
  export let selectedFields;
  let element: HTMLElement;
</script>

<div bind:this={element} style="display: table; clear: both; word-break: break-word; margin: 5rem;">
  {#each entries as entry, index}
    {#if index % 2 === 0}
      <div style="float: left; width:50%;">
        <HTMLTemplate4 {selectedFields} {entry} />
      </div>
    {/if}
    {#if index % 2 === 1}
      <div style="float: right; width:50%;">
        <HTMLTemplate4 {selectedFields} {entry} />
      </div>
    {/if}
  {/each}
</div>

<Button onclick={() => console.log(element.outerHTML)}>Test HTML</Button>