<script lang="ts">
  import type { EntryData, Tables } from '@living-dictionaries/types'
  import { ShowHide } from 'svelte-pieces'
  import sanitize from 'xss'
  import Audio from '../components/Audio.svelte'
  import Video from '../components/Video.svelte'
  import Image from '$lib/components/image/Image.svelte'
  import { order_glosses } from '$lib/helpers/glosses'
  import { minutes_ago_in_ms } from '$lib/helpers/time'
  import { page } from '$app/stores'
  import type { DbOperations } from '$lib/dbOperations'
  import AddImage from '$lib/components/image/AddImage.svelte'

  export let entry: EntryData
  export let dictionary: Tables<'dictionaries'>
  export let can_edit = false
  export let dbOperations: DbOperations
  export let on_click: (e: MouseEvent & { currentTarget: EventTarget & HTMLAnchorElement }) => void = undefined

  $: glosses = order_glosses({
    glosses: entry.senses?.[0]?.glosses,
    dictionary_gloss_languages: dictionary.gloss_languages,
    t: $page.data.t,
    label: dictionary.id !== 'jewish-neo-aramaic',
  }).join(', ')

  $: updated_within_last_5_minutes = can_edit && new Date(entry.updated_at).getTime() > minutes_ago_in_ms(5)

  $: first_sense = entry.senses?.[0] || {} as EntryData['senses'][0]
  $: first_video = first_sense.videos?.[0]
</script>

<div
  dir="ltr"
  class:border-b-2={updated_within_last_5_minutes}
  class="flex rounded shadow my-1 overflow-hidden items-stretch border-green-300"
  style="margin-right: 2px;">
  {#if entry.audios?.[0] || can_edit}
    <Audio class="bg-gray-100 py-1.5 px-1 min-w-55px w-55px" {entry} sound_file={entry.audios?.[0] || null} {can_edit} context="list" />
  {/if}
  <a
    href="/{dictionary.url}/entry/{entry.id}"
    on:click={on_click}
    class="p-2 text-lg flex-grow flex flex-col justify-between hover:bg-gray-200">
    <div>
      <span class="font-semibold text-gray-900 mr-1">{entry.main.lexeme.default}</span>
      {#if entry.main.phonetic}
        <span class="mr-1 hidden sm:inline">[{entry.main.phonetic}]</span>
      {/if}

      {#if dictionary.id !== 'garifuna'}
        {#each Object.entries(entry.main.lexeme) as [key, value]}
          {#if key !== 'default'}
            <i class="mr-1" class:sompeng={dictionary.id === 'sora' && key === 'lo2'}>{value}</i>
          {/if}
        {/each}
      {/if}
    </div>
    <div class="flex flex-wrap items-center justify-end -mb-1">
      <div class="text-xs text-gray-600 mr-auto mb-1">
        {#if first_sense.parts_of_speech}
          {#each first_sense.parts_of_speech as pos}
            <i>{$page.data.t({ dynamicKey: `psAbbrev.${pos}`, fallback: pos })}, </i>
          {/each}
        {/if}

        {#if glosses.includes('<i>')}
          {@html sanitize(glosses)}
        {:else}
          {glosses}
        {/if}

        {#if entry.main.scientific_names}
          {@const scientific_names = entry.main.scientific_names.join(', ')}
          {#if scientific_names.includes('<i>')}
            {@html sanitize(scientific_names)}
          {:else}
            <i>{scientific_names}</i>
          {/if}
        {/if}

        {#if entry.dialects?.length}<p class="text-xs">
          <i class="mr-1">{$page.data.t('entry_field.dialects')}: {entry.dialects.map(({ name }) => name.default).join(', ')}</i>
        </p>{/if}

        {#if dictionary.id === 'jewish-neo-aramaic'}
          {#if entry.dialects}<p class="text-xs">
            <i class="mr-1">{$page.data.t('entry_field.dialects')}: {entry.dialects.map(({ name }) => name.default).join(', ')}</i>
          </p>{/if}
          {#each first_sense.sentences || [] as sentence}
            {#each Object.entries(sentence.text) as [bcp, content]}
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

        {#if first_sense.plural_form}
          <p class="text-xs">
            {$page.data.t('entry_field.plural_form')}: {first_sense.plural_form.default}
          </p>
        {/if}
      </div>

      {#if first_sense.write_in_semantic_domains}
        <span class="px-2 py-1 leading-tight text-xs bg-gray-100 rounded ml-1">
          <i>{first_sense.write_in_semantic_domains.join(', ')}</i>
        </span>
      {/if}

      {#each first_sense.semantic_domains || [] as domain}
        <span
          class="px-2 py-1 leading-tight text-xs bg-gray-100 rounded ml-1
            mb-1">
          {$page.data.t({ dynamicKey: `sd.${domain}`, fallback: domain })}
        </span>
      {/each}
    </div>
  </a>
  {#if first_video}
    <Video
      class="bg-gray-100 p-1.5 border-r-2"
      lexeme={entry.main.lexeme.default}
      video={first_video}
      {can_edit} />
  {:else if can_edit}
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
  <!-- {#each sense_photos as photo (photo.id)} -->

  {#if first_sense.photos?.length}
    {@const [first_photo] = first_sense.photos}
    <div class="media-block bg-gray-300 relative">
      <Image
        square={128}
        title={entry.main.lexeme.default}
        gcs={first_photo.serving_url}
        {can_edit}
        on_delete_image={() => dbOperations.update_photo({ deleted: new Date().toISOString(), id: first_photo.id })} />
      {#if first_sense.photos.length > 1}
        <span class="i-fluent-image-stack-20-regular text-white absolute bottom-1 right-1 text-xl" />
      {/if}
    </div>
  {:else if can_edit}
    <div class="w-12 bg-gray-100 flex flex-col">
      <AddImage upload_image={file => dbOperations.addImage({ file, sense_id: first_sense.id })}>
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
