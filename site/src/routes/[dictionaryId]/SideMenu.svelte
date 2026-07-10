<script lang="ts">
  import type { Tables } from '$lib/types'
  import type { DictSyncStatus } from '$lib/db/dict-client/dict-sync-status.svelte'
  import DictSyncStatusButton from '$lib/db/dict-client/DictSyncStatus.svelte'
  import { page } from '$app/state'
  import IconFaSolidList from '~icons/fa-solid/list'
  import IconMdiBookOpenPageVariantOutline from '~icons/mdi/book-open-page-variant-outline'
  import IconFa6SolidUserShield from '~icons/fa6-solid/user-shield'
  import IconSvgSpinners3DotsFade from '~icons/svg-spinners/3-dots-fade'
  import IconFa6SolidFileLines from '~icons/fa6-solid/file-lines'
  import IconFa6SolidCircleInfo from '~icons/fa6-solid/circle-info'
  import IconTablerTextGrammar from '~icons/tabler/text-grammar'
  import IconFa6SolidUsers from '~icons/fa6-solid/users'
  import IconFa6SolidGear from '~icons/fa6-solid/gear'
  import IconFa6SolidRobot from '~icons/fa6-solid/robot'
  import IconFa6SolidClockRotateLeft from '~icons/fa6-solid/clock-rotate-left'
  import IconFa6SolidFileImport from '~icons/fa6-solid/file-import'
  import IconFa6SolidFileExport from '~icons/fa6-solid/file-export'
  import IconFa6SolidBook from '~icons/fa6-solid/book'
  import IconFa6SolidScroll from '~icons/fa6-solid/scroll'

  interface Props {
    dictionary: Tables<'dictionaries'>
    entry_count: number
    on_close: () => void
    is_manager: boolean
    is_editor_or_above: boolean
    loading: boolean
    can_edit: boolean
    dict_sync_status: DictSyncStatus | null
  }

  const {
    dictionary,
    entry_count,
    on_close,
    is_manager,
    is_editor_or_above,
    loading,
    can_edit,
    dict_sync_status,
  }: Props = $props()
</script>

<div class="mobile-heading">
  <a href="/" class="ld-home-link">
    {page.data.t('misc.LD')}
  </a>
  <h5>
    {dictionary.name}
  </h5>
</div>
<div onclick={on_close}>
  <!-- The dictionary home lives at the bare dict root; the open-book icon
       (matching the site home's "Living Dictionary" node) keeps it visually
       distinct from the site-home house button in the header. -->
  <a
    href={`/${dictionary.url}`}
    class:active={page.url.pathname.split('/').filter(Boolean).length === 1}>
    <IconMdiBookOpenPageVariantOutline class="icon-inline" />
    <span class="item-label">
      {page.data.t('dict_home.home')}
    </span>
  </a>
  <div class="nav-row" class:active={page.url.pathname.match(/entry|entries/)}>
    <a class="entries-link" href={`/${dictionary.url}/entries`}>
      <IconFaSolidList class="icon-inline" />
      <span class="item-label">
        {page.data.t('dictionary.entries')}
      </span>
    </a>
    <span style="flex-grow: 1"></span>
    {#if is_manager && loading}
      <IconSvgSpinners3DotsFade class="icon-inline" style="vertical-align: -4px; margin-left: 0.25rem; margin-right: 0.25rem" />
    {/if}
    {#if can_edit && dict_sync_status}
      <DictSyncStatusButton sync_status={dict_sync_status} />
    {/if}
    {#if entry_count}
      <span class="count-pill">
        {new Intl.NumberFormat().format(entry_count)}
      </span>
    {/if}
  </div>
  <!-- Admin-3 preview while the texts pipeline is iterated on (the shield marks
       the gate) — see .issues/texts-sentences-pipeline.md. -->
  {#if page.data.auth_user?.admin_level >= 3}
    {@const texts_count = page.data.dict_db?.texts.rows.length ?? 0}
    <a
      href={`/${dictionary.url}/texts`}
      class:active={page.url.pathname.match(/\/texts?(\/|$)/)}>
      <IconFa6SolidScroll class="icon-inline" />
      <span class="item-label">
        {page.data.t('dictionary.texts')}
      </span>
      {#if texts_count}
        <span class="count-pill" style="margin-inline-start: auto">
          {new Intl.NumberFormat().format(texts_count)}
        </span>
      {/if}
      <IconFa6SolidUserShield class="icon-inline admin-gate-icon" style={texts_count ? 'margin-inline-start: 0.375rem' : ''} />
    </a>
  {/if}
  {#if !is_manager}
    <a
      href={`/${dictionary.url}/synopsis`}
      class:active={page.url.pathname.includes('synopsis')}>
      <IconFa6SolidFileLines class="icon-inline" />
      <span class="item-label">
        {page.data.t('synopsis.name')}
      </span>
    </a>
  {/if}
  <a
    href={`/${dictionary.url}/about`}
    class:active={page.url.pathname.includes('about')}>
    <IconFa6SolidCircleInfo class="icon-inline" style="margin-left: 0.0625rem; margin-right: 0.0625rem" />
    <span class="item-label">
      {page.data.t('header.about')}
    </span>
  </a>
  <a
    href={`/${dictionary.url}/grammar`}
    class:active={page.url.pathname.includes('grammar')}>
    <IconTablerTextGrammar class="icon-inline" style="font-size: 1.125rem" />
    <span class="item-label">
      {page.data.t('dictionary.grammar')}
    </span>
  </a>
  <a
    href={`/${dictionary.url}/contributors`}
    class:active={page.url.pathname.includes('contributors')}>
    <IconFa6SolidUsers class="icon-inline" style="font-size: 1.125rem" />
    <span class="item-label">
      {page.data.t('dictionary.contributors')}
    </span>
  </a>
  {#if is_manager}
    <a
      href={`/${dictionary.url}/settings`}
      class:active={page.url.pathname.includes('settings')}>
      <IconFa6SolidGear class="icon-inline" style="margin-left: 0.125rem; margin-right: 0.125rem" />
      <span class="item-label">
        {page.data.t('misc.settings')}
      </span>
    </a>
  {/if}
  {#if is_editor_or_above}
    <a
      href={`/${dictionary.url}/agents`}
      class:active={page.url.pathname.includes('agents')}>
      <IconFa6SolidRobot class="icon-inline" style="margin-left: 0.0625rem; margin-right: 0.0625rem" />
      <span class="item-label">
        Agents
      </span>
    </a>
    <a
      href={`/${dictionary.url}/history`}
      class:active={page.url.pathname.includes('history')}>
      <IconFa6SolidClockRotateLeft class="icon-inline" style="margin-left: 0.0625rem; margin-right: 0.0625rem" />
      <span class="item-label">
        {page.data.t('history.history')}
      </span>
    </a>
    <a
      href={`/${dictionary.url}/sources`}
      class:active={page.url.pathname.includes('sources')}>
      <IconFa6SolidBook class="icon-inline" style="margin-left: 0.0625rem; margin-right: 0.0625rem" />
      <span class="item-label">
        {page.data.t({ dynamicKey: 'source.sources', fallback: 'Sources' })}
      </span>
    </a>
  {/if}
  {#if is_manager}
    {#if !dictionary.con_language_description}
      <a
        href={`/${dictionary.url}/import`}
        class:active={page.url.pathname.includes('import')}>
        <IconFa6SolidFileImport class="icon-inline" style="margin-left: 0.125rem; margin-right: 0.125rem" />
        <span class="item-label">
          {page.data.t('import_page.import')}
        </span>
      </a>
    {/if}
    {#if entry_count}
      <a
        href={`/${dictionary.url}/export`}
        class:active={page.url.pathname.includes('export')}>
        <IconFa6SolidFileExport class="icon-inline" style="margin-left: 0.25rem" />
        <span class="item-label">
          {page.data.t('misc.export')}
        </span>
      </a>
    {/if}
  {/if}
</div>

<div style="margin-top: auto"></div>

<a href="/terms" target="_blank" class="link">
  {page.data.t('dictionary.terms_of_use')}
</a>
<a href="/privacy-policy" target="_blank" class="link">
  {page.data.t('terms.privacy_policy')}
</a>
<a href="https://www.youtube.com/static?template=terms" target="_blank" rel="noopener noreferrer" class="link">
  {page.data.t('dictionary.youtube_terms')}
</a>
<a href="https://policies.google.com/privacy" target="_blank" rel="noopener noreferrer" class="link last-link">
  {page.data.t('dictionary.google_terms')}
</a>

<style>
  .mobile-heading {
    display: block;
  }

  @media (min-width: 768px) {
    .mobile-heading {
      display: none;
    }
  }

  .ld-home-link {
    display: block;
    padding: 0.75rem;
    font-size: 1.125rem;
    line-height: 1.75rem;
    font-weight: 600;
    margin-bottom: 0.75rem;
    border-bottom: 1px solid var(--border-color);
  }

  h5 {
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.025em;
    margin-left: 0.75rem;
    margin-right: 0.75rem;
    margin-bottom: 0.5rem;
  }

  .item-label {
    font-weight: 500;
    margin-left: 0.5rem;
    margin-right: 0.5rem;
  }

  /* Marks an admin-level-3-gated item (see the dict-home preview link). */
  :global(.admin-gate-icon) {
    font-size: 0.6875rem;
    opacity: 0.45;
    margin-inline-start: auto;
  }

  .count-pill {
    flex-shrink: 0;
    display: inline-block;
    padding: 0.125rem 0.375rem;
    line-height: 1.4;
    font-size: 0.6875rem;
    font-weight: 600;
    font-variant-numeric: tabular-nums;
    color: color-mix(in srgb, var(--color) 85%, var(--background)); /* ≈ gray-700 */
    background-color: color-mix(in srgb, var(--background), var(--color) 18%); /* ≈ gray-300 */
    border-radius: 9999px;
  }

  /* `:not(.entries-link)` keeps this rule's padding/margin off the Entries row's
     inner link — it must stay unpadded (see `.entries-link` below) since it lives
     nested inside `.nav-row`, which already carries this same padding. Without the
     exclusion, a:not(.link) still matches `.entries-link` (higher specificity than
     the lone `.entries-link` class rule) and its padding/margin stack on top of
     `.nav-row`'s, roughly doubling the row's height. */
  a:not(.link):not(.entries-link),
  .nav-row {
    color: color-mix(in srgb, var(--color) 75%, var(--background)); /* ≈ gray-600 */
    padding: 0.5rem 0.75rem;
    display: flex;
    align-items: center;
    margin-bottom: 0.5rem;
  }

  a:not(.link):not(.entries-link):hover,
  .nav-row:hover {
    background-color: color-mix(in srgb, var(--background), var(--color) 10%); /* ≈ gray-200 */
  }

  /* The Entries row is a div (not an `<a>`) so the sync button can sit next to
     the nav link without nesting a `<button>` inside an `<a>` (invalid HTML).
     `.entries-link` carries just the icon + label, no padding/margin of its own —
     `.nav-row` already supplies that padding for the whole row. It also needs to
     shrink (and its label truncate) before the sync button/count pill do, so a
     large entry count never pushes the pill past the sidebar's edge. */
  .entries-link {
    display: flex;
    align-items: center;
    min-width: 0;
    flex-shrink: 1;
    color: inherit;
    text-decoration: none;
  }

  .entries-link .item-label {
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    /* The flex spacer right after `.entries-link` already provides breathing room
       before the sync button/count pill, so this trailing margin would just be
       reclaimable dead space — drop it to buy the label more room before eliding. */
    margin-right: 0;
  }

  @media (min-width: 768px) {
    a:not(.link),
    .nav-row {
      border-radius: 0.5rem;
    }
  }

  .active {
    background-color: color-mix(in srgb, var(--background), var(--color) 10%); /* ≈ gray-200 */
    color: var(--color); /* ≈ gray-900 */
  }

  .link {
    display: block;
    font-size: 0.875rem;
    line-height: 1.25rem;
    padding-left: 0.75rem;
    font-weight: 500;
    color: color-mix(in srgb, var(--color) 85%, var(--background)); /* ≈ gray-700 */
    padding-top: 0.25rem;
    padding-bottom: 0.25rem;
    font-size: 0.78em;
  }

  .link:hover {
    text-decoration-line: underline;
  }

  .last-link {
    margin-bottom: 0.75rem;
  }
</style>
