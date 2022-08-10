<script lang="ts">
  import type { IEntry } from "@living-dictionaries/types";
import { setRTLTextPlugin } from "mapbox-gl";

  export let entries: IEntry[];
  //TODO import dictionary data
</script>

<div class="test">
  {#each entries as entry}
    <div>
      <strong>{entry.lx}</strong>
      {entry.ph ? `/${entry.ph}/` : ''}
      {#each Object.entries(entry.gl) as gloss, index}
        <strong>{index < Object.entries(entry.gl).length-1 ? `${gloss[1]} - ` : gloss[1]}</strong>
      {/each}
      <strong><i>{entry.ps ? entry.ps : ''}</i></strong>
      {entry.xv ? entry.xv : ''}
      {#if entry.xs}      
        {#each Object.entries(entry.xs) as sentence, index}
          {index < Object.entries(entry.xs).length-1 ? `${sentence[1]}, ` : `${sentence[1]};`}
        {/each}
      {/if}
      {#if entry.pf}
        <img width="280" src={entry.pf.path} alt={entry.lx} />
        <i>{entry.pf.path};</i>
        <i>{entry.pf.source ? `${entry.pf.source};` : ''}</i>
      {/if}
      {#if entry.sr}
        {#each entry.sr as source, index}
          <i>{index < entry.sr.length-1 ? `${source}, ` : `${source};`}</i>
        {/each}
      {/if}
    </div>
  {/each}
</div>

<style>
  .test {
    display: flex;
    flex-wrap: wrap;
  }
  .test div {
    flex: 1 1 200px;
  }
</style>