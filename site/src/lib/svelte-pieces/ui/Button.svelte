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
    --un-border-opacity:1;border-color:rgb(59 130 246 / var(--un-border-opacity));--un-text-opacity:1;color:rgb(29 78 216 / var(--un-text-opacity));
  }.primary:hover{--un-bg-opacity:1;background-color:rgb(59 130 246 / var(--un-bg-opacity));}.primary:focus{--un-ring-opacity:1;--un-ring-color:rgb(59 130 246 / var(--un-ring-opacity));}
  .red {
    --un-border-opacity:1;border-color:rgb(239 68 68 / var(--un-border-opacity));--un-text-opacity:1;color:rgb(185 28 28 / var(--un-text-opacity));
  }.red:hover{--un-bg-opacity:1;background-color:rgb(239 68 68 / var(--un-bg-opacity));}.red:focus{--un-ring-opacity:1;--un-ring-color:rgb(239 68 68 / var(--un-ring-opacity));}
  .orange {
    --un-border-opacity:1;border-color:rgb(249 115 22 / var(--un-border-opacity));--un-text-opacity:1;color:rgb(194 65 12 / var(--un-text-opacity));
  }.orange:hover{--un-bg-opacity:1;background-color:rgb(249 115 22 / var(--un-bg-opacity));}.orange:focus{--un-ring-opacity:1;--un-ring-color:rgb(249 115 22 / var(--un-ring-opacity));}
  .green {
    --un-border-opacity:1;border-color:rgb(34 197 94 / var(--un-border-opacity));--un-text-opacity:1;color:rgb(21 128 61 / var(--un-text-opacity));
  }.green:hover{--un-bg-opacity:1;background-color:rgb(34 197 94 / var(--un-bg-opacity));}.green:focus{--un-ring-opacity:1;--un-ring-color:rgb(34 197 94 / var(--un-ring-opacity));}
  .black {
    --un-border-opacity:1;border-color:rgb(107 114 128 / var(--un-border-opacity));--un-text-opacity:1;color:rgb(31 41 55 / var(--un-text-opacity));
  }.black:hover{--un-bg-opacity:1;background-color:rgb(17 24 39 / var(--un-bg-opacity));}.black:focus{--un-ring-opacity:1;--un-ring-color:rgb(107 114 128 / var(--un-ring-opacity));}
  .white {
    --un-text-opacity:1;color:rgb(31 41 55 / var(--un-text-opacity));
  }.white:hover{--un-bg-opacity:1;background-color:rgb(107 114 128 / var(--un-bg-opacity));--un-bg-opacity:0.25;}.white:focus{--un-ring-opacity:1;--un-ring-color:rgb(107 114 128 / var(--un-ring-opacity));}

  .filled {
    --un-text-opacity:1;color:rgb(255 255 255 / var(--un-text-opacity));
  }
  .filled.primary {
    --un-bg-opacity:1;background-color:rgb(37 99 235 / var(--un-bg-opacity));
  }.filled.primary:hover{--un-bg-opacity:1;background-color:rgb(29 78 216 / var(--un-bg-opacity));}
  .filled.red {
    --un-bg-opacity:1;background-color:rgb(220 38 38 / var(--un-bg-opacity));
  }.filled.red:hover{--un-bg-opacity:1;background-color:rgb(185 28 28 / var(--un-bg-opacity));}
  .filled.orange {
    --un-bg-opacity:1;background-color:rgb(234 88 12 / var(--un-bg-opacity));
  }.filled.orange:hover{--un-bg-opacity:1;background-color:rgb(194 65 12 / var(--un-bg-opacity));}
  .filled.green {
    --un-bg-opacity:1;background-color:rgb(22 163 74 / var(--un-bg-opacity));
  }.filled.green:hover{--un-bg-opacity:1;background-color:rgb(21 128 61 / var(--un-bg-opacity));}
  .filled.black {
    --un-bg-opacity:1;background-color:rgb(31 41 55 / var(--un-bg-opacity));
  }.filled.black:hover{--un-bg-opacity:1;background-color:rgb(17 24 39 / var(--un-bg-opacity));}
  .filled.white {
    --un-bg-opacity:1;background-color:rgb(243 244 246 / var(--un-bg-opacity));--un-text-opacity:1;color:rgb(0 0 0 / var(--un-text-opacity));
  }.filled.white:hover{--un-bg-opacity:1;background-color:rgb(255 255 255 / var(--un-bg-opacity));}.filled.white:focus{--un-ring-opacity:1;--un-ring-color:rgb(255 255 255 / var(--un-ring-opacity));}

  .filled,
  .outlined {
    border-width:1px;--un-shadow:var(--un-shadow-inset) 0 1px 2px 0 var(--un-shadow-color, rgb(0 0 0 / 0.05));box-shadow:var(--un-ring-offset-shadow), var(--un-ring-shadow), var(--un-shadow);
  }

  .menu,
  .link,
  .text {
    border-style:none;--un-text-opacity:1;color:rgb(75 85 99 / var(--un-text-opacity));--un-shadow:0 0 var(--un-shadow-color, rgb(0 0 0 / 0));box-shadow:var(--un-ring-offset-shadow), var(--un-ring-shadow), var(--un-shadow);
  }.menu:hover, .link:hover, .text:hover{background-color:transparent;--un-text-opacity:1;color:rgb(0 0 0 / var(--un-text-opacity));}.menu:focus, .link:focus, .text:focus{--un-ring-opacity:1;--un-ring-color:rgb(107 114 128 / var(--un-ring-opacity));}

  .menu {
    border-radius:0.5rem;
  }.menu:hover{--un-bg-opacity:1;background-color:rgb(229 231 235 / var(--un-bg-opacity));}
  .link {
  }.link:hover{text-decoration-line:underline;}
  .text {
    padding:0.75rem;font-size:1rem;line-height:1.5rem;font-weight:400;
  }
  .active {
    --un-bg-opacity:1;background-color:rgb(229 231 235 / var(--un-bg-opacity));--un-text-opacity:1;color:rgb(31 41 55 / var(--un-text-opacity));
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
