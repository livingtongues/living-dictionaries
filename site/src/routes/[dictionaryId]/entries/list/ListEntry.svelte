<script lang="ts">
  import type { EntryData, Tables } from '$lib/types'
  import sanitize from 'xss'
  import Audio from '../components/Audio.svelte'
  import ShowHide from '$lib/components/ui/ShowHide.svelte'
  import Popover from '$lib/components/ui/Popover.svelte'
  import Image from '$lib/components/image/Image.svelte'
  import { order_glosses } from '$lib/gloss/order-glosses'
  import { get_headword } from '$lib/orthography/orthographies'
  import { minutes_ago_in_ms } from '$lib/utils/time'
  import { video_thumb_src } from '$lib/utils/media-url'
  import { page } from '$app/state'
  import type { GuardedWrites } from '$lib/db/dict-client/guarded-writes'
  import IconBiCameraVideo from '~icons/bi/camera-video'
  import IconFluentImageStack20Regular from '~icons/fluent/image-stack-20-regular'
  import IconMdiDotsHorizontal from '~icons/mdi/dots-horizontal'
  import IconMdiPlay from '~icons/mdi/play'
  import IconMaterialSymbolsHearing from '~icons/material-symbols/hearing'
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

  const updated_within_last_5_minutes = $derived(can_edit && new Date(entry.updated_at).getTime() > minutes_ago_in_ms(5))

  const senses = $derived(entry.senses || [])
  const first_sense = $derived(senses[0] || {} as EntryData['senses'][0])
  const first_video = $derived(first_sense.videos?.[0])
  const headword = $derived(get_headword({ lexeme: entry.main.lexeme, orthographies: dictionary.orthographies }))

  // Media rail: flush full-bleed against the card's top/right/bottom edges while
  // the row is short; a floating centered thumb once the text makes the card
  // taller than the thumb cap (pure-CSS block-size container queries can't do
  // this on auto-height rows, so measure).
  let row_height = $state(0)
  const FLUSH_MAX_PX = 104 // 6.5rem — beyond this the full-bleed square would stretch
  const media_floating = $derived(row_height > FLUSH_MAX_PX)
  // Explicit square width for flush thumbs: `height: 100%` + `aspect-ratio` can't
  // size a flex parent (circular), so the measured row height sets it instead.
  const flush_thumb_width = $derived(row_height ? `${Math.min(row_height, FLUSH_MAX_PX)}px` : '3.5rem')

  const video_thumb_url = $derived(first_video ? video_thumb_src(first_video) : null)
  let video_thumb_errored = $state(false)

  // No language-name labels in the list — values only, languages separated by '·'.
  function multistring_text(value: EntryData['senses'][0]['glosses']): string {
    return order_glosses({
      glosses: value,
      dictionary_gloss_languages: dictionary.gloss_languages,
      t: page.data.t,
    }).join(' · ')
  }

  const single_sense = $derived(senses.length <= 1)
  const first_gloss_text = $derived(multistring_text(first_sense.glosses))
  const first_definition_text = $derived(multistring_text(first_sense.definition))

  function sense_segment(sense: EntryData['senses'][0]): string {
    // Gloss (short form) leads; definition (long form) follows an em dash — or stands in when there's no gloss.
    return [multistring_text(sense.glosses), multistring_text(sense.definition)].filter(Boolean).join(' — ')
  }

  function pos_abbrevs(sense: EntryData['senses'][0]): string {
    return (sense.parts_of_speech || []).map(pos => page.data.t({ dynamicKey: `psAbbrev.${pos}`, fallback: pos })).join(', ')
  }

  // ⋯ menu + media modals (drag-drop routes a file straight into the right modal)
  let menu_anchor: HTMLElement = $state(null)
  let menu_open = $state(false)
  let open_modal: 'audio' | 'photo' | 'video' | null = $state(null)
  let dropped_file: File | null = $state(null)
  let dragging = $state(false)

  function close_modal() {
    open_modal = null
    dropped_file = null
  }

  function route_dropped_file(file: File) {
    if (!file) return
    const [kind] = file.type.split('/')
    if (kind === 'image' && file.type !== 'image/svg+xml' && first_sense.id) {
      dropped_file = file
      open_modal = 'photo'
    } else if (kind === 'audio') {
      dropped_file = entry.audios?.[0] ? null : file
      open_modal = 'audio'
    } else if (kind === 'video' && first_sense.id && !dictionary.con_language_description) {
      dropped_file = file
      open_modal = 'video'
    }
  }
</script>

<div
  dir="ltr"
  class:recently-updated={updated_within_last_5_minutes}
  class:dragging
  class:has-audio={!!entry.audios?.[0]}
  class="entry-row"
  bind:clientHeight={row_height}
  ondragover={(e) => {
    if (!can_edit || !e.dataTransfer?.types.includes('Files')) return
    e.preventDefault()
    dragging = true
  }}
  ondragleave={() => dragging = false}
  ondrop={(e) => {
    if (!can_edit) return
    e.preventDefault()
    dragging = false
    route_dropped_file(e.dataTransfer?.files?.[0])
  }}>
  {#if entry.audios?.[0]}
    <Audio class="list-audio-cell" {entry} sound_file={entry.audios[0]} {can_edit} context="list" />
  {/if}
  <a
    href="/{dictionary.url}/entry/{entry.id}"
    onclick={on_click}
    class="entry-link">
    <div class="headword-line">
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

    {#if single_sense}
      {@const primary = first_gloss_text || first_definition_text}
      {#if primary || first_sense.parts_of_speech?.length || entry.main.scientific_names}
        <div class="gloss-line">
          {#if first_sense.parts_of_speech?.length}
            <i>{pos_abbrevs(first_sense)}{primary ? ', ' : ''}</i>
          {/if}

          {#if primary.includes('<i>')}
            {@html sanitize(primary)}
          {:else}
            {primary}
          {/if}

          {#if entry.main.scientific_names}
            {@const scientific_names = entry.main.scientific_names.join(', ')}
            {#if scientific_names.includes('<i>')}
              {@html sanitize(scientific_names)}
            {:else}
              <i>{scientific_names}</i>
            {/if}
          {/if}
        </div>
      {/if}
      {#if first_gloss_text && first_definition_text}
        <div class="definition-line">
          {#if first_definition_text.includes('<i>')}
            {@html sanitize(first_definition_text)}
          {:else}
            {first_definition_text}
          {/if}
        </div>
      {/if}
    {:else}
      <div class="senses-block">
        {#each senses as sense, index (sense.id)}
          {@const segment = sense_segment(sense)}
          {#if segment || sense.parts_of_speech?.length}
            <span class="sense">
              <span class="sense-num">{index + 1}</span>
              {#if sense.parts_of_speech?.length}<i>{pos_abbrevs(sense)}, </i>{/if}
              {#if segment.includes('<i>')}
                {@html sanitize(segment)}
              {:else}
                {segment}
              {/if}
            </span>
          {/if}
        {/each}
      </div>
    {/if}

    {#if entry.dialects?.length}
      <div class="extra-line">
        <i>{page.data.t('entry_field.dialects')}: {entry.dialects.map(({ name }) => name.default).join(', ')}</i>
      </div>
    {/if}

    {#if dictionary.id === 'jewish-neo-aramaic'}
      {#each first_sense.sentences || [] as sentence (sentence.id)}
        {#each Object.entries(sentence.text) as [bcp, content] (bcp)}
          <div class="extra-line">
            <span style="font-weight: 600">
              {#if bcp !== 'vn'}
                {page.data.t({ dynamicKey: `gl.${bcp}`, fallback: bcp })}
              {/if}
              {page.data.t('entry_field.example_sentence')}:</span>
            {content}
          </div>
        {/each}
      {/each}
    {/if}

    {#if first_sense.plural_form}
      <div class="extra-line">
        {page.data.t('entry_field.plural_form')}: {first_sense.plural_form.default}
      </div>
    {/if}

    {#if first_sense.write_in_semantic_domains || first_sense.semantic_domains?.length}
      <div class="chips-line">
        {#if first_sense.write_in_semantic_domains}
          <span class="sd-chip"><i>{first_sense.write_in_semantic_domains.join(', ')}</i></span>
        {/if}
        {#each first_sense.semantic_domains || [] as domain (domain)}
          <span class="sd-chip">
            {page.data.t({ dynamicKey: `sd.${domain}`, fallback: domain })}
          </span>
        {/each}
      </div>
    {/if}
  </a>

  {#if can_edit}
    <button
      bind:this={menu_anchor}
      type="button"
      class="icon-button menu-button"
      title={page.data.t('misc.edit')}
      onclick={() => menu_open = true}>
      <IconMdiDotsHorizontal style="font-size: 1.125rem" />
    </button>
  {/if}

  {#if (first_video && !dictionary.con_language_description) || first_sense.photos?.length}
    <div class="media-rail" class:floating={media_floating} style="--flush-thumb-width: {flush_thumb_width}">
      {#if first_video && !dictionary.con_language_description}
        <ShowHide>
          {#snippet children({ show, toggle })}
            <button type="button" class="media-thumb video-thumb" title={page.data.t('video.view')} onclick={toggle}>
              {#if video_thumb_url && !video_thumb_errored}
                <img src={video_thumb_url} alt="" onerror={() => video_thumb_errored = true} />
                <span class="play-overlay"><IconMdiPlay style="font-size: 1.25rem" /></span>
              {:else}
                <IconBiCameraVideo style="font-size: 1.125rem" />
              {/if}
            </button>
            {#if show}
              {#await import('$lib/components/video/PlayVideo.svelte') then { default: PlayVideo }}
                <PlayVideo
                  lexeme={headword.value}
                  video={first_video}
                  {can_edit}
                  on_close={toggle} />
              {/await}
            {/if}
          {/snippet}
        </ShowHide>
      {/if}

      {#if first_sense.photos?.length}
        {@const [first_photo] = first_sense.photos}
        <div class="media-thumb photo-block">
          <Image
            square={192}
            title={headword.value}
            photo={first_photo}
            photos={first_sense.photos}
            photo_source={first_photo.source}
            photographer={first_photo.photographer}
            {can_edit}
            on_delete_image={photo_id => writes.delete_photo(photo_id ?? first_photo.id)} />
          {#if first_sense.photos.length > 1}
            <IconFluentImageStack20Regular class="photo-stack-icon" />
          {/if}
        </div>
      {/if}
    </div>
  {/if}
</div>

{#if menu_open}
  <Popover anchor={menu_anchor} on_close={() => menu_open = false} max_width="14rem">
    <div class="menu-items">
      <button type="button" class="menu-item" onclick={() => { menu_open = false; open_modal = 'audio' }}>
        <IconMaterialSymbolsHearing />
        {entry.audios?.[0] ? page.data.t('audio.edit_audio') : page.data.t('audio.add_audio')}
      </button>
      {#if first_sense.id}
        <button type="button" class="menu-item" onclick={() => { menu_open = false; open_modal = 'photo' }}>
          <IconIcOutlineCameraAlt />
          {page.data.t('entry.upload_photo')}
        </button>
        {#if !dictionary.con_language_description}
          <button type="button" class="menu-item" onclick={() => { menu_open = false; open_modal = 'video' }}>
            <IconBiCameraVideo />
            {page.data.t('video.add_video')}
          </button>
        {/if}
      {/if}
    </div>
  </Popover>
{/if}

{#if open_modal === 'audio'}
  {#await import('$lib/components/audio/EditAudio.svelte') then { default: EditAudio }}
    <EditAudio {entry} sound_file={entry.audios?.[0] || null} initial_file={dropped_file} context="list" on_close={close_modal} />
  {/await}
{:else if open_modal === 'photo'}
  {#await import('$lib/components/image/EditImage.svelte') then { default: EditImage }}
    <EditImage sense_id={first_sense.id} initial_file={dropped_file} context="list" on_close={close_modal} />
  {/await}
{:else if open_modal === 'video'}
  {#await import('$lib/components/video/AddVideo.svelte') then { default: AddVideo }}
    <AddVideo {entry} initial_file={dropped_file} context="list" on_close={close_modal} />
  {/await}
{/if}

<style>
  .entry-row {
    position: relative;
    display: flex;
    align-items: center;
    gap: 0.375rem;
    padding: 0.5rem 0.625rem;
    background-color: var(--surface);
    border-radius: 0.75rem;
    margin-bottom: 0.5rem;
    transition: background-color var(--transition-time, 150ms);
  }

  .entry-row:hover {
    background-color: color-mix(in srgb, var(--color) 4%, var(--surface));
  }

  .recently-updated {
    box-shadow: inset 0 -2px 0 var(--success);
  }

  .dragging {
    outline: 1px dashed var(--primary);
    outline-offset: -1px;
    background-color: color-mix(in srgb, var(--primary) 8%, var(--surface));
  }

  /* The ear floats over the first (headword) line only — following lines run
     full width so the play button reads as part of the headword. */
  .entry-row :global(.list-audio-cell) {
    position: absolute;
    left: 0.625rem;
    top: 0.4375rem;
  }

  .has-audio .headword-line {
    padding-left: 2.125rem;
  }

  .entry-link {
    flex-grow: 1;
    min-width: 0;
  }

  .headword-line {
    font-size: 1.0625rem;
    line-height: 1.5rem;
  }

  .lexeme {
    font-weight: 600;
    color: var(--color);
    margin-right: 0.25rem;
  }

  .homograph {
    font-weight: 400;
    opacity: 0.7;
    margin-left: 0.05em;
  }

  .phonetic {
    margin-right: 0.25rem;
    color: var(--color-secondary);
    font-size: 0.875rem;
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

  .gloss-line,
  .senses-block,
  .definition-line,
  .extra-line {
    font-size: 0.8125rem;
    line-height: 1.125rem;
    color: color-mix(in srgb, var(--color) 78%, var(--background));
    margin-top: 0.125rem;
  }

  .definition-line,
  .extra-line {
    color: var(--color-secondary);
  }

  .definition-line {
    overflow: hidden;
    display: -webkit-box;
    -webkit-box-orient: vertical;
    -webkit-line-clamp: 2;
  }

  .senses-block {
    overflow: hidden;
    display: -webkit-box;
    -webkit-box-orient: vertical;
    -webkit-line-clamp: 4;
  }

  .sense {
    margin-right: 0.375rem;
  }

  .sense-num {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 0.9375rem;
    height: 0.9375rem;
    border-radius: 50%;
    background: color-mix(in srgb, var(--color) 10%, transparent);
    color: var(--color-secondary);
    font-size: 0.625rem;
    font-weight: 600;
    vertical-align: 0.0625rem;
    margin-right: 0.1875rem;
  }

  .chips-line {
    display: flex;
    flex-wrap: wrap;
    gap: 0.25rem;
    margin-top: 0.25rem;
  }

  .sd-chip {
    padding: 0.125rem 0.5rem;
    line-height: 1.25;
    font-size: 0.6875rem;
    color: var(--color-secondary);
    background-color: color-mix(in srgb, var(--color) 7%, transparent);
    border-radius: 9999px;
  }

  /* Right media rail. FLUSH (default): stretches to the card's top/right/bottom
     edges via negative margins, thumbs fill the full row height as squares, and
     the card radius clips the outer corners. FLOATING (row taller than the
     thumb cap): centered fixed-size rounded thumbs on plain card background. */
  .media-rail {
    align-self: stretch;
    flex-shrink: 0;
    display: flex;
    gap: 2px;
    margin: -0.5rem -0.625rem -0.5rem 0.125rem;
    border-radius: 0 0.75rem 0.75rem 0;
    overflow: hidden;
  }

  .media-thumb {
    position: relative;
    height: 100%;
    width: var(--flush-thumb-width, 3.5rem);
    flex-shrink: 0;
    border: none;
    padding: 0;
    overflow: hidden;
    background: color-mix(in srgb, var(--color) 8%, transparent);
  }

  .media-rail.floating {
    align-self: center;
    margin: 0 0 0 0.125rem;
    border-radius: 0;
    overflow: visible;
  }

  .media-rail.floating .media-thumb {
    height: 5.5rem;
    width: 5.5rem;
    border-radius: 0.5rem;
  }

  .video-thumb {
    display: flex;
    align-items: center;
    justify-content: center;
    color: var(--color-secondary);
    cursor: pointer;
  }

  .video-thumb img {
    position: absolute;
    inset: 0;
    width: 100%;
    height: 100%;
    object-fit: cover;
  }

  .play-overlay {
    position: relative;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 1.75rem;
    height: 1.75rem;
    border-radius: 50%;
    background: rgb(0 0 0 / 0.55);
    color: #fff;
    pointer-events: none;
  }

  .icon-button {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 2.125rem;
    height: 2.125rem;
    border: none;
    border-radius: 50%;
    background: transparent;
    color: var(--color-secondary);
    cursor: pointer;
    transition: background var(--transition-time, 150ms), transform 75ms;
  }

  .icon-button:hover {
    background: color-mix(in srgb, var(--color) 8%, transparent);
  }

  .icon-button:active {
    transform: scale(0.93);
  }

  .photo-block :global(.photo-stack-icon) {
    color: #fff;
    position: absolute;
    bottom: 0.125rem;
    right: 0.125rem;
    font-size: 1rem;
    filter: drop-shadow(0 1px 2px rgb(0 0 0 / 0.6));
    pointer-events: none;
  }

  .menu-items {
    display: flex;
    flex-direction: column;
    gap: 0.125rem;
  }

  .menu-item {
    display: flex;
    align-items: center;
    gap: 0.625rem;
    padding: 0.5rem 0.625rem;
    border: none;
    background: transparent;
    color: var(--color);
    font-size: 0.875rem;
    text-align: start;
    border-radius: 0.5rem;
    cursor: pointer;
  }

  .menu-item:hover {
    background: color-mix(in srgb, var(--color) 7%, transparent);
  }
</style>
