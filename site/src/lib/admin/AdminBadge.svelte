<script lang="ts">
  import type { AdminLevel } from '$lib/admins'
  import IconMdiShieldAccount from '~icons/mdi/shield-account'

  interface Props {
    level: AdminLevel
    /** `'pill'` for tiny inline use (table rows), `'lg'` for header chips. */
    size?: 'pill' | 'lg'
  }

  const { level, size = 'pill' }: Props = $props()

  // Distinct from existing primary (purple) / success / warning chips.
  //   L2 → indigo (super-user / dev admin)
  //   L1 → slate (editor admin)
  const palette = $derived.by(() => {
    if (level === 2) return { bg: '#4f46e5', fg: '#ffffff' } // indigo-600
    return { bg: '#475569', fg: '#ffffff' } // slate-600
  })

</script>

<span
  class={['admin-badge', size === 'lg' ? 'size-lg' : 'size-pill']}
  style:background={palette.bg}
  style:color={palette.fg}
  title="Living Dictionaries admin · level {level}">
  <IconMdiShieldAccount style={size === 'lg' ? 'font-size: 0.875rem' : 'font-size: 11px'} />
  Admin
</span>

<style>
  .admin-badge {
    display: inline-flex;
    align-items: center;
    gap: 0.25rem;
    border-radius: 9999px;
    font-weight: 600;
    white-space: nowrap;
  }
  .size-lg {
    padding: 0.25rem 0.625rem;
    font-size: 0.75rem;
  }
  .size-pill {
    padding: 0.125rem 0.375rem;
    font-size: 10px;
    line-height: 1;
  }
</style>
