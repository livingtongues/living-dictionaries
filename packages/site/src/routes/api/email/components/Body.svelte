<script lang="ts">
  // @ts-nocheck
  import Preview from './Preview.svelte'

  interface Props {
    preview: string;
    backgroundColor?: string;
    fontFamily?: string;
    children?: import('svelte').Snippet;
  }

  let {
    preview,
    backgroundColor = '#f8f9fc',
    fontFamily = '-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,"Helvetica Neue",Ubuntu,sans-serif',
    children
  }: Props = $props();
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
    {@render children?.()}
  </table>
</body>
