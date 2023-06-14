<script lang="ts">
  import { Story } from 'kitbook';
  import ContributorInvitationStatus from './ContributorInvitationStatus.svelte';
</script>


# Invitations 

- "Invited:" can be replaced using the `prefix` slot
- Hover over email to see email of the inviter

<Story knobs={{ targetEmail: 'john@gmail.com', admin: false }} let:props={{ targetEmail, admin }}>
  {#each [{ targetEmail, inviterEmail: 'jimcousin@gmail.com', id: 'randomid1234' }, { targetEmail: 'jimbob@gmail.com', inviterEmail: 'jimcousin@gmail.com', id: 'randomid1234' }] as invite}
    <div class="my-1">
      <ContributorInvitationStatus {admin} {invite} on:delete={(e) => alert(`Deleted invite from ${invite.id}`)} />
    </div>
  {/each}
</Story>
