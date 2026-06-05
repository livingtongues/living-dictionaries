<script lang="ts">
  import { invalidateAll } from '$app/navigation'
  import { page } from '$app/state'
  import AuthModal from '$lib/components/shell/AuthModal.svelte'

  interface Props {
    on_close: () => void
  }

  const { on_close }: Props = $props()

  const auth_user = $derived(page.data.auth_user)

  // Reuse the app's existing AuthModal (M4 auth). Once auth completes, re-run the
  // admin layout load (which builds the sync engine) and close.
  $effect(() => {
    if (auth_user?.user) {
      void invalidateAll()
      on_close()
    }
  })
</script>

<AuthModal {on_close} />
