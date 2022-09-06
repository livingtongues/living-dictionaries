<script lang="ts">
  import type { IEntry, ISpeaker, ISelectedFields } from '@living-dictionaries/types';
  import Button from 'svelte-pieces/ui/Button.svelte';
  import HTMLTemplate from './HTMLTemplate.svelte';

  export let dictionaryId:string; 
  export let entries:IEntry[];
  export let selectedFields:ISelectedFields;
  export let speakers:ISpeaker[];
  export let imageSize = 100;

  export let fontSize:number = 1;
  let element: HTMLElement;
</script>

<div bind:this={element} style={`column-count: 2; column-gap: 50px; word-break: break-word; margin: 5rem; font-size:${fontSize}rem`}>
  {#each entries as entry}
      <div>
        <HTMLTemplate {selectedFields} {speakers} {entry} {imageSize} {dictionaryId} />
      </div>
  {/each}
</div>

<Button onclick={() => console.log(element.outerHTML)}>Test HTML</Button>