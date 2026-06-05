<script lang="ts">
  /**
   * Filter + reset controls for the schema graph. Sits as an absolute-positioned
   * `<Panel>` in the top-right of the xyflow canvas.
   */
  import IconMdiEye from '~icons/mdi/eye'
  import IconMdiRefresh from '~icons/mdi/refresh'

  interface Props {
    hide_junctions: boolean
    hide_system: boolean
    hidden_count: number
    visible_count: number
    on_toggle_junctions: () => void
    on_toggle_system: () => void
    on_show_all: () => void
    on_reset_layout: () => void
  }

  const {
    hide_junctions,
    hide_system,
    hidden_count,
    visible_count,
    on_toggle_junctions,
    on_toggle_system,
    on_show_all,
    on_reset_layout,
  }: Props = $props()
</script>

<div class="toolbar">
  <label class="check-row">
    <input type="checkbox" checked={hide_junctions} onchange={on_toggle_junctions} class="check" />
    <span>Hide junction tables</span>
  </label>
  <label class="check-row">
    <input type="checkbox" checked={hide_system} onchange={on_toggle_system} class="check" />
    <span>Hide system tables</span>
  </label>
  <hr class="divider" />
  <div class="count-line">
    {visible_count} visible{#if hidden_count > 0}, {hidden_count} hidden{/if}
  </div>
  <div class="action-row">
    <button type="button" class="btn-ghost btn-sm" onclick={on_show_all} disabled={hidden_count === 0}>
      <IconMdiEye style="margin-right: 0.125rem" />Show all
    </button>
    <button type="button" class="btn-ghost btn-sm" onclick={on_reset_layout} title="Reset drag positions and re-run auto-layout">
      <IconMdiRefresh style="margin-right: 0.125rem" />Reset
    </button>
  </div>
</div>

<style>
  .toolbar {
    display: flex;
    flex-direction: column;
    gap: 0.25rem;
    background: var(--surface);
    border: 1px solid var(--border-color);
    border-radius: 0.375rem;
    box-shadow: 0 4px 6px -1px rgb(0 0 0 / 0.1), 0 2px 4px -2px rgb(0 0 0 / 0.1);
    padding: 0.5rem;
    font-size: 0.75rem;
  }
  .check-row {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    cursor: pointer;
    user-select: none;
  }
  .check {
    cursor: pointer;
  }
  .divider {
    border-top: 1px solid var(--border-color);
    margin-top: 0.25rem;
    margin-bottom: 0.25rem;
  }
  .count-line {
    color: var(--color-secondary);
    font-size: 11px;
  }
  .action-row {
    display: flex;
    gap: 0.25rem;
    margin-top: 0.25rem;
  }
</style>
