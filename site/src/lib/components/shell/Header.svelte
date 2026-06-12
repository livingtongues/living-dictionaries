<script lang="ts">
  import User from './User.svelte'
  import { Button, ResponsiveSlideover, ShowHide } from '$lib/svelte-pieces'
  import { page } from '$app/state'
  import { mode } from '$lib/mode'
  import IconFluentLearningApp24Regular from '~icons/fluent/learning-app-24-regular'

  interface Props {
    children?: import('svelte').Snippet
    left?: import('svelte').Snippet
  }

  const { children, left }: Props = $props()
</script>

<header class="site-header">
  {#if children}
    <Button form="text" href="/"><i class="fas fa-home"></i></Button>
    <div class="page-title">
      {@render children?.()}
    </div>
  {:else if left}
    {@render left?.()}
  {:else}
    <div class="brand">
      <a class="brand-link" href="/">
        <img
          alt="logo"
          src="/images/LD_logo_white.svg"
          style="height: 30px; width: 30px; filter: invert(100%); margin-left: 0.5rem; margin-right: 0.5rem;" />
        {page.data.t('misc.LD')}
        {#if mode === 'development'}
          <span class="dev-badge">(dev)</span>
        {/if}
      </a>
    </div>
  {/if}
  <div class="spacer"></div>

  <div class="actions">
    <Button
      class="show-md"
      form="text"
      href="https://www.paypal.com/donate?hosted_button_id=QCELFXU8ZGTVC"
      target="_blank">
      <i class="far fa-donate"></i>
      <span class="label label-lg">{page.data.t('header.donate')}</span>
    </Button>
    <Button href="/about" form="text" class="show-lg">
      <i class="far fa-info-circle"></i>
      <span class="label label-lg">{page.data.t('header.about')}</span>
    </Button>
    <Button href="/tutorials" form="text" class="show-md">
      <IconFluentLearningApp24Regular class="icon-inline" style="margin-top: -2px" />
      <span class="label label-lg">{page.data.t('header.tutorials')}</span>
    </Button>
    <Button
      form="text"
      href="https://docs.google.com/document/d/1MZGkBbnCiAch3tWjBOHRYPpjX1MVd7f6x5uVuwbxM-Q/edit?usp=sharing"
      target="_blank"
      class="faq-btn">
      <i class="far fa-question-circle"></i>
      <span class="label">
        FAQ
      </span>
    </Button>

    <ShowHide>
      {#snippet children({ show, toggle })}
        <Button form="text" onclick={toggle}>
          <span>
            <i class="far fa-comment"></i>
          </span>
          <!-- <span class="lg:hidden">
            <i class="far fa-question-circle" />
          </span> -->
          <span class="label label-sm">
            {page.data.t('header.contact_us')}
          </span>
        </Button>
        {#if show}
          {#await import('$lib/components/modals/Contact.svelte') then { default: Contact }}
            <Contact on:close={toggle} />
          {/await}
        {/if}
      {/snippet}
    </ShowHide>

    <ShowHide>
      {#snippet children({ show, toggle })}
        <Button form="text" onclick={toggle}>
          <i class="far fa-language"></i>
          <span class="label label-lg">
            {page.data.t('header.language')}
          </span>
        </Button>
        {#if show}
          {#await import('$lib/components/modals/SelectLanguage.svelte') then { default: SelectLanguage }}
            <SelectLanguage on:close={toggle} />
          {/await}
        {/if}
      {/snippet}
    </ShowHide>

    <ShowHide>
      {#snippet children({ show, toggle, set })}
        <button type="button" class="menu-button" onclick={toggle}>
          <i class="far fa-bars print-hidden"></i>
        </button>
        <ResponsiveSlideover
          side={page.data.t('page.direction') === 'ltr' ? 'right' : 'left'}
          showWidth={show ? 'md' : null}
          widthRem={9}
          on_close={() => set(false)}
          open={show}>
          <div class="menu-panel">
            <header>
              <div class="menu-heading">{page.data.t('header.menu')}</div>
            </header>
            <div>
              <Button
                form="text"
                href="https://www.flipcause.com/secure/cause_pdetails/NTQ3NDQ"
                target="_blank">
                <i class="far fa-donate"></i>
                <span class="label">{page.data.t('header.donate')}</span>
              </Button>
              <Button href="/about" form="text">
                <i class="far fa-info-circle"></i>
                <span class="label">{page.data.t('header.about')}</span>
              </Button>
              <Button href="/tutorials" form="text">
                <IconFluentLearningApp24Regular class="icon-inline" style="margin-top: -2px" />
                <span class="label">{page.data.t('header.tutorials')}</span>
              </Button>
              <Button
                form="text"
                href="https://docs.google.com/document/d/1MZGkBbnCiAch3tWjBOHRYPpjX1MVd7f6x5uVuwbxM-Q/edit?usp=sharing"
                target="_blank">
                <i class="far fa-question-circle"></i>
                <span class="label">
                  FAQ
                </span>
              </Button>
            </div>
            <div class="menu-bottom">
              <hr />
              <Button form="menu" class="menu-close-btn" onclick={toggle}>
                <i class="far fa-times fa-lg fa-fw"></i>
                {page.data.t('misc.close')}
              </Button>
            </div>
          </div>
        </ResponsiveSlideover>
      {/snippet}
    </ShowHide>

    <User />
  </div>
</header>

<style>
  .site-header {
    position: sticky;
    top: 0;
    left: 0;
    right: 0;
    display: flex;
    align-items: center;
    background-color: var(--background);
    height: 3rem;
    z-index: 2;
    white-space: nowrap;
  }

  .page-title {
    font-size: 1.125rem;
    line-height: 1.75rem;
    font-weight: 600;
    padding: 0.75rem;
    overflow-x: auto;
  }

  .brand {
    font-weight: 600;
    overflow-x: auto;
  }

  @media (min-width: 640px) {
    .brand {
      font-size: 1.25rem;
      line-height: 1.75rem;
    }
  }

  @media (min-width: 768px) {
    .page-title,
    .brand {
      overflow: hidden;
    }
  }

  .brand-link {
    display: flex;
    align-items: center;
  }

  .brand-link:hover {
    color: #000;
  }

  .dev-badge {
    margin-left: 0.25rem;
    font-size: 0.75rem;
    line-height: 1rem;
    opacity: 0.5;
  }

  .spacer {
    width: 0.25rem;
    flex-grow: 1;
  }

  .actions {
    display: flex;
    align-items: center;
    white-space: nowrap;
  }

  /* Buttons hidden until a breakpoint (was `!hidden !md:inline` etc on the Button class
     prop — the classes land on the <a>/<button> inside Button, so :global + !important
     mirror the uno important-prefix utilities). */
  .actions :global(.show-md),
  .actions :global(.show-lg),
  .actions :global(.faq-btn) {
    display: none !important;
  }

  @media (min-width: 768px) {
    .actions :global(.show-md) {
      display: inline !important;
    }
  }

  @media (min-width: 1024px) {
    .actions :global(.show-lg) {
      display: inline !important;
    }

    .actions :global(.faq-btn) {
      display: block !important;
    }
  }

  .actions :global(.faq-btn) {
    padding: 0.75rem !important;
  }

  .label {
    margin-left: 0.25rem;
  }

  .label-sm,
  .label-lg {
    display: none;
  }

  @media (min-width: 640px) {
    .label-sm {
      display: inline;
    }
  }

  @media (min-width: 1024px) {
    .label-lg {
      display: inline;
    }
  }

  .menu-button {
    padding: 0.75rem;
  }

  @media (min-width: 768px) {
    .menu-button {
      display: none;
    }
  }

  .menu-panel {
    height: 100%;
    display: flex;
    flex-direction: column;
  }

  .menu-heading {
    display: block;
    padding: 0.75rem;
    font-size: 1.125rem;
    line-height: 1.75rem;
    font-weight: 600;
    margin-bottom: 0.75rem;
    border-bottom: 1px solid var(--border-color);
  }

  .menu-bottom {
    margin-top: auto;
  }

  .menu-panel :global(.menu-close-btn) {
    text-align: left;
  }

  @media (min-width: 768px) {
    .menu-panel hr {
      display: none;
    }

    .menu-panel :global(.menu-close-btn) {
      display: none !important;
    }
  }

  @media print {
    .site-header {
      display: none;
    }

    .actions {
      display: none;
    }

    .menu-button {
      padding: 0;
    }

    .print-hidden {
      display: none;
    }
  }
</style>
