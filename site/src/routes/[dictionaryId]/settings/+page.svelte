<script lang="ts">
  import type { TablesUpdate } from '$lib/types'
  import HeadlessButton from '$lib/components/ui/HeadlessButton.svelte'
  import JSON from '$lib/components/ui/JSON.svelte'
  import ShowHide from '$lib/components/ui/ShowHide.svelte'
  import { page } from '$app/state'
  import PublicCheckbox from '$lib/components/settings/PublicCheckbox.svelte' // only used here - perhaps colocate
  import PrintAccessCheckbox from '$lib/components/settings/PrintAccessCheckbox.svelte' // only used here - perhaps colocate
  import SeoMetaTags from '$lib/components/SeoMetaTags.svelte'
  import DialectsManager from './DialectsManager.svelte'
  import { goto } from '$app/navigation'

  const { data } = $props()
  const { dictionary, auth_user, is_manager, can_edit, update_dictionary, about_is_too_short } = $derived(data)

  // Catalog fields (name, codes, languages, orthographies, location, cover image…)
  // are edited in place on the dictionary home page — settings only keeps the
  // toggles and the delete escape hatch.
  async function save(change: TablesUpdate<'dictionaries'>) {
    try {
      await update_dictionary(change)
    } catch (err) {
      alert(`${page.data.t('misc.error')}: ${err}`)
    }
  }
</script>

<div style="max-width: 700px">
  <h3 class="settings-heading">{page.data.t('misc.settings')}</h3>

  <PrintAccessCheckbox
    checked={!!dictionary.print_access}
    on_changed={async ({ checked }) => await save({ print_access: checked ? 1 : 0 })} />
  <div style="margin-bottom: 1.25rem"></div>

  {#if !dictionary.con_language_description}
    <PublicCheckbox
      checked={!!dictionary.public}
      on_changed={async ({ checked }) => {
        if (!checked) {
          await save({ public: 0 })
        } else if (auth_user.is_admin) {
          await save({ public: 1 })
          dictionary.public = 1
        } else if (about_is_too_short()) {
          alert(page.data.t('about.message'))
          goto(`/${dictionary.url}/about`)
        } else {
          const communityAllowsOnline = confirm(page.data.t('settings.community_permission'))
          if (communityAllowsOnline) alert(page.data.t('header.contact_us'))
        }
        dictionary.public = 0
      }} />
    <div style="margin-bottom: 1.25rem"></div>
  {/if}

  {#if can_edit}
    <hr class="settings-divider" />
    <DialectsManager />
  {/if}

  {#if is_manager}
    <hr class="settings-divider" />

    <div>
      <ShowHide>
        {#snippet children({ show, toggle })}
          <HeadlessButton onclick={toggle} class="btn btn-default delete-dict-button">
            {page.data.t('settings.delete_dictionary')}:
            {page.data.t('header.contact_us')}
          </HeadlessButton>
          {#if show}
            {#await import('$lib/components/modals/Contact.svelte') then { default: Contact }}
              <Contact subject="delete_dictionary" on_close={toggle} />
            {/await}
          {/if}
        {/snippet}
      </ShowHide>
    </div>
  {/if}

  {#if auth_user.admin_level >= 3}
    <div style="margin-top: 1.25rem">
      <JSON obj={dictionary} />
    </div>
  {/if}
</div>

<SeoMetaTags
  norobots={!dictionary.public}
  title={page.data.t('misc.settings')}
  dictionaryName={dictionary.name}
  description="Under Settings, dictionary managers can toggle on or off the ability to make the dictionary public, and the ability to make the dictionary printable to viewers."
  keywords="Settings, public dictionary, private dictionary, Endangered Languages, Language Documentation, Language Revitalization, Build a Dictionary, Online Dictionary, Digital Dictionary, Dictionary Software, Free Software, Online Dictionary Builder, Living Dictionaries, Living Dictionary, Edit a dictionary" />

<style>
  .settings-heading {
    font-size: 1.25rem;
    line-height: 1.75rem;
    font-weight: 600;
    margin-bottom: 1rem;
  }

  :global(.delete-dict-button) {
    margin-bottom: 1.25rem;
  }

  .settings-divider {
    border: none;
    border-top: 1px solid color-mix(in srgb, var(--color) 12%, var(--background));
    margin: 1.5rem 0;
  }
</style>
