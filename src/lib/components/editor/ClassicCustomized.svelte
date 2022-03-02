<script lang="ts">
  export let html: string;
  export let englishGloss = false;
  import CKEditor from './CKEditor.svelte';
  import { onMount } from 'svelte';
  let editor: any;

  let editorConfig = {
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

  //TODO make it for every other case and make it legible
  if (englishGloss) {
    editorConfig.toolbar = [
      editorConfig.toolbar[editorConfig.toolbar.indexOf('bold')],
      editorConfig.toolbar[editorConfig.toolbar.indexOf('italic')],
      editorConfig.toolbar[editorConfig.toolbar.indexOf('link')],
    ];
  }

  let mounted = false;
  onMount(async () => {
    editor = (await import('ckeditor5-build-classic-with-alignment-underline-smallcaps')).default;
    mounted = true;
  });
</script>

{#if mounted}
  <CKEditor bind:editor bind:value={html} bind:config={editorConfig} />
{/if}
