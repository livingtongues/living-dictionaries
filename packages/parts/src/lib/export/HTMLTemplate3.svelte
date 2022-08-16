<script lang="ts">
  import type { IEntry, IEntryForPDF } from '@living-dictionaries/types';
  import { EntryPDFFieldsEnum } from '@living-dictionaries/types';
  import { semanticDomains } from '@living-dictionaries/parts';

  export let entries: IEntry[];
  export let selectedFields;
</script>

<div class="container">
  {#each entries as entry}
    <div>
      <!--Essential Fields-->
      <div>
        <!--It might be necessary to style elements inline to eventually use the html-pdf library-->
        <strong style="font-size: 1.3em;">{entry.lx}</strong>
        {entry.ph && selectedFields.ph ? `/${entry.ph}/` : ''}
        {#if entry.gl && selectedFields.gl}
          {#each Object.entries(entry.gl) as gloss, index}
            <strong>{gloss[1]}{index < Object.entries(entry.gl).length-1 ? ' - ' : ''}</strong>
          {/each}
        {/if}
        <strong><i>{entry.ps && selectedFields.ps ? entry.ps : ''}</i></strong>
        {entry.xv && selectedFields.xv ? entry.xv : ''}
        {#if entry.xs && selectedFields.xs}      
          {#each Object.entries(entry.xs) as sentence, index}
          {sentence[1]}{index < Object.entries(entry.xs).length-1 ? ', ' : ';'}
          {/each}
        {/if}
        {#if entry.pf && selectedFields.pf}
          <img width="280" src={entry.pf.path} alt={entry.lx} />
          <i>{entry.pf.path};</i>
          <i>{entry.pf.source ? `${entry.pf.source};` : ''}</i>
        {/if}
        {#if entry.sr && selectedFields.sr}
          <i><strong>Source(s): </strong></i>
          {#each entry.sr as source, index}
            <i>{index < entry.sr.length-1 ? `${source}, ` : `${source};`}</i>
          {/each}
        {/if}
      </div>
      <!-- The remaining fields -->
      <div>
        {#if entry.sdn && selectedFields.sd}
          <strong>Semantic Domains: </strong>
          {#each entry.sdn as key, index}
          {semanticDomains.find(sd => sd.key === key).name}{index < entry.sdn.length-1 ? ', ' : ';'}
          {/each}
        {/if}
        {#each Object.keys(EntryPDFFieldsEnum) as key}
          {#if entry[key] && selectedFields[key]}
            <span><strong>{EntryPDFFieldsEnum[key]}</strong>: {entry[key]}; </span>
          {/if}
        {/each}
      </div>
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