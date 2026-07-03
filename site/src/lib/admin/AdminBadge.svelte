<script lang="ts">
  import type { EffectiveAdminLevel } from '$lib/admins'
  import { LEVEL_LABELS } from '$lib/auth/view-as'
  import IconMdiShieldAccount from '~icons/mdi/shield-account'

  interface Props {
    level: EffectiveAdminLevel
    /** `'pill'` for tiny inline use (table rows), `'lg'` for header chips. */
    size?: 'pill' | 'lg'
  }

  const { level, size = 'pill' }: Props = $props()

  // Same palette as house's AdminBadge:
  //   L3 → amber/gold (super admin)
  //   L2 → indigo (admin)
  //   L1 → slate (super manager — DB-granted, not in the allow-list)
  const palette = $derived.by(() => {
    if (level === 3) return { bg: '#d97706', fg: '#ffffff' } // amber-600
    if (level === 2) return { bg: '#4f46e5', fg: '#ffffff' } // indigo-600
    return { bg: '#475569', fg: '#ffffff' } // slate-600
  })

  const label = $derived(LEVEL_LABELS[level])
</script>

<span
  class={['admin-badge', size === 'lg' ? 'size-lg' : 'size-pill']}
  style:background={palette.bg}
  style:color={palette.fg}
  title="Living Dictionaries {label} · level {level}">
  <IconMdiShieldAccount style={size === 'lg' ? 'font-size: 0.875rem' : 'font-size: 11px'} />
  {label}
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
