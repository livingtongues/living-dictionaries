<script lang="ts">
  import type { Readable } from 'svelte/store'
  import type { ImageUploadStatus } from './upload-image'
  import { page } from '$app/state'
  import IconFaSolidTimes from '~icons/fa-solid/times'
  import IconFa6SolidCheck from '~icons/fa6-solid/check'

  interface Props {
    upload_status: Readable<ImageUploadStatus>
    on_finish: () => void
  }

  const { upload_status, on_finish }: Props = $props()
  $effect(() => {
    if ($upload_status.storage_path) {
      on_finish()
    }
  })
</script>

<div class="status-frame">
  {#if $upload_status.error}
    <div class="error-note">
      <div><IconFaSolidTimes class="icon-inline" /></div>
      {page.data.t('misc.error')}: {$upload_status.error}
    </div>
  {:else}
    {#if $upload_status.serving_url}
      <div class="done-check text-dark-shadow">
        <IconFa6SolidCheck class="icon-inline" />
      </div>
    {:else}
      <div class="progress-text text-dark-shadow">
        {$upload_status.progress}%
      </div>
    {/if}
    {#if $upload_status.preview_url}
      <img style="object-fit: cover; height: 100%; width: 100%; position: absolute; inset: 0" src={$upload_status.preview_url} />
    {/if}
    <div
      style="height:{100 - $upload_status.progress}%"
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
