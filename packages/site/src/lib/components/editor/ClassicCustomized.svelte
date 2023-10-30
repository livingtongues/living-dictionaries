<script lang="ts">
  import CKEditor from './CKEditor.svelte';
  import type { EditorConfig } from '@ckeditor/ckeditor5-core/src/editor/editorconfig';

  export let html: string;
  export let editorConfig: EditorConfig = {
    // TODO: figure out which plugins to remove related to photos to speed up
    // removePlugins: ['MediaEmbed'],
    // Available plugins for ClassicEditor: Essentials, CKFinderUploadAdapter, Autoformat, Bold, Italic, BlockQuote, CKFinder, EasyImage, Heading, Image, ImageCaption, ImageStyle, ImageToolbar, ImageUpload, Link, List, MediaEmbed, Paragraph, PasteFromOffice, Table, TableToolbar, ++ Alignment
    // To Discover: ClassicEditor.builtinPlugins.map(plugin => { console.log(plugin.pluginName); });
    alignment: {
      options: ['left', 'right', 'center', 'justify'],
    },
    toolbar: [
      'heading',
      '|',
      'bold',
      'italic',
      'underline',
      'smallCaps',
      'alignment',
      'link',
      'bulletedList',
      'numberedList',
      'blockQuote',
      'insertTable',
      'undo',
      'redo',
    ],
  };

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  interface $$Events {
    update: CustomEvent<string>;
  }

</script>

{#await import('ckeditor5-build-classic-with-alignment-underline-smallcaps') then editor}
  <CKEditor editor={editor.default} value={html} {editorConfig} on:update />
{/await}
