<script lang="ts">
  import Head from './Head.svelte'
  import Html from './Html.svelte'
  import Body from './Body.svelte'

  export let dark = false
  export let preview: string
  export let title: string
</script>

<Html>
  <Head {dark}>
    <title>{title}</title>
  </Head>
  <Body {preview}>
    <slot />
  </Body>
</Html>
