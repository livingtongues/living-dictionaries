<script lang="ts"> import IconFaSolidCode from '~icons/fa-solid/code'
  import Button from './Button.svelte'
  import ShowHide from './ShowHide.svelte'

  const { obj } = $props()
  function string_and_colorize(obj2) {
    return JSON.stringify(obj2, null, 2).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(
      /("(\\u[a-zA-Z0-9]{4}|\\[^u]|[^\\"])*"(\s*:)?|\b(true|false|null)\b|-?\d+(?:\.\d*)?(?:[eE][+-]?\d+)?)/g,
      (match) => {
        let color = 'darkorange'
        if (match.startsWith('"')) {
          if (match.endsWith(':'))
            color = 'red'
          else
            color = 'green'
        } else if (/true|false/.test(match)) {
          color = 'blue'
        } else if (/null/.test(match)) {
          color = 'magenta'
        }
        return `<span style="color:${color}">${match}</span>`
      },
    )
  }
</script>

<ShowHide>
  {#snippet children({ show, toggle })}
    <Button onclick={toggle} form="simple" color="black">
      <IconFaSolidCode class="icon-inline" />
    </Button>
    {#if show}
      <div class="overlay">
        <button type="button" class="hide-button" onclick={toggle}>Hide</button>
        <pre>{@html string_and_colorize(obj)}</pre>
      </div>
    {/if}
  {/snippet}
</ShowHide>

<style>
  .overlay {
    position: fixed;
    inset: 0;
    z-index: 100;
    overflow-y: auto;
    background-color: var(--background);
  }

  pre {
    white-space: pre-wrap;
    font-size: 0.75rem;
    line-height: 1rem;
  }

  .hide-button {
    background-color: var(--surface);
    padding: 0.5rem 0.75rem;
    color: var(--color-secondary);
  }
</style>
