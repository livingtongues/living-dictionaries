<script lang="ts">
  import type { HomepageBaked } from '$lib/components/home-v2/types'
  import { page } from '$app/state'
  import baked_json from '$lib/data/homepage-baked.json'
  import { round_stat } from '$lib/components/home-v2/round-stat'
  import IconMageFacebookSquare from '~icons/mage/facebook-square'
  import IconF7LogoInstagram from '~icons/f7/logo-instagram'
  import ColorSchemeToggle from './ColorSchemeToggle.svelte'

  // Build-time baked (same payload as the homepage cubes) — no per-visitor query.
  const { stats } = baked_json as HomepageBaked
  const { public_dictionaries } = stats
  const entries_display = $derived(round_stat({ value: stats.entries, stat: 'entries', locale: page.data.locale }))
</script>

<footer>
  {#if public_dictionaries}
    <span class="nowrap">{page.data.t('footer.public_LD')}: <b>{public_dictionaries}</b>,</span>
  {/if}
  <span class="nowrap">{page.data.t('footer.entries')}: <b>{entries_display}</b>,</span>
  <span>{page.data.t('footer.LD_project')} <a href="https://livingtongues.org/" target="_blank" class="lt-link">Living Tongues Institute for Endangered Languages.</a>
  </span>
  <span class="nowrap legal-links">
    <a href="/terms" class="lt-link">{page.data.t('dictionary.terms_of_use')}</a>
    <a href="/privacy-policy" class="lt-link">{page.data.t('terms.privacy_policy')}</a>
  </span>
  <a href="https://www.facebook.com/living.tongues" target="_blank" class="social social-first"><IconMageFacebookSquare class="icon-inline" /></a>
  <a href="https://www.instagram.com/livingtongues" target="_blank" class="social"><IconF7LogoInstagram class="icon-inline" /></a>
  <span class="scheme-toggle"><ColorSchemeToggle compact /></span>
</footer>

<style>
  footer {
    border-top: 1px solid var(--border-color);
    z-index: 1;
    background-color: var(--background);
    padding: 0.5rem;
    font-size: 0.875rem;
    line-height: 1.25rem;
  }

  @media (min-width: 768px) {
    footer {
      position: sticky;
      bottom: 0;
    }
  }

  @media print {
    footer {
      display: none;
    }
  }

  .nowrap {
    white-space: nowrap;
  }

  .lt-link {
    text-decoration-line: underline;
  }

  .legal-links a + a {
    margin-left: 0.5rem;
  }

  .lt-link:hover,
  .social:hover {
    color: var(--primary);
  }

  .scheme-toggle :global(button) {
    padding: 0.25rem;
    margin: -0.25rem 0;
    font-size: 1.05rem;
    color: var(--color-secondary);
  }

  .scheme-toggle :global(button:hover) {
    color: var(--color);
  }

  .social {
    padding: 0.25rem;
    margin-top: -0.25rem;
    margin-bottom: -0.25rem;
  }

  .social-first {
    margin-left: 0.25rem;
  }

  .social :global(.icon-inline) {
    font-size: 1.25rem;
    margin-top: -0.125rem;
  }

  @media (min-width: 640px) {
    .social :global(.icon-inline) {
      margin-top: -0.25rem;
    }
  }
</style>
