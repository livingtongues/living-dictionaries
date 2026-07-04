<script>
  import { fly } from 'svelte/transition'
  import { portal } from '../portal'
  import { clickoutside } from '../actions/clickoutside'

  let { portalTarget = undefined, onclickoutside = undefined, class: klass = '', children } = $props()
</script>

{#if portalTarget}
  <div
    use:portal={portalTarget}
    use:clickoutside
    onclickoutside={onclickoutside}
    transition:fly={{ y: -10, duration: 150 }}
    class="sp-d8trwd {klass}">
    <div class="sv-menu">
      {@render children?.()}
    </div>
  </div>
{:else}
  <div
    use:clickoutside
    onclickoutside={onclickoutside}
    transition:fly={{ y: -10, duration: 150 }}
    class="sp-d8trwd {klass}">
    <div class="sv-menu">
      {@render children?.()}
    </div>
  </div>
{/if}

<style>
  :global(.sp-d8trwd) {
    position: absolute;
    z-index: 30;
    margin-top: 0.5rem;
    width: 12rem;
    border-radius: 0.375rem;
    box-shadow: 0 10px 15px -3px rgb(0 0 0 / 0.1), 0 4px 6px -4px rgb(0 0 0 / 0.1);
  }

  .sv-menu {
    display: flex;
    flex-direction: column;
    border-radius: 0.375rem;
    background-color: var(--background);
    border: 1px solid var(--border-color); /* separates the menu from a dark page (shadow alone vanishes) */
    padding-top: 0.25rem;
    padding-bottom: 0.25rem;
  }

  :global(.sv-menu a),
  :global(.sv-menu label),
  :global(.sv-menu button) {
    padding: 0.5rem 1rem;
    text-align: left;
    font-size: 0.875rem;
    line-height: 1.25rem;
    color: color-mix(in srgb, var(--color) 85%, var(--background));
    transition: color 150ms, background-color 150ms;
  }

  :global(.sv-menu a):hover,
  :global(.sv-menu label):hover,
  :global(.sv-menu button):hover {
    background-color: var(--surface);
  }
</style>
