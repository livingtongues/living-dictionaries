<script lang="ts">
  import { clickoutside } from '$lib/utils/clickoutside'
  import IconMdiClose from '~icons/mdi/close'
  import IconMdiPlus from '~icons/mdi/plus'
  import { EMOJI_CATEGORIES, QUICK_REACTIONS } from './emoji-data'

  interface Props {
    on_pick: (emoji: string) => void
    close: () => void
  }
  let { on_pick, close }: Props = $props()

  let show_full = $state(false)

  function pick(emoji: string) {
    on_pick(emoji)
    close()
  }
</script>

<div class="picker" use:clickoutside onclickoutside={close} role="menu">
  <div class="quick-row">
    {#each QUICK_REACTIONS as emoji (emoji)}
      <button type="button" class="emoji-btn" title={emoji} onclick={() => pick(emoji)}>{emoji}</button>
    {/each}
    <button type="button" class={['more-btn', { active: show_full }]} aria-label="More emojis" aria-expanded={show_full} onclick={() => { show_full = !show_full }}>
      {#if show_full}<IconMdiClose />{:else}<IconMdiPlus />{/if}
    </button>
  </div>

  {#if show_full}
    <div class="full-grid">
      {#each EMOJI_CATEGORIES as category (category.label)}
        <div class="cat-label">{category.label}</div>
        <div class="cat-emojis">
          {#each category.emojis as emoji (emoji)}
            <button type="button" class="emoji-btn" title={emoji} onclick={() => pick(emoji)}>{emoji}</button>
          {/each}
        </div>
      {/each}
    </div>
  {/if}
</div>

<style>
  .picker {
    position: absolute;
    z-index: 30;
    bottom: 100%;
    right: 0;
    margin-bottom: 0.25rem;
    background: var(--surface);
    border: 1px solid var(--border-color);
    border-radius: 0.75rem;
    box-shadow: 0 8px 24px rgb(0 0 0 / 0.18);
    padding: 0.35rem;
  }
  .quick-row {
    display: flex;
    align-items: center;
    gap: 0.1rem;
  }
  .emoji-btn {
    border: none;
    background: transparent;
    cursor: pointer;
    font-size: 1.15rem;
    line-height: 1;
    padding: 0.2rem;
    border-radius: 0.4rem;
    display: inline-flex;
    align-items: center;
    justify-content: center;
  }
  .emoji-btn:hover {
    background: color-mix(in srgb, var(--primary), transparent 85%);
  }
  .more-btn {
    border: none;
    background: transparent;
    color: var(--color-secondary);
    cursor: pointer;
    padding: 0.25rem;
    margin-left: 0.15rem;
    border-radius: 0.4rem;
    display: inline-flex;
  }
  .more-btn:hover,
  .more-btn.active {
    background: var(--surface-hover, color-mix(in srgb, var(--color), transparent 90%));
    color: var(--color);
  }
  .full-grid {
    margin-top: 0.35rem;
    padding-top: 0.35rem;
    border-top: 1px solid var(--border-color);
    width: 15.5rem;
    max-height: 15rem;
    overflow-y: auto;
  }
  .cat-label {
    font-size: 0.65rem;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.04em;
    color: var(--color-secondary);
    margin: 0.25rem 0.15rem 0.1rem;
  }
  .cat-emojis {
    display: grid;
    grid-template-columns: repeat(8, 1fr);
    gap: 0.05rem;
  }
</style>
