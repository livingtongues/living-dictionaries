<script lang="ts">
  import { Button, ResponsiveSlideover, ShowHide } from 'svelte-pieces'
  import User from './User.svelte'
  import { page } from '$app/stores'
  import { mode } from '$lib/supabase'
</script>

<header class="print:hidden sticky top-0 left-0 right-0 flex items-center bg-white h-12 z-2 whitespace-nowrap">
  {#if $$slots.default}
    <Button form="text" href="/"><i class="fas fa-home" /></Button>
    <div class="text-lg font-semibold p-3 overflow-x-auto md:overflow-hidden">
      <slot />
    </div>
  {:else if $$slots.left}
    <slot name="left" />
  {:else}
    <div class="font-semibold sm:text-xl overflow-x-auto md:overflow-hidden">
      <a class="flex items-center hover:text-black" href="/">
        <img
          alt="logo"
          src="/images/LD_logo_white.svg"
          class="mr-2 ml-2"
          style="height: 30px; width: 30px; filter: invert(100%);" />
        {$page.data.t('misc.LD')}
        {#if mode === 'development'}
          <span class="ml-1 text-xs opacity-50">(dev)</span>
        {/if}
      </a>
    </div>
  {/if}
  <div class="w-1 flex-grow" />

  <div class="print:hidden flex items-center whitespace-nowrap">
    <Button
      class="!hidden !md:inline"
      form="text"
      href="https://www.flipcause.com/secure/cause_pdetails/NTQ3NDQ"
      target="_blank">
      <i class="far fa-donate" />
      <span class="ml-1 hidden lg:inline">{$page.data.t('header.donate')}</span>
    </Button>
    <Button href="/about" form="text" class="!hidden !lg:inline" target="_blank">
      <i class="far fa-info-circle" />
      <span class="ml-1 hidden lg:inline">{$page.data.t('header.about')}</span>
    </Button>
    <Button href="/tutorials" form="text" class="!hidden !md:inline" target="_blank">
      <span class="i-fluent-learning-app-24-regular -mt-2px" />
      <span class="ml-1 hidden lg:inline">{$page.data.t('header.tutorials')}</span>
    </Button>
    <Button
      form="text"
      href="https://docs.google.com/document/d/1MZGkBbnCiAch3tWjBOHRYPpjX1MVd7f6x5uVuwbxM-Q/edit?usp=sharing"
      target="_blank"
      class="!p-3 text-gray-600 hover:text-black !hidden !lg:block">
      <i class="far fa-question-circle" />
      <span class="ml-1">
        FAQ
      </span>
    </Button>

    <ShowHide let:show let:toggle>
      <Button form="text" onclick={toggle}>
        <span class="inline">
          <i class="far fa-comment" />
        </span>
        <!-- <span class="lg:hidden">
          <i class="far fa-question-circle" />
        </span> -->
        <span class="ml-1 hidden sm:inline">
          {$page.data.t('header.contact_us')}
        </span>
      </Button>
      {#if show}
        {#await import('$lib/components/modals/Contact.svelte') then { default: Contact }}
          <Contact on:close={toggle} />
        {/await}
      {/if}
    </ShowHide>

    <ShowHide let:show let:toggle>
      <Button form="text" onclick={toggle}>
        <i class="far fa-language" />
        <span class="ml-1 hidden lg:inline">
          {$page.data.t('header.language')}
        </span>
      </Button>
      {#if show}
        {#await import('$lib/components/modals/SelectLanguage.svelte') then { default: SelectLanguage }}
          <SelectLanguage on:close={toggle} />
        {/await}
      {/if}
    </ShowHide>

    <ShowHide let:show let:toggle let:set>
      <button type="button" class="p-3 md:hidden print:p-0" on:click={toggle}>
        <i class="far fa-bars print:hidden" />
      </button>
      <ResponsiveSlideover
        side={$page.data.t('page.direction') === 'ltr' ? 'right' : 'left'}
        showWidth={show ? 'md' : null}
        widthRem={9}
        on_close={() => set(false)}
        open={show}>
        <div class="print:hidden h-full flex flex-col">
          <header>
            <div class="block p-3 text-lg font-semibold mb-3 border-b">{$page.data.t('header.menu')}</div>
          </header>
          <div>
            <Button
              form="text"
              href="https://www.flipcause.com/secure/cause_pdetails/NTQ3NDQ"
              target="_blank">
              <i class="far fa-donate" />
              <span class="ml-1">{$page.data.t('header.donate')}</span>
            </Button>
            <Button href="/about" form="text" target="_blank">
              <i class="far fa-info-circle" />
              <span class="ml-1">{$page.data.t('header.about')}</span>
            </Button>
            <Button href="/tutorials" form="text" target="_blank">
              <span class="i-fluent-learning-app-24-regular -mt-2px" />
              <span class="ml-1">{$page.data.t('header.tutorials')}</span>
            </Button>
            <Button
              form="text"
              href="https://docs.google.com/document/d/1MZGkBbnCiAch3tWjBOHRYPpjX1MVd7f6x5uVuwbxM-Q/edit?usp=sharing"
              target="_blank"
              class="text-gray-600 hover:text-black !lg:block">
              <i class="far fa-question-circle" />
              <span class="ml-1">
                FAQ
              </span>
            </Button>
          </div>
          <div class="mt-auto">
            <hr class="md:hidden" />
            <Button form="menu" class="text-left !md:hidden" onclick={toggle}>
              <i class="far fa-times fa-lg fa-fw" />
              {$page.data.t('misc.close')}
            </Button>
          </div>
        </div>
      </ResponsiveSlideover>
    </ShowHide>

    <User />
  </div>
</header>
