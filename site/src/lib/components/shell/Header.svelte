<script lang="ts">
  import IconBars from '~icons/fa-solid/bars'
  import IconDonate from '~icons/fa-solid/donate'
  import IconInfoCircle from '~icons/fa-solid/info-circle'
  import IconQuestionCircle from '~icons/fa-regular/question-circle'
  import IconTimes from '~icons/fa-solid/times'
  import IconHome from '~icons/fa-solid/home'
  import IconComment from '~icons/fa-regular/comment'
  import IconLanguage from '~icons/fa-solid/language'
  import User from './User.svelte'
  import ColorSchemeToggle from './ColorSchemeToggle.svelte'
  import HeadlessButton from '$lib/components/ui/HeadlessButton.svelte'
  import Slideover from '$lib/components/ui/Slideover.svelte'
  import ShowHide from '$lib/components/ui/ShowHide.svelte'
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
  {#if !left}
    <ShowHide>
      {#snippet children({ show, toggle, set })}
        <button type="button" class="menu-button" aria-label={page.data.t('header.menu')} onclick={toggle}>
          <IconBars class="print-hidden" />
        </button>
        {#if show}
          <Slideover
            side={page.data.t('page.direction') === 'rtl' ? 'right' : 'left'}
            widthRem={13}
            on_close={() => set(false)}>
            <div class="menu-panel">
              <header>
                <div class="menu-heading">{page.data.t('header.menu')}</div>
              </header>
              <div class="menu-items">
                <HeadlessButton class="btn-ghost btn-default" href="https://www.flipcause.com/secure/cause_pdetails/NTQ3NDQ" target="_blank">
                  <IconDonate />
                  <span class="label">{page.data.t('header.donate')}</span>
                </HeadlessButton>
                <HeadlessButton class="btn-ghost btn-default" href="/about">
                  <IconInfoCircle />
                  <span class="label">{page.data.t('header.about')}</span>
                </HeadlessButton>
                <HeadlessButton class="btn-ghost btn-default" href="/tutorials">
                  <IconFluentLearningApp24Regular style="margin-top: -2px" />
                  <span class="label">{page.data.t('header.tutorials')}</span>
                </HeadlessButton>
                <HeadlessButton class="btn-ghost btn-default" href="https://docs.google.com/document/d/1MZGkBbnCiAch3tWjBOHRYPpjX1MVd7f6x5uVuwbxM-Q/edit?usp=sharing" target="_blank">
                  <IconQuestionCircle />
                  <span class="label">
                    FAQ
                  </span>
                </HeadlessButton>
                {#if !page.data.auth_user?.user}
                  <div class="menu-theme">
                    <ColorSchemeToggle />
                  </div>
                {/if}
              </div>
              <div class="menu-bottom">
                <hr />
                <HeadlessButton class="btn-ghost btn-default menu-close-btn" onclick={toggle}>
                  <IconTimes style="font-size: 1.3333em" />
                  {page.data.t('misc.close')}
                </HeadlessButton>
              </div>
            </div>
          </Slideover>
        {/if}
      {/snippet}
    </ShowHide>
  {/if}
  {#if children}
    <HeadlessButton class="btn-ghost btn-default" href="/"><IconHome /></HeadlessButton>
    <div class="page-title">
      {@render children?.()}
    </div>
  {:else if left}
    {@render left?.()}
  {:else}
    <div class="brand">
      <a class="brand-link" href="/">
        <img
          class="brand-logo"
          alt="logo"
          src="/images/LD_logo_white.svg" />
        {page.data.t('misc.LD')}
        {#if mode === 'development'}
          <span class="dev-badge">(dev)</span>
        {/if}
      </a>
    </div>
  {/if}
  <div class="spacer"></div>

  <div class="actions">
    <HeadlessButton
      class="btn-ghost btn-default show-md"

      href="https://www.paypal.com/donate?hosted_button_id=QCELFXU8ZGTVC"
      target="_blank">
      <IconDonate />
      <span class="label label-lg">{page.data.t('header.donate')}</span>
    </HeadlessButton>
    <HeadlessButton href="/about" class="btn-ghost btn-default show-lg">
      <IconInfoCircle />
      <span class="label label-lg">{page.data.t('header.about')}</span>
    </HeadlessButton>
    <HeadlessButton href="/tutorials" class="btn-ghost btn-default show-md">
      <IconFluentLearningApp24Regular style="margin-top: -2px" />
      <span class="label label-lg">{page.data.t('header.tutorials')}</span>
    </HeadlessButton>
    <HeadlessButton

      href="https://docs.google.com/document/d/1MZGkBbnCiAch3tWjBOHRYPpjX1MVd7f6x5uVuwbxM-Q/edit?usp=sharing"
      target="_blank"
      class="btn-ghost btn-default faq-btn">
      <IconQuestionCircle />
      <span class="label">
        FAQ
      </span>
    </HeadlessButton>

    <ShowHide>
      {#snippet children({ show, toggle })}
        <HeadlessButton class="btn-ghost btn-default" onclick={toggle}>
          <span>
            <IconComment />
          </span>
          <!-- <span class="lg:hidden">
            <IconQuestionCircle />
          </span> -->
          <span class="label label-sm">
            {page.data.t('header.contact_us')}
          </span>
        </HeadlessButton>
        {#if show}
          {#await import('$lib/components/modals/Contact.svelte') then { default: Contact }}
            <Contact on_close={toggle} />
          {/await}
        {/if}
      {/snippet}
    </ShowHide>

    <ShowHide>
      {#snippet children({ show, toggle })}
        <HeadlessButton class="btn-ghost btn-default" onclick={toggle}>
          <IconLanguage />
          <span class="label label-lg">
            {page.data.t('header.language')}
          </span>
        </HeadlessButton>
        {#if show}
          {#await import('$lib/components/modals/SelectLanguage.svelte') then { default: SelectLanguage }}
            <SelectLanguage on_close={toggle} />
          {/await}
        {/if}
      {/snippet}
    </ShowHide>

    {#if !page.data.auth_user?.user}
      <span class="scheme-toggle">
        <ColorSchemeToggle compact />
      </span>
    {/if}

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
    color: var(--color);
  }

  .brand-logo {
    height: 20px;
    width: 20px;
    filter: var(--invert-in-light);
    margin-left: 0.5rem;
    margin-right: 0.5rem;
  }

  @media (min-width: 768px) {
    .brand-logo {
      height: 30px;
      width: 30px;
    }
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

  .menu-items :global(a),
  .menu-items :global(button) {
    display: flex;
    align-items: center;
    text-align: left;
  }

  .menu-theme :global(button) {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    padding: 0.75rem;
    width: 100%;
    text-align: left;
  }

  .menu-theme :global(button:hover) {
    background-color: color-mix(in srgb, var(--background), var(--color) 10%);
  }

  /* Compact theme toggle in the header for signed-out users — desktop only
     (mobile relies on the hamburger-menu entry). */
  .scheme-toggle {
    display: none;
  }

  @media (min-width: 768px) {
    .scheme-toggle {
      display: inline-flex;
    }
  }

  .scheme-toggle :global(button) {
    padding: 0.75rem;
    font-size: 1.05rem;
    color: var(--color-secondary);
  }

  .scheme-toggle :global(button:hover) {
    color: var(--color);
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
