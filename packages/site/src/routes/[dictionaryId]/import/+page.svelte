<script lang="ts">
  import { _ } from 'svelte-i18n';
  import { Button, ShowHide } from 'svelte-pieces';
  import { dictionary } from '$lib/stores';
  import Header from '$lib/components/shell/Header.svelte';
</script>

<Header>
  {$_('import.import', { default: 'Import to a Living Dictionary' })} {$_('misc.LD_singular', { default: 'Living Dictionary' })}
</Header>

<div class="max-w-screen-md ml-4">
  <div class="p-2">
    <h3
      class="mb-6 text-3xl leading-8 font-bold tracking-tight text-gray-900
        sm:text-4xl sm:leading-10">
      {$_('import.import', {
        default: 'Import',
      })}: {$dictionary.name}
    </h3>

    <p class="mb-3">
      {$_('import.instructions_1', {default: 'If you already have linguistic data that you want to import into your Dictionary, please follow the steps below.'})}
    </p>
    <ol class="py-3 px-5">
      <li class="list-decimal mb-3">{$_('import.instructions_2', {default: 'Click on the blue “Link to Template” button below. Download the template as an Excel file, or create a copy on Google Docs. Edit the template according to your project’s needs. Copy and paste your data into the spreadsheet.'})}</li>
      <li class="list-decimal mb-3">{$_('import.instructions_3', {default: 'Use the “Contact Us” below to contact us. Let us know that you have a new spreadsheet that is ready for import. Ask us any questions you have. We will respond to you by email, and then you can send us your file.'})}</li>
    </ol>
    <p class="mb-3">
      {$_('import.instructions_4', {default: 'To send us data exported from dictionary softwares like FLEx, Lexique Pro, Shoebox, please use the “Contact Us” button below and tell us the details of your project.'})}
    </p>
  </div>
  <div class="flex justify-between">
    <Button form="filled" type="button" target="_blank" href="https://docs.google.com/spreadsheets/d/1Bqy1q_XZzlZLDM_glTxQ9gw0Pb5JEUssqQFtINxbwzY/edit#gid=1392642957">
      {$_('import.template_link', { default: 'Link to Template' })}
    </Button>
    <ShowHide let:show let:toggle>
      <Button onclick={toggle}>
        <span class="lg:inline">
          <i class="far fa-comment" />
        </span>
        <span class="ml-1 sm:inline">
          {$_('header.contact_us', { default: 'Contact Us' })}
        </span>
      </Button>
      {#if show}
        {#await import('$lib/components/modals/Contact.svelte') then { default: Contact }}
          <Contact subject="import_data" on:close={toggle} />
        {/await}
      {/if}
    </ShowHide>
  </div>
</div>
