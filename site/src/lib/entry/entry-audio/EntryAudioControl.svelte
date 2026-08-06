<script lang="ts">
  import { fade } from 'svelte/transition'
  import { page } from '$app/state'
  import Popover from '$lib/components/ui/Popover.svelte'
  import { portal } from '$lib/utils/portal'
  import { track } from '$lib/debug/remote-log'
  import { AUDIO_PLAYED } from '$lib/debug/log-events'
  import { audio_option_labels } from './audio-option-labels'
  import type { AudioOption, AudioOptionInput } from './audio-option-labels'
  import { entry_audio } from './entry-audio-state.svelte'
  import IconMaterialSymbolsHearing from '~icons/material-symbols/hearing'
  import IconMdiPlay from '~icons/mdi/play'
  import IconMdiPause from '~icons/mdi/pause'

  interface Props {
    /** Ordered (created_at ASC) — see `from_entry_audios`. */
    audios: AudioOptionInput[]
    entry_id: string
    /** Telemetry context — which compact surface this control sits on. */
    surface: 'list' | 'table' | 'gallery' | 'home'
    /** 'tint' = primary-tinted circle (list/table); 'overlay' = white glass circle over photo cards. */
    appearance?: 'tint' | 'overlay'
    /** Headword, for the accessible play/pause label. */
    entry_name?: string
    class?: string
  }

  const { audios, entry_id, surface, appearance = 'tint', entry_name = '', class: klass = '' }: Props = $props()

  const t = $derived(page.data.t)
  const options = $derived(audio_option_labels(audios))
  const multiple = $derived(options.length > 1)
  const playing_here = $derived(options.some(option => entry_audio.is_active(option.id)))

  let trigger_el = $state<HTMLButtonElement | null>(null)
  let panel_open = $state(false)
  let transient = $state<{ name: string, top?: number, bottom?: number, left?: number, right?: number } | null>(null)
  let transient_timeout: ReturnType<typeof setTimeout> | undefined

  function play_option(option: AudioOption) {
    const dictionary_id = page.params.dictionaryId
    track({ event: AUDIO_PLAYED, props: { dictionary_id, entry_id, audio_id: option.id, context: surface } })
    entry_audio.play({
      audio_id: option.id,
      storage_path: option.storage_path,
      context: { dictionary_id, entry_id, context: surface },
      failure_message: t('audio.playback_failed'),
    })
  }

  /** Brief speaker attribution beside a single-recording control (multi shows names in the panel). */
  function show_transient_name(option: AudioOption) {
    if (option.no_speaker || !trigger_el) return
    const rect = trigger_el.getBoundingClientRect()
    transient = {
      name: option.label,
      // Above the control when there's room, below it near the viewport top.
      ...(rect.top > 44
        ? { bottom: window.innerHeight - rect.top + 6 }
        : { top: rect.bottom + 6 }),
      ...(rect.left > window.innerWidth / 2
        ? { right: window.innerWidth - rect.right }
        : { left: rect.left }),
    }
    clearTimeout(transient_timeout)
    transient_timeout = setTimeout(() => transient = null, 2000)
  }

  function on_trigger_click(event: MouseEvent) {
    // The control can sit inside a card <a> (home strip) — never navigate.
    event.preventDefault()
    event.stopPropagation()
    if (multiple) {
      panel_open = true
      // First tap = reveal + play recording 1; reopening while one is already
      // sounding just shows the panel without restarting.
      if (!playing_here)
        play_option(options[0])
      return
    }
    if (playing_here) {
      entry_audio.stop()
      return
    }
    play_option(options[0])
    show_transient_name(options[0])
  }

  function on_row_click(option: AudioOption) {
    if (entry_audio.is_active(option.id))
      entry_audio.stop()
    else
      play_option(option)
  }

  function close_panel() {
    // Dismissal never stops audio — the collapsed control keeps its playing state.
    panel_open = false
    trigger_el?.focus()
  }
</script>

{#if options.length}
  <button
    bind:this={trigger_el}
    type="button"
    class="{klass} trigger {appearance}"
    class:playing={playing_here}
    aria-pressed={playing_here}
    aria-expanded={multiple ? panel_open : undefined}
    title={!multiple && !options[0].no_speaker ? `${t('audio.listen')} — ${options[0].label}` : t('audio.listen')}
    aria-label="{playing_here ? t('misc.pause') : t('misc.play')}{entry_name ? ` ${entry_name}` : ''}{multiple ? ` (${options.length})` : !options[0].no_speaker ? ` — ${options[0].label}` : ''}"
    onclick={on_trigger_click}>
    <IconMaterialSymbolsHearing style="font-size: 1.125rem" />
    {#if multiple}
      <span class="badge" aria-hidden="true">{options.length}</span>
    {/if}
  </button>
{/if}

{#if panel_open && trigger_el}
  <Popover anchor={trigger_el} on_close={close_panel} max_width="16rem">
    <div class="rows">
      {#each options as option (option.id)}
        {@const active = entry_audio.is_active(option.id)}
        <button
          type="button"
          class="row"
          class:active
          aria-pressed={active}
          onclick={() => on_row_click(option)}>
          {#if active}
            <IconMdiPause style="font-size: 0.875rem; flex-shrink: 0" />
          {:else}
            <IconMdiPlay style="font-size: 0.875rem; flex-shrink: 0; opacity: 0.65" />
          {/if}
          <span class="name" class:no-speaker={option.no_speaker}>{option.label}</span>
          {#if option.ordinal}
            <span class="ordinal">{option.ordinal}</span>
          {/if}
        </button>
      {/each}
    </div>
  </Popover>
{/if}

{#if transient}
  <div
    use:portal
    class="transient-name"
    transition:fade={{ duration: 150 }}
    style:top={transient.top !== undefined ? `${transient.top}px` : undefined}
    style:bottom={transient.bottom !== undefined ? `${transient.bottom}px` : undefined}
    style:left={transient.left !== undefined ? `${transient.left}px` : undefined}
    style:right={transient.right !== undefined ? `${transient.right}px` : undefined}>
    {transient.name}
  </div>
{/if}

<style>
  .trigger {
    position: relative;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    flex-shrink: 0;
    width: 1.75rem;
    height: 1.75rem;
    border: none;
    border-radius: 50%;
    cursor: pointer;
    transition: background var(--transition-time, 150ms), transform 75ms;
  }

  .trigger:active {
    transform: scale(0.93);
  }

  .trigger.tint {
    background: color-mix(in srgb, var(--primary) 12%, transparent);
    color: var(--primary);
  }

  .trigger.tint:hover {
    background: color-mix(in srgb, var(--primary) 22%, transparent);
  }

  .trigger.tint.playing {
    background: var(--primary);
    color: var(--on-primary);
  }

  /* Same visual language as the photo-card overlay buttons (gallery/home). */
  .trigger.overlay {
    width: 2rem;
    height: 2rem;
    background: rgb(255 255 255 / 0.22);
    backdrop-filter: blur(4px);
    color: white;
    font-size: 1rem;
  }

  .trigger.overlay:hover,
  .trigger.overlay.playing {
    background: rgb(255 255 255 / 0.42);
  }

  .badge {
    position: absolute;
    top: -0.3125rem;
    right: -0.4375rem;
    min-width: 1rem;
    height: 1rem;
    padding: 0 0.1875rem;
    border-radius: 0.5rem;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 0.59375rem;
    font-weight: 700;
    background: var(--primary);
    color: var(--on-primary);
  }

  .tint .badge {
    box-shadow: 0 0 0 2px var(--background);
  }

  .overlay .badge {
    box-shadow: 0 1px 2px rgb(0 0 0 / 0.35);
  }

  .rows {
    display: flex;
    flex-direction: column;
    gap: 0.125rem;
    min-width: 9rem;
  }

  .row {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    padding: 0.4375rem 0.5625rem;
    border: none;
    border-radius: 0.4375rem;
    background: transparent;
    color: inherit;
    font-size: 0.8125rem;
    text-align: start;
    cursor: pointer;
    /* color must travel WITH background — instant color on a transitioning background flashes white-on-white. */
    transition: background var(--transition-time, 150ms), color var(--transition-time, 150ms);
  }

  .row:hover {
    background: color-mix(in srgb, var(--color) 8%, transparent);
  }

  .row.active {
    background: var(--primary);
    color: var(--on-primary);
  }

  .name {
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .name.no-speaker {
    font-style: italic;
    opacity: 0.7;
  }

  .row.active .name.no-speaker {
    opacity: 0.9;
  }

  .ordinal {
    flex-shrink: 0;
    font-size: 0.6875rem;
    opacity: 0.55;
  }

  .transient-name {
    position: fixed;
    z-index: 80;
    max-width: 14rem;
    padding: 0.25rem 0.5625rem;
    border-radius: 9999px;
    background: var(--surface);
    color: var(--color);
    border: 1px solid var(--border-color);
    box-shadow: 0 4px 12px rgb(0 0 0 / 0.15);
    font-size: 0.75rem;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    pointer-events: none;
  }
</style>
