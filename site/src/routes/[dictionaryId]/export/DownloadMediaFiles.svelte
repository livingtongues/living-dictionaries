<script lang="ts">
  import type { MediaFile } from './media-files'
  import { page } from '$app/state'
  import Progress from '$lib/export/Progress.svelte'

  interface Props {
    files: MediaFile[]
    label: string
  }

  const { files, label }: Props = $props()

  let status = $state<'idle' | 'picking' | 'running' | 'done'>('idle')
  let completed = $state(0)
  let errors = $state<string[]>([])
  let cancelled = false

  const supports_directory_picker = typeof window !== 'undefined' && 'showDirectoryPicker' in window

  async function start() {
    cancelled = false
    completed = 0
    errors = []

    if (supports_directory_picker) {
      status = 'picking'
      let directory: FileSystemDirectoryHandle
      try {
        type PickerWindow = Window & { showDirectoryPicker: (picker_options: { mode: string }) => Promise<FileSystemDirectoryHandle> }
        directory = await (window as unknown as PickerWindow).showDirectoryPicker({ mode: 'readwrite' })
      } catch {
        status = 'idle' // user dismissed the picker
        return
      }
      status = 'running'
      await save_to_directory(directory)
    } else {
      status = 'running'
      await save_one_by_one()
    }
    status = 'done'
  }

  async function save_to_directory(directory: FileSystemDirectoryHandle) {
    for (const file of files) {
      if (cancelled) return
      try {
        const response = await fetch(file.url)
        if (!response.ok) throw new Error(`${response.status} ${response.statusText}`)
        const handle = await directory.getFileHandle(file.filename, { create: true })
        const writable = await handle.createWritable()
        await response.body.pipeTo(writable)
      } catch (err) {
        errors = [...errors, `${file.storage_path}: ${err}`]
      }
      completed++
    }
  }

  async function save_one_by_one() {
    for (const file of files) {
      if (cancelled) return
      try {
        const response = await fetch(file.url)
        if (!response.ok) throw new Error(`${response.status} ${response.statusText}`)
        const blob = await response.blob()
        const object_url = URL.createObjectURL(blob)
        const anchor = document.createElement('a')
        anchor.href = object_url
        anchor.download = file.filename
        anchor.click()
        // Give the browser a beat to register each download before the next.
        await new Promise(resolve => setTimeout(resolve, 500))
        URL.revokeObjectURL(object_url)
      } catch (err) {
        errors = [...errors, `${file.storage_path}: ${err}`]
      }
      completed++
    }
  }
</script>

{#if status === 'idle' || status === 'picking'}
  <button type="button" class="btn-outline btn-default" disabled={!files.length || status === 'picking'} onclick={start}>
    {label} ({files.length})
  </button>
{:else if status === 'running'}
  <div class="running">
    <Progress progress={completed / files.length} />
    <button
      type="button"
      class="btn-outline btn-default"
      style="color: var(--danger)"
      onclick={() => { cancelled = true; status = 'done' }}>{page.data.t('misc.cancel')}</button>
  </div>
{:else}
  <div class="done">
    <span>{label}: {completed - errors.length}/{files.length} ✓</span>
    <button type="button" class="btn btn-sm" onclick={() => { status = 'idle' }}>{page.data.t('misc.reset')}</button>
  </div>
{/if}

{#if errors.length}
  <div class="errors-block">
    {#each errors as error (error)}
      <div>{error}</div>
    {/each}
  </div>
{/if}

<style>
  .running {
    display: flex;
    flex-direction: column;
    align-items: flex-start;
    gap: 0.5rem;
  }

  .done {
    display: flex;
    align-items: center;
    gap: 0.5rem;
  }

  .errors-block {
    margin-top: 0.5rem;
    color: var(--danger);
    font-size: 0.875rem;
    line-height: 1.25rem;
  }
</style>
