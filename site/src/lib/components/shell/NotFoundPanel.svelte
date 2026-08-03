<script lang="ts">
  import HeadlessButton from '$lib/components/ui/HeadlessButton.svelte'
  import ShowHide from '$lib/components/ui/ShowHide.svelte'
  import { page } from '$app/state'

  // A 404 is a dead link, not a fault — so it gets calm copy and, above all,
  // ways back in. Cosmas Rai reported "the dictionary does not open anymore"
  // (2026-08-03) after one bad entry link showed him the crash apology with no
  // link to his own dictionary: .issues/not-found-page-is-a-scary-error.md
  interface NotFoundLink {
    href: string
    label: string
    primary?: boolean
  }

  const { title, explanation, links = [] }: { title: string, explanation?: string, links?: NotFoundLink[] } = $props()
</script>

<div class="not-found">
  <h2>{title}</h2>

  {#if explanation}
    <p class="explain">{explanation}</p>
  {/if}

  {#if links.length}
    <div class="links">
      {#each links as link (link.href)}
        <a class="{link.primary ? 'btn-primary' : 'btn-outline'} btn-default" href={link.href}>{link.label}</a>
      {/each}
    </div>
  {/if}

  <ShowHide>
    {#snippet children({ show, toggle })}
      <p class="mistake">
        {page.data.t('error.think_mistake')}
        <HeadlessButton class="contact-link" onclick={toggle}>{page.data.t('header.contact_us')}</HeadlessButton>
      </p>
      {#if show}
        {#await import('$lib/components/modals/Contact.svelte') then { default: Contact }}
          <Contact subject="report_problem" on_close={toggle} />
        {/await}
      {/if}
    {/snippet}
  </ShowHide>

  <p class="error-detail">
    {page.data.t('misc.error')}: {page.status} - {page.error.message}
  </p>
</div>

<style>
  .not-found {
    padding: 1.5rem 1rem;
    background-color: var(--background);
    position: relative;
    z-index: 20;
  }

  h2 {
    font-size: 1.375rem;
    line-height: 1.75rem;
    font-weight: 700;
    margin-bottom: 0.5rem;
  }

  @media (min-width: 640px) {
    h2 {
      font-size: 1.75rem;
      line-height: 2.25rem;
    }
  }

  .explain {
    color: color-mix(in srgb, var(--color) 80%, var(--background));
    margin-bottom: 1.25rem;
  }

  .links {
    display: flex;
    flex-wrap: wrap;
    gap: 0.5rem;
  }

  .mistake {
    color: color-mix(in srgb, var(--color) 65%, var(--background));
    font-size: 0.875rem;
    line-height: 1.25rem;
    margin-top: 1.5rem;
  }

  .not-found :global(.contact-link) {
    text-decoration: underline;
    color: inherit;
  }

  .error-detail {
    color: color-mix(in srgb, var(--color) 55%, var(--background));
    font-size: 0.8125rem;
    line-height: 1.25rem;
    margin-top: 0.25rem;
  }
</style>
