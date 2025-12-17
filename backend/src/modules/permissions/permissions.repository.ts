// =====================================================
// PERMISSIONS REPOSITORY
// =====================================================

import { supabase } from '../../config/supabase'
import type {
  Module,
  Role,
  RolePermission,
  CreateModuleDto,
  CreateRoleDto,
  UpdateRolePermissionsDto,
} from '../../types/permission.types'

export class PermissionsRepository {
  // =====================================================
  // MODULES
  // =====================================================

  async getAllModules(): Promise<Module[]> {
    const { data, error } = await supabase
      .from('perm_modules')
      .select('*')
      .order('name')

    if (error) throw error
    return (data as Module[]) || []
  }

  async getModuleById(id: string): Promise<Module | null> {
    const { data, error } = await supabase
      .from('perm_modules')
      .select('*')
      .eq('id', id)
      .single()

    if (error) return null
    return data as Module
  }

  async getModuleByName(name: string): Promise<Module | null> {
    const { data, error } = await supabase
      .from('perm_modules')
      .select('*')
      .eq('name', name)
      .single()

    if (error) return null
    return data as Module
  }

  async createModule(dto: CreateModuleDto): Promise<Module> {
    const { data, error } = await supabase
      .from('perm_modules')
      .insert(dto)
      .select()
      .single()

    if (error) throw error
    return data as Module
  }

  async updateModule(id: string, updates: Partial<Module>): Promise<Module> {
    const { data, error } = await supabase
      .from('perm_modules')
      .update(updates)
      .eq('id', id)
      .select()
      .single()

    if (error) throw error
    return data as Module
  }

  async deleteModule(id: string): Promise<boolean> {
    const { error } = await supabase.from('perm_modules').delete().eq('id', id)
    return !error
  }

  // =====================================================
  // ROLES
  // =====================================================

  async getAllRoles(): Promise<Role[]> {
    const { data, error } = await supabase
      .from('perm_roles')
      .select('*')
      .order('name')

    if (error) throw error
    return (data as Role[]) || []
  }

  async getRoleById(id: string) {
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

  async getRoleByName(name: string): Promise<Role | null> {
    const { data, error } = await supabase
      .from('perm_roles')
      .select('*')
      .eq('name', name)
      .single()

    if (error) return null
    return data as Role
  }

  async createRole(dto: CreateRoleDto): Promise<Role> {
    const { data, error } = await supabase
      .from('perm_roles')
      .insert(dto)
      .select()
      .single()

    if (error) throw error
    return data as Role
  }

  async updateRole(id: string, updates: Partial<Role>): Promise<Role> {
    const { data, error } = await supabase
      .from('perm_roles')
      .update(updates)
      .eq('id', id)
      .select()
      .single()

    if (error) throw error
    return data as Role
  }

  async deleteRole(id: string): Promise<boolean> {
    // Check if system role
    const role = await this.getRoleById(id)
    if ((role as any)?.is_system_role) {
      throw new Error('Cannot delete system role')
    }

    const { error } = await supabase.from('perm_roles').delete().eq('id', id)
    return !error
  }

  // =====================================================
  // ROLE PERMISSIONS
  // =====================================================

  async getRolePermissions(roleId: string): Promise<RolePermission[]> {
    const { data, error } = await supabase
      .from('perm_role_permissions')
      .select('*, perm_modules(*)')
      .eq('role_id', roleId)

    if (error) throw error
    return (data as any[]) || []
  }

  async getPermission(roleId: string, moduleId: string): Promise<RolePermission | null> {
    const { data, error } = await supabase
      .from('perm_role_permissions')
      .select('*')
      .eq('role_id', roleId)
      .eq('module_id', moduleId)
      .single()

    if (error) return null
    return data as RolePermission
  }

  async createPermission(permission: Partial<RolePermission>): Promise<RolePermission> {
    const { data, error } = await supabase
      .from('perm_role_permissions')
      .insert(permission)
      .select()
      .single()

    if (error) throw error
    return data as RolePermission
  }

  async updatePermission(
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

  async deletePermission(roleId: string, moduleId: string): Promise<boolean> {
    const { error } = await supabase
      .from('perm_role_permissions')
      .delete()
      .eq('role_id', roleId)
      .eq('module_id', moduleId)

    return !error
  }

  // =====================================================
  // BULK OPERATIONS
  // =====================================================

  async bulkCreatePermissions(permissions: Partial<RolePermission>[]): Promise<boolean> {
    const { error } = await supabase.from('perm_role_permissions').insert(permissions)
    return !error
  }

  async bulkUpdatePermissions(
    updates: Array<{ roleId: string; moduleId: string; permissions: UpdateRolePermissionsDto }>
  ): Promise<boolean> {
    try {
      for (const update of updates) {
        await this.updatePermission(update.roleId, update.moduleId, update.permissions)
      }
      return true
    } catch {
      return false
    }
  }
}
