<script lang="ts">
  import entryFields from './entryFields.json';
  import { semanticDomains, partsOfSpeech } from '@living-dictionaries/parts';
  import type { IEntry } from '@living-dictionaries/types';

  let fields = {
    id: false,
    lx: true,
    lo: true,
    lo2: true,
    lo3: true,
    lo4: true,
    lo5: true,
    ph: true,
    gl: true,
    in: true,
    mr: true,
    ps: true,
    sd: true,
    nc: false,
    pl: false,
    va: false,
    di: true,
    nt: true,
    sr: true,
    xv: true,
    xs: true,
    sf: true,
    pf: true,
    vfs: false,
  }

  let selectAll = true;
  let mirror = false;

  function toggleAll() {
    Object.keys(fields).forEach(field => {
      fields[field] = selectAll;
    });
  }

  function mirrorToggle() {
    Object.keys(fields).forEach(field => {
      fields[field] = !fields[field];
    });
  }

  export let entries: IEntry[];

  $: console.log("Fields:", fields)
</script>

<!-- prettier-ignore -->
# Birhor

### Select entry fields to export
<div class="mb-3">
  <input id="select-all" type="checkbox" bind:checked={selectAll} on:change={toggleAll} />
  <label for="select-all" class="text-sm font-medium text-gray-700 mr-4">Select/Deselect All</label>
  <input id="mirror-toggle" type="checkbox" bind:checked={mirror} on:change={mirrorToggle} />
  <label for="mirror-toggle" class="text-sm font-medium text-gray-700">Mirror Toggling</label>
</div>
{#each Object.keys(entryFields) as field}
  <input id={field} type="checkbox" bind:checked={fields[field]} />
  <label for={field} class="text-sm font-medium text-gray-700 mr-4">{entryFields[field]}</label>
{/each}

{#each entries as entry}
  {#if fields['lx']}
    ## {entry.lx}
  {/if}

  {#if entry.pf && fields['pf']}
    <div class="flex justify-between">
      <img src={entry.pf.path} alt={entry.pf.gcs} width=350 height=350 />
      {#if entry.pf.source}

        **Image Source:** {entry.pf.source}
        
      {/if}
    </div>
  {/if}

  {#if entry.gl && fields['gl']}
    {#each Object.entries(entry.gl) as gloss}

      _**{gloss[0]}:** {gloss[1]}_

    {/each}
  {/if}

  {#each Object.entries(entry) as field}
    {#if typeof(field[1]) !== 'object'}
      {#if field[1] && field[0] !== "lx" && field[0] !== "ps" && fields[field[0]]}

        **{entryFields[field[0]]}:** {field[1]}

      {/if}
    {/if}
  {/each}

  {#if entry.ps && fields['ps']}

    **Part of Speech:** {partsOfSpeech.find(pos => pos.enAbbrev === entry.ps).enName}

  {/if}

  {#if entry.sdn && fields['sd']}
    <div>
      <strong>Semantic domains:</strong>

      {#each entry.sdn as semanticDomain, index}

        <span>{semanticDomains.find((sd) => sd.key === semanticDomain).name}{entry.sdn.length-1 === index  ? '' : ', '}</span>

      {/each}
    </div>
  {/if}

  {#if entry.sf && fields['sf']}
    {#if entry.sf.source}

    **Audio Source:** {entry.sf.source}

    {/if}
    {#if entry.sf.speakerName}

    **Audio Speakername:** {entry.sf.speakerName}

    {/if}

    **Audio Path:** {entry.sf.path}

  {/if}

{/each}
