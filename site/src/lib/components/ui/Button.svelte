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
    class="sp-btn {className} {fill} {size} {color}">
    {@render children?.()}
    {#if showExternalLinkIcon}
      <span class="external-icon" style="vertical-align: -2px;"></span>
    {/if}
  </a>
{:else}
  <button
    class:active
    class:disabled={disable}
    class="sp-btn {className} {fill} {size} {color}"
    {type}
    {title}
    onclick={runWithSpinner}
    disabled={disable}>
    {@render children?.()}
    {#if loading}
      <span class="spinner" style="vertical-align: -2px;"></span>
    {/if}
  </button>
{/if}

<style>
  /* Base — shared by the <a> and <button> renders.
     `--btn-ring` is the focus-ring color (set per color class); `--btn-shadow` is
     the resting drop shadow (a subtle one for filled/outlined, none for the flat
     forms), reused as the innermost layer of the focus box-shadow so focusing
     doesn't drop it.
     NOTE: the base class is `sp-btn`, NOT `btn` — `$lib/buttons.css` defines a
     separate global `.btn` system (resting `var(--surface)` background) that would
     otherwise collide and give every Button a resting background. */
  .sp-btn {
    display: inline-block;
    text-align: center;
    border-radius: 0.25rem;
    --btn-ring: rgb(147 197 253 / 0.5);
    --btn-shadow: 0 0 transparent;
  }
  .sp-btn:hover {
    color: #fff;
  }
  .sp-btn:focus {
    outline: 2px solid transparent;
    outline-offset: 2px;
    /* 2px white gap + 2px colored ring (Uno's ring-2 with a white offset), over the resting shadow. */
    box-shadow: 0 0 0 2px #fff, 0 0 0 4px var(--btn-ring), var(--btn-shadow);
  }

  /* --- Outlined (the default form) + solid colors: bordered, colored text --- */
  .primary {
    border-color: var(--primary);
    color: var(--primary);
    --btn-ring: var(--primary);
  }
  .primary:hover {
    background-color: var(--primary);
  }
  .red {
    border-color: var(--danger);
    color: var(--danger);
    --btn-ring: var(--danger);
  }
  .red:hover {
    background-color: var(--danger);
  }
  .orange {
    border-color: var(--warning);
    color: var(--warning);
    --btn-ring: var(--warning);
  }
  .orange:hover {
    background-color: var(--warning);
  }
  .green {
    border-color: var(--success);
    color: var(--success);
    --btn-ring: var(--success);
  }
  .green:hover {
    background-color: var(--success);
  }
  .black {
    border-color: color-mix(in srgb, var(--color) 47%, transparent);
    color: color-mix(in srgb, var(--color) 88%, transparent);
    --btn-ring: color-mix(in srgb, var(--color) 47%, transparent);
  }
  .black:hover {
    background-color: color-mix(in srgb, var(--color) 92%, var(--background));
    color: var(--background);
  }
  .white {
    color: color-mix(in srgb, var(--color) 88%, transparent);
    --btn-ring: color-mix(in srgb, var(--color) 47%, transparent);
  }
  .white:hover {
    background-color: color-mix(in srgb, var(--color) 25%, transparent);
  }

  /* --- Filled: solid background, light text --- */
  .filled {
    color: #fff;
  }
  .filled.primary {
    background-color: var(--primary);
    color: var(--on-primary);
  }
  .filled.primary:hover {
    background-color: color-mix(in srgb, var(--primary) 85%, var(--color));
  }
  .filled.red {
    background-color: var(--danger);
  }
  .filled.red:hover {
    background-color: color-mix(in srgb, var(--danger) 85%, var(--color));
  }
  .filled.orange {
    background-color: var(--warning);
  }
  .filled.orange:hover {
    background-color: color-mix(in srgb, var(--warning) 85%, var(--color));
  }
  .filled.green {
    background-color: var(--success);
  }
  .filled.green:hover {
    background-color: color-mix(in srgb, var(--success) 85%, var(--color));
  }
  .filled.black {
    background-color: color-mix(in srgb, var(--color) 88%, var(--background));
    color: var(--background);
  }
  .filled.black:hover {
    background-color: var(--color);
  }
  .filled.white {
    background-color: var(--surface);
    color: var(--color);
  }
  .filled.white:hover {
    background-color: var(--background);
  }
  .filled.white:focus {
    --btn-ring: var(--background);
  }

  .filled,
  .outlined {
    border-width: 1px;
    --btn-shadow: 0 1px 2px 0 rgb(0 0 0 / 0.05);
    box-shadow: var(--btn-shadow);
  }

  /* --- Flat forms: no border, no shadow, muted text --- */
  .menu,
  .link,
  .text {
    border-style: none;
    color: color-mix(in srgb, var(--color) 75%, transparent);
    box-shadow: none;
    --btn-ring: color-mix(in srgb, var(--color) 47%, transparent);
  }
  .menu:hover,
  .link:hover,
  .text:hover {
    background-color: transparent;
    color: var(--color);
  }

  .menu {
    border-radius: 0.5rem;
  }
  .menu:hover {
    background-color: color-mix(in srgb, var(--background), var(--color) 12%);
  }
  .link:hover {
    text-decoration-line: underline;
  }
  .text {
    padding: 0.75rem;
    font-size: 1rem;
    line-height: 1.5rem;
    font-weight: 400;
  }
  .active {
    background-color: color-mix(in srgb, var(--background), var(--color) 12%);
    color: color-mix(in srgb, var(--color) 88%, transparent);
  }

  /* --- Sizes --- */
  .sm {
    padding: 0.375rem 0.625rem;
    font-size: 0.75rem;
    line-height: 1rem;
    font-weight: 500;
  }
  .md {
    padding: 0.5rem 1rem;
    font-size: 0.875rem;
    line-height: 1.25rem;
    font-weight: 500;
  }
  .lg {
    padding: 0.625rem 1.25rem;
    font-weight: 700;
  }

  :disabled,
  .disabled {
    cursor: not-allowed;
    opacity: 0.5;
  }

  /* --- Icons (masked SVGs, tinted with currentColor) --- */
  .external-icon,
  .spinner {
    display: inline-block;
    vertical-align: middle;
    width: 1em;
    height: 1em;
    background-color: currentColor;
    -webkit-mask: var(--icon) no-repeat;
    mask: var(--icon) no-repeat;
    -webkit-mask-size: 100% 100%;
    mask-size: 100% 100%;
  }
  .external-icon {
    --icon: url("data:image/svg+xml;utf8,%3Csvg viewBox='0 0 24 24' width='1em' height='1em' xmlns='http://www.w3.org/2000/svg'%3E%3Cpath fill='none' stroke='currentColor' stroke-linecap='round' stroke-linejoin='round' stroke-width='2' d='M12 6H6a2 2 0 0 0-2 2v10a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-6m-7 1l9-9m-5 0h5v5'/%3E%3C/svg%3E");
  }
  .spinner {
    margin-left: 0.25rem;
    margin-right: -0.25rem;
    animation: spin 1s linear infinite;
    --icon: url("data:image/svg+xml;utf8,%3Csvg viewBox='0 0 24 24' width='1em' height='1em' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='currentColor'%3E%3Cpath fill-rule='evenodd' d='M12 19a7 7 0 1 0 0-14a7 7 0 0 0 0 14m0 3c5.523 0 10-4.477 10-10S17.523 2 12 2S2 6.477 2 12s4.477 10 10 10' clip-rule='evenodd' opacity='.2'/%3E%3Cpath d='M2 12C2 6.477 6.477 2 12 2v3a7 7 0 0 0-7 7z'/%3E%3C/g%3E%3C/svg%3E");
  }
  @keyframes spin {
    from { transform: rotate(0deg); }
    to { transform: rotate(360deg); }
  }
</style>
