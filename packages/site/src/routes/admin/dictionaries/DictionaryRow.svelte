<script lang="ts">
  import { BadgeArrayEmit, Button, JSON, Modal, ShowHide } from 'svelte-pieces'
  import type { TablesUpdate } from '@living-dictionaries/types'
  import type { UserWithDictionaryRoles } from '@living-dictionaries/types/supabase/users.types'
  import DictionaryFieldEdit from './DictionaryFieldEdit.svelte'
  import RolesManagment from './RolesManagment.svelte'
  import type { DictionaryWithHelpers } from './dictionaryWithHelpers.types'
  import type { PageData } from './$types'
  import ContributorInvitationStatus from '$lib/components/contributors/ContributorInvitationStatus.svelte'
  import { supabase_date_to_friendly } from '$lib/helpers/time'
  import LatLngDisplay from '$lib/components/maps/LatLngDisplay.svelte'
  import { page } from '$app/stores'
  import { api_delete_dictionary } from '$api/db/delete-dictionary/_call'

  interface Props {
    index: number;
    is_public: boolean;
    dictionary: DictionaryWithHelpers;
    users: UserWithDictionaryRoles[];
    update_dictionary: (change: TablesUpdate<'dictionaries'>) => Promise<void>;
    load_extras: () => Promise<void>;
  }

  let {
    index,
    is_public,
    dictionary,
    users,
    update_dictionary,
    load_extras
  }: Props = $props();

  let typedId = $state('')

  let { admin, supabase, add_editor, remove_editor, inviteHelper } = $derived($page.data as PageData)

  let managers = $derived(dictionary.editors.filter(({ dictionary_roles }) => dictionary_roles.some(({ role, dictionary_id }) => role === 'manager' && dictionary_id === dictionary.id)))
  let contributors = $derived(dictionary.editors.filter(({ dictionary_roles }) => dictionary_roles.some(({ role, dictionary_id }) => role === 'contributor' && dictionary_id === dictionary.id)))
</script>

<td class="relative">
  <span onclick={() => window.open(`/${dictionary.id}`)} class="absolute top-0 left-0 text-xs text-gray-400 cursor-pointer">{index + 1}</span>
  <DictionaryFieldEdit field="name" value={dictionary.name} {update_dictionary} />
</td>
<td>
  <Button
    color={dictionary.public ? 'green' : 'orange'}
    size="sm"
    onclick={async () => {
      if (confirm('Flip this dictionary\'s visibility?')) {
        await update_dictionary({
          public: !dictionary.public,
        })
      }
    }}>
    {dictionary.public ? 'Public' : 'Private'}
  </Button>
</td>
<td>
  <Button title="View Entries" size="sm" form="simple" href="/{dictionary.url}">
    {dictionary.entry_count}
    <!-- <span class="i-tabler-external-link" style="vertical-align: -1px;" /> -->
  </Button>
</td>
<td>
  <div style="width: 300px;"></div>
  <RolesManagment
    editors={managers}
    add_editor={async (user_id) => {
      await add_editor({ role: 'manager', user_id, dictionary_id: dictionary.id })
      await load_extras()
    }}
    remove_editor={async (user_id) => {
      await remove_editor({ user_id, dictionary_id: dictionary.id })
      await load_extras()
    }}
    invite_editor={async () => {
      await inviteHelper('manager', dictionary.id)
      await load_extras()
    }}
    {users} />
  <div class="max-h-150px overflow-y-auto">
    {#each dictionary.invites as invite}
      {#if invite.role === 'manager'}
        <div class="my-1">
          <ContributorInvitationStatus
            admin
            {invite}
            on_delete_invite={async () => {
              const { error } = await supabase.from('invites').update({ status: 'cancelled' }).eq('id', invite.id)
              if (error) {
                alert(error.message)
                console.error(error)
              } else {
                await load_extras()
              }
            }}>
            {#snippet prefix()}
                        <span class="i-mdi-email-send" ></span>
                      {/snippet}
          </ContributorInvitationStatus>
        </div>
      {/if}
    {/each}
  </div>
</td>
<td>
  <div style="width: 300px;"></div>
  <RolesManagment
    editors={contributors}
    add_editor={async (user_id) => {
      await add_editor({ role: 'contributor', user_id, dictionary_id: dictionary.id })
      await load_extras()
    }}
    remove_editor={async (user_id) => {
      await remove_editor({ user_id, dictionary_id: dictionary.id })
      await load_extras()
    }}
    invite_editor={async () => {
      await inviteHelper('contributor', dictionary.id)
      await load_extras()
    }}
    {users} />
  <div class="max-h-150px overflow-y-auto">
    {#each dictionary.invites as invite}
      {#if invite.role === 'contributor'}
        <div class="my-1">
          <ContributorInvitationStatus
            admin
            {invite}
            on_delete_invite={async () => {
              const { error } = await supabase.from('invites').update({ status: 'cancelled' }).eq('id', invite.id)
              if (error) {
                alert(error.message)
                console.error(error)
              } else {
                await load_extras()
              }
            }}>
            {#snippet prefix()}
                        <span class="i-mdi-email-send" ></span>
                      {/snippet}
          </ContributorInvitationStatus>
        </div>
      {/if}
    {/each}
  </div>
</td>
<td>
  <DictionaryFieldEdit
    field="iso_639_3"
    value={dictionary.iso_639_3}
    {update_dictionary} />
</td>
<td>
  <DictionaryFieldEdit
    field="glottocode"
    value={dictionary.glottocode}
    {update_dictionary} />
</td>
<td>
  <ShowHide  >
    {#snippet children({ show, toggle })}
        <Button class="text-nowrap -ml-2" size="sm" form="simple" onclick={toggle}>
        {#if dictionary.coordinates?.points?.length}
          <LatLngDisplay
            lat={dictionary.coordinates.points[0].coordinates.latitude}
            lng={dictionary.coordinates.points[0].coordinates.longitude} />
        {:else}<b>Add</b>{/if}
      </Button>
      {#if show}
        {#await import('$lib/components/maps/CoordinatesModal.svelte') then { default: CoordinatesModal }}
          <CoordinatesModal
            lat={dictionary.coordinates?.points?.length ? dictionary.coordinates.points[0].coordinates.latitude : undefined}
            lng={dictionary.coordinates?.points?.length ? dictionary.coordinates.points[0].coordinates.longitude : undefined}
            on:update={({ detail: { lat, lng } }) => {
              const [, ...rest] = dictionary.coordinates?.points || []
              update_dictionary({
                coordinates: {
                  points: [{ coordinates: { latitude: lat, longitude: lng } }, ...rest],
                  regions: dictionary.coordinates?.regions,
                },
              })
            }}
            on:remove={() => {
              const [, ...rest] = dictionary.coordinates?.points || []
              update_dictionary({
                coordinates: {
                  points: rest,
                  regions: dictionary.coordinates?.regions,
                },
              })
            }}
            on:close={toggle} />
        {/await}
      {/if}
          {/snippet}
    </ShowHide>
</td>
<td>
  <DictionaryFieldEdit
    field="location"
    value={dictionary.location}
    {update_dictionary} />
</td>
<td>
  <BadgeArrayEmit addMessage="Add" strings={dictionary.gloss_languages?.slice(0, 8)} />
  {#if dictionary.gloss_languages?.length > 8}
    <span class="text-xs text-gray-400">+{dictionary.gloss_languages.length - 8}</span>
  {/if}
</td>
<td>
  <div style="width: 300px;"></div>
  <BadgeArrayEmit
    canEdit
    addMessage="Add"
    strings={dictionary.alternate_names?.slice(0, 8)}
    on:additem={() => {
      const name = prompt('Enter alternate name:')
      if (name) {
        update_dictionary({
          alternate_names: [...(dictionary.alternate_names || []), name],
        })
      }
    }}
    on:itemremoved={({ detail: { value } }) => {
      update_dictionary({
        alternate_names: dictionary.alternate_names.filter(name => name !== value),
      })
    }} />
  {#if dictionary.alternate_names?.length > 8}
    <span class="text-xs text-gray-400">+{dictionary.alternate_names.length - 8}</span>
  {/if}
</td>
<td>
  {dictionary.orthographies?.length? dictionary.orthographies.map(({ name }) => name.default) : ''}
</td>
<td class="whitespace-nowrap">
  {#if dictionary.created_at}{supabase_date_to_friendly(dictionary.created_at)}{/if}
</td>
<td class="whitespace-nowrap">
  {#if dictionary.updated_at}{supabase_date_to_friendly(dictionary.updated_at)}{/if}
</td>
<td>{typeof dictionary.language_used_by_community === 'boolean'
  ? dictionary.language_used_by_community
  : ''}</td>
<td>{dictionary.community_permission ? dictionary.community_permission : ''}</td>

<td class="w-300px max-w-300px">
  <div class="w-300px line-clamp-5" title={dictionary.author_connection}>
    {dictionary.author_connection ? dictionary.author_connection : ''}
  </div>
</td>
<td class="w-300px max-w-300px">
  <div class="w-300px line-clamp-5" title={dictionary.con_language_description}>
    {dictionary.con_language_description ? dictionary.con_language_description : ''}
  </div>
</td>
<td>
  {#if !is_public}
    <Button
      color={dictionary?.con_language_description === 'YES' ? 'green' : 'orange'}
      size="sm"
      onclick={() => {
        if (confirm('Toggle con lang status?')) {
          update_dictionary({ con_language_description: dictionary?.con_language_description === 'YES' ? null : 'YES' })
        }
      }}>
      {dictionary?.con_language_description === 'YES' ? 'YES' : 'NO'}
    </Button>
  {/if}
</td>
<td>
  <ShowHide  >
    {#snippet children({ show, toggle })}
        <Button
        color="red"
        form="filled"
        size="sm"
        onclick={toggle}>
        Delete
      </Button>
      {#if show}
        <Modal on:close={toggle}>
          {#snippet heading()}
                <span >Delete {dictionary.name}?</span>
              {/snippet}
          <div class="mb-2">
            id: {dictionary.id}, url: /{dictionary.url}
          </div>
          <input type="text" bind:value={typedId} placeholder="Type the dictionary ID to confirm deletion" class="mb-2 form-input w-full" />
          <Button
            disabled={!typedId || typedId !== dictionary.id}
            color="red"
            form="filled"
            size="sm"
            class="block!"
            onclick={async () => {
              const { error } = await api_delete_dictionary({ dictionary_id: dictionary.id })
              if (error) {
                alert(error.message)
              } else {
                alert('Dictionary deleted. Please check your email to confirm it was successful and then close the dialog to continue working (the view is updated once a day).')
              }
            }}>
            Delete
          </Button>
        </Modal>
      {/if}
          {/snippet}
    </ShowHide>
</td>
{#if $admin > 1}
  <td class="cursor-pointer">
    <JSON obj={dictionary} />
  </td>
{/if}
