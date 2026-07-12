<script lang="ts">
  import type { MediaUploadHandle } from '$lib/media/upload-media'
  import { page } from '$app/state'
  import IconFaSolidTimes from '~icons/fa-solid/times'
  import IconFa6SolidCheck from '~icons/fa6-solid/check'

  interface Props {
    handle: MediaUploadHandle
    on_finish: () => void
  }

  const { handle, on_finish }: Props = $props()
  const progress = $derived(handle.progress)
  let error = $state<string | null>(null)

  $effect(() => {
    error = null
    handle.done
      .then(() => on_finish())
      .catch((err: unknown) => error = err instanceof Error ? err.message : String(err))
  })
</script>

<div class="status-frame">
  {#if error}
    <div class="error-note">
      <div><IconFaSolidTimes /></div>
      {page.data.t('misc.error')}: {error}
    </div>
  {:else}
    {#if $progress.progress === 100}
      <div class="done-check text-dark-shadow">
        <IconFa6SolidCheck />
      </div>
    {:else}
      <div class="progress-text text-dark-shadow">
        {$progress.progress}%
      </div>
    {/if}
    {#if $progress.preview_url}
      <img style="object-fit: cover; height: 100%; width: 100%; position: absolute; inset: 0" src={$progress.preview_url} />
    {/if}
    <div
      style="height:{100 - $progress.progress}%"
      class="progress-veil smooth-height-transition"></div>
  {/if}
</div>

<style>
  .smooth-height-transition {
    transition: height 0.5s ease;
  }

  .status-frame {
    width: 100%;
    height: 100%;
    flex-grow: 1;
    position: relative;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    overflow: hidden;
  }

  .error-note {
    padding: 0.5rem;
    color: rgb(220 38 38); /* red-600 */
    text-align: center;
  }

  .done-check {
    width: 3rem;
    color: #fff;
    font-size: 1.875rem;
    line-height: 2.25rem;
    z-index: 10;
    text-align: center;
  }

  .progress-text {
    color: #fff;
    z-index: 10;
    font-weight: 600;
    width: 3rem;
    text-align: center;
    font-family: var(--font-mono);
  }

  .progress-veil {
    background-color: color-mix(in srgb, var(--background), var(--color) 10%); /* ≈ gray-200 */
    opacity: 0.75;
    position: absolute;
    top: 0;
    width: 100%;
  }
</style>
