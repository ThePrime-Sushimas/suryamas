// =====================================================
// ROLES REPOSITORY
// Responsibility: Role database operations only
// =====================================================

import { supabase } from '../../config/supabase'
import type { Role, CreateRoleDto } from './permissions.types'

export class RolesRepository {
  async getAll(): Promise<Role[]> {
    const { data, error } = await supabase
      .from('perm_roles')
      .select('*')
      .order('name')

    if (error) throw error
    return (data as Role[]) || []
  }

  async findById(id: string) {
    const { data, error } = await supabase
      .from('perm_roles')
      .select(
        `
        *,
        perm_role_permissions (
          *,
          perm_modules (*)
        )
      `
      )
      .eq('id', id)
      .single()

    if (error) throw error
    return data
  }

  async getByName(name: string): Promise<Role | null> {
    const { data, error } = await supabase
      .from('perm_roles')
      .select('*')
      .eq('name', name)
      .single()

    if (error) return null
    return data as Role
  }

  async create(dto: CreateRoleDto): Promise<Role> {
    const { data, error } = await supabase
      .from('perm_roles')
      .insert(dto)
      .select()
      .single()

    if (error) throw error
    return data as Role
  }

  async update(id: string, updates: Partial<Role>): Promise<Role> {
    const { data, error } = await supabase
      .from('perm_roles')
      .update(updates)
      .eq('id', id)
      .select()
      .single()

    if (error) throw error
    return data as Role
  }

  async delete(id: string): Promise<boolean> {
    const role = await this.findById(id)
    if ((role as any)?.is_system_role) {
      throw new Error('Cannot delete system role')
    }

    const { error } = await supabase.from('perm_roles').delete().eq('id', id)
    return !error
  }
}
