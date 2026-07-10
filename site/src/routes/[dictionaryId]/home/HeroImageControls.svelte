<script lang="ts">
  import type { Readable } from 'svelte/store'
  import type { ImageUploadStatus } from '$lib/components/image/upload-image'
  import { page } from '$app/state'
  import IconMdiImagePlus from '~icons/mdi/image-plus'
  import IconMdiImageSyncOutline from '~icons/mdi/image-sync-outline'
  import IconMdiTrashCanOutline from '~icons/mdi/trash-can-outline'
  import IconMdiClose from '~icons/mdi/close'

  interface Props {
    has_image: boolean
    uploading: Readable<ImageUploadStatus> | null
    on_file: (file: File) => void
    on_delete: () => Promise<void>
    on_dismiss_error: () => void
  }

  const { has_image, uploading, on_file, on_delete, on_dismiss_error }: Props = $props()
  const t = $derived(page.data.t)

  function handle_input(event: Event) {
    const input = event.target as HTMLInputElement
    const file = input.files?.[0]
    if (file)
      on_file(file)
    input.value = ''
  }
</script>

{#if uploading}
  <div class="upload-overlay">
    {#if $uploading.error}
      <button type="button" class="error-note" onclick={on_dismiss_error}>
        {t('misc.error')}: {$uploading.error}
        <IconMdiClose class="icon-inline" />
      </button>
    {:else}
      {#if $uploading.preview_url}
        <img class="preview" src={$uploading.preview_url} alt="" />
      {/if}
      <div class="progress-veil" style="height: {100 - $uploading.progress}%"></div>
      <div class="progress-text">{$uploading.progress}%</div>
    {/if}
  </div>
{:else}
  <div class="cover-controls" class:on-image={has_image}>
    <label class="cover-btn" title={has_image ? t('dict_home.replace_cover') : t('dict_home.add_cover')}>
      <input type="file" accept="image/*" style="display: none" oninput={handle_input} />
      {#if has_image}
        <IconMdiImageSyncOutline class="icon-inline" />
      {:else}
        <IconMdiImagePlus class="icon-inline" />
        <span class="btn-label">{t('dict_home.add_cover')}</span>
      {/if}
    </label>
    {#if has_image}
      <button
        type="button"
        class="cover-btn"
        title={t('dict_home.delete_cover')}
        aria-label={t('dict_home.delete_cover')}
        onclick={async () => {
          if (confirm(t('dict_home.delete_cover_confirm')))
            await on_delete()
        }}>
        <IconMdiTrashCanOutline class="icon-inline" />
      </button>
    {/if}
  </div>
{/if}

<style>
  .upload-overlay {
    position: absolute;
    inset: 0;
    z-index: 2;
    display: flex;
    align-items: center;
    justify-content: center;
    overflow: hidden;
    background: var(--surface);
  }

  .preview {
    position: absolute;
    inset: 0;
    width: 100%;
    height: 100%;
    object-fit: cover;
  }

  .progress-veil {
    position: absolute;
    top: 0;
    width: 100%;
    background: color-mix(in srgb, var(--background), var(--color) 10%);
    opacity: 0.75;
    transition: height 0.5s ease;
  }

  .progress-text {
    position: relative;
    color: white;
    font-weight: 600;
    font-family: var(--font-mono);
    text-shadow: 0 1px 3px rgb(0 0 0 / 0.6);
  }

  .error-note {
    position: relative;
    padding: 0.5rem 0.875rem;
    border-radius: 0.5rem;
    color: rgb(220 38 38);
    background: var(--background);
  }

  .cover-controls {
    position: absolute;
    top: 0.75rem;
    inset-inline-end: 0.75rem;
    z-index: 2;
    display: flex;
    gap: 0.375rem;
  }

  .cover-btn {
    display: flex;
    align-items: center;
    gap: 0.375rem;
    padding: 0.375rem 0.75rem;
    border-radius: 9999px;
    font-size: 0.8125rem;
    cursor: pointer;
    background: color-mix(in srgb, var(--color) 8%, transparent);
    color: inherit;
  }

  .cover-btn:hover {
    background: color-mix(in srgb, var(--color) 14%, transparent);
  }

  .on-image .cover-btn {
    background: rgb(0 0 0 / 0.45);
    color: white;
    backdrop-filter: blur(4px);
  }

  .on-image .cover-btn:hover {
    background: rgb(0 0 0 / 0.65);
  }

  /* icon-only pills on small screens so they don't cover the title */
  @media (max-width: 640px) {
    .btn-label {
      display: none;
    }
  }
</style>
