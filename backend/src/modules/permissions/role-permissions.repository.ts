// =====================================================
// ROLE PERMISSIONS REPOSITORY
// Responsibility: Role-permission database operations only
// =====================================================

import { supabase } from '../../config/supabase'
import type { RolePermission, UpdateRolePermissionsDto } from './permissions.types'

export class RolePermissionsRepository {
  async getByRoleId(roleId: string): Promise<RolePermission[]> {
    const { data, error } = await supabase
      .from('perm_role_permissions')
      .select('*, perm_modules(*)')
      .eq('role_id', roleId)

    if (error) throw error
    return (data as any[]) || []
  }

  async get(roleId: string, moduleId: string): Promise<RolePermission | null> {
    const { data, error } = await supabase
      .from('perm_role_permissions')
      .select('*')
      .eq('role_id', roleId)
      .eq('module_id', moduleId)
      .single()

    if (error) return null
    return data as RolePermission
  }

  async create(permission: Partial<RolePermission>): Promise<RolePermission> {
    const { data, error } = await supabase
      .from('perm_role_permissions')
      .insert(permission)
      .select()
      .single()

    if (error) throw error
    return data as RolePermission
  }

  async update(
    roleId: string,
    moduleId: string,
    updates: UpdateRolePermissionsDto
  ): Promise<RolePermission> {
    const { data, error } = await supabase
      .from('perm_role_permissions')
      .update(updates)
      .eq('role_id', roleId)
      .eq('module_id', moduleId)
      .select()

    if (error) throw error
    if (!data || data.length === 0) throw new Error('Permission not found')
    return data[0] as RolePermission
  }

  async delete(roleId: string, moduleId: string): Promise<boolean> {
    const { error } = await supabase
      .from('perm_role_permissions')
      .delete()
      .eq('role_id', roleId)
      .eq('module_id', moduleId)

    return !error
  }

  async bulkCreate(permissions: Partial<RolePermission>[]): Promise<boolean> {
    const { error } = await supabase.from('perm_role_permissions').insert(permissions)
    return !error
  }
}
