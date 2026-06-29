<script lang="ts">
  // A thin horizontal rail of clustered key-event ticks (deploys) overlaid on the top
  // band of a time chart. Each tick = one cluster; a count badge appears when it holds
  // more than one event. Hover (or tap to pin) reveals a popover listing each event —
  // label + optional note rows, with the "current" build accented. Shared HTML overlay
  // for ComboChart + LineChart so the marker treatment stays identical. KEEP IN SYNC
  // across house / living-dictionaries / tutor.

  interface NoteItem { label: string, text: string, color?: string }
  export interface RailEvent { label: string, color?: string, current?: boolean, note?: { title: string, items: NoteItem[] } }
  export interface RailCluster { left_pct: number, items: RailEvent[] }

  interface Props {
    clusters: RailCluster[]
    /** Glyph shown on each tick (🚀 deploy in house/tutor, ⬆ in LD). */
    icon?: string
    accent?: string
  }
  const { clusters, icon = '🚀', accent = 'var(--primary)' }: Props = $props()

  let hover_i = $state<number | null>(null)
  let pinned_i = $state<number | null>(null)
  const active_i = $derived(pinned_i !== null ? pinned_i : hover_i)
  function toggle(i: number) {
    pinned_i = pinned_i === i ? null : i
  }

  const is_current = (cluster: RailCluster) => cluster.items.some(item => item.current)
  // Drop a leading icon glyph from a label so the popover row doesn't double the tick's.
  function row_label(label: string): string {
    return label.startsWith(icon) ? label.slice(icon.length).trim() : label
  }
  function shift(left_pct: number): string {
    return left_pct > 62 ? 'translateX(-92%)' : left_pct < 24 ? 'translateX(-8%)' : 'translateX(-50%)'
  }
</script>

<div class="rail">
  {#each clusters as cluster, i (i)}
    {@const current = is_current(cluster)}
    <button
      type="button"
      class="tick"
      class:current
      style:left={`clamp(18px, ${cluster.left_pct}%, calc(100% - 18px))`}
      style:--accent={accent}
      onpointerenter={() => (hover_i = i)}
      onpointerleave={() => (hover_i = null)}
      onclick={() => toggle(i)}
      aria-label={`${cluster.items.length} deploy${cluster.items.length === 1 ? '' : 's'}`}>
      <span class="tick-icon">{icon}</span>
      {#if cluster.items.length > 1}<span class="tick-count">{cluster.items.length}</span>{/if}
    </button>

    {#if active_i === i}
      <div class="note" style:left={`${cluster.left_pct}%`} style:transform={shift(cluster.left_pct)}>
        <div class="note-title">
          {cluster.items.length} deploy{cluster.items.length === 1 ? '' : 's'}
        </div>
        {#each [...cluster.items].reverse() as ev, j (j)}
          <div class="ev" class:current={ev.current} style:--accent={accent}>
            <div class="ev-head">
              <span class="ev-label">{row_label(ev.label)}</span>
              {#if ev.current}<span class="ev-badge">current</span>{/if}
            </div>
            {#if ev.note}
              {#each ev.note.items as it (it.label)}
                <div class="ev-note"><span class="ev-note-label">{it.label}</span>{it.text}</div>
              {/each}
            {/if}
          </div>
        {/each}
      </div>
    {/if}
  {/each}
</div>

<style>
  .rail {
    position: absolute;
    top: 0;
    left: 0;
    right: 0;
    height: 22px;
    pointer-events: none;
  }
  .tick {
    position: absolute;
    top: 0;
    transform: translateX(-50%);
    display: inline-flex;
    align-items: center;
    gap: 3px;
    box-sizing: border-box;
    padding: 1px 5px;
    font-family: inherit;
    font-size: 11px;
    line-height: 1.1;
    color: var(--color-secondary);
    border: 1px solid color-mix(in srgb, currentColor 35%, transparent);
    background: color-mix(in srgb, var(--surface) 86%, currentColor);
    border-radius: 8px;
    cursor: pointer;
    pointer-events: auto;
    transition: background 0.12s, border-color 0.12s, transform 0.06s;
  }
  .tick:hover { transform: translateX(-50%) translateY(-1px); }
  .tick:active { transform: translateX(-50%) scale(0.94); }
  .tick:focus-visible { outline: 2px solid var(--accent); outline-offset: 1px; }
  .tick.current {
    color: var(--accent);
    border-color: color-mix(in srgb, var(--accent) 55%, transparent);
    background: color-mix(in srgb, var(--accent) 14%, var(--surface));
  }
  .tick-icon { font-size: 11px; }
  .tick-count {
    font-weight: 800;
    font-variant-numeric: tabular-nums;
    color: currentColor;
  }
  .note {
    position: absolute;
    top: 26px;
    width: max-content;
    max-width: 280px;
    max-height: 232px;
    overflow-y: auto;
    overscroll-behavior: contain;
    pointer-events: auto;
    background: var(--surface);
    border: 1px solid var(--border-color);
    border-radius: 10px;
    box-shadow: 0 6px 20px rgba(0, 0, 0, 0.18);
    padding: 0.55rem 0.65rem;
    font-size: 0.76rem;
    line-height: 1.36;
    z-index: 4;
  }
  .note-title { position: sticky; top: 0; background: var(--surface); font-weight: 800; font-size: 0.8rem; padding-bottom: 0.4rem; }
  .ev + .ev { margin-top: 0.35rem; padding-top: 0.35rem; border-top: 1px solid var(--border-color); }
  .ev.current { color: var(--accent); }
  .ev-head { display: flex; align-items: baseline; gap: 0.4rem; }
  .ev-label { font-weight: 700; font-variant-numeric: tabular-nums; }
  .ev-badge {
    font-size: 0.62rem;
    font-weight: 800;
    text-transform: uppercase;
    letter-spacing: 0.03em;
    color: var(--accent);
  }
  .ev-note { color: var(--color-secondary); }
  .ev-note-label { font-weight: 600; margin-right: 0.35rem; }
</style>
