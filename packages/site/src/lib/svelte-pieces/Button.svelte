<script lang="ts">
  interface Props {
    onclick?: (e: MouseEvent & { currentTarget: EventTarget & HTMLButtonElement }) => any
    oncontextmenu?: (e: MouseEvent & { currentTarget: EventTarget & HTMLButtonElement }) => any
    href?: any
    type?: 'button' | 'submit'
    target?: '_blank'
    rel?: string
    size?: 'sm' | 'md' | 'lg'
    form?: 'outline' | 'filled' | 'simple' | 'link' | 'menu' | 'text'
    color?: 'red' | 'orange' | 'green' | 'black' | 'white' | 'primary'
    disabled?: boolean
    active?: boolean
    showExternalLinkIcon?: boolean
    title?: string
    loading?: boolean
    class?: string
    children?: import('svelte').Snippet
  }

  let {
    onclick = undefined,
    oncontextmenu = undefined,
    href = undefined,
    type = 'button',
    target = undefined,
    rel = undefined,
    size = 'md',
    form = 'outline',
    color = 'primary',
    disabled = false,
    active = false,
    showExternalLinkIcon = false,
    title = undefined,
    loading = false,
    class: classes = '',
    children,
    ...attachments
  }: Props = $props()

  let disable = $derived(disabled || loading)
  let fill = $derived(form === 'outline' ? 'outlined' : form)

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
    {...attachments}
    {href}
    {title}
    {target}
    rel={rel || (target === '_blank' ? 'noopener noreferrer' : '')}
    class:active
    class="{classes} {fill} {size} {color} text-center inline-block">
    {@render children?.()}
    {#if showExternalLinkIcon}
      <span class="i-tabler-external-link" style="vertical-align: -2px;"></span>
    {/if}
  </a>
{:else}
  <button
    {...attachments}
    class:active
    class:disabled={disable}
    class="{classes} {fill} {size} {color} text-center inline-block"
    {type}
    {title}
    onclick={runWithSpinner}
    oncontextmenu={right_with_spinner}
    disabled={disable}>
    {@render children?.()}
    {#if loading}
      <span class="i-gg-spinner animate-spin ml-1 -mr-1" style="vertical-align: -2px;"></span>
    {/if}
  </button>
{/if}

<style>
  a,
  button {
    @apply rounded hover:text-white focus:outline-none focus:ring-2 focus:ring-offset-2;
  }

  .primary {
    @apply focus:ring-blue-500 text-blue-700 hover:bg-blue-500 border-blue-500;
  }
  .red {
    @apply focus:ring-red-500 text-red-700 hover:bg-red-500 border-red-500;
  }
  .orange {
    @apply focus:ring-orange-500 text-orange-700 hover:bg-orange-500 border-orange-500;
  }
  .green {
    @apply focus:ring-green-500 text-green-700 hover:bg-green-500 border-green-500;
  }
  .black {
    @apply focus:ring-gray-500 text-gray-800 hover:bg-gray-900 border-gray-500;
  }
  .white {
    @apply focus:ring-gray-500 text-gray-800 hover:bg-gray-500 hover:bg-opacity-25;
  }

  .filled {
    @apply text-white;
  }
  .filled.primary {
    @apply bg-blue-600 hover:bg-blue-700;
  }
  .filled.red {
    @apply bg-red-600 hover:bg-red-700;
  }
  .filled.orange {
    @apply bg-orange-600 hover:bg-orange-700;
  }
  .filled.green {
    @apply bg-green-600 hover:bg-green-700;
  }
  .filled.black {
    @apply bg-gray-800 hover:bg-gray-900;
  }
  .filled.white {
    @apply bg-gray-100 hover:bg-white text-black focus:ring-white;
  }

  .filled,
  .outlined {
    @apply border shadow-sm;
  }

  .menu,
  .link,
  .text {
    @apply border-none shadow-none hover:bg-transparent text-gray-600 hover:text-black focus:ring-gray-500;
  }

  .menu {
    @apply rounded-lg hover:bg-gray-200;
  }
  .link {
    @apply hover:underline;
  }
  .text {
    @apply p-3 text-base font-normal;
  }
  .active {
    @apply bg-gray-200 text-gray-800;
  }

  .sm {
    @apply font-medium text-xs px-2.5 py-1.5;
  }
  .md {
    @apply font-medium text-sm px-4 py-2;
  }
  .lg {
    @apply font-bold px-5 py-2.5;
    /* text-base */
  }

  :disabled,
  .disabled {
    @apply opacity-50 cursor-not-allowed;
  }
</style>
