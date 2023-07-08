<script lang="ts">
  import { t } from 'svelte-i18n';
  import Audio from '../Audio.svelte';
  import Video from '../Video.svelte';
  import Image from '$lib/components/image/Image.svelte';
  import AddImage from '$lib/components/image/AddImage.svelte';
  import type { IDictionary, IEntry } from '@living-dictionaries/types';
  import { order_glosses, order_entry_and_dictionary_gloss_languages } from '$lib/helpers/glosses';
  import { minutesAgo } from '$lib/helpers/time';
  import { ShowHide } from 'svelte-pieces';
  import sanitize from 'xss';

  export let entry: IEntry;
  export let dictionary: IDictionary;
  export let canEdit = false;
  export let videoAccess = false;

  $: glosses = order_glosses({
    glosses: entry.gl,
    dictionary_gloss_languages: dictionary.glossLanguages,
    $t,
    label: dictionary.id !== 'jewish-neo-aramaic',
  }).join(', ');
</script>

<div
  dir="ltr"
  class:border-b-2={entry.ua?.toMillis?.() > minutesAgo(5)}
  class="flex rounded shadow my-1 overflow-hidden items-stretch border-green-300"
  style="margin-right: 2px;">
  {#if entry.sf || canEdit}
    <Audio class="bg-gray-100" {entry} {canEdit} minimal />
  {/if}
  <a
    href={'/' + dictionary.id + '/entry/' + entry.id}
    class="p-2 text-lg flex-grow flex flex-col justify-between hover:bg-gray-200">
    <div>
      <span class="font-semibold text-gray-900 mr-1">{entry.lx}</span>
      {#if entry.ph}
        <span class="mr-1 hidden sm:inline">[{entry.ph}]</span>
      {/if}

      {#if dictionary.id !== 'garifuna'}
        {#if entry.lo}<i class="mr-1">{entry.lo}</i>{/if}
        {#if entry.lo2}<i class="mr-1" class:sompeng={dictionary.id === 'sora'}
        >{entry.lo2}</i
        >{/if}
        {#if entry.lo3}<i class="mr-1">{entry.lo3}</i>{/if}
        {#if entry.lo4}<i class="mr-1">{entry.lo4}</i>{/if}
        {#if entry.lo5}<i class="mr-1">{entry.lo5}</i>{/if}
      {/if}
    </div>
    <div class="flex flex-wrap items-center justify-end -mb-1">
      <div class="text-xs text-gray-600 mr-auto mb-1">
        {#if entry.ps}
          {#if typeof entry.ps === 'string'}
            <!-- TODO: refactor entry.ps strings to array of strings, then remove this -->
            <i>{$t('psAbbrev.' + entry.ps, { default: entry.ps })},</i>
          {:else}
            {#each entry.ps as pos}
              <i>{$t('psAbbrev.' + pos, { default: pos })}, </i>
            {/each}
          {/if}
        {/if}

        {#if glosses.includes('<i>')}
          {@html sanitize(glosses)}
        {:else}
          {glosses}
        {/if}

        {#if entry.scn?.length}
          {@const scientific_names = entry.scn?.join(', ')}
          {#if scientific_names.includes('<i>')}
            {@html sanitize(scientific_names)}
          {:else}
            <i>{scientific_names}</i>
          {/if}
        {/if}

        {#if dictionary.id === 'jewish-neo-aramaic'}
          {#if entry.di}<p class="text-xs">
            <i class="mr-1">{$t('entry.di', { default: 'Dialect' })}: {entry.di}</i>
          </p>{/if}
          {#if entry.xs?.vn}<p>
            <span class="font-semibold"
            >{$t('entry.example_sentence', { default: 'Example Sentence' })}:</span>
            {entry.xs.vn}
          </p>{/if}
          {#if entry.xs}
            {#each order_entry_and_dictionary_gloss_languages(entry.gl, dictionary.glossLanguages) as bcp}
              {#if entry.xs[bcp]}
                <p>
                  <span class="font-semibold"
                  >{$t(`gl.${bcp}`)}
                    {$t('entry.example_sentence', {
                      default: 'Example Sentence',
                    })}:</span>
                  {entry.xs[bcp]}
                </p>
              {/if}
            {/each}
          {/if}
        {:else if dictionary.id === 'babanki'}
          {#if entry.pl}<p class="text-xs">
            {$t('entry.pl', { default: 'Plural form' })}: {entry.pl}
          </p>{/if}
        {/if}
      </div>

      {#if entry.sd}
        <span class="px-2 py-1 leading-tight text-xs bg-gray-100 rounded ml-1">
          <i>{entry.sd}</i>
        </span>
      {/if}

      {#if entry.sdn?.length}
        {#each entry.sdn as domain}
          <span
            class="px-2 py-1 leading-tight text-xs bg-gray-100 rounded ml-1
              mb-1">
            {$t('sd.' + domain, { default: domain })}
          </span>
        {/each}
      {/if}
    </div>
  </a>
  {#if entry.senses?.[0].video_files?.[0]}
    <Video class="bg-gray-100 border-r-2" {entry} video={entry.senses[0].video_files[0]} {canEdit} />
  {:else if videoAccess && canEdit}
    <ShowHide let:show let:toggle>
      <button
        type="button"
        class="media-block bg-gray-100 border-r-2 hover:bg-gray-300 flex flex-col items-center
          justify-center cursor-pointer p-2 text-lg"
        on:click={toggle}>
        <i class="far fa-video-plus my-1 mx-2 text-blue-800" />
      </button>
      {#if show}
        {#await import('$lib/components/video/AddVideo.svelte') then { default: AddVideo }}
          <AddVideo {entry} on:close={toggle} />
        {/await}
      {/if}
    </ShowHide>
  {/if}
  {#if entry.pf}
    <div class="media-block bg-gray-300 relative">
      <Image
        square={128}
        lexeme={entry.lx}
        gcs={entry.pf.gcs}
        {canEdit}
        on:deleteImage />
    </div>
  {:else if canEdit}
    <AddImage {entry} class="w-12 bg-gray-100">
      <div class="text-xs" slot="text">
        {$t('entry.photo', { default: 'Photo' })}
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
