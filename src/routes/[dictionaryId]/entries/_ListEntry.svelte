<script lang="ts">
  import { _ } from 'svelte-i18n';
  import Audio from './_Audio.svelte';
  import Image from '$lib/components/image/Image.svelte';
  import AddImage from './_AddImage.svelte';
  import { page } from '$app/stores';
  import type { IEntry } from '$lib/interfaces';
  export let entry: IEntry;
  export let canEdit = false;

  function printGlosses(obj) {
    Object.keys(obj).forEach((key) => !obj[key] && delete obj[key]);
    const keys = Object.keys(obj).sort();
    if (keys.length > 1) {
      return keys.map((bcp) => {
        if (obj[bcp]) {
          return `${$_('gl.' + bcp)}: ${obj[bcp]}`;
        }
      });
    } else {
      return [obj[keys[0]]];
    }
  }
</script>

<!-- TODO: class:border-b-2={entry.ua} -->
<div
  dir="ltr"
  class="flex rounded shadow my-1 overflow-hidden items-stretch border-green-300"
  style="margin-right: 2px;">
  {#if entry.sf || canEdit}
    <Audio class="bg-gray-100" {entry} minimal={true} />
  {/if}

  <a
    sveltekit:prefetch
    href={'/' + $page.params.dictionaryId + '/entry/' + entry.id}
    class="p-2 flex-grow flex flex-col justify-between hover:bg-gray-200 ">
    <div>
      <!-- TODO: class:text-green-800={entry.ua} -->
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
    <div class="flex flex-wrap items-center justify-end -mb-1">
      <div class="text-xs text-gray-600 mr-auto mb-1">
        {#if entry.ps}
          <i>{$_('psAbbrev.' + entry.ps, { default: entry.ps })},</i>
        {/if}
        {printGlosses(entry.gl).join(', ')}
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
  {#if entry.pf}
    <div class="media-block bg-gray-300 relative">
      <Image square={128} {entry} editable={canEdit} />
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
