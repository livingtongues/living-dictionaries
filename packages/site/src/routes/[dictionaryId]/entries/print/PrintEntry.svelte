<script lang="ts">
  import { t } from 'svelte-i18n';
  import { StandardPrintFields, type IEntry, type IPrintFields } from '@living-dictionaries/types';
  import { semanticDomains } from '$lib/mappings/semantic-domains';
  import QrCode from './QrCode.svelte';
  import sanitize from 'xss';

  export let entry: IEntry;
  // export let speakers: ISpeaker[];
  export let selectedFields: IPrintFields;
  export let imagePercent = 50;
  export let fontSize = 12;
  export let headwordSize = 12;
  export let dictionaryId: string;
  export let showLabels = false;
  export let showQrCode = false;

  // $: speaker = entry.sf?.sp ? speakers.find((s) => s.uid === entry.sf.sp) : null;
</script>

<div style="font-size: {fontSize}pt;">
  <!--Essential Fields-->
  <b style="font-size: {headwordSize}pt;">{entry.lx}</b>
  {#if selectedFields.alternateOrthographies}
    {#each ['lo', 'lo2', 'lo3', 'lo4', 'lo5'] as lo}
      {#if entry[lo]}
        <b>{entry[lo]}</b>{' '}
      {/if}
    {/each}
  {/if}
  {entry.ph && selectedFields.ph ? `/${entry.ph}/` : ''}
  <i>{entry.ps && selectedFields.ps ? entry.ps : ''}</i>
  {#if entry.gl && selectedFields.gloss}
    {#each Object.entries(entry.gl) as gloss, index}
      {@html sanitize(gloss[1])}{index < Object.entries(entry.gl).length - 1 ? ' - ' : ''}
    {/each}
  {/if}
  <b>{entry.xv && selectedFields.example_sentence ? entry.xv : ''}</b>
  {#if entry.xs && selectedFields.example_sentence}
    {#each Object.entries(entry.xs) as sentence, index}
      {sentence[1]}{index < Object.entries(entry.xs).length - 1 ? ', ' : ''}
    {/each}
  {/if}

  <!-- Remaining Fields -->
  {#if entry.sr && selectedFields.sr}
    <div>
      {#if showLabels}
        <span class="italic text-[80%]">{$t('entry.sr', { default: 'Source' })}: </span>
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
    {#if selectedFields.sdn}
      {#if entry.sdn?.length || entry.sd}
        {#if showLabels}
          <span class="italic text-[80%]">{$t('entry.sdn', { default: 'Semantic Domains' })}: </span>
        {/if}

        {#if entry.sdn}
          {#each entry.sdn as key, index}
            {semanticDomains.find((sd) => sd.key === key).name}{index < entry.sdn.length - 1
              ? '; '
              : ''}
          {/each}
        {/if}
        {#if entry.sd}
          {entry.sd}
        {/if}
      {/if}
    {/if}
    {#each Object.keys(StandardPrintFields) as key}
      {#if entry[key] && selectedFields[key]}
        <p>
          {#if showLabels}
            <span class="italic text-[80%]"
              >{$t(`entry.${key}`, { default: StandardPrintFields[key] })}:</span>
          {/if}
          {#if key === 'nt'}
            {@html sanitize(entry[key])}
          {:else}
            {entry[key]}
          {/if}
        </p>
      {/if}
    {/each}
  </div>
  {#if entry.sf?.speakerName && selectedFields.speaker}
    <div>
      {#if showLabels}
        <span class="italic text-[80%]">{$t('entry.speaker', { default: 'Speaker' })}: </span>
      {/if}
      {entry.sf.speakerName}
    </div>
  {/if}
</div>
{#if entry.pf && selectedFields.image}
  <!-- max-height keeps tall images from spilling onto 2nd page when printing single column w/ images at 100% width; -->
  <img
    class="block mb-1 mt-1px"
    style="width:{imagePercent}%; max-height: 100vh;"
    src={`https://lh3.googleusercontent.com/${entry.pf.gcs}`}
    alt={entry.lx} />
{/if}
{#if showQrCode}
  {#await new Promise((r) => setTimeout(() => r(true), 1)) then value}
    <QrCode
      pixelsPerModule={2}
      value={`livingdictionaries.app/${dictionaryId}/entry/${entry.id}`} />
  {/await}
{/if}
