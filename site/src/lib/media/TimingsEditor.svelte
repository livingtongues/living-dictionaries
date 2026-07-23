<script lang="ts">
  import { page } from '$app/state'
  import { portal } from '$lib/utils/portal'
  import IconMdiPlay from '~icons/mdi/play'
  import IconMdiPause from '~icons/mdi/pause'
  import IconMdiChevronLeft from '~icons/mdi/chevron-left'
  import IconMdiChevronRight from '~icons/mdi/chevron-right'
  import IconMdiClose from '~icons/mdi/close'
  import IconSvgSpinners3DotsFade from '~icons/svg-spinners/3-dots-fade'
  import type { DictRowType } from '$lib/db/dict-client/dict-live-db.svelte'
  import { decode_audio_buffer } from '$lib/components/audio/waveform-utils'
  import { clamp_edge, encode_all_timings, init_editor_spans } from './timings-editor-state'

  interface Props {
    audio: DictRowType<'audio'>
    audio_url: string
    /** Reading-order sentences; token_forms index-align with the timing pipe parts. */
    sentences: { id: string, token_forms: (string | undefined)[] }[]
    on_close: () => void
  }

  const { audio, audio_url, sentences, on_close }: Props = $props()

  const ordered_ids = sentences.map(sentence => sentence.id)
  // Snapshot once — drags mutate these spans until save.
  const spans_by_sentence = $state(init_editor_spans({ ordered_sentence_ids: ordered_ids, timings: audio.timings }))
  const timed_sentences = sentences.filter(sentence => spans_by_sentence[sentence.id]?.some(Boolean))

  let nav_index = $state(0)
  const current = $derived(timed_sentences[nav_index])
  const current_spans = $derived(current ? spans_by_sentence[current.id] : [])

  let dirty = $state(false)
  let saving = $state(false)

  // --- audio decode (waveform) + playback ---
  let channel_data = $state<Float32Array | null>(null)
  let sample_rate = 0
  let duration_ms = $state(0)
  let decode_failed = $state(false)

  $effect(() => {
    let cancelled = false
    fetch(audio_url)
      .then(response => response.arrayBuffer())
      .then(decode_audio_buffer)
      .then((buffer) => {
        if (cancelled) return
        channel_data = buffer.getChannelData(0)
        sample_rate = buffer.sampleRate
        duration_ms = buffer.duration * 1000
      })
      .catch(() => decode_failed = true)
    return () => cancelled = true
  })

  let audio_element = $state<HTMLAudioElement | null>(null)
  let playing = $state(false)
  let current_ms = $state(0)
  let stop_at_ms: number | null = null

  // timeupdate is too coarse (~4 Hz) to verify 20ms boundary drags — poll via rAF while playing.
  $effect(() => {
    if (!playing) return
    let frame = 0
    const tick = () => {
      if (audio_element) {
        current_ms = audio_element.currentTime * 1000
        if (stop_at_ms !== null && current_ms >= stop_at_ms) {
          audio_element.pause()
          stop_at_ms = null
        }
      }
      frame = requestAnimationFrame(tick)
    }
    frame = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(frame)
  })

  function play_span({ start_ms, end_ms }: { start_ms: number, end_ms: number }) {
    if (!audio_element) return
    stop_at_ms = end_ms
    audio_element.currentTime = start_ms / 1000
    current_ms = start_ms
    void audio_element.play()
  }

  // --- window (sentence-scoped zoom) ---
  const window_bounds = $derived.by(() => {
    const timed = current_spans.filter(Boolean) as { start_ms: number, end_ms: number }[]
    if (!timed.length)
      return { start_ms: 0, end_ms: Math.max(duration_ms, 1000) }
    const first = timed[0].start_ms
    const last = timed[timed.length - 1].end_ms
    const pad = Math.max((last - first) * 0.08, 300)
    return {
      start_ms: Math.max(0, first - pad),
      end_ms: Math.min(duration_ms || last + pad, last + pad),
    }
  })
  const window_duration = $derived(window_bounds.end_ms - window_bounds.start_ms)

  function to_percent(ms: number): number {
    return ((ms - window_bounds.start_ms) / window_duration) * 100
  }

  // Cross-sentence clamps: previous sentence's last timed end / next sentence's first timed start.
  const clamp_bounds = $derived.by(() => {
    let floor_ms = 0
    for (let i = nav_index - 1; i >= 0; i--) {
      const spans = spans_by_sentence[timed_sentences[i].id]?.filter(Boolean)
      if (spans?.length) {
        floor_ms = spans[spans.length - 1].end_ms
        break
      }
    }
    let ceiling_ms = duration_ms || Number.MAX_SAFE_INTEGER
    for (let i = nav_index + 1; i < timed_sentences.length; i++) {
      const spans = spans_by_sentence[timed_sentences[i].id]?.filter(Boolean)
      if (spans?.length) {
        ceiling_ms = spans[0].start_ms
        break
      }
    }
    return { floor_ms, ceiling_ms }
  })

  // --- waveform canvas ---
  let canvas = $state<HTMLCanvasElement | null>(null)
  let strip = $state<HTMLDivElement | null>(null)
  let strip_width = $state(0)

  $effect(() => {
    if (!strip) return
    const observer = new ResizeObserver(entries => strip_width = entries[0].contentRect.width)
    observer.observe(strip)
    return () => observer.disconnect()
  })

  $effect(() => {
    if (!canvas || !channel_data || !strip_width || !window_duration) return
    draw_waveform()
  })

  function draw_waveform() {
    const context = canvas.getContext('2d')
    if (!context || !channel_data) return
    const pixel_ratio = window.devicePixelRatio || 1
    const height = 120
    canvas.width = strip_width * pixel_ratio
    canvas.height = height * pixel_ratio
    canvas.style.width = `${strip_width}px`
    canvas.style.height = `${height}px`
    context.scale(pixel_ratio, pixel_ratio)
    context.clearRect(0, 0, strip_width, height)

    const start_sample = Math.max(0, Math.floor((window_bounds.start_ms / 1000) * sample_rate))
    const end_sample = Math.min(channel_data.length, Math.ceil((window_bounds.end_ms / 1000) * sample_rate))
    const samples_per_pixel = Math.max(1, Math.floor((end_sample - start_sample) / strip_width))

    // Normalize against the window's own max so quiet clips stay readable.
    let window_max = 0
    for (let i = start_sample; i < end_sample; i++) {
      const value = Math.abs(channel_data[i])
      if (value > window_max) window_max = value
    }
    const scale = window_max ? 1 / window_max : 1

    const mid = height / 2
    const styles = getComputedStyle(canvas)
    context.fillStyle = styles.getPropertyValue('--color-secondary') || '#94a3b8'
    context.globalAlpha = 0.75
    for (let x = 0; x < strip_width; x++) {
      const from = start_sample + x * samples_per_pixel
      let max = 0
      for (let i = from; i < from + samples_per_pixel && i < end_sample; i++) {
        const value = Math.abs(channel_data[i])
        if (value > max) max = value
      }
      const bar = Math.max(1, max * scale * (mid - 4))
      context.fillRect(x, mid - bar, 1, bar * 2)
    }
    context.globalAlpha = 1
  }

  // --- dragging ---
  let drag = $state<{ index: number, edge: 'start' | 'end', grab_offset_ms: number } | null>(null)

  function pointer_ms(event: PointerEvent): number {
    const rect = strip.getBoundingClientRect()
    return window_bounds.start_ms + ((event.clientX - rect.left) / rect.width) * window_duration
  }

  function edge_pointerdown(event: PointerEvent, index: number, edge: 'start' | 'end') {
    event.preventDefault()
    event.stopPropagation()
    const span = current_spans[index]
    if (!span || !strip) return
    // Handles sit inside the region — remember where on the handle the grab
    // landed so the edge doesn't jump to the pointer.
    const edge_ms = edge === 'start' ? span.start_ms : span.end_ms
    drag = { index, edge, grab_offset_ms: pointer_ms(event) - edge_ms }
    ;(event.currentTarget as HTMLElement).setPointerCapture(event.pointerId)
  }

  function edge_pointermove(event: PointerEvent) {
    if (!drag || !strip) return
    const to_ms = pointer_ms(event) - drag.grab_offset_ms
    const clamped = clamp_edge({
      token_spans: current_spans,
      index: drag.index,
      edge: drag.edge,
      to_ms,
      floor_ms: clamp_bounds.floor_ms,
      ceiling_ms: clamp_bounds.ceiling_ms,
    })
    const span = current_spans[drag.index]
    if (!span) return
    if (drag.edge === 'start')
      span.start_ms = clamped
    else
      span.end_ms = clamped
    dirty = true
  }

  function edge_pointerup(event: PointerEvent) {
    if (!drag) return
    const span = current_spans[drag.index]
    drag = null
    // Verify loop: hear the adjusted word right away.
    if (span)
      play_span({ start_ms: span.start_ms, end_ms: span.end_ms })
    event.stopPropagation()
  }

  function strip_click(event: MouseEvent) {
    if (!strip || !audio_element) return
    const rect = strip.getBoundingClientRect()
    const ratio = (event.clientX - rect.left) / rect.width
    stop_at_ms = window_bounds.end_ms
    const ms = window_bounds.start_ms + ratio * window_duration
    audio_element.currentTime = ms / 1000
    current_ms = ms
    void audio_element.play()
  }

  function toggle_play() {
    if (!audio_element) return
    if (playing) {
      audio_element.pause()
      return
    }
    play_span({ start_ms: window_bounds.start_ms, end_ms: window_bounds.end_ms })
  }

  function go(delta: number) {
    const next = nav_index + delta
    if (next < 0 || next >= timed_sentences.length) return
    audio_element?.pause()
    nav_index = next
  }

  function close() {
    if (dirty && !confirm(`${page.data.t('misc.cancel')}?`)) return
    on_close()
  }

  async function save() {
    if (saving) return
    saving = true
    try {
      const timings = encode_all_timings({
        ordered_sentence_ids: ordered_ids,
        spans_by_sentence,
        original_timings: audio.timings,
      })
      await page.data.writes.update_audio({ id: audio.id, timings })
      on_close()
    } finally {
      saving = false
    }
  }

  function keydown(event: KeyboardEvent) {
    if (event.key === 'Escape') close()
    if (event.key === 'ArrowLeft') go(-1)
    if (event.key === 'ArrowRight') go(1)
    if (event.key === ' ' && (event.target as HTMLElement)?.tagName !== 'BUTTON') {
      event.preventDefault()
      toggle_play()
    }
  }
</script>

<svelte:window onkeydown={keydown} />

<div class="timings-editor" use:portal>
  <header>
    <div class="title">{page.data.t('timings.editor_title')}</div>
    <div style="flex-grow: 1"></div>
    <button type="button" class="btn-primary btn-sm" disabled={!dirty || saving} onclick={save}>
      {#if saving}<IconSvgSpinners3DotsFade />{/if}
      {page.data.t('misc.save')}
    </button>
    <button type="button" class="btn-outline btn-sm" title={page.data.t('misc.close')} onclick={close}>
      <IconMdiClose />
    </button>
  </header>

  {#if !timed_sentences.length}
    <div class="state-note">{page.data.t('timings.no_timings')}</div>
  {:else}
    <div class="nav-row">
      <button type="button" class="btn-outline btn-sm" disabled={nav_index === 0} onclick={() => go(-1)}>
        <IconMdiChevronLeft />
      </button>
      <span class="nav-label">
        {page.data.t('timings.sentence_of', { values: { position: String(nav_index + 1), total: String(timed_sentences.length) } })}
      </span>
      <button type="button" class="btn-outline btn-sm" disabled={nav_index === timed_sentences.length - 1} onclick={() => go(1)}>
        <IconMdiChevronRight />
      </button>
      <div style="flex-grow: 1"></div>
      <button type="button" class="btn-outline btn-sm" onclick={toggle_play}>
        {#if playing}<IconMdiPause />{:else}<IconMdiPlay />{/if}
      </button>
    </div>

    <div class="sentence-preview">
      {#each current?.token_forms ?? [] as form, index (index)}{#if current_spans[index]}<span
        class="preview-token"
        class:speaking={playing && current_ms >= current_spans[index].start_ms && current_ms < current_spans[index].end_ms}>{form}</span>{:else}<span class="preview-token untimed">{form}</span>{/if}{/each}
    </div>

    <div class="strip-wrap">
      {#if !channel_data && !decode_failed}
        <div class="state-note"><IconSvgSpinners3DotsFade /></div>
      {:else if decode_failed}
        <div class="state-note">{page.data.t('audio.unavailable')}</div>
      {/if}
      <div class="strip-scroll">
        <div
          bind:this={strip}
          class="strip"
          class:hidden={!channel_data}
          style="min-width: {Math.round((window_duration / 1000) * 100)}px"
          role="presentation"
          onclick={strip_click}>
          <canvas bind:this={canvas}></canvas>

          {#if playing && current_ms >= window_bounds.start_ms && current_ms <= window_bounds.end_ms}
            <div class="playhead" style="left: {to_percent(current_ms)}%"></div>
          {/if}

          {#each current_spans as span, index (index)}
            {#if span}
              <div
                class="region"
                class:dragging={drag?.index === index}
                style="left: {to_percent(span.start_ms)}%; width: {to_percent(span.end_ms) - to_percent(span.start_ms)}%"
                role="presentation"
                onclick={(event) => { event.stopPropagation(); play_span(span) }}>
                <span class="region-label" class:staggered={index % 2 === 1}>{current?.token_forms[index] ?? ''}</span>
                <div
                  class="handle handle-start"
                  role="presentation"
                  onpointerdown={event => edge_pointerdown(event, index, 'start')}
                  onpointermove={edge_pointermove}
                  onpointerup={edge_pointerup}></div>
                <div
                  class="handle handle-end"
                  role="presentation"
                  onpointerdown={event => edge_pointerdown(event, index, 'end')}
                  onpointermove={edge_pointermove}
                  onpointerup={edge_pointerup}></div>
              </div>
            {/if}
          {/each}
        </div>
      </div>
    </div>

    <div class="hint">{page.data.t('timings.drag_hint')}</div>
  {/if}

  <audio bind:this={audio_element} src={audio_url} preload="auto" onplay={() => playing = true} onpause={() => playing = false} onended={() => playing = false}></audio>
</div>

<style>
  .timings-editor {
    position: fixed;
    inset: 0;
    z-index: 70;
    background: var(--surface);
    display: flex;
    flex-direction: column;
    padding: 0.75rem 1rem;
    gap: 0.75rem;
    overflow-y: auto;
  }

  header {
    display: flex;
    align-items: center;
    gap: 0.5rem;
  }

  .title {
    font-weight: 600;
  }

  .nav-row {
    display: flex;
    align-items: center;
    gap: 0.5rem;
  }

  .nav-label {
    font-size: 0.8125rem;
    color: var(--color-secondary);
    font-variant-numeric: tabular-nums;
  }

  .sentence-preview {
    font-size: 1.125rem;
    line-height: 1.7;
  }

  .preview-token {
    border-radius: 0.25rem;
    padding: 0.05em 0.02em;
  }

  .preview-token.speaking {
    background: var(--primary);
    color: var(--on-primary);
  }

  .preview-token.untimed {
    opacity: 0.5;
  }

  .strip-wrap {
    position: relative;
  }

  .strip-scroll {
    overflow-x: auto;
  }

  .strip {
    position: relative;
    height: 200px;
    touch-action: pan-y pan-x;
    cursor: pointer;
  }

  .strip.hidden {
    visibility: hidden;
  }

  .strip canvas {
    position: absolute;
    top: 50px;
    left: 0;
  }

  .playhead {
    position: absolute;
    top: 40px;
    bottom: 0;
    width: 2px;
    background: var(--primary);
    pointer-events: none;
    z-index: 3;
  }

  .region {
    position: absolute;
    top: 50px;
    height: 120px;
    background: color-mix(in srgb, var(--primary) 14%, transparent);
    border: 1px solid color-mix(in srgb, var(--primary) 45%, transparent);
    border-radius: 0.375rem;
    z-index: 2;
    cursor: pointer;
  }

  .region.dragging {
    background: color-mix(in srgb, var(--primary) 26%, transparent);
  }

  .region-label {
    position: absolute;
    top: -1.5rem;
    left: 50%;
    transform: translateX(-50%);
    font-size: 0.8125rem;
    white-space: nowrap;
    color: var(--color);
    pointer-events: none;
  }

  /* Alternate label rows so narrow adjacent words don't collide. */
  .region-label.staggered {
    top: -2.75rem;
  }

  /* Handles live INSIDE their region — straddling the edge made adjacent
     regions' handles overlap across small inter-word gaps, so drags grabbed
     the wrong token. */
  .handle {
    position: absolute;
    top: 0;
    bottom: 0;
    width: 14px;
    max-width: 45%;
    cursor: ew-resize;
    touch-action: none;
    z-index: 4;
  }

  .handle::after {
    content: '';
    position: absolute;
    top: 0;
    bottom: 0;
    width: 3px;
    background: var(--primary);
    border-radius: 2px;
  }

  .handle-start {
    left: 0;
  }

  .handle-start::after {
    left: 0;
  }

  .handle-end {
    right: 0;
  }

  .handle-end::after {
    right: 0;
  }

  .hint {
    font-size: 0.8125rem;
    color: var(--color-secondary);
  }

  .state-note {
    padding: 2rem 0;
    color: var(--color-secondary);
  }
</style>
