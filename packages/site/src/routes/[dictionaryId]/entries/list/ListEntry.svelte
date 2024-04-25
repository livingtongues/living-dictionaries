<script lang="ts">
  import type { ExpandedEntry, IDictionary } from '@living-dictionaries/types'
  import { ShowHide } from 'svelte-pieces'
  import sanitize from 'xss'
  import Audio from '../Audio.svelte'
  import Video from '../Video.svelte'
  import Image from '$lib/components/image/Image.svelte'
  import { order_glosses } from '$lib/helpers/glosses'
  import { minutesAgo } from '$lib/helpers/time'
  import { page } from '$app/stores'
  import type { DbOperations } from '$lib/dbOperations'
  import AddImage from '$lib/components/image/AddImage.svelte'

  export let entry: ExpandedEntry
  export let dictionary: IDictionary
  export let can_edit = false
  export let videoAccess = false
  export let dbOperations: DbOperations
  export let on_click: (e: MouseEvent & { currentTarget: EventTarget & HTMLAnchorElement }) => void = undefined

  $: glosses = order_glosses({
    glosses: entry.senses?.[0]?.glosses,
    dictionary_gloss_languages: dictionary.glossLanguages,
    t: $page.data.t,
    label: dictionary.id !== 'jewish-neo-aramaic',
  }).join(', ')

  $: updated_within_last_5_minutes = can_edit && (entry.ua?.toMillis?.() || (entry.ua?.seconds * 1000)) > minutesAgo(5)
</script>

<div
  dir="ltr"
  class:border-b-2={updated_within_last_5_minutes}
  class="flex rounded shadow my-1 overflow-hidden items-stretch border-green-300"
  style="margin-right: 2px;">
  {#if entry.sound_files?.[0] || can_edit}
    <Audio class="bg-gray-100 py-1.5 px-1 min-w-55px w-55px" {entry} {can_edit} context="list" updateEntryOnline={dbOperations.updateEntryOnline} />
  {/if}
  <a
    href="/{dictionary.id}/entry/{entry.id}"
    on:click={on_click}
    class="p-2 text-lg flex-grow flex flex-col justify-between hover:bg-gray-200">
    <div>
      <span class="font-semibold text-gray-900 mr-1">{entry.lexeme}</span>
      {#if entry.phonetic}
        <span class="mr-1 hidden sm:inline">[{entry.phonetic}]</span>
      {/if}

      {#if dictionary.id !== 'garifuna'}
        {#if entry.local_orthography_1}<i class="mr-1">{entry.local_orthography_1}</i>{/if}
        {#if entry.local_orthography_2}<i class="mr-1" class:sompeng={dictionary.id === 'sora'}>{entry.local_orthography_2}</i>{/if}
        {#if entry.local_orthography_3}<i class="mr-1">{entry.local_orthography_3}</i>{/if}
        {#if entry.local_orthography_4}<i class="mr-1">{entry.local_orthography_4}</i>{/if}
        {#if entry.local_orthography_5}<i class="mr-1">{entry.local_orthography_5}</i>{/if}
      {/if}
    </div>
    <div class="flex flex-wrap items-center justify-end -mb-1">
      <div class="text-xs text-gray-600 mr-auto mb-1">
        {#if entry.senses?.[0]?.translated_parts_of_speech}
          {#each entry.senses?.[0]?.parts_of_speech_keys as pos}
            <i>{$page.data.t({ dynamicKey: `psAbbrev.${pos}`, fallback: pos })}, </i>
          {/each}
        {/if}

        {#if glosses.includes('<i>')}
          {@html sanitize(glosses)}
        {:else}
          {glosses}
        {/if}

        {#if entry.scientific_names}
          {@const scientific_names = entry.scientific_names.join(', ')}
          {#if scientific_names.includes('<i>')}
            {@html sanitize(scientific_names)}
          {:else}
            <i>{scientific_names}</i>
          {/if}
        {/if}

        {#if dictionary.id === 'jewish-neo-aramaic'}
          {#if entry.dialects}<p class="text-xs">
            <i class="mr-1">{$page.data.t('entry_field.dialects')}: {entry.dialects.join(', ')}</i>
          </p>{/if}
          {#each entry.senses?.[0]?.example_sentences || [{}] as sentence}
            {#each Object.entries(sentence) as [bcp, content]}
              <p>
                <span class="font-semibold">
                  {#if bcp !== 'vn'}
                    {$page.data.t({ dynamicKey: `gl.${bcp}`, fallback: bcp })}
                  {/if}
                  {$page.data.t('entry_field.example_sentence')}:</span>
                {content}
              </p>
            {/each}
          {/each}
        {/if}

        {#if entry.plural_form}
          <p class="text-xs">
            {$page.data.t('entry_field.plural_form')}: {entry.plural_form}
          </p>
        {/if}
      </div>

      {#if entry.senses?.[0]?.write_in_semantic_domains}
        <span class="px-2 py-1 leading-tight text-xs bg-gray-100 rounded ml-1">
          <i>{entry.senses?.[0]?.write_in_semantic_domains.join(', ')}</i>
        </span>
      {/if}

      {#each entry.senses?.[0]?.translated_ld_semantic_domains || [] as domain}
        <span
          class="px-2 py-1 leading-tight text-xs bg-gray-100 rounded ml-1
            mb-1">
          {domain}
        </span>
      {/each}
    </div>
  </a>
  {#if entry.senses?.[0]?.video_files?.[0]}
    <Video
      class="bg-gray-100 p-1.5 border-r-2"
      lexeme={entry.lexeme}
      video={entry.senses[0].video_files[0]}
      {can_edit}
      on_delete_video={async () => await dbOperations.deleteVideo(entry)} />
  {:else if videoAccess && can_edit}
    <ShowHide let:show let:toggle>
      <button
        type="button"
        class="media-block bg-gray-100 border-r-2 hover:bg-gray-300 flex flex-col items-center
          justify-center cursor-pointer p-2 text-lg"
        on:click={toggle}>
        <span class="i-bi-camera-video text-2xl mt-1  text-blue-800" />
      </button>
      {#if show}
        {#await import('$lib/components/video/AddVideo.svelte') then { default: AddVideo }}
          <AddVideo {entry} on_close={toggle} />
        {/await}
      {/if}
    </ShowHide>
  {/if}
  {#if entry.senses?.[0]?.photo_files?.[0]}
    <div class="media-block bg-gray-300 relative">
      <Image
        square={128}
        title={entry.lexeme}
        gcs={entry.senses?.[0]?.photo_files?.[0].specifiable_image_url}
        {can_edit}
        on_delete_image={() => dbOperations.deleteImage(entry)} />
    </div>
  {:else if can_edit}
    <div class="w-12 bg-gray-100 flex flex-col">
      <AddImage upload_image={file => dbOperations.addImage(entry.id, file)}>
        <div class="text-xs">
          {$page.data.t('entry_field.photo')}
        </div>
      </AddImage>
    </div>
  {/if}
</div>

<style>
  .media-block {
    flex: 0 0 64px;
    width: 64px;
    min-height: 64px;
  }
</style>
