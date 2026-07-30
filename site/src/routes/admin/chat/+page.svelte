<script lang="ts">
  import ChatPage from '$lib/chat/ChatPage.svelte'
</script>

<svelte:head><title>Chat · Admin</title></svelte:head>

<!-- The in-admin door: an admin working in the admin never bops out of it. The
     layout already gates on admin + owns the header, so `chrome="admin"`. -->
<ChatPage base_path="/admin/chat" chrome="admin" />
