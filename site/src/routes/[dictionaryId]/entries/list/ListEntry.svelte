<script lang="ts">
  import type { EntryData, Tables } from '$lib/types'
  import sanitize from 'xss'
  import Audio from '../components/Audio.svelte'
  import Video from '../components/Video.svelte'
  import ShowHide from '$lib/components/ui/ShowHide.svelte'
  import Image from '$lib/components/image/Image.svelte'
  import { order_glosses } from '$lib/helpers/glosses'
  import { get_headword } from '$lib/helpers/orthographies'
  import { minutes_ago_in_ms } from '$lib/utils/time'
  import { page } from '$app/state'
  import type { GuardedWrites } from '$lib/db/dict-client/guarded-writes'
  import IconBiCameraVideo from '~icons/bi/camera-video'
  import IconFluentImageStack20Regular from '~icons/fluent/image-stack-20-regular'
  import IconIcOutlineCloudUpload from '~icons/ic/outline-cloud-upload'
  import IconIcOutlineCameraAlt from '~icons/ic/outline-camera-alt'

  interface Props {
    entry: EntryData
    dictionary: Tables<'dictionaries'>
    can_edit?: boolean
    writes: GuardedWrites
    on_click?: (e: MouseEvent & { currentTarget: EventTarget & HTMLAnchorElement }) => void
  }

  const {
    entry,
    dictionary,
    can_edit = false,
    writes,
    on_click = undefined,
  }: Props = $props()

  const glosses = $derived(order_glosses({
    glosses: entry.senses?.[0]?.glosses,
    dictionary_gloss_languages: dictionary.gloss_languages,
    t: page.data.t,
    label: dictionary.id !== 'jewish-neo-aramaic',
  }).join(', '))

  const updated_within_last_5_minutes = $derived(can_edit && new Date(entry.updated_at).getTime() > minutes_ago_in_ms(5))

  const first_sense = $derived(entry.senses?.[0] || {} as EntryData['senses'][0])
  const first_video = $derived(first_sense.videos?.[0])
  const headword = $derived(get_headword({ lexeme: entry.main.lexeme, orthographies: dictionary.orthographies }))
</script>

<div
  dir="ltr"
  class:recently-updated={updated_within_last_5_minutes}
  class="entry-row"
  style="margin-right: 2px;">
  {#if entry.audios?.[0] || can_edit}
    <Audio class="list-audio-cell" {entry} sound_file={entry.audios?.[0] || null} {can_edit} context="list" />
  {/if}
  <a
    href="/{dictionary.url}/entry/{entry.id}"
    onclick={on_click}
    class="entry-link">
    <div>
      <span class="lexeme">{headword.value}{#if entry.main.homograph}<sup class="homograph">{entry.main.homograph}</sup>{/if}</span>
      {#if entry.main.phonetic}
        <span class="phonetic">[{entry.main.phonetic}]</span>
      {/if}

      {#if dictionary.id !== 'garifuna'}
        {#each Object.entries(entry.main.lexeme) as [key, value] (key)}
          {#if key !== 'default' && key !== headword.code}
            <i class="spaced" class:sompeng={dictionary.id === 'sora' && key === 'srb-sora'}>{value}</i>
          {/if}
        {/each}
      {/if}
    </div>
    <div class="meta-row">
      <div class="gloss-block">
        {#if first_sense.parts_of_speech}
          {#each first_sense.parts_of_speech as pos (pos)}
            <i>{page.data.t({ dynamicKey: `psAbbrev.${pos}`, fallback: pos })}, </i>
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

        {#if entry.dialects?.length}<p>
          <i class="spaced">{page.data.t('entry_field.dialects')}: {entry.dialects.map(({ name }) => name.default).join(', ')}</i>
        </p>{/if}

        {#if dictionary.id === 'jewish-neo-aramaic'}
          {#if entry.dialects}<p>
            <i class="spaced">{page.data.t('entry_field.dialects')}: {entry.dialects.map(({ name }) => name.default).join(', ')}</i>
          </p>{/if}
          {#each first_sense.sentences || [] as sentence (sentence.id)}
            {#each Object.entries(sentence.text) as [bcp, content] (bcp)}
              <p>
                <span style="font-weight: 600">
                  {#if bcp !== 'vn'}
                    {page.data.t({ dynamicKey: `gl.${bcp}`, fallback: bcp })}
                  {/if}
                  {page.data.t('entry_field.example_sentence')}:</span>
                {content}
              </p>
            {/each}
          {/each}
        {/if}

        {#if first_sense.plural_form}
          <p>
            {page.data.t('entry_field.plural_form')}: {first_sense.plural_form.default}
          </p>
        {/if}
      </div>

      {#if first_sense.write_in_semantic_domains}
        <span class="sd-chip">
          <i>{first_sense.write_in_semantic_domains.join(', ')}</i>
        </span>
      {/if}

      {#each first_sense.semantic_domains || [] as domain (domain)}
        <span class="sd-chip" style="margin-bottom: 0.25rem">
          {page.data.t({ dynamicKey: `sd.${domain}`, fallback: domain })}
        </span>
      {/each}
    </div>
  </a>
  {#if !dictionary.con_language_description}
    {#if first_video}
      <Video
        class="list-video-cell"
        lexeme={headword.value}
        video={first_video}
        {can_edit} />
    {:else if can_edit}
      <ShowHide>
        {#snippet children({ show, toggle })}
          <button
            type="button"
            class="media-block add-video"
            onclick={toggle}>
            <IconBiCameraVideo style="font-size: 1.5rem; margin-top: 0.25rem; color: rgb(30 64 175)" />
          </button>
          {#if show}
            {#await import('$lib/components/video/AddVideo.svelte') then { default: AddVideo }}
              <AddVideo {entry} on_close={toggle} />
            {/await}
          {/if}
        {/snippet}
      </ShowHide>
    {/if}
  {/if}
  <!-- {#each sense_photos as photo (photo.id)} -->

  <ShowHide>
    {#snippet children({ show, toggle })}
      {#if first_sense.photos?.length}
        {@const [first_photo] = first_sense.photos}
        <div class="media-block photo-block">
          <Image
            square={128}
            title={headword.value}
            gcs={first_photo.serving_url}
            photo_source={first_photo.source}
            photographer={first_photo.photographer}
            {can_edit}
            on_delete_image={() => writes.delete_photo(first_photo.id)} />
          {#if first_sense.photos.length > 1}
            <IconFluentImageStack20Regular class="photo-stack-icon" />
          {/if}
        </div>
      {:else if can_edit}
        <div
          class="upload-block"
          onclick={toggle}>
          <span class="desktop-only">
            <IconIcOutlineCloudUpload style="font-size: 1.5rem" />
          </span>
          <span class="mobile-only">
            <IconIcOutlineCameraAlt style="font-size: 1.25rem" />
          </span>
          <div style="font-size: 0.75rem; line-height: 1rem">
            {page.data.t('entry_field.photo')}
          </div>
        </div>
      {/if}
      {#if show}
        {#await import('$lib/components/image/EditImage.svelte') then { default: EditImage }}
          <EditImage on_close={toggle} sense_id={first_sense.id} />
        {/await}
      {/if}
    {/snippet}
  </ShowHide>
</div>

<style>
  .media-block {
    flex: 0 0 64px;
    width: 64px;
    min-height: 64px;
  }

  .entry-row {
    display: flex;
    border-radius: 0.25rem;
    box-shadow: 0 1px 3px 0 rgb(0 0 0 / 0.1), 0 1px 2px -1px rgb(0 0 0 / 0.1); /* shadow */
    margin-top: 0.25rem;
    margin-bottom: 0.25rem;
    overflow: hidden;
    align-items: stretch;
    border-color: rgb(134 239 172); /* green-300 */
  }

  .recently-updated {
    border-bottom-width: 2px;
  }

  .entry-row :global(.list-audio-cell) {
    background-color: var(--surface); /* ≈ gray-100 */
    padding: 0.375rem 0.25rem;
    min-width: 55px;
    width: 55px;
  }

  .entry-link {
    padding: 0.5rem;
    font-size: 1.125rem;
    line-height: 1.75rem;
    flex-grow: 1;
    display: flex;
    flex-direction: column;
    justify-content: space-between;
  }

  .entry-link:hover {
    background-color: color-mix(in srgb, var(--background), var(--color) 10%); /* ≈ gray-200 */
  }

  .lexeme {
    font-weight: 600;
    color: var(--color); /* ≈ gray-900 */
    margin-right: 0.25rem;
  }

  .homograph {
    font-weight: 400;
    opacity: 0.7;
    margin-left: 0.05em;
  }

  .phonetic {
    margin-right: 0.25rem;
    display: none;
  }

  @media (min-width: 640px) {
    .phonetic {
      display: inline;
    }
  }

  .spaced {
    margin-right: 0.25rem;
  }

  .meta-row {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    justify-content: flex-end;
    margin-bottom: -0.25rem;
  }

  .gloss-block {
    font-size: 0.75rem;
    line-height: 1rem;
    color: color-mix(in srgb, var(--color) 75%, var(--background)); /* ≈ gray-600 */
    margin-right: auto;
    margin-bottom: 0.25rem;
  }

  .sd-chip {
    padding: 0.25rem 0.5rem;
    line-height: 1.25;
    font-size: 0.75rem;
    background-color: var(--surface); /* ≈ gray-100 */
    border-radius: 0.25rem;
    margin-left: 0.25rem;
  }

  .entry-row :global(.list-video-cell) {
    background-color: var(--surface); /* ≈ gray-100 */
    padding: 0.375rem;
    border-right-width: 2px;
  }

  .add-video {
    background-color: var(--surface); /* ≈ gray-100 */
    border-right-width: 2px;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    cursor: pointer;
    padding: 0.5rem;
    font-size: 1.125rem;
    line-height: 1.75rem;
  }

  .add-video:hover {
    background-color: color-mix(in srgb, var(--background), var(--color) 18%); /* ≈ gray-300 */
  }

  .photo-block {
    background-color: color-mix(in srgb, var(--background), var(--color) 18%); /* ≈ gray-300 */
    position: relative;
  }

  .photo-block :global(.photo-stack-icon) {
    color: #fff;
    position: absolute;
    bottom: 0.25rem;
    right: 0.25rem;
    font-size: 1.25rem;
  }

  .upload-block {
    width: 3rem;
    background-color: var(--surface); /* ≈ gray-100 */
    display: flex;
    flex-direction: column;
    color: color-mix(in srgb, var(--color) 75%, var(--background)); /* ≈ gray-600 */
    align-items: center;
    justify-content: center;
    cursor: pointer;
  }

  .desktop-only {
    display: none;
  }

  @media (min-width: 768px) {
    .desktop-only {
      display: inline;
    }

    .mobile-only {
      display: none;
    }
  }
</style>
