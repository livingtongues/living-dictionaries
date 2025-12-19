<script lang="ts">
  import { Lexer } from 'marked'
  import RenderToken from './RenderToken.svelte'

  interface Props {
    markdown: string
  }

  const { markdown }: Props = $props()

  const lexar = new Lexer({
    breaks: false,
    gfm: true,
    pedantic: false,
    renderer: null,
    silent: false,
    tokenizer: null,
  })
  const tokens = lexar.lex(markdown)
</script>

{#each tokens as token}
  <RenderToken {token} />
{/each}
