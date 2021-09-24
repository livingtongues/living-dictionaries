<script lang="ts">
  import { _ } from 'svelte-i18n';
  import User from './User.svelte';
  import ShowHide from '$svelteui/functions/ShowHide.svelte';
  import Button from '$svelteui/ui/Button.svelte';
  import { firebaseConfig } from '$sveltefire/config';
</script>

<header>
  {#if $$slots.default}
    <Button form="text" href="/" class="print:hidden"><i class="fas fa-home" /></Button>
    <div class="text-lg font-semibold p-3 overflow-x-auto md:overflow-hidden md:overflow-ellipsis">
      <slot />
    </div>
  {:else if $$slots.left}
    <slot name="left" />
  {:else}
    <div class="font-semibold sm:text-xl overflow-x-auto md:overflow-hidden md:overflow-ellipsis">
      <a class="flex items-center hover:text-black" href="/">
        <img
          alt="logo"
          src="/images/LD_logo_white.svg"
          class="mr-2 ml-2"
          style="height: 30px; width: 30px; filter: invert(100%);" />
        {$_('misc.LD', { default: 'Living Dictionaries' })}
        {#if firebaseConfig.projectId === 'talking-dictionaries-dev'}
          <span class="ml-1 text-xs opacity-50">(dev)</span>
        {/if}
      </a>
    </div>
  {/if}
  <div class="w-1 flex-grow" />

  <Button
    class="hidden md:inline"
    form="text"
    href="https://www.flipcause.com/secure/cause_pdetails/NTQ3NDQ"
    target="_blank">
    <i class="far fa-donate" />
    <span class="ml-1 hidden lg:inline"
      >{$_('header.donate', {
        default: 'Donate',
      })}</span>
  </Button>
  <Button href="/about" form="text" class="hidden lg:inline">
    <i class="far fa-info-circle" />
    <span class="ml-1 hidden lg:inline">{$_('header.about', { default: 'About' })}</span>
  </Button>
  <Button
    form="text"
    href="https://docs.google.com/document/d/1MZGkBbnCiAch3tWjBOHRYPpjX1MVd7f6x5uVuwbxM-Q/edit?usp=sharing"
    target="_blank"
    class="p-3 text-gray-600 hover:text-black hidden lg:block">
    <i class="far fa-question-circle" />
    <span class="ml-1">
      FAQ
      <!-- {$_('header.faq', { default: 'FAQ' })} -->
    </span>
  </Button>

  <ShowHide let:show let:toggle>
    <Button form="text" class="hidden lg:inline print:hidden" onclick={toggle}>
      <i class="far fa-comment" />
      <span class="ml-1 hidden sm:inline">
        {$_('header.contact_us', { default: 'Contact Us' })}
      </span>
    </Button>
    <Button form="text" class="lg:hidden print:hidden" onclick={toggle}>
      <i class="far fa-question-circle" />
      <span class="ml-1 hidden sm:inline">
        {$_('header.contact_us', { default: 'Contact Us' })}
      </span>
    </Button>
    {#if show}
      {#await import('$lib/components/modals/Contact.svelte') then { default: Contact }}
        <Contact on:close={toggle} />
      {/await}
    {/if}
  </ShowHide>

  <ShowHide let:show let:toggle>
    <Button form="text" class="print:hidden" onclick={toggle}>
      <i class="far fa-language" />
      <span class="ml-1 hidden lg:inline">
        {$_('header.language', { default: 'Language' })}
      </span>
    </Button>
    {#if show}
      {#await import('$lib/components/modals/SelectLanguage.svelte') then { default: SelectLanguage }}
        <SelectLanguage on:close={toggle} />
      {/await}
    {/if}
  </ShowHide>

  <User />
</header>

<style>
  header {
    @apply fixed top-0 left-0 right-0 flex items-center bg-white h-12 z-[2] whitespace-nowrap;
  }
</style>
