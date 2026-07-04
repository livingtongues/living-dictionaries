<script lang="ts"> import Button from './Button.svelte'
  import ShowHide from './LegacyShowHide.svelte'

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
      <span class="sp-646rvl"></span>
    </Button>
    {#if show}
      <div class="sp-7eaudr">
        <button type="button" class="sp-zvqotm" onclick={toggle}>Hide</button>
        <pre class="sp-oha2nn">{@html string_and_colorize(obj)}</pre>
      </div>
    {/if}
  {/snippet}
</ShowHide>

<style>:global(.sp-646rvl){--un-icon:url("data:image/svg+xml;utf8,%3Csvg viewBox='0 0 640 512' display='inline-block' vertical-align='middle' width='1em' height='1em' xmlns='http://www.w3.org/2000/svg' %3E%3Cpath fill='currentColor' d='m278.9 511.5l-61-17.7c-6.4-1.8-10-8.5-8.2-14.9L346.2 8.7c1.8-6.4 8.5-10 14.9-8.2l61 17.7c6.4 1.8 10 8.5 8.2 14.9L293.8 503.3c-1.9 6.4-8.5 10.1-14.9 8.2m-114-112.2l43.5-46.4c4.6-4.9 4.3-12.7-.8-17.2L117 256l90.6-79.7c5.1-4.5 5.5-12.3.8-17.2l-43.5-46.4c-4.5-4.8-12.1-5.1-17-.5L3.8 247.2c-5.1 4.7-5.1 12.8 0 17.5l144.1 135.1c4.9 4.6 12.5 4.4 17-.5m327.2.6l144.1-135.1c5.1-4.7 5.1-12.8 0-17.5L492.1 112.1c-4.8-4.5-12.4-4.3-17 .5L431.6 159c-4.6 4.9-4.3 12.7.8 17.2L523 256l-90.6 79.7c-5.1 4.5-5.5 12.3-.8 17.2l43.5 46.4c4.5 4.9 12.1 5.1 17 .6'/%3E%3C/svg%3E");-webkit-mask:var(--un-icon) no-repeat;mask:var(--un-icon) no-repeat;-webkit-mask-size:100% 100%;mask-size:100% 100%;background-color:currentColor;color:inherit;display:inline-block;vertical-align:middle;width:1em;height:1em;}:global(.sp-7eaudr){position:fixed;inset:0;z-index:100;overflow-y:auto;background-color:var(--background);}:global(.sp-oha2nn){white-space:pre-wrap;font-size:0.75rem;line-height:1rem;}:global(.sp-zvqotm){background-color:var(--surface);padding-left:0.75rem;padding-right:0.75rem;padding-top:0.5rem;padding-bottom:0.5rem;color:var(--color-secondary);}</style>
