<script lang="ts">
  import IconCheck from '~icons/fa-solid/check'
  import type { MediaUploadHandle } from '$lib/media/upload-media'
  import { page } from '$app/state'

  interface Props {
    handle: MediaUploadHandle
  }

  const { handle }: Props = $props()
  const progress = $derived(handle.progress)
  let error = $state<string | null>(null)

  $effect(() => {
    error = null
    handle.done.catch((err: unknown) => error = err instanceof Error ? err.message : String(err))
  })
</script>

{#if error}
  <span class="status-pill error-pill">
    {page.data.t('misc.error')}: {error}
  </span>
{:else if $progress.progress === 100}
  <span class="status-pill success-pill">
    <IconCheck />
    {page.data.t('upload.success')}
  </span>
{:else}
  <div style="position: relative; padding-top: 0.25rem">
    <div class="progress-header">
      <div>
        <span class="status-pill uploading-pill">
          {page.data.t('upload.uploading')}
        </span>
      </div>
      <div style="text-align: right">
        <span class="progress-percent">
          {$progress.progress}%
        </span>
      </div>
    </div>
    <div class="progress-track">
      <div
        style="width:{$progress.progress}%"
        class="progress-bar smooth-width-transition"></div>
    </div>
  </div>
{/if}

<style>
  .smooth-width-transition {
    transition: width 0.5s ease;
  }

  .status-pill {
    font-size: 0.75rem;
    line-height: 1rem;
    font-weight: 600;
    display: inline-block;
    padding: 0.25rem 0.5rem;
    text-transform: uppercase;
    border-radius: 9999px;
  }

  .error-pill {
    color: rgb(220 38 38); /* red-600 */
    background-color: rgb(254 202 202); /* red-200 */
  }

  .success-pill {
    color: rgb(22 163 74); /* green-600 */
    background-color: rgb(187 247 208); /* green-200 */
  }

  .uploading-pill {
    color: rgb(37 99 235); /* blue-600 */
    background-color: rgb(191 219 254); /* blue-200 */
  }

  .progress-header {
    display: flex;
    margin-bottom: 0.5rem;
    align-items: center;
    justify-content: space-between;
  }

  .progress-percent {
    font-size: 0.75rem;
    line-height: 1rem;
    font-weight: 600;
    display: inline-block;
    color: rgb(37 99 235); /* blue-600 */
  }

  .progress-track {
    overflow: hidden;
    height: 0.5rem;
    margin-bottom: 1rem;
    font-size: 0.75rem;
    line-height: 1rem;
    display: flex;
    border-radius: 0.25rem;
    background-color: rgb(191 219 254); /* blue-200 */
  }

  .progress-bar {
    box-shadow: none;
    display: flex;
    flex-direction: column;
    text-align: center;
    white-space: nowrap;
    color: #fff;
    justify-content: center;
    background-color: rgb(59 130 246); /* blue-500 */
  }
</style>
