<script lang="ts">
  import ChatPage from '$lib/chat/ChatPage.svelte'
</script>

<svelte:head><title>Chat · Living Dictionaries</title></svelte:head>

<!-- The standalone door: partners and super managers live here, and every chat
     notification email deep-links to /chat?room=… -->
<ChatPage base_path="/chat" chrome="site" />
