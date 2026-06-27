<script lang="ts">
  import { page } from '$app/stores'
  import IconMageFacebookSquare from '~icons/mage/facebook-square'
  import IconF7LogoInstagram from '~icons/f7/logo-instagram'

  const { dictionaries } = $derived($page.data)
  const public_dictionaries = $derived($dictionaries?.filter(dictionary => dictionary.public).length || 0)

  const public_entries_count = 254813
</script>

<footer>
  {#if public_dictionaries}
    <span class="nowrap">{$page.data.t('footer.public_LD')}: <b>{public_dictionaries}</b>,</span>
  {/if}
  <span class="nowrap">{$page.data.t('footer.entries')}: <b>{new Intl.NumberFormat().format(public_entries_count)}</b>,</span>
  <span>{$page.data.t('footer.LD_project')} <a href="https://livingtongues.org/" target="_blank" class="lt-link">Living Tongues Institute for Endangered Languages.</a>
  </span>
  <span class="nowrap legal-links">
    <a href="/terms" class="lt-link">{$page.data.t('dictionary.terms_of_use')}</a>
    <a href="/privacy-policy" class="lt-link">{$page.data.t('terms.privacy_policy')}</a>
  </span>
  <a href="https://www.facebook.com/living.tongues" target="_blank" class="social social-first"><IconMageFacebookSquare class="icon-inline" /></a>
  <a href="https://www.instagram.com/livingtongues" target="_blank" class="social"><IconF7LogoInstagram class="icon-inline" /></a>
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
    color: #1d4ed8; /* blue-700, was hover:text-blue-700 */
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
