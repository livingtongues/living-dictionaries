<script lang="ts">
  import type { ImportUploadHandle } from './upload-import-file'

  interface Props {
    filename: string
    handle: ImportUploadHandle
  }

  const { filename, handle }: Props = $props()
  const progress = $derived(handle.progress)
</script>

<div class="upload-row">
  <span class="upload-name">{filename}</span>
  <progress max="100" value={$progress}></progress>
  <span class="upload-pct">{$progress}%</span>
</div>

<style>
  .upload-row {
    display: flex;
    align-items: center;
    gap: 0.75rem;
    font-size: 0.85rem;
  }
  .upload-name {
    max-width: 16rem;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  progress {
    flex-grow: 1;
    accent-color: var(--primary);
  }
  .upload-pct {
    font-variant-numeric: tabular-nums;
    color: var(--color-secondary);
  }
</style>
