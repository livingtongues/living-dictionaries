export async function load({ params: { inviteId }, parent }) {
  const { t, supabase, authResponse } = await parent()

  if (!authResponse?.data?.user) {
    return { invite: null, accept_invite: null }
  }

  const { data: invite, error: invite_error } = await supabase.from('invites').select().eq('id', inviteId).single()

  if (invite_error) {
    console.error({ invite_error })
    return { invite: null, accept_invite: null }
  }

  async function accept_invite() {
    try {
      const { error: role_error } = await supabase.from('dictionary_roles').insert({
        dictionary_id: invite.dictionary_id,
        role: invite.role,
      })
      if (role_error) {
        throw new Error(role_error.message)
      }

      const { error: update_error } = await supabase.from('invites').update({ status: 'claimed' }).eq('id', inviteId)
      if (update_error) {
        throw new Error(update_error.message)
      }

      const { error } = await supabase.from('user_data').update({ terms_agreement: new Date().toISOString() }).eq('id', authResponse.data.user.id)
      if (error) {
        throw new Error(error.message)
      }
    } catch (err) {
      alert(`${t('misc.error')}: ${err}`)
    }
  }

  return { invite, accept_invite }
}
