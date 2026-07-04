<script lang="ts">
  import { page } from '$app/state'
  import IconMdiWaveform from '~icons/mdi/waveform'
  import IconMdiTranslate from '~icons/mdi/translate'
  import IconMdiKeyboardOutline from '~icons/mdi/keyboard-outline'
  import IconMdiAccountGroupOutline from '~icons/mdi/account-group-outline'
  import IconMdiDatabaseImportOutline from '~icons/mdi/database-import-outline'
  import IconMdiHeartOutline from '~icons/mdi/heart-outline'

  const t = $derived(page.data.t)

  type FeatureKey = 'multimedia' | 'glossing' | 'keyboards' | 'collaboration' | 'import' | 'free'
  const features: { key: FeatureKey, icon: typeof IconMdiWaveform, accent: string }[] = [
    { key: 'multimedia', icon: IconMdiWaveform, accent: '#3b82f6' },
    { key: 'glossing', icon: IconMdiTranslate, accent: '#8b5cf6' },
    { key: 'keyboards', icon: IconMdiKeyboardOutline, accent: '#06b6d4' },
    { key: 'collaboration', icon: IconMdiAccountGroupOutline, accent: '#10b981' },
    { key: 'import', icon: IconMdiDatabaseImportOutline, accent: '#f59e0b' },
    { key: 'free', icon: IconMdiHeartOutline, accent: '#ef4444' },
  ]
</script>

<section class="features">
  <h2>{t('home_v2.features_heading')}</h2>
  <div class="grid">
    {#each features as feature (feature.key)}
      <div class="card">
        <div class="icon-chip" style:--accent={feature.accent}>
          <feature.icon style="font-size: 1.375rem" />
        </div>
        <h3>{t(`home_v2.feature_${feature.key}_title`)}</h3>
        <p>{t(`home_v2.feature_${feature.key}_body`)}</p>
      </div>
    {/each}
  </div>
</section>

<style>
  .features {
    max-width: 72rem;
    margin: 0 auto;
    padding: 2.5rem 1rem 1rem;
  }

  h2 {
    font-size: 1.5rem;
    font-weight: 700;
    letter-spacing: -0.02em;
    margin: 0 0 1.25rem;
  }

  .grid {
    display: grid;
    grid-template-columns: 1fr;
    gap: 0.75rem;
  }

  @media (min-width: 640px) {
    .grid {
      grid-template-columns: repeat(2, 1fr);
    }
  }

  @media (min-width: 1024px) {
    .grid {
      grid-template-columns: repeat(3, 1fr);
    }
  }

  .card {
    background: var(--surface);
    border-radius: 0.75rem;
    padding: 1.25rem;
  }

  .icon-chip {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 2.5rem;
    height: 2.5rem;
    border-radius: 0.625rem;
    color: var(--accent);
    background: color-mix(in srgb, var(--accent) 14%, transparent);
  }

  h3 {
    margin: 0.75rem 0 0.25rem;
    font-size: 1rem;
    font-weight: 600;
  }

  p {
    margin: 0;
    font-size: 0.875rem;
    line-height: 1.5;
    color: var(--color-secondary);
  }
</style>
