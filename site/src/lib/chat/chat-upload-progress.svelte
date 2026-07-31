<script lang="ts">
  import type { UploadProgress } from './chat-upload'
  import IconMdiAlertCircleOutline from '~icons/mdi/alert-circle-outline'
  import IconMdiCheckCircleOutline from '~icons/mdi/check-circle-outline'
  import IconMdiClose from '~icons/mdi/close'
  import IconMdiFileOutline from '~icons/mdi/file-outline'
  import IconMdiImageOutline from '~icons/mdi/image-outline'
  import IconMdiMusicNote from '~icons/mdi/music-note'
  import IconMdiVideoOutline from '~icons/mdi/video-outline'
  import { format_bytes, is_audio_mimetype, is_image_mimetype, is_video_mimetype } from './attachments'
  import { format_rate, format_time_remaining, overall_progress } from './chat-upload'

  interface Props {
    entries: UploadProgress[]
    on_cancel?: () => void
  }
  const { entries, on_cancel }: Props = $props()

  const overall = $derived(overall_progress(entries))
  const show_overall = $derived(entries.length > 1)
  /** Nothing in flight, but something failed or was cancelled — the panel needs a way out. */
  const finished_badly = $derived(!overall.active && entries.some(entry => entry.status === 'error' || entry.status === 'cancelled'))

  function percent(fraction: number): string {
    return `${Math.round(fraction * 100)}%`
  }
</script>

{#if entries.length}
  <div class="uploads" aria-live="polite">
    {#if show_overall}
      <div class="overall">
        <div class="overall-label">
          <span>{overall.active ? 'Uploading' : 'Uploaded'} {entries.length} files</span>
          <span class="overall-count">{format_bytes(overall.bytes_sent)} / {format_bytes(overall.bytes_total)}</span>
        </div>
        <div class="track" role="progressbar" aria-valuenow={Math.round(overall.fraction * 100)} aria-valuemin="0" aria-valuemax="100">
          <div class="fill" style:width={percent(overall.fraction)}></div>
        </div>
      </div>
    {/if}

    {#each entries as entry (entry.index)}
      {@const { mimetype } = entry}
      <div class={['row', entry.status]}>
        <span class="kind">
          {#if entry.status === 'done'}
            <IconMdiCheckCircleOutline style="color: var(--success)" />
          {:else if entry.status === 'error'}
            <IconMdiAlertCircleOutline style="color: var(--danger)" />
          {:else if is_video_mimetype(mimetype)}
            <IconMdiVideoOutline />
          {:else if is_audio_mimetype(mimetype)}
            <IconMdiMusicNote />
          {:else if is_image_mimetype(mimetype)}
            <IconMdiImageOutline />
          {:else}
            <IconMdiFileOutline />
          {/if}
        </span>

        <div class="details">
          <div class="line">
            <span class="name">{entry.filename}</span>
            <span class="percent">
              {#if entry.status === 'error'}Failed
              {:else if entry.status === 'cancelled'}Cancelled
              {:else if entry.status === 'done'}Uploaded
              {:else}{percent(entry.fraction)}{/if}
            </span>
          </div>

          <div class="track" role="progressbar" aria-valuenow={Math.round(entry.fraction * 100)} aria-valuemin="0" aria-valuemax="100" aria-label={`Upload progress for ${entry.filename}`}>
            <div class="fill" style:width={percent(entry.fraction)}></div>
          </div>

          <div class="meta">
            {#if entry.status === 'error'}
              <span class="error-text">{entry.error_message}</span>
            {:else if entry.status === 'waiting'}
              <span>Waiting…</span>
            {:else}
              <span>{format_bytes(entry.bytes_sent)} / {format_bytes(entry.bytes_total)}</span>
              {#if entry.status === 'uploading'}
                {#if format_rate(entry.bytes_per_second)}<span class="dot">·</span><span>{format_rate(entry.bytes_per_second)}</span>{/if}
                {#if format_time_remaining(entry.seconds_remaining)}<span class="dot">·</span><span>{format_time_remaining(entry.seconds_remaining)}</span>{/if}
              {/if}
            {/if}
          </div>
        </div>
      </div>
    {/each}

    {#if on_cancel && (overall.active || finished_badly)}
      <button type="button" class="cancel" onclick={() => on_cancel()}>
        <IconMdiClose /> {overall.active ? 'Cancel upload' : 'Dismiss'}
      </button>
    {/if}
  </div>
{/if}

<style>
  .uploads {
    display: flex;
    flex-direction: column;
    gap: 0.625rem;
    padding: 0.75rem;
    background: var(--surface);
    border-radius: 0.75rem;
  }
  .overall {
    display: flex;
    flex-direction: column;
    gap: 0.35rem;
    padding-bottom: 0.5rem;
    border-bottom: 1px solid var(--border-color);
  }
  .overall-label {
    display: flex;
    justify-content: space-between;
    gap: 0.5rem;
    font-size: 0.8rem;
    font-weight: 600;
  }
  .overall-count {
    font-weight: 400;
    color: var(--color-secondary);
  }
  .row {
    display: flex;
    align-items: flex-start;
    gap: 0.5rem;
    min-width: 0;
  }
  .kind {
    display: inline-flex;
    padding-top: 0.1rem;
    color: var(--color-secondary);
    flex-shrink: 0;
  }
  .details {
    display: flex;
    flex-direction: column;
    gap: 0.25rem;
    flex: 1;
    min-width: 0;
  }
  .line {
    display: flex;
    align-items: baseline;
    justify-content: space-between;
    gap: 0.5rem;
    font-size: 0.8rem;
    min-width: 0;
  }
  .name {
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    min-width: 0;
  }
  .percent {
    flex-shrink: 0;
    font-variant-numeric: tabular-nums;
    font-weight: 600;
    color: var(--color-secondary);
  }
  .track {
    height: 5px;
    border-radius: 999px;
    background: color-mix(in srgb, transparent, var(--color) 12%);
    overflow: hidden;
  }
  .fill {
    height: 100%;
    border-radius: 999px;
    background: var(--primary);
    /* The width jumps on every XHR progress event; ease it so the bar glides. */
    transition: width 200ms linear;
  }
  .row.done .fill {
    background: var(--success);
  }
  .row.error .fill,
  .row.cancelled .fill {
    background: var(--danger);
  }
  .meta {
    display: flex;
    align-items: center;
    gap: 0.3rem;
    font-size: 0.7rem;
    color: var(--color-secondary);
    font-variant-numeric: tabular-nums;
  }
  .dot {
    opacity: 0.5;
  }
  .error-text {
    color: var(--danger);
  }
  .cancel {
    display: inline-flex;
    align-items: center;
    gap: 0.25rem;
    align-self: flex-start;
    padding: 0.1rem;
    border: none;
    background: transparent;
    color: var(--color-secondary);
    font-size: 0.75rem;
    cursor: pointer;
  }
  .cancel:hover {
    color: var(--danger);
  }
</style>
