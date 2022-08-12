<script lang="ts">
  import type { IEntry, EntryForPDF } from "@living-dictionaries/types";


  export let entries: IEntry[];
  export let selectedFields;

  //TODO import dictionary data
</script>

<div class="container">
  {#each entries as entry}
    <div>
      <strong>{entry.lx}</strong>
      {entry.ph && selectedFields.ph ? `/${entry.ph}/` : ''}
      {#if entry.gl && selectedFields.gl}
        {#each Object.entries(entry.gl) as gloss, index}
          <strong>{index < Object.entries(entry.gl).length-1 ? `${gloss[1]} - ` : gloss[1]}</strong>
        {/each}
      {/if}
      <strong><i>{entry.ps && selectedFields.ps ? entry.ps : ''}</i></strong>
      {entry.xv && selectedFields.xv ? entry.xv : ''}
      {#if entry.xs && selectedFields.xs}      
        {#each Object.entries(entry.xs) as sentence, index}
          {index < Object.entries(entry.xs).length-1 ? `${sentence[1]}, ` : `${sentence[1]};`}
        {/each}
      {/if}
      {#if entry.pf && selectedFields.pf}
        <img width="280" src={entry.pf.path} alt={entry.lx} />
        <i>{entry.pf.path};</i>
        <i>{entry.pf.source ? `${entry.pf.source};` : ''}</i>
      {/if}
      {#if entry.sr && selectedFields.sr}
        {#each entry.sr as source, index}
          <i>{index < entry.sr.length-1 ? `${source}, ` : `${source};`}</i>
        {/each}
      {/if}
    </div>
  {/each}
</div>

<style>
  .container {
    column-count: 2;
    column-gap: 20px;
    word-break: break-all;
  }
</style>