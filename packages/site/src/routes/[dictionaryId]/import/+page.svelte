<script lang="ts">
  import { page } from '$app/stores';
// import { Button, ShowHide } from 'svelte-pieces';
</script>

<div class="max-w-screen-md ml-4">
  <!-- Temporarily disabling imports -->
  <!-- <div class="p-2">
    <h3
      class="mb-6 text-3xl leading-8 font-bold tracking-tight text-gray-900
        sm:text-4xl sm:leading-10">
      {$page.data.t('import_page.import')}: {$page.data.dictionary.name}
    </h3>

    <p class="mb-3">
      {$page.data.t('import_page.instructions_1')}
    </p>
    <ol class="py-3 px-5">
      <li class="list-decimal mb-3">{$page.data.t('import_page.instructions_2')}</li>
      <li class="list-decimal mb-3">{$page.data.t('import_page.instructions_3')}</li>
    </ol>
    <p class="mb-3">
      {$page.data.t('import_page.instructions_4')}
    </p>
  </div>
  <div class="flex justify-between">
    <Button form="filled" type="button" target="_blank" href="https://docs.google.com/spreadsheets/d/1Bqy1q_XZzlZLDM_glTxQ9gw0Pb5JEUssqQFtINxbwzY/edit#gid=1392642957">
      {$page.data.t('import_page.template_link')}
    </Button>
    <ShowHide let:show let:toggle>
      <Button onclick={toggle}>
        <span class="lg:inline">
          <i class="far fa-comment" />
        </span>
        <span class="ml-1 sm:inline">
          {$page.data.t('header.contact_us')}
        </span>
      </Button>
      {#if show}
        {#await import('$lib/components/modals/Contact.svelte') then { default: Contact }}
          <Contact subject="import_data" on:close={toggle} />
        {/await}
      {/if}
    </ShowHide>
  </div> -->
  <p class="m-10 text-xl font-semibold">{$page.data.t('import_page.no_imports')}</p>
</div>
