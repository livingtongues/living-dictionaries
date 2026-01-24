<script>
  let { emulateEmailAddingDarkClasses = false } = $props()
</script>
<meta name="color-scheme" content="light dark">
<meta name="supported-color-schemes" content="light dark only">

{@html `<style type="text/css">
  :root {
    color-scheme: light;
    supported-color-schemes: light;
  }
</style>`}

{#if emulateEmailAddingDarkClasses}
  {@html `<style type="text/css">
  @media (prefers-color-scheme: dark) {
    :root {
      color-scheme: dark;
      supported-color-schemes: dark;
    }
    body {
      background-color: #000000 !important;
    }
  }
</style>`}
{/if}
