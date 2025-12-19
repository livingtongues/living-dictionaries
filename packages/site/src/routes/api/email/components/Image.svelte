<script lang="ts">
  import type { ComponentProps } from 'svelte'
  import Row from './Row.svelte'

  interface Props {
    row?: ComponentProps<typeof Row>
    href?: string
    src: string
    alt: string
  }

  let {
    row = {},
    href,
    src,
    alt,
  }: Props = $props()
</script>

<Row {...row}>
  <td align="center" valign="middle">
    {#if href}
      <a target="_blank" {href}>
        <img {src} {alt} width="500" style="display: block; color: #666666; font-family: Helvetica, arial, sans-serif; font-size: 16px; width: 500px; height: auto;" border="0" />
      </a>
    {:else}
      <img {src} {alt} width="500" style="display: block; color: #666666; font-family: Helvetica, arial, sans-serif; font-size: 16px; width: 500px; height: auto;" border="0" />
    {/if}
  </td>
</Row>

<style>
  @media screen and (max-width: 525px) {
    img {
      max-width: 100% !important;
      width: 100% !important;
      height: auto !important;
    }
  }
</style>

<svelte:options css="injected" />
