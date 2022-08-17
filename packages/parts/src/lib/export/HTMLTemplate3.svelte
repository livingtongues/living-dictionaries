<script lang="ts">
  import type { IEntry, IEntryForPDF } from '@living-dictionaries/types';
  import { EntryPDFFieldsEnum } from '@living-dictionaries/types';
  import { semanticDomains } from '@living-dictionaries/parts';
  import Button from 'svelte-pieces/ui/Button.svelte';

  export let entries: IEntry[];
  export let selectedFields;
  let element: HTMLElement;
</script>

<div bind:this={element} style="column-count: 2; column-gap: 20px; word-break: break-word;">
  {#each entries as entry}
    <div>
      <!--Essential Fields-->
      <div>
        <!--It might be necessary to style elements inline to eventually use the html-pdf library-->
        <strong style="font-size: 1.4em;">{entry.lx}</strong>
        {entry.ph && selectedFields.ph ? `/${entry.ph}/` : ''}
        {#if entry.gl && selectedFields.gl}
          {#each Object.entries(entry.gl) as gloss, index}
            {gloss[1]}{index < Object.entries(entry.gl).length-1 ? ' - ' : ''}
          {/each}
        {/if}
        <i>{entry.ps && selectedFields.ps ? entry.ps : ''}</i>
        {entry.xv && selectedFields.xv ? entry.xv : ''}
        {#if entry.xs && selectedFields.xs}      
          {#each Object.entries(entry.xs) as sentence, index}
          {sentence[1]}{index < Object.entries(entry.xs).length-1 ? ', ' : ''}
          {/each}
        {/if}
        {#if entry.pf && selectedFields.pf}
          <div style="font-size: 0.8em;">
            <img width="280" style="width: -moz-available; width: -webkit-fill-available;" src={entry.pf.path} alt={entry.lx} />
            <p><i>{entry.pf.path}</i></p>
            <p><i>{entry.pf.source ? `${entry.pf.source}` : ''}</i></p>
          </div>
        {/if}
        {#if entry.sr && selectedFields.sr}
          <i><strong>Source(s): </strong></i>
          {#each entry.sr as source, index}
            <i>{index < entry.sr.length-1 ? `${source}, ` : `${source}`}</i>
          {/each}
        {/if}
      </div>
      <!-- The remaining fields -->
      <div>
        {#if entry.sdn && selectedFields.sd}
          <strong>Semantic Domains: </strong>
          {#each entry.sdn as key, index}
          {semanticDomains.find(sd => sd.key === key).name}{index < entry.sdn.length-1 ? ', ' : ''}
          {/each}
        {/if}
        {#each Object.keys(EntryPDFFieldsEnum) as key}
          {#if entry[key] && selectedFields[key]}
            <p><strong>{EntryPDFFieldsEnum[key]}</strong>: {entry[key]}</p>
          {/if}
        {/each}
      </div>
    </div>
  {/each}
</div>

<Button onclick={() => console.log(element.outerHTML)}>Test HTML</Button>