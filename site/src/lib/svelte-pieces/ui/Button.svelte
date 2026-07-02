<script>
  /**
   * @type {{
   *   onclick?: (event: Event) => unknown
   *   href?: string
   *   type?: 'button' | 'submit' | 'reset'
   *   target?: string
   *   rel?: string
   *   size?: 'sm' | 'md' | 'lg'
   *   form?: string
   *   color?: string
   *   disabled?: boolean
   *   active?: boolean
   *   showExternalLinkIcon?: boolean
   *   title?: string
   *   loading?: boolean
   *   class?: string
   *   children?: import('svelte').Snippet
   * }}
   */
  let {
    onclick = undefined,
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
    loading = $bindable(false),
    class: className = '',
    children,
  } = $props()

  const disable = $derived(disabled || loading)
  const fill = $derived(form === 'outline' ? 'outlined' : form)

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
</script>

{#if href}
  <a
    {href}
    {title}
    {target}
    rel={rel ?? (target === '_blank' ? 'noopener noreferrer' : '')}
    class:active
    class="sp-hpa67q {className} {fill} {size} {color}">
    {@render children?.()}
    {#if showExternalLinkIcon}
      <span class="sp-ph4sp1" style="vertical-align: -2px;"></span>
    {/if}
  </a>
{:else}
  <button
    class:active
    class:disabled={disable}
    class="sp-hpa67q {className} {fill} {size} {color}"
    {type}
    {title}
    onclick={runWithSpinner}
    disabled={disable}>
    {@render children?.()}
    {#if loading}
      <span class="sp-yscjkl" style="vertical-align: -2px;"></span>
    {/if}
  </button>
{/if}

<style>:global(.sp-ph4sp1){--un-icon:url("data:image/svg+xml;utf8,%3Csvg viewBox='0 0 24 24' display='inline-block' vertical-align='middle' width='1em' height='1em' xmlns='http://www.w3.org/2000/svg' %3E%3Cpath fill='none' stroke='currentColor' stroke-linecap='round' stroke-linejoin='round' stroke-width='2' d='M12 6H6a2 2 0 0 0-2 2v10a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-6m-7 1l9-9m-5 0h5v5'/%3E%3C/svg%3E");-webkit-mask:var(--un-icon) no-repeat;mask:var(--un-icon) no-repeat;-webkit-mask-size:100% 100%;mask-size:100% 100%;background-color:currentColor;color:inherit;display:inline-block;vertical-align:middle;width:1em;height:1em;}:global(.sp-yscjkl){--un-icon:url("data:image/svg+xml;utf8,%3Csvg viewBox='0 0 24 24' display='inline-block' vertical-align='middle' width='1em' height='1em' xmlns='http://www.w3.org/2000/svg' %3E%3Cg fill='currentColor'%3E%3Cpath fill-rule='evenodd' d='M12 19a7 7 0 1 0 0-14a7 7 0 0 0 0 14m0 3c5.523 0 10-4.477 10-10S17.523 2 12 2S2 6.477 2 12s4.477 10 10 10' clip-rule='evenodd' opacity='.2'/%3E%3Cpath d='M2 12C2 6.477 6.477 2 12 2v3a7 7 0 0 0-7 7z'/%3E%3C/g%3E%3C/svg%3E");-webkit-mask:var(--un-icon) no-repeat;mask:var(--un-icon) no-repeat;-webkit-mask-size:100% 100%;mask-size:100% 100%;background-color:currentColor;color:inherit;display:inline-block;vertical-align:middle;width:1em;height:1em;margin-left:0.25rem;margin-right:-0.25rem;animation:spin 1s linear infinite;}:global(.sp-hpa67q){display:inline-block;text-align:center;}@keyframes spin{from{transform:rotate(0deg)}to{transform:rotate(360deg)}}
  a,
  button {
    border-radius:0.25rem;
  }a:hover, button:hover{--un-text-opacity:1;color:rgb(255 255 255 / var(--un-text-opacity));}a:focus, button:focus{outline:2px solid transparent;outline-offset:2px;--un-ring-width:2px;--un-ring-offset-shadow:var(--un-ring-inset) 0 0 0 var(--un-ring-offset-width) var(--un-ring-offset-color);--un-ring-shadow:var(--un-ring-inset) 0 0 0 calc(var(--un-ring-width) + var(--un-ring-offset-width)) var(--un-ring-color);box-shadow:var(--un-ring-offset-shadow), var(--un-ring-shadow), var(--un-shadow);--un-ring-offset-width:2px;}

  .primary {
    border-color:var(--primary);color:var(--primary);
  }.primary:hover{background-color:var(--primary);}.primary:focus{--un-ring-color:var(--primary);}
  .red {
    border-color:var(--danger);color:var(--danger);
  }.red:hover{background-color:var(--danger);}.red:focus{--un-ring-color:var(--danger);}
  .orange {
    border-color:var(--warning);color:var(--warning);
  }.orange:hover{background-color:var(--warning);}.orange:focus{--un-ring-color:var(--warning);}
  .green {
    border-color:var(--success);color:var(--success);
  }.green:hover{background-color:var(--success);}.green:focus{--un-ring-color:var(--success);}
  .black {
    border-color:color-mix(in srgb, var(--color) 47%, transparent);color:color-mix(in srgb, var(--color) 88%, transparent);
  }.black:hover{background-color:color-mix(in srgb, var(--color) 92%, var(--background));color:var(--background);}.black:focus{--un-ring-color:color-mix(in srgb, var(--color) 47%, transparent);}
  .white {
    color:color-mix(in srgb, var(--color) 88%, transparent);
  }.white:hover{background-color:color-mix(in srgb, var(--color) 25%, transparent);}.white:focus{--un-ring-color:color-mix(in srgb, var(--color) 47%, transparent);}

  .filled {
    --un-text-opacity:1;color:rgb(255 255 255 / var(--un-text-opacity));
  }
  .filled.primary {
    background-color:var(--primary);color:var(--on-primary);
  }.filled.primary:hover{background-color:color-mix(in srgb, var(--primary) 85%, var(--color));}
  .filled.red {
    background-color:var(--danger);
  }.filled.red:hover{background-color:color-mix(in srgb, var(--danger) 85%, var(--color));}
  .filled.orange {
    background-color:var(--warning);
  }.filled.orange:hover{background-color:color-mix(in srgb, var(--warning) 85%, var(--color));}
  .filled.green {
    background-color:var(--success);
  }.filled.green:hover{background-color:color-mix(in srgb, var(--success) 85%, var(--color));}
  .filled.black {
    background-color:color-mix(in srgb, var(--color) 88%, var(--background));color:var(--background);
  }.filled.black:hover{background-color:var(--color);}
  .filled.white {
    background-color:var(--surface);color:var(--color);
  }.filled.white:hover{background-color:var(--background);}.filled.white:focus{--un-ring-color:var(--background);}

  .filled,
  .outlined {
    border-width:1px;--un-shadow:var(--un-shadow-inset) 0 1px 2px 0 var(--un-shadow-color, rgb(0 0 0 / 0.05));box-shadow:var(--un-ring-offset-shadow), var(--un-ring-shadow), var(--un-shadow);
  }

  .menu,
  .link,
  .text {
    border-style:none;color:color-mix(in srgb, var(--color) 75%, transparent);--un-shadow:0 0 var(--un-shadow-color, rgb(0 0 0 / 0));box-shadow:var(--un-ring-offset-shadow), var(--un-ring-shadow), var(--un-shadow);
  }.menu:hover, .link:hover, .text:hover{background-color:transparent;color:var(--color);}.menu:focus, .link:focus, .text:focus{--un-ring-color:color-mix(in srgb, var(--color) 47%, transparent);}

  .menu {
    border-radius:0.5rem;
  }.menu:hover{background-color:color-mix(in srgb, var(--background), var(--color) 12%);}
  .link {
  }.link:hover{text-decoration-line:underline;}
  .text {
    padding:0.75rem;font-size:1rem;line-height:1.5rem;font-weight:400;
  }
  .active {
    background-color:color-mix(in srgb, var(--background), var(--color) 12%);color:color-mix(in srgb, var(--color) 88%, transparent);
  }

  .sm {
    padding-left:0.625rem;padding-right:0.625rem;padding-top:0.375rem;padding-bottom:0.375rem;font-size:0.75rem;line-height:1rem;font-weight:500;
  }
  .md {
    padding-left:1rem;padding-right:1rem;padding-top:0.5rem;padding-bottom:0.5rem;font-size:0.875rem;line-height:1.25rem;font-weight:500;
  }
  .lg {
    padding-left:1.25rem;padding-right:1.25rem;padding-top:0.625rem;padding-bottom:0.625rem;font-weight:700;
    /* text-base */
  }

  :disabled,
  .disabled {
    cursor:not-allowed;opacity:0.5;
  }
</style>
