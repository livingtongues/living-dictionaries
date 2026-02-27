<script lang="ts">
  import type { PageData } from './$types'
  import type { DictionaryWithHelpers, UserWithRoles } from './dictionaryWithHelpers.types'
  import { page } from '$app/state'
  import ContributorInvitationStatus from '$lib/components/contributors/ContributorInvitationStatus.svelte'
  import LatLngDisplay from '$lib/components/maps/LatLngDisplay.svelte'
  import { db_date_to_friendly } from '$lib/helpers/time'
  import { BadgeArrayEmit, Button, JSON, Modal, ShowHide } from '$lib/svelte-pieces'
  import DictionaryFieldEdit from './DictionaryFieldEdit.svelte'
  import RolesManagment from './RolesManagment.svelte'

  interface Props {
    index: number
    is_public: boolean
    dictionary: DictionaryWithHelpers
    users: UserWithRoles[]
  }

  let {
    index,
    is_public,
    dictionary,
    users,
  }: Props = $props()

  let typedId = $state('')

  let { admin, add_editor, remove_editor, inviteHelper, db } = $derived(page.data as PageData)

  let managers = $derived(dictionary.editors.filter(({ dictionary_roles }) => dictionary_roles.some(({ role, dictionary_id }) => role === 'manager' && dictionary_id === dictionary.id)))
  let contributors = $derived(dictionary.editors.filter(({ dictionary_roles }) => dictionary_roles.some(({ role, dictionary_id }) => role === 'contributor' && dictionary_id === dictionary.id)))
</script>

<td class="relative">
  <span onclick={() => window.open(`/${dictionary.id}`)} class="absolute top-0 left-0 text-xs text-gray-400 cursor-pointer">{index + 1}</span>
  <DictionaryFieldEdit field="name" {dictionary} />
</td>
<td>
  <Button
    color={dictionary.public ? 'green' : 'orange'}
    size="sm"
    onclick={async () => {
      if (confirm('Flip this dictionary\'s visibility?')) {
        dictionary.public = !dictionary.public
        await dictionary._save()
      }
    }}>
    {dictionary.public ? 'Public' : 'Private'}
  </Button>
</td>
<td>
  <Button title="View Entries" size="sm" form="simple" href="/{dictionary.url}">
    {dictionary.entry_count}
  </Button>
</td>
<td>
  <div style="width: 300px;"></div>
  <RolesManagment
    editors={managers}
    add_editor={async (user_id) => {
      await add_editor({ role: 'manager', user_id, dictionary_id: dictionary.id })
    }}
    remove_editor={async (user_id) => {
      await remove_editor({ user_id, dictionary_id: dictionary.id })
    }}
    invite_editor={async () => {
      await inviteHelper('manager', dictionary.id)
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
              const pglite_invite = db?.invites.rows.find(i => i.id === invite.id)
              if (pglite_invite) {
                pglite_invite.status = 'cancelled'
                await pglite_invite._save()
              }
            }}>
            {#snippet prefix()}
              <span class="i-mdi-email-send"></span>
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
    }}
    remove_editor={async (user_id) => {
      await remove_editor({ user_id, dictionary_id: dictionary.id })
    }}
    invite_editor={async () => {
      await inviteHelper('contributor', dictionary.id)
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
              const pglite_invite = db?.invites.rows.find(i => i.id === invite.id)
              if (pglite_invite) {
                pglite_invite.status = 'cancelled'
                await pglite_invite._save()
              }
            }}>
            {#snippet prefix()}
              <span class="i-mdi-email-send"></span>
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
    {dictionary} />
</td>
<td>
  <DictionaryFieldEdit
    field="glottocode"
    {dictionary} />
</td>
<td>
  <ShowHide>
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
            on_update={({ lat, lng }) => {
              const [, ...rest] = dictionary.coordinates?.points || []
              dictionary.coordinates = {
                points: [{ coordinates: { latitude: lat, longitude: lng } }, ...rest],
                regions: dictionary.coordinates?.regions,
              }
              dictionary._save()
            }}
            on_remove={() => {
              const [, ...rest] = dictionary.coordinates?.points || []
              dictionary.coordinates = {
                points: rest,
                regions: dictionary.coordinates?.regions,
              }
              dictionary._save()
            }}
            on_close={toggle} />
        {/await}
      {/if}
    {/snippet}
  </ShowHide>
</td>
<td>
  <DictionaryFieldEdit
    field="location"
    {dictionary} />
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
    onadditem={() => {
      const name = prompt('Enter alternate name:')
      if (name) {
        dictionary.alternate_names = [...(dictionary.alternate_names || []), name]
        dictionary._save()
      }
    }}
    onitemremoved={({ value }) => {
      dictionary.alternate_names = dictionary.alternate_names?.filter(name => name !== value) || []
      dictionary._save()
    }} />
  {#if dictionary.alternate_names?.length > 8}
    <span class="text-xs text-gray-400">+{dictionary.alternate_names.length - 8}</span>
  {/if}
</td>
<td>
  {dictionary.orthographies?.length? dictionary.orthographies.map(({ name }) => name.default) : ''}
</td>
<td class="whitespace-nowrap">
  {#if dictionary.created_at}{db_date_to_friendly(dictionary.created_at)}{/if}
</td>
<td class="whitespace-nowrap">
  {#if dictionary.updated_at}{db_date_to_friendly(dictionary.updated_at)}{/if}
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
          dictionary.con_language_description = dictionary?.con_language_description === 'YES' ? null : 'YES'
          dictionary._save()
        }
      }}>
      {dictionary?.con_language_description === 'YES' ? 'YES' : 'NO'}
    </Button>
  {/if}
</td>
<td>
  <ShowHide>
    {#snippet children({ show, toggle })}
      <Button
        color="red"
        form="filled"
        size="sm"
        onclick={toggle}>
        Delete
      </Button>
      {#if show}
        <Modal on_close={toggle}>
          {#snippet heading()}
            <span>Delete {dictionary.name}?</span>
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
              await dictionary._delete()
              alert('Dictionary deleted locally. Make sure to sync your changes.')
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
