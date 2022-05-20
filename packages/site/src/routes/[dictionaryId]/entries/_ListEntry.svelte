<script lang="ts">
  import { _ } from 'svelte-i18n';
  import Audio from './_Audio.svelte';
  import Video from './_Video.svelte';
  import Image from '$lib/components/image/Image.svelte';
  import AddImage from './_AddImage.svelte';
  import { page } from '$app/stores';
  import type { IEntry } from '@living-dictionaries/types';
  import { printGlosses } from '$lib/helpers/glosses';
  import { minutesAgo } from '$lib/helpers/time';
  import ShowHide from 'svelte-pieces/functions/ShowHide.svelte';
  import { showEntryGlossLanguages } from '$lib/helpers/glosses';
  import {dictionary} from '$lib/stores'
  export let entry: IEntry,
    canEdit = false,
    videoAccess = false;

  $: glosses = $dictionary.id === 'babanki' ? printGlosses(entry.gl, true).join(', ') : printGlosses(entry.gl).join(', ');
</script>

<div
  dir="ltr"
  class:border-b-2={entry.ua && entry.ua.toMillis && entry.ua.toMillis() > minutesAgo(5)}
  class="flex rounded shadow my-1 overflow-hidden items-stretch border-green-300"
  style="margin-right: 2px;">
  {#if entry.sf || canEdit}
    <Audio class="bg-gray-100" {entry} minimal />
  {/if}
  <a
    sveltekit:prefetch
    href={'/' + $page.params.dictionaryId + '/entry/' + entry.id}
    class="p-2 text-lg flex-grow flex flex-col justify-between hover:bg-gray-200 ">
    <div>
      <span class="font-semibold text-gray-900 mr-1">{entry.lx}</span>
      {#if entry.ph}
        <span class="mr-1 hidden sm:inline">[{entry.ph}]</span>
      {/if}

      {#if entry.lo}<i class="mr-1">{entry.lo}</i>{/if}
      {#if entry.lo2}<i class="mr-1" class:sompeng={$page.params.dictionaryId === 'sora'}
          >{entry.lo2}</i
        >{/if}
      {#if entry.lo3}<i class="mr-1">{entry.lo3}</i>{/if}
      {#if entry.lo4}<i class="mr-1">{entry.lo4}</i>{/if}
      {#if entry.lo5}<i class="mr-1">{entry.lo5}</i>{/if}
      
    </div>
    {#if entry.di}<p class="text-xs"><i class="mr-1">Dialect: {entry.di}</i></p>{/if}
    <div class="flex flex-wrap items-center justify-end -mb-1">
      <div class="text-xs text-gray-600 mr-auto mb-1">
        {#if entry.ps}
          <i>{$_('psAbbrev.' + entry.ps, { default: entry.ps })},</i>
        {/if}
        {#if glosses.indexOf('<i>') > -1}
          {@html glosses}
        {:else}
          {glosses}
        {/if}
        <br>
        {#if entry.xs && entry.xs.vn}<p class="font-semibold">{$_('entry.example_sentence', { default: 'Example Sentence' })}: {entry.xs.vn}</p>{/if}
        {#if entry.xs}{#each showEntryGlossLanguages(entry.gl, $dictionary.glossLanguages) as bcp}
        <p class="font-semibold">{$_(`gl.${bcp}`)} {$_('entry.example_sentence', {
            default: 'Example Sentence',
          })}: {entry.xs[bcp]}</p>
        {/each}{/if}
      </div>
    
      {#if entry.sd}
        <span class="px-2 py-1 leading-tight text-xs bg-gray-100 rounded ml-1">
          <i>{entry.sd}</i>
        </span>
      {/if}
      
      {#if entry.sdn && entry.sdn.length}
        {#each entry.sdn as domain}
          <span
            class="px-2 py-1 leading-tight text-xs bg-gray-100 rounded ml-1
        mb-1">
            {$_('sd.' + domain, { default: domain })}
          </span>
        {/each}
      {/if}
    </div>
  </a>
  {#if entry.vfs && entry.vfs[0]}
    <Video class="bg-gray-100 border-r-2" {entry} video={entry.vfs[0]} {canEdit} />
  {:else if videoAccess && canEdit}
    <ShowHide let:show let:toggle>
      <div
        class="media-block bg-gray-100 border-r-2 hover:bg-gray-300 flex flex-col items-center
        justify-center cursor-pointer p-2 text-lg"
        on:click={toggle}>
        <i class="far fa-video-plus my-1 mx-2 text-blue-800" />
      </div>
      {#if show}
        {#await import('$lib/components/video/AddVideo.svelte') then { default: AddVideo }}
          <AddVideo {entry} on:close={toggle} />
        {/await}
      {/if}
    </ShowHide>
  {/if}
  {#if entry.pf}
    <div class="media-block bg-gray-300 relative">
      <Image square={128} {entry} {canEdit} />
    </div>
  {:else if canEdit}
    <AddImage {entry} class="w-12 bg-gray-100">
      <div class="text-xs" slot="text">
        {$_('entry.photo', { default: 'Photo' })}
      </div>
    </AddImage>
  {/if}
</div>

<style>
  .media-block {
    flex: 0 0 64px;
    width: 64px;
    min-height: 64px;
  }
</style>
