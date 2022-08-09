<script lang="ts">
  import type { IEntry } from "@living-dictionaries/types";

  export let entries: IEntry[];
  //TODO import dictionary data
</script>

<div class="grid grid-cols-2 gap-4">
  {#each entries as entry}
    <div>
      <strong>{entry.lx}</strong>
      {entry.ph ? `/${entry.ph}/` : ''}
      {#each Object.entries(entry.gl) as gloss, index}
        {index < Object.entries(entry.gl).length ? `${gloss[1]} ` : gloss[1]}
      {/each}
      {entry.xv ? entry.xv : ''}
      {#if entry.xs}      
        {#each Object.entries(entry.xs) as sentence, index}
          {index < Object.entries(entry.xs).length ? `${sentence[1]} ` : sentence[1]}
        {/each}
      {/if}
      {#if entry.pf}
        <img width="280" src={entry.pf.path} alt={entry.lx} />
        More image info
      {/if}
    </div>
  {/each}
</div>