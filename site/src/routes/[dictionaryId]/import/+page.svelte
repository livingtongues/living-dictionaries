<script lang="ts">
  import { Button, ShowHide } from '$lib/svelte-pieces'
  import { page } from '$app/stores'

  const { data } = $props()
  const { dictionary } = $derived(data)
</script>

<div style="max-width: 768px; margin-left: 1rem">
  <div style="padding: 0.5rem">
    <h3 class="import-heading">
      {$page.data.t('import_page.import')}: {dictionary.name}
    </h3>

    <p style="margin-bottom: 0.75rem">
      {$page.data.t('import_page.instructions_1')}
    </p>
    <ol style="padding: 0.75rem 1.25rem">
      <li class="import-step">{$page.data.t('import_page.instructions_2')}</li>
      <li class="import-step">{$page.data.t('import_page.instructions_3')}</li>
    </ol>
    <p style="margin-bottom: 0.75rem">
      {$page.data.t('import_page.instructions_4')}
    </p>
  </div>
  <div style="display: flex; justify-content: space-between">
    <Button form="filled" type="button" target="_blank" href="https://docs.google.com/spreadsheets/d/1Bqy1q_XZzlZLDM_glTxQ9gw0Pb5JEUssqQFtINxbwzY/edit#gid=1392642957">
      {$page.data.t('import_page.template_link')}
    </Button>
    <ShowHide>
      {#snippet children({ show, toggle })}
        <Button onclick={toggle}>
          <span>
            <i class="far fa-comment"></i>
          </span>
          <span style="margin-left: 0.25rem">
            {$page.data.t('header.contact_us')}
          </span>
        </Button>
        {#if show}
          {#await import('$lib/components/modals/Contact.svelte') then { default: Contact }}
            <Contact subject="import_data" on:close={toggle} />
          {/await}
        {/if}
      {/snippet}
    </ShowHide>
  </div>
  <!-- <p class="m-10 text-xl font-semibold">{$page.data.t('import_page.no_imports')}</p> -->
</div>

<style>
  .import-heading {
    margin-bottom: 1.5rem;
    font-size: 1.875rem;
    line-height: 2rem;
    font-weight: 700;
    letter-spacing: -0.025em;
    color: var(--color); /* ≈ gray-900 */
  }

  @media (min-width: 640px) {
    .import-heading {
      font-size: 2.25rem;
      line-height: 2.5rem;
    }
  }

  .import-step {
    list-style-type: decimal;
    margin-bottom: 0.75rem;
  }
</style>
