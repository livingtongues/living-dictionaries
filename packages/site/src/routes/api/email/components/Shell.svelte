<script lang="ts">
  import Body from './Body.svelte'
  import Head from './Head.svelte'
  import Html from './Html.svelte'

  interface Props {
    dark?: boolean
    preview: string
    title: string
    children?: import('svelte').Snippet
  }

  let {
    dark = false,
    preview,
    title,
    children,
  }: Props = $props()
</script>

<Html>
  <Head {dark}>
    <title>{title}</title>
  </Head>
  <Body {preview}>
    {@render children?.()}
  </Body>
</Html>
