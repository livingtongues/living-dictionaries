<script lang="ts">
  import type { IEntry, ISpeaker, ISelectedFields } from '@living-dictionaries/types';
  import { EntryPDFFieldsEnum } from '@living-dictionaries/types';
  //TODO how to use Image?
  //import { Image } from '../entries/media/Image.svelte';
  import { semanticDomains } from '../mappings/semantic-domains';
  import QrCode from '../QrCode.svelte';

  export let entry:IEntry;
  export let speakers:ISpeaker[];
  export let selectedFields:ISelectedFields;
  export let imageSize = 100;
  export let fontSize = 1;
  export let headwordSize = 4;
  export let dictionaryId:string;

  let speaker:ISpeaker;
  function findSpeaker(speakerId: string) {
    speaker = speakers.find((speaker) => speaker?.uid === speakerId)
  }
  $: entry?.sf?.sp ? findSpeaker(entry.sf.sp) : '';
</script>

<div style={`font-size: ${fontSize}em;`}>
  <!--Essential Fields-->
  <div>
    <strong style="font-size: 1.{headwordSize}em;">{entry.lx}</strong>
    {#each ['lo', 'lo2', 'lo3', 'lo4', 'lo5'] as lo}
      {#if entry[lo] && selectedFields[lo]}
        <strong>{entry[lo]}</strong>{' '}
      {/if}
    {/each}
    {entry.ph && selectedFields.ph ? `/${entry.ph}/` : ''}
    {#if entry.gl && selectedFields.gl}
      {#each Object.entries(entry.gl) as gloss, index}
        {@html gloss[1]}{index < Object.entries(entry.gl).length-1 ? ' - ' : ''}
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
      <!--TODO how to avoid images duplication? -->
      <img class="print:hidden" style="width:20%;margin-bottom:5px" src={`https://lh3.googleusercontent.com/${entry.pf.gcs}`} alt={entry.lx} />
      <img class="hidden print:block" style="width:{imageSize}%;margin-bottom:5px" src={`https://lh3.googleusercontent.com/${entry.pf.gcs}`} alt={entry.lx} />
        <!-- <Image square={imageSize} gcs={entry.pf.gcs} lexeme={entry.lx} /> -->
    {/if}
    {#if entry.sr && selectedFields.sr}
      <div>
        {#if !selectedFields.hideLabels}
          <i>Source(s): </i>
        {/if}
        {#each entry.sr as source, index}
          <i>{index < entry.sr.length-1 ? `${source}, ` : `${source}`}</i>
        {/each}
      </div>
    {/if}
    {#if entry.sf && selectedFields.sf}
      <div>
        {#if entry.sf.speakerName}
          <p><i>{!selectedFields.hideLabels ? 'Speaker:' : ''}</i> {entry.sf.speakerName}</p>
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
      {#if entry[key] && selectedFields[key] && EntryPDFFieldsEnum[key]}
        <p>
          {#if !selectedFields.hideLabels}
          <i>{EntryPDFFieldsEnum[key]}</i>:{' '}
          {/if}
          {@html entry[key]}</p>
      {/if}
    {/each}
  </div>
  {#if selectedFields.qrCode}
    <QrCode pixelsPerModule={2} value={`https://livingdictionaries.app/${dictionaryId}/entry/${entry.id}`} />
  {/if}
</div>