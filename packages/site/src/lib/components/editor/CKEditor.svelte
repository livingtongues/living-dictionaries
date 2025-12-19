<!-- From: https://github.com/techlab23/ckeditor5-svelte -->
<script lang="ts">
  import { onDestroy, onMount } from 'svelte'
  import type { Editor } from '@ckeditor/ckeditor5-core'
  import type { EditorConfig } from '@ckeditor/ckeditor5-core/src/editor/editorconfig'

  interface Props {
    editor: typeof Editor;
    editorConfig: EditorConfig;
    value?: string;
    on_update?: (value: string) => void;
  }

  let { editor, editorConfig, value = $bindable(''), on_update }: Props = $props();

  let editorEl: HTMLDivElement = $state()
  let instance: Editor

  const emitInputEvent = () => {
    // @ts-expect-error
    value = instance.getData()
    on_update?.(value)
  }

  onMount(() => {
    editor
      .create(editorEl, { ...editorConfig, initialData: value })
      .then((editor) => {
        instance = editor
        instance.model.document.on('change:data', emitInputEvent)

      // instance.editing.view.document.on('focus', (evt) => {
        //   dispatch('focus', { evt, instance });
        // });

        // instance.editing.view.document.on('blur', (evt) => {
        //   dispatch('blur', { evt, instance });
        // });
      })
      .catch((error) => {
        console.error(error)
      })
  })
  onDestroy(() => {
    if (instance) {
      instance.model.document.off('change:data', emitInputEvent)
      instance.destroy()
      instance = null
    }
  })
</script>

<div bind:this={editorEl} contenteditable bind:innerHTML={value}></div>
