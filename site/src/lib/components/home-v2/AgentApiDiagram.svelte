<script lang="ts">
  import { page } from '$app/state'
  import IconMdiFilePdfBox from '~icons/mdi/file-pdf-box'
  import IconMdiFileDelimitedOutline from '~icons/mdi/file-delimited-outline'
  import IconMdiNotebookOutline from '~icons/mdi/notebook-outline'
  import IconMdiRobotOutline from '~icons/mdi/robot-outline'
  import IconMdiBookOpenPageVariantOutline from '~icons/mdi/book-open-page-variant-outline'
  import IconMdiCellphone from '~icons/mdi/cellphone'
  import IconMdiPrinterOutline from '~icons/mdi/printer-outline'
  import IconMdiKeyVariant from '~icons/mdi/key-variant'

  const t = $derived(page.data.t)
</script>

<section class="api-section">
  <h2>{t('home_v2.api_heading')}</h2>
  <p class="sub">{t('home_v2.api_subline')}</p>

  <div class="diagram">
    <div class="node">
      <div class="doc-pile">
        <div class="doc doc-1"><IconMdiFilePdfBox style="color: #ef4444" /></div>
        <div class="doc doc-2"><IconMdiFileDelimitedOutline style="color: #10b981" /></div>
        <div class="doc doc-3"><IconMdiNotebookOutline style="color: #f59e0b" /></div>
      </div>
      <div class="node-title">{t('home_v2.api_sources_label')}</div>
    </div>

    <div class="connector" aria-hidden="true"><span class="pulse"></span></div>

    <div class="node">
      <div class="chip" style="--accent: #8b5cf6"><IconMdiRobotOutline /></div>
      <div class="node-title">{t('home_v2.api_agent_label')}</div>
      <div class="node-sub">{t('home_v2.api_agent_action')}</div>
    </div>

    <div class="connector" aria-hidden="true">
      <span class="pulse"></span>
      <span class="key-badge"><IconMdiKeyVariant style="font-size: 0.75rem" /> {t('home_v2.api_write_key')}</span>
    </div>

    <div class="node node-center">
      <div class="chip chip-lg" style="--accent: var(--primary)"><IconMdiBookOpenPageVariantOutline /></div>
      <div class="node-title">{t('home_v2.api_ld_label')}</div>
      <div class="node-sub">{t('home_v2.api_ld_sub')}</div>
    </div>

    <div class="connector" aria-hidden="true">
      <span class="pulse"></span>
      <span class="key-badge"><IconMdiKeyVariant style="font-size: 0.75rem" /> {t('home_v2.api_read_key')}</span>
    </div>

    <div class="node outputs">
      <div class="output">
        <div class="chip chip-sm" style="--accent: #06b6d4"><IconMdiCellphone /></div>
        <div class="output-label">{t('home_v2.api_output_apps')}</div>
      </div>
      <div class="output">
        <div class="chip chip-sm" style="--accent: #64748b"><IconMdiPrinterOutline /></div>
        <div class="output-label">{t('home_v2.api_output_print')}</div>
      </div>
    </div>
  </div>
</section>

<style>
  .api-section {
    max-width: 72rem;
    margin: 0 auto;
    padding: 2.5rem 1rem 1rem;
  }

  h2 {
    font-size: 1.5rem;
    font-weight: 700;
    letter-spacing: -0.02em;
    margin: 0 0 0.25rem;
  }

  .sub {
    color: var(--color-secondary);
    font-size: 0.9375rem;
    margin: 0 0 1.75rem;
    max-width: 40rem;
  }

  .diagram {
    display: flex;
    flex-direction: column;
    align-items: stretch;
    gap: 0;
    background: var(--surface);
    border-radius: 1rem;
    padding: 1.75rem 1.5rem;
  }

  @media (min-width: 900px) {
    .diagram {
      flex-direction: row;
      align-items: center;
      padding: 2.25rem 2rem;
    }
  }

  .node {
    display: flex;
    flex-direction: column;
    align-items: center;
    text-align: center;
    flex-shrink: 0;
  }

  .node-title {
    margin-top: 0.625rem;
    font-weight: 600;
    font-size: 0.875rem;
  }

  .node-sub {
    margin-top: 0.125rem;
    font-size: 0.75rem;
    color: var(--color-secondary);
    max-width: 11rem;
  }

  .chip {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 3.25rem;
    height: 3.25rem;
    border-radius: 0.875rem;
    font-size: 1.5rem;
    color: var(--accent);
    background: color-mix(in srgb, var(--accent) 14%, transparent);
  }

  .chip-lg {
    width: 4rem;
    height: 4rem;
    font-size: 1.875rem;
  }

  .chip-sm {
    width: 2.5rem;
    height: 2.5rem;
    font-size: 1.125rem;
  }

  .doc-pile {
    position: relative;
    width: 4.5rem;
    height: 3.5rem;
  }

  .doc {
    position: absolute;
    display: flex;
    align-items: center;
    justify-content: center;
    width: 2.375rem;
    height: 2.375rem;
    border-radius: 0.5rem;
    background: var(--background);
    box-shadow: 0 2px 6px rgb(0 0 0 / 0.12);
    font-size: 1.25rem;
  }

  .doc-1 { left: 0; top: 0.875rem; transform: rotate(-8deg); }
  .doc-2 { left: 1.125rem; top: 0.375rem; transform: rotate(3deg); }
  .doc-3 { left: 2.25rem; top: 1rem; transform: rotate(10deg); z-index: 1; }

  .connector {
    position: relative;
    flex: 1;
    min-width: 2rem;
    height: 2px;
    margin: 1.5rem 0.75rem;
    background: color-mix(in srgb, var(--color) 18%, transparent);
    border-radius: 1px;
    align-self: center;
    width: auto;
  }

  @media (max-width: 899.9px) {
    .connector {
      flex: none;
      width: 2px;
      height: 2.25rem;
      margin: 0.75rem auto;
    }
  }

  .pulse {
    position: absolute;
    width: 7px;
    height: 7px;
    border-radius: 50%;
    background: var(--primary);
    top: -2.5px;
    left: 0;
    animation: flow-x 2.2s linear infinite;
  }

  @media (max-width: 899.9px) {
    .pulse {
      top: 0;
      left: -2.5px;
      animation: flow-y 2.2s linear infinite;
    }
  }

  @keyframes flow-x {
    0% { left: 0; opacity: 0; }
    12% { opacity: 1; }
    88% { opacity: 1; }
    100% { left: calc(100% - 7px); opacity: 0; }
  }

  @keyframes flow-y {
    0% { top: 0; opacity: 0; }
    12% { opacity: 1; }
    88% { opacity: 1; }
    100% { top: calc(100% - 7px); opacity: 0; }
  }

  @media (prefers-reduced-motion: reduce) {
    .pulse {
      animation: none;
      opacity: 0;
    }
  }

  .key-badge {
    position: absolute;
    top: -1.375rem;
    left: 50%;
    transform: translateX(-50%);
    display: inline-flex;
    align-items: center;
    gap: 0.25rem;
    padding: 0.125rem 0.5rem;
    border-radius: 9999px;
    background: color-mix(in srgb, var(--primary) 12%, transparent);
    color: var(--primary);
    font-size: 0.6875rem;
    font-weight: 600;
    white-space: nowrap;
  }

  @media (max-width: 899.9px) {
    .key-badge {
      top: 50%;
      left: 1rem;
      transform: translateY(-50%);
    }
  }

  .outputs {
    gap: 0.875rem;
  }

  .output {
    display: flex;
    align-items: center;
    gap: 0.625rem;
  }

  .output-label {
    font-size: 0.8125rem;
    font-weight: 500;
  }
</style>
