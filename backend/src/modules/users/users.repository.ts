// =====================================================
// USERS REPOSITORY
// =====================================================

import { supabase } from '../../config/supabase'

export class UsersRepository {
  async getAllUsers() {
    const { data, error } = await supabase
      .from('perm_user_profiles')
      .select(`
        user_id,
        role_id,
        created_at,
        perm_roles (id, name, description)
      `)
      .order('created_at', { ascending: false })

    if (error) throw error
    return data || []
  }

  async getUserRole(userId: string) {
    const { data, error } = await supabase
      .from('perm_user_profiles')
      .select(`
        user_id,
        role_id,
        perm_roles (id, name, description)
      `)
      .eq('user_id', userId)
      .single()

    if (error) return null
    return data
  }

  async assignRole(userId: string, roleId: string) {
    // Check if profile exists
    const { data: existing } = await supabase
      .from('perm_user_profiles')
      .select('user_id')
      .eq('user_id', userId)
      .single()

    if (existing) {
      // Update existing
      const { data, error } = await supabase
        .from('perm_user_profiles')
        .update({ role_id: roleId })
        .eq('user_id', userId)
        .select()
        .single()
      if (error) throw error
      return data
    } else {
      // Insert new
      const { data, error } = await supabase
        .from('perm_user_profiles')
        .insert({ user_id: userId, role_id: roleId })
        .select()
        .single()
      if (error) throw error
      return data
    }
  }

  async removeRole(userId: string) {
    const { error } = await supabase
      .from('perm_user_profiles')
      .update({ role_id: null })
      .eq('user_id', userId)

    if (error) throw error
    return true
  }
}
