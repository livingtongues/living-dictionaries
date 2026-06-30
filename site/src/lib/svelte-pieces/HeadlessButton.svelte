<script lang="ts">
  import IconGgSpinner from '~icons/gg/spinner'
  import IconTablerExternalLink from '~icons/tabler/external-link'

  interface Props {
    onclick?: (e: MouseEvent & { currentTarget: EventTarget & HTMLButtonElement }) => any
    oncontextmenu?: (e: MouseEvent & { currentTarget: EventTarget & HTMLButtonElement }) => any
    href?: any
    type?: 'button' | 'submit'
    target?: '_blank'
    rel?: string
    disabled?: boolean
    showExternalLinkIcon?: boolean
    title?: string
    loading?: boolean
    class?: string
    style?: string
    children?: import('svelte').Snippet
  }

  let {
    onclick = undefined,
    oncontextmenu = undefined,
    href = undefined,
    type = 'button',
    target = undefined,
    rel = undefined,
    disabled = false,
    showExternalLinkIcon = false,
    title = undefined,
    loading = $bindable(false),
    class: classes = undefined,
    style: inline_style = undefined,
    children,
  }: Props = $props()

  const disable = $derived(disabled || loading)

  async function runWithSpinner(event) {
    if (onclick) {
      loading = true
      try {
        await onclick(event)
      } catch (err) {
        console.error(err)
        alert(err)
      }
      loading = false
    }
  }

  async function right_with_spinner(event) {
    if (oncontextmenu) {
      loading = true
      try {
        event.preventDefault()
        await oncontextmenu(event)
      } catch (err) {
        console.error(err)
        alert(err)
      }
      loading = false
    }
  }
</script>

{#if href}
  <a
    {href}
    {title}
    {target}
    rel={rel ?? (target === '_blank' ? 'noopener noreferrer' : undefined)}
    class={classes}
    style={inline_style}>
    {@render children?.()}
    {#if showExternalLinkIcon}
      <IconTablerExternalLink style="vertical-align: -2px" />
    {/if}
  </a>
{:else}
  <button
    class={classes}
    style={inline_style}
    {type}
    {title}
    onclick={runWithSpinner}
    oncontextmenu={right_with_spinner}
    disabled={disable}>
    {@render children?.()}
    {#if loading}
      <IconGgSpinner class="headless-spinner" style="vertical-align: -2px; margin-left: 0.25rem; margin-right: -0.25rem;" />
    {/if}
  </button>
{/if}

<style>
  :global(.headless-spinner) {
    animation: headless-spin 1s linear infinite;
  }
  @keyframes headless-spin {
    to { transform: rotate(360deg); }
  }
</style>
