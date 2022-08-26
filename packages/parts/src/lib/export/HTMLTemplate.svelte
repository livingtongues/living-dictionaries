<script lang="ts">
  import type { IEntry, ISpeaker, ISelectedFields, IEntryForPDF } from '@living-dictionaries/types';
  import { EntryPDFFieldsEnum } from '@living-dictionaries/types';
  import { semanticDomains } from '@living-dictionaries/parts';
  import QrCode from '$lib/QrCode.svelte';

  export let entry: IEntry;
  export let speakers: ISpeaker[];
  export let selectedFields: ISelectedFields;
  export let imageSize: number;

  let speaker:ISpeaker;
  function findSpeaker(speakerId: string) {
    speaker = speakers.find((speaker) => speaker.uid === speakerId)
  }
  $: entry?.sf?.sp ? findSpeaker(entry.sf.sp) : '';
</script>

<div style="max-width:450px;margin:auto;">
  <!--Essential Fields-->
  <div>
    <strong style="font-size: 1.4em;">{entry.lx}</strong>
    {#each ['lo', 'lo2', 'lo3', 'lo4', 'lo5'] as lo}
      {#if entry[lo] && selectedFields[lo]}
        <strong>{entry[lo]}</strong>{' '}
      {/if}
    {/each}
    {entry.ph && selectedFields.ph ? `/${entry.ph}/` : ''}
    {#if entry.gl && selectedFields.gl}
      {#each Object.entries(entry.gl) as gloss, index}
        {gloss[1]}{index < Object.entries(entry.gl).length-1 ? ' - ' : ''}
      {/each}
    {/if}
    <i>{entry.ps && selectedFields.ps ? entry.ps : ''}</i>
    <strong>{entry.xv && selectedFields.xv ? entry.xv : ''}</strong>
    {#if entry.xs && selectedFields.xs}      
      {#each Object.entries(entry.xs) as sentence, index}
      {sentence[1]}{index < Object.entries(entry.xs).length-1 ? ', ' : ''}
      {/each}
    {/if}
    {#if entry.pf && selectedFields.pf}
      <div style="font-size: 0.8em;">
        <img style={`width:${imageSize}%;margin-bottom:5px`} src={entry.pf.path} alt={entry.lx} />
        <QrCode pixelsPerModule={2} value={entry.pf.path} />
      </div>
    {/if}
    {#if entry.sr && selectedFields.sr}
      <i><i>Source(s): </i></i>
      {#each entry.sr as source, index}
        <i>{index < entry.sr.length-1 ? `${source}, ` : `${source}`}</i>
      {/each}
    {/if}
    {#if entry.sf && selectedFields.sf}
      <div>
        <i>Audio data:</i>
        <QrCode pixelsPerModule={2} value={entry.sf.path} />
        {#if entry.sf.sp}
          <p><i>Speaker:</i> {speaker?.displayName} ({speaker?.gender}) ({speaker?.decade*10}-{(speaker?.decade+0.9)*10} years old)</p>
        {:else if entry.sf.speakerName}
          <p><i>Speaker:</i> {entry.sf.speakerName}</p>
        {/if}
      </div>
    {/if}
  </div>
  <!-- The remaining fields -->
  <div>
    {#if entry.sdn && selectedFields.sd}
      <i>Semantic Domains: </i>
      {#each entry.sdn as key, index}
      {semanticDomains.find(sd => sd.key === key).name}{index < entry.sdn.length-1 ? ', ' : ''}
      {/each}
    {/if}
    {#each Object.keys(EntryPDFFieldsEnum) as key}
      {#if entry[key] && selectedFields[key]}
        <p><i>{EntryPDFFieldsEnum[key]}</i>: {entry[key]}</p>
      {/if}
    {/each}
  </div>
</div>
      