<script lang="ts">
  import type { TableInfo } from '$lib/db/introspect'
  import IconMdiCircleMedium from '~icons/mdi/circle-medium'
  import IconMdiCircleOutline from '~icons/mdi/circle-outline'
  import IconMdiDeleteSweep from '~icons/mdi/delete-sweep'
  import IconMdiFingerprint from '~icons/mdi/fingerprint'
  import IconMdiHelpCircleOutline from '~icons/mdi/help-circle-outline'
  import IconMdiKey from '~icons/mdi/key'
  import IconMdiLinkVariant from '~icons/mdi/link-variant'
  import IconMdiRestore from '~icons/mdi/restore'
  import IconMdiShieldLockOutline from '~icons/mdi/shield-lock-outline'
  import IconMdiTable from '~icons/mdi/table'

  let { table }: { table: TableInfo } = $props()
  let show_raw_sql = $state(false)

  function fk_for_column(name: string) {
    return table.foreign_keys.find(fk => fk.column === name)
  }

  function show_on_delete(action: string): boolean {
    return !!action && action !== 'NO ACTION'
  }
</script>

<section id="table-{table.name}" class="table-card">
  <header class="table-header">
    <IconMdiTable style="font-size: 1.125rem; color: var(--primary)" />
    <h2 class="table-name">{table.name}</h2>
    {#if table.row_count !== null}
      <span class="row-count">
        {table.row_count.toLocaleString()} {table.row_count === 1 ? 'row' : 'rows'}
      </span>
    {/if}
  </header>

  <div class="columns">
    {#each table.columns as column (column.name)}
      {@const fk = fk_for_column(column.name)}
      <div class="column-row">
        <div class="column-icons">
          {#if column.pk_order > 0}
            <IconMdiKey style="color: var(--primary)" />
          {/if}
          {#if column.is_foreign_key}
            <IconMdiLinkVariant />
          {/if}
          {#if column.is_unique && column.pk_order === 0}
            <IconMdiFingerprint />
          {/if}
          {#if column.not_null}
            <IconMdiCircleMedium style="font-size: 0.75rem" />
          {:else}
            <IconMdiCircleOutline style="font-size: 0.75rem" />
          {/if}
        </div>
        <div class="column-name-wrap">
          <span>{column.name}</span>
          {#if fk}
            <a href="#table-{fk.target_table}" class="fk-link">
              <span>→ {fk.target_table}({fk.target_column})</span>
              {#if show_on_delete(fk.on_delete)}
                {#if fk.on_delete === 'CASCADE'}
                  <span title="ON DELETE CASCADE"><IconMdiDeleteSweep /></span>
                {:else if fk.on_delete === 'SET NULL'}
                  <span title="ON DELETE SET NULL"><IconMdiCircleOutline /></span>
                {:else if fk.on_delete === 'RESTRICT'}
                  <span title="ON DELETE RESTRICT"><IconMdiShieldLockOutline /></span>
                {:else if fk.on_delete === 'SET DEFAULT'}
                  <span title="ON DELETE SET DEFAULT"><IconMdiRestore /></span>
                {:else}
                  <span title="ON DELETE {fk.on_delete}"><IconMdiHelpCircleOutline /></span>
                {/if}
              {/if}
            </a>
          {/if}
          {#if column.default_value !== null}
            <span class="default-value">default {column.default_value}</span>
          {/if}
        </div>
        <div class="column-type">{column.type || '—'}</div>
      </div>
    {/each}
  </div>

  {#if table.indexes.length > 0 || table.triggers.length > 0 || (table.primary_key_columns.length > 1)}
    <footer class="table-footer">
      {#if table.primary_key_columns.length > 1}
        <div>
          <span class="footer-label">PK:</span>
          <span class="mono">({table.primary_key_columns.join(', ')})</span>
        </div>
      {/if}
      {#each table.indexes as idx (idx.name)}
        {#if idx.origin !== 'pk'}
          <div>
            <span class="footer-label">{idx.unique ? 'UNIQUE' : 'INDEX'}</span>
            <span class="mono">{idx.name} ({idx.columns.join(', ')})</span>
            {#if idx.partial_where}
              <span class="footer-label">WHERE</span>
              <span class="mono">{idx.partial_where}</span>
            {/if}
          </div>
        {/if}
      {/each}
      {#each table.triggers as trigger (trigger.name)}
        <div>
          <span class="footer-label">TRIGGER</span>
          <a href="#trigger-{trigger.name}" class="trigger-link">{trigger.name}</a>
        </div>
      {/each}
    </footer>
  {/if}

  <div class="raw-toggle-section">
    <button type="button" class="raw-toggle" onclick={() => show_raw_sql = !show_raw_sql}>
      {show_raw_sql ? '▾' : '▸'} raw CREATE
    </button>
    {#if show_raw_sql}
      <pre class="raw-sql">{table.raw_sql}</pre>
    {/if}
  </div>
</section>

<style>
  .table-card {
    background: var(--surface);
    border-radius: 0.5rem;
    overflow: hidden;
    scroll-margin-top: 5rem;
  }
  .table-header {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    padding: 0.75rem 1rem;
    border-bottom: 1px solid var(--border-color);
  }
  .table-name {
    font-family: var(--font-mono);
    font-weight: 600;
    font-size: 1rem;
    margin: 0;
  }
  .row-count {
    margin-left: auto;
    font-size: 0.75rem;
    font-variant-numeric: tabular-nums;
    padding: 0.125rem 0.5rem;
    border-radius: 0.25rem;
    background: var(--background);
    color: var(--color-secondary);
  }

  .columns {
    padding: 0.5rem;
    font-family: var(--font-mono);
    font-size: 0.875rem;
  }
  .column-row {
    display: grid;
    grid-template-columns: auto 1fr auto;
    align-items: center;
    gap: 0.5rem;
    padding: 0.25rem 0.5rem;
    border-radius: 0.25rem;
  }
  .column-row:hover {
    background: var(--background);
  }
  .column-icons {
    display: flex;
    align-items: center;
    gap: 0.125rem;
    color: var(--color-secondary);
    font-size: 1rem;
  }
  .column-name-wrap {
    min-width: 0;
  }
  .fk-link {
    margin-left: 0.5rem;
    display: inline-flex;
    align-items: center;
    gap: 0.25rem;
    font-size: 0.75rem;
    color: var(--color-secondary);
    text-decoration: none;
    vertical-align: baseline;
  }
  .fk-link:hover {
    color: var(--primary);
  }
  .default-value {
    margin-left: 0.5rem;
    font-size: 0.75rem;
    color: var(--color-secondary);
  }
  .column-type {
    font-size: 0.75rem;
    color: var(--color-secondary);
  }

  .table-footer {
    border-top: 1px solid var(--border-color);
    padding: 0.5rem 1rem;
    font-size: 0.75rem;
  }
  .table-footer > * + * {
    margin-top: 0.25rem;
  }
  .footer-label {
    color: var(--color-secondary);
  }
  .mono {
    font-family: var(--font-mono);
  }
  .trigger-link {
    font-family: var(--font-mono);
    text-decoration: none;
  }
  .trigger-link:hover {
    color: var(--primary);
  }

  .raw-toggle-section {
    padding: 0.5rem 1rem;
    border-top: 1px solid var(--border-color);
  }
  .raw-toggle {
    font-size: 0.75rem;
    color: var(--color-secondary);
    background: transparent;
    border: 0;
    padding: 0;
    cursor: pointer;
  }
  .raw-toggle:hover {
    color: var(--color);
  }
  .raw-sql {
    margin-top: 0.5rem;
    padding: 0.75rem;
    background: var(--background);
    border-radius: 0.25rem;
    font-size: 0.75rem;
    overflow: auto;
    font-family: var(--font-mono);
    white-space: pre-wrap;
    word-break: break-all;
  }
</style>
