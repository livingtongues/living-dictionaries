<script lang="ts">
  import { _ } from 'svelte-i18n';
  import { where } from 'firebase/firestore';
  import { deleteDocumentOnline, updateOnline, Collection } from '$sveltefirets';
  import type { IInvite, IHelper } from '$lib/interfaces';
  import { isManager, admin } from '$lib/stores';
  import Button from '$svelteui/ui/Button.svelte';
  export let dictionaryId: string;
  export let role: 'manager' | 'contributor' | 'writeInCollaborator';
  let inviteType: IInvite[];
  let helperType: IHelper[];
</script>

{#if role !== 'writeInCollaborator'}
  <Collection
    path={`dictionaries/${dictionaryId}/invites`}
    queryConstraints={[where('role', '==', role), where('status', 'in', ['queued', 'sent'])]}
    startWith={inviteType}
    let:data={invites}>
    {#each invites as invite}
      <div class="py-3 flex flex-wrap items-center justify-between">
        <div class="text-sm leading-5 font-medium text-gray-900">
          <i
            >{$_('contributors.invitation_sent', {
              default: 'Invitation sent',
            })}:</i>
          {invite.targetEmail}
        </div>
        {#if $admin}
          <Button
            color="red"
            size="sm"
            onclick={() => {
              if (confirm($_('misc.delete', { default: 'Delete' }))) {
                updateOnline(`dictionaries/${dictionaryId}/invites/${invite.id}`, {
                  status: 'cancelled',
                });
              }
            }}
            >{$_('misc.delete', { default: 'Delete' })}
            <i class="fas fa-times" /><i class="fas fa-key mx-1" /></Button>
        {/if}
      </div>
    {/each}
  </Collection>
{:else}
  <Collection
    path={`dictionaries/${dictionaryId}/writeInCollaborators`}
    startWith={helperType}
    let:data={writeInCollaborators}>
    {#each writeInCollaborators as collaborator}
      <div class="py-3 flex flex-wrap items-center justify-between">
        <div class="text-sm leading-5 font-medium text-gray-900">
          {collaborator.name}
        </div>
        {#if $isManager}
          <Button
            color="red"
            size="sm"
            onclick={() => {
              if (confirm($_('misc.delete', { default: 'Delete' }))) {
                deleteDocumentOnline(
                  `dictionaries/${dictionaryId}/writeInCollaborators/${collaborator.id}`
                );
              }
            }}
            >{$_('misc.delete', { default: 'Delete' })}
            <i class="fas fa-times" /></Button>
        {/if}
      </div>
    {/each}
  </Collection>
{/if}
