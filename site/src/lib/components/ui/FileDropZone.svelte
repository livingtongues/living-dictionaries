<script lang="ts">
  import type { Snippet } from 'svelte'
  import IconMdiTrayArrowUp from '~icons/mdi/tray-arrow-up'

  interface Props {
    children: Snippet
    on_files: (files: File[]) => void
    label?: string
    sub_label?: string
    disabled?: boolean
  }
  const { children, on_files, label = 'Drop files to attach', sub_label = '', disabled = false }: Props = $props()

  /**
   * `dragenter`/`dragleave` fire for every descendant the pointer crosses, so a
   * plain boolean flickers the overlay off the moment the cursor moves over a
   * message. Counting enters minus leaves is the standard fix: the overlay hides
   * only when the drag has truly left the container.
   */
  let drag_depth = $state(0)
  const dragging = $derived(drag_depth > 0)

  /** Ignore drags of selected text/links — only a real file drag should light this up. */
  function has_files(event: DragEvent): boolean {
    return !!event.dataTransfer?.types?.includes('Files')
  }

  function on_dragenter(event: DragEvent) {
    if (disabled || !has_files(event))
      return
    drag_depth += 1
  }

  function on_dragover(event: DragEvent) {
    if (disabled || !has_files(event))
      return
    // Without preventDefault the browser refuses the drop and navigates to the file.
    event.preventDefault()
    if (event.dataTransfer)
      event.dataTransfer.dropEffect = 'copy'
  }

  function on_dragleave(event: DragEvent) {
    if (disabled || !has_files(event))
      return
    drag_depth = Math.max(drag_depth - 1, 0)
  }

  function on_drop(event: DragEvent) {
    if (disabled || !has_files(event))
      return
    event.preventDefault()
    drag_depth = 0
    const files = Array.from(event.dataTransfer?.files ?? [])
    if (files.length)
      on_files(files)
  }
</script>

<!-- svelte-ignore a11y_no_static_element_interactions -->
<div
  class="drop-zone"
  ondragenter={on_dragenter}
  ondragover={on_dragover}
  ondragleave={on_dragleave}
  ondrop={on_drop}>
  {@render children()}

  {#if dragging}
    <div class="overlay">
      <div class="prompt">
        <IconMdiTrayArrowUp style="font-size: 2rem" />
        <span class="label">{label}</span>
        {#if sub_label}<span class="sub">{sub_label}</span>{/if}
      </div>
    </div>
  {/if}
</div>

<style>
  .drop-zone {
    position: relative;
    display: flex;
    flex-direction: column;
    min-height: 0;
    min-width: 0;
    flex: 1;
  }
  .overlay {
    position: absolute;
    inset: 0;
    z-index: 20;
    display: flex;
    align-items: center;
    justify-content: center;
    border-radius: 0.75rem;
    background: color-mix(in srgb, transparent, var(--background) 82%);
    /* The overlay must not swallow the drag events the container is listening for. */
    pointer-events: none;
  }
  .prompt {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 0.35rem;
    padding: 1.5rem 2.25rem;
    border: 2px dashed var(--primary);
    border-radius: 0.75rem;
    background: var(--surface);
    color: var(--primary);
  }
  .label {
    font-size: 1rem;
    font-weight: 600;
  }
  .sub {
    font-size: 0.8rem;
    color: var(--color-secondary);
  }
</style>
