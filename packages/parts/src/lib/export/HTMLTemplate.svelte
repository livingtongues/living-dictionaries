<script lang="ts">
  import type { IEntry, ISpeaker, ISelectedFields } from '@living-dictionaries/types';
  import { EntryPDFFieldsEnum } from '@living-dictionaries/types';
  import { semanticDomains } from '../mappings/semantic-domains';
  import QrCode from '../QrCode.svelte';

  export let entry: IEntry;
  // export let speakers: ISpeaker[];
  export let selectedFields: ISelectedFields;
  export let imagePercent = 50;
  export let fontSize = 12;
  export let headwordSize = 12;
  export let dictionaryId: string;

  // $: speaker = entry.sf?.sp ? speakers.find((s) => s.uid === entry.sf.sp) : null;
</script>

<div style={`font-size: ${fontSize}pt;`}>
  <!--Essential Fields-->
  <div>
    <b style="font-size: {headwordSize}pt;">{entry.lx}</b>
    {#each ['lo', 'lo2', 'lo3', 'lo4', 'lo5'] as lo}
      {#if entry[lo] && selectedFields[lo]}
        <b>{entry[lo]}</b>{' '}
      {/if}
    {/each}
    {entry.ph && selectedFields.ph ? `/${entry.ph}/` : ''}
    <i>{entry.ps && selectedFields.ps ? entry.ps : ''}</i>
    {#if entry.gl && selectedFields.gl}
      {#each Object.entries(entry.gl) as gloss, index}
        {@html gloss[1]}{index < Object.entries(entry.gl).length - 1 ? ' - ' : ''}
      {/each}
    {/if}
    <b>{entry.xv && selectedFields.xv ? entry.xv : ''}</b>
    {#if entry.xs && selectedFields.xs}
      {#each Object.entries(entry.xs) as sentence, index}
        {sentence[1]}{index < Object.entries(entry.xs).length - 1 ? ', ' : ''}
      {/each}
    {/if}
    <!-- The remaining fields -->
    {#if entry.sr && selectedFields.sr}
      <div>
        {#if !selectedFields.hideLabels}
          <i>Source(s): </i>
        {/if}
        {#if typeof entry.sr === 'string'}
          <i>{entry.sr}</i>
        {:else}
          {#each entry.sr as source, index}
            <i>{index < entry.sr.length - 1 ? `${source}, ` : `${source}`}</i>
          {/each}
        {/if}
      </div>
    {/if}
    <div>
      {#if entry.sdn && selectedFields.sd}
        <span class="italic text-[80%]">Semantic Domains: </span>
        {#each entry.sdn as key, index}
          {semanticDomains.find((sd) => sd.key === key).name}{index < entry.sdn.length - 1
            ? ', '
            : ''}
        {/each}
      {/if}
      {#each Object.keys(EntryPDFFieldsEnum) as key}
        {#if entry[key] && selectedFields[key] && EntryPDFFieldsEnum[key]}
          <p>
            {#if !selectedFields.hideLabels}
              <i>{EntryPDFFieldsEnum[key]}</i>:{' '}
            {/if}
            {@html entry[key]}
          </p>
        {/if}
      {/each}
    </div>
    {#if entry.sf && selectedFields.sf}
      <div>
        {#if entry.sf.speakerName}
          <p><i>{!selectedFields.hideLabels ? 'Speaker:' : ''}</i> {entry.sf.speakerName}</p>
        {/if}
      </div>
    {/if}
  </div>
  {#if entry.pf && selectedFields.pf}
    <!-- max-height keeps tall images from spilling onto 2nd page when printing single column w/ images at 100% width; -->
    <img
      class="block mb-1 mt-1px"
      style="width:{imagePercent}%; max-height: 100vh;"
      src={`https://lh3.googleusercontent.com/${entry.pf.gcs}`}
      alt={entry.lx} />
  {/if}
  {#if selectedFields.qrCode}
    {#await new Promise((r) => setTimeout(() => r(true), 1)) then value}
      <QrCode
        pixelsPerModule={2}
        value={`livingdictionaries.app/${dictionaryId}/entry/${entry.id}`} />
    {/await}
  {/if}
</div>
