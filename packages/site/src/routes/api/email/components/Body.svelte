<script lang="ts">
  // @ts-nocheck
  import Preview from './Preview.svelte'

  export let preview: string
  export let backgroundColor = '#f8f9fc'
  export let fontFamily = '-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,"Helvetica Neue",Ubuntu,sans-serif'
</script>

<body
  class="body-fix"
  bgcolor={backgroundColor}
  style="
    background-color: {backgroundColor};
      font-family: {fontFamily};
      height: 100% !important;
      margin: 0 !important;
      padding: 0 !important;
      width: 100% !important;
  ">
  <Preview {preview} />

  <table border="0" cellpadding="0" cellspacing="0" width="100%">
    <slot />
  </table>
</body>
