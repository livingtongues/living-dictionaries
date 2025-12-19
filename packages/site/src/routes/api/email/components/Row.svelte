<!-- @migration-task Error while migrating Svelte code: `<tr>` cannot be a child of `<table>`. `<table>` only allows these children: `<caption>`, `<colgroup>`, `<tbody>`, `<thead>`, `<tfoot>`, `<style>`, `<script>`, `<template>`. The browser will 'repair' the HTML (by moving, removing, or inserting elements) which breaks Svelte's assumptions about the structure of your components.
https://svelte.dev/e/node_invalid_placement -->
<script lang="ts">
  // @ts-nocheck
  export let backgroundColor = '#ffffff'
  export let space = 0
  export let top = space
  export let bottom = space
</script>

<tr>
  <td bgcolor={backgroundColor} align="center" style="padding: {top}px 12px {bottom}px;">
    {@html `<!--[if (gte mso 9)|(IE)]><table align="center" border="0" cellspacing="0" cellpadding="0" width="500"><tr><td align="center" valign="top" width="500"><![endif]-->`}
    <table border="0" cellpadding="0" cellspacing="0" width="100%" style="max-width: 500px;" class="make-responsive-on-small-screens">
      <tr>
        <slot />
      </tr>
    </table>
    {@html `<!--[if (gte mso 9)|(IE)]></td></tr></table><![endif]-->`}
  </td>
</tr>

<style>
  /* 500 width + 12 padding-left + 12 padding-left + 1px to spare = 525px */
  @media screen and (max-width: 525px) {
    :global(.make-responsive-on-small-screens) {
      width: 100% !important;
    }
  }
</style>
