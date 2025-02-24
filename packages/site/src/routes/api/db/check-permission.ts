import type { Supabase } from '$lib/supabase'

export async function check_can_edit(supabase: Supabase, dictionary_id: string) {
  const { data: roles, error } = await supabase.from('dictionary_roles').select()
  if (error) throw new Error(error.message)

  if (roles.some(({ dictionary_id: _dictionary_id, role }) => _dictionary_id === dictionary_id && (role === 'manager' || role === 'contributor'))) return true

  throw new Error('Is not authorized to make changes to this dictionary.')
}
