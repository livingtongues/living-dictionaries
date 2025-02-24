import type { DictionaryView } from '@living-dictionaries/types'
import type { LayoutLoad } from './$types'
import { inviteHelper } from '$lib/helpers/inviteHelper'

export const load = (({ parent }) => {
  async function get_public_dictionaries() {
    const { supabase } = await parent()
    const { data: public_dictionaries, error } = await supabase.from('dictionaries_view')
      .select()
      .eq('public', true)
    if (error) {
      console.error(error)
      alert(error.message)
      return []
    }
    return public_dictionaries as DictionaryView[]
  }

  async function get_private_dictionaries() {
    const { supabase } = await parent()
    const { data: private_dictionaries, error } = await supabase.from('dictionaries_view')
      .select()
      .neq('public', true)
      .is('con_language_description', null)

    if (error) {
      console.error(error)
      alert(error.message)
      return []
    }
    return private_dictionaries as DictionaryView[]
  }

  async function get_other_dictionaries() {
    const { supabase } = await parent()
    const { data: private_dictionaries, error } = await supabase.from('dictionaries_view')
      .select()
      .neq('public', true)
      .not('con_language_description', 'is', null)

    if (error) {
      console.error(error)
      alert(error.message)
      return []
    }
    return private_dictionaries as DictionaryView[]
  }

  async function get_dictionary_roles() {
    const { supabase } = await parent()
    const { data: dictionary_roles, error } = await supabase.from('dictionary_roles')
      .select()

    if (error) {
      console.error(error)
      alert(error.message)
      return []
    }
    return dictionary_roles
  }

  async function get_invites() {
    const { supabase } = await parent()
    const { data: invites, error } = await supabase.from('invites')
      .select()

    if (error) {
      console.error(error)
      alert(error.message)
      return []
    }
    return invites
  }

  async function get_users_with_roles() {
    const { supabase } = await parent()
    const { data: users_with_dictionary_ids, error } = await supabase.rpc('users_with_dictionary_roles')
      .select()
    if (error) {
      console.error(error)
      alert(error.message)
      return []
    }
    return users_with_dictionary_ids
  }

  async function add_editor({ role, dictionary_id, user_id }: { role: 'manager' | 'contributor', dictionary_id: string, user_id: string }) {
    const { supabase } = await parent()
    const { error } = await supabase.from('dictionary_roles')
      .insert({ dictionary_id, user_id, role })
    if (error) {
      console.error(error)
      alert(error.message)
    }
  }

  async function remove_editor({ dictionary_id, user_id }: { dictionary_id: string, user_id: string }) {
    const { supabase } = await parent()
    const { error } = await supabase.from('dictionary_roles')
      .delete()
      .eq('dictionary_id', dictionary_id)
      .eq('user_id', user_id)
    if (error) {
      console.error(error)
      alert(error.message)
    }
  }

  return {
    get_public_dictionaries,
    get_private_dictionaries,
    get_other_dictionaries,
    get_users_with_roles,
    add_editor,
    remove_editor,
    get_dictionary_roles,
    get_invites,
    inviteHelper,
  }
}) satisfies LayoutLoad
