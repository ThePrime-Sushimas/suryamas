// =====================================================
// PERMISSION SERVICE - Core Permission Logic
// =====================================================

import { supabase } from '../config/supabase'
import { logInfo, logError, logWarn } from '../config/logger'
import type {
  Module,
  Role,
  RolePermission,
  PermissionAction,
  PermissionMatrix,
  PermissionCheckResult,
  CreateModuleDto,
  UpdateRolePermissionsDto,
} from '../types/permission.types'
import {
  isPublicModule,
  createDefaultPermissions,
  getPermissionColumn,
  PERMISSION_CACHE_TTL,
} from '../utils/permissions.util'

export class PermissionService {
  private static memoryCache = new Map<string, { permissions: PermissionMatrix; expiresAt: number }>()
  private static userPermissionsCache = new Map<string, { permissions: PermissionMatrix; expiresAt: number }>()
  private static readonly MEMORY_CACHE_TTL = 5 * 60 * 1000 // 5 minutes
  private static readonly USER_PERMISSIONS_CACHE_TTL = 10 * 60 * 1000 // 10 minutes

  // =====================================================
  // MODULE REGISTRATION
  // =====================================================

  /**
   * Register a new module in the system
   * Auto-creates default permissions for all existing roles
   */
  static async registerModule(
    name: string,
    description: string,
    defaultPermissions?: Record<string, any>
  ): Promise<Module | null> {
    try {
      // Check if module already exists
      const { data: existing } = await supabase
        .from('perm_modules')
        .select('*')
        .eq('name', name)
        .single()

      if (existing) {
        return existing as Module
      }

      // Create new module
      const { data: module, error: moduleError } = await supabase
        .from('perm_modules')
        .insert({ name, description, is_active: true })
        .select()
        .single()

      if (moduleError) throw moduleError

      logInfo('Module registered', { module: name, id: module.id })

      // Create default permissions for all roles
      const { data: roles } = await supabase.from('perm_roles').select('*')

      if (roles && roles.length > 0) {
        const permissions = roles.map((role: Role) => ({
          role_id: role.id,
          module_id: module.id,
          ...(defaultPermissions?.[role.name] || createDefaultPermissions(role.name)),
        }))

        const { error: permError } = await supabase
          .from('perm_role_permissions')
          .insert(permissions)

        if (permError) {
          logError('Failed to create default permissions', { error: permError.message })
        } else {
          logInfo('Default permissions created', { module: name, roleCount: roles.length })
        }
      }

      return module as Module
    } catch (error: any) {
      logError('Module registration failed', { module: name, error: error.message })
      return null
    }
  }

  /**
   * Get all registered modules
   */
  static async getAllModules(): Promise<Module[]> {
    const { data, error } = await supabase
      .from('perm_modules')
      .select('*')
      .order('name')

    if (error) {
      logError('Failed to fetch modules', { error: error.message })
      return []
    }

    return (data as Module[]) || []
  }

  /**
   * Update module status
   */
  static async updateModuleStatus(moduleId: string, isActive: boolean): Promise<boolean> {
    const { error } = await supabase
      .from('perm_modules')
      .update({ is_active: isActive })
      .eq('id', moduleId)

    if (error) {
      logError('Failed to update module status', { moduleId, error: error.message })
      return false
    }

    // Invalidate cache for all users
    await this.invalidateAllCache()

    logInfo('Module status updated', { moduleId, isActive })
    return true
  }

  // =====================================================
  // PERMISSION CHECKING
  // =====================================================

  /**
   * Check if user has specific permission
   * Uses memory cache first, then database cache, then queries database
   */
  static async hasPermission(
    userId: string,
    moduleName: string,
    action: PermissionAction
  ): Promise<PermissionCheckResult> {
    try {
      // Skip check for public modules
      if (isPublicModule(moduleName)) {
        logInfo('Public module - skipping permission check', { moduleName })
        return { allowed: true, reason: 'Public module' }
      }

      // Try memory cache first
      const memCached = this.memoryCache.get(userId)
      if (memCached && memCached.expiresAt > Date.now()) {
        const allowed = memCached.permissions[moduleName]?.[action] || false
        logInfo('Permission from memory cache', { userId, moduleName, action, allowed })
        return { allowed, cached: true }
      }

      // Try database cache
      const cached = await this.getFromCache(userId)
      if (cached && Object.keys(cached).length > 0) {
        const allowed = cached[moduleName]?.[action] || false
        // Update memory cache
        this.memoryCache.set(userId, {
          permissions: cached,
          expiresAt: Date.now() + this.MEMORY_CACHE_TTL,
        })
        logInfo('Permission from database cache', { userId, moduleName, action, allowed })
        return { allowed, cached: true }
      }
      
      logInfo('Cache miss - checking database', { userId, moduleName, action })

      // Query database
      logInfo('Calling RPC user_has_permission', { userId, moduleName, action })
      const { data, error } = await supabase.rpc('user_has_permission', {
        p_user_id: userId,
        p_module_name: moduleName,
        p_action: action,
      })

      if (error) {
        logError('RPC user_has_permission failed', { userId, moduleName, action, error: error.message, errorDetails: error })
        throw error
      }

      logInfo('Permission check result', { userId, moduleName, action, data, dataType: typeof data })
      const allowed = data === true

      // Update both caches
      await this.updateCache(userId)

      return { allowed, cached: false }
    } catch (error: any) {
      logError('Permission check failed', {
        userId,
        moduleName,
        action,
        error: error.message,
      })
      return { allowed: false, reason: 'Permission check error' }
    }
  }

  /**
   * Batch check multiple permissions for a user
   */
  static async hasPermissions(
    userId: string,
    checks: Array<{ module: string; action: PermissionAction }>
  ): Promise<Record<string, boolean>> {
    const results: Record<string, boolean> = {}

    for (const check of checks) {
      const key = `${check.module}:${check.action}`
      const result = await this.hasPermission(userId, check.module, check.action)
      results[key] = result.allowed
    }

    return results
  }

  /**
   * Get all permissions for a user (flattened)
   * Uses cache to avoid repeated database queries
   */
  static async getUserPermissions(userId: string): Promise<PermissionMatrix> {
    try {
      // Check cache first
      const cached = this.userPermissionsCache.get(userId)
      if (cached && cached.expiresAt > Date.now()) {
        return cached.permissions
      }

      // Get user's role
      const { data: profile, error: profileError } = await supabase
        .from('perm_user_profiles')
        .select('role_id')
        .eq('user_id', userId)
        .single()

      if (profileError || !profile) throw profileError || new Error('User profile not found')

      // Get role permissions
      const { data: permissions, error: permError } = await supabase
        .from('perm_role_permissions')
        .select(`
          can_view,
          can_insert,
          can_update,
          can_delete,
          can_approve,
          can_release,
          perm_modules!inner (name)
        `)
        .eq('role_id', profile.role_id)

      if (permError) throw permError

      const matrix: PermissionMatrix = {}

      for (const perm of permissions || []) {
        const moduleName = (perm as any).perm_modules.name
        matrix[moduleName] = {
          view: perm.can_view,
          insert: perm.can_insert,
          update: perm.can_update,
          delete: perm.can_delete,
          approve: perm.can_approve,
          release: perm.can_release,
        }
      }

      // Cache result
      this.userPermissionsCache.set(userId, {
        permissions: matrix,
        expiresAt: Date.now() + this.USER_PERMISSIONS_CACHE_TTL,
      })

      return matrix
    } catch (error: any) {
      logError('Failed to get user permissions', { userId, error: error.message })
      return {}
    }
  }

  // =====================================================
  // ROLE MANAGEMENT
  // =====================================================

  /**
   * Get all roles with their permissions
   */
  static async getAllRoles(): Promise<Role[]> {
    const { data, error } = await supabase
      .from('perm_roles')
      .select('*')
      .order('name')

    if (error) {
      logError('Failed to fetch roles', { error: error.message })
      return []
    }

    return (data as Role[]) || []
  }

  /**
   * Get role with all its permissions
   */
  static async getRoleWithPermissions(roleId: string) {
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
      .eq('id', roleId)
      .single()

    if (error) {
      logError('Failed to fetch role permissions', { roleId, error: error.message })
      return null
    }

    return data
  }

  /**
   * Update role permissions for a specific module
   */
  static async updateRolePermissions(
    roleId: string,
    moduleId: string,
    permissions: UpdateRolePermissionsDto,
    changedBy?: string
  ): Promise<RolePermission | null> {
    try {
      // Get old value for audit
      const { data: oldPerm } = await supabase
        .from('perm_role_permissions')
        .select('*')
        .eq('role_id', roleId)
        .eq('module_id', moduleId)
        .single()

      // Update permissions
      const { data: updated, error } = await supabase
        .from('perm_role_permissions')
        .update(permissions)
        .eq('role_id', roleId)
        .eq('module_id', moduleId)
        .select()
        .single()

      if (error) throw error

      // Log audit trail
      if (changedBy) {
        await this.logAudit({
          action: 'UPDATE',
          entity_type: 'permission',
          entity_id: roleId,
          changed_by: changedBy,
          old_value: oldPerm,
          new_value: permissions,
        })
      }

      // Invalidate cache for all users with this role
      await this.invalidateRoleCache(roleId)

      logInfo('Role permissions updated', { roleId, moduleId })
      return updated as RolePermission
    } catch (error: any) {
      logError('Failed to update role permissions', {
        roleId,
        moduleId,
        error: error.message,
      })
      return null
    }
  }

  /**
   * Bulk update permissions for a role
   * Invalidates cache once at the end for efficiency
   */
  static async bulkUpdateRolePermissions(
    roleId: string,
    updates: Array<{ moduleId: string; permissions: UpdateRolePermissionsDto }>,
    changedBy?: string
  ): Promise<boolean> {
    try {
      for (const update of updates) {
        const { data: oldPerm } = await supabase
          .from('perm_role_permissions')
          .select('*')
          .eq('role_id', roleId)
          .eq('module_id', update.moduleId)
          .single()

        const { error } = await supabase
          .from('perm_role_permissions')
          .update(update.permissions)
          .eq('role_id', roleId)
          .eq('module_id', update.moduleId)

        if (error) throw error

        if (changedBy) {
          await this.logAudit({
            action: 'UPDATE',
            entity_type: 'permission',
            entity_id: roleId,
            changed_by: changedBy,
            old_value: oldPerm,
            new_value: update.permissions,
          })
        }
      }

      await this.invalidateRoleCache(roleId)
      logInfo('Bulk role permissions updated', { roleId, count: updates.length, changedBy })
      return true
    } catch (error: any) {
      logError('Bulk update failed', { roleId, error: error.message })
      return false
    }
  }

  // =====================================================
  // CACHE MANAGEMENT
  // =====================================================

  /**
   * Get permissions from cache
   */
  private static async getFromCache(userId: string): Promise<PermissionMatrix | null> {
    try {
      const { data, error } = await supabase
        .from('perm_cache')
        .select('*')
        .eq('user_id', userId)
        .gt('expires_at', new Date().toISOString())
        .single()

      if (error || !data) return null

      const permissions = data.permissions as PermissionMatrix
      // Return null if cache is empty
      if (!permissions || Object.keys(permissions).length === 0) return null
      
      return permissions
    } catch {
      return null
    }
  }

  /**
   * Update permission cache for user
   */
  private static async updateCache(userId: string): Promise<void> {
    try {
      const permissions = await this.getUserPermissions(userId)
      const expiresAt = new Date(Date.now() + PERMISSION_CACHE_TTL).toISOString()

      await supabase.from('perm_cache').upsert({
        user_id: userId,
        permissions,
        expires_at: expiresAt,
      })
    } catch (error: any) {
      logWarn('Cache update failed', { userId, error: error.message })
    }
  }

  /**
   * Invalidate cache for all users with specific role
   * Public method for external use
   */
  static async invalidateRoleCache(roleId: string): Promise<void> {
    try {
      const { data: users } = await supabase
        .from('perm_user_profiles')
        .select('user_id')
        .eq('role_id', roleId)

      if (users && users.length > 0) {
        const userIds = users.map((u) => u.user_id)
        await supabase.from('perm_cache').delete().in('user_id', userIds)
        // Also clear memory caches
        userIds.forEach((id) => {
          this.memoryCache.delete(id)
          this.userPermissionsCache.delete(id)
        })
        logInfo('Role cache invalidated', { roleId, userCount: users.length })
      }
    } catch (error: any) {
      logWarn('Cache invalidation failed', { roleId, error: error.message })
    }
  }

  /**
   * Invalidate all permission cache
   */
  static async invalidateAllCache(): Promise<void> {
    try {
      await supabase.from('perm_cache').delete().neq('user_id', '00000000-0000-0000-0000-000000000000')
      // Also clear memory caches
      this.memoryCache.clear()
      this.userPermissionsCache.clear()
      logInfo('All permission cache invalidated')
    } catch (error: any) {
      logWarn('Cache invalidation failed', { error: error.message })
    }
  }

  // =====================================================
  // AUDIT LOGGING
  // =====================================================

  /**
   * Log permission change to audit trail
   */
  private static async logAudit(audit: {
    action: 'CREATE' | 'UPDATE' | 'DELETE'
    entity_type: 'role' | 'module' | 'permission'
    entity_id: string
    changed_by: string
    old_value?: any
    new_value?: any
    ip_address?: string
    user_agent?: string
  }): Promise<void> {
    try {
      await supabase.from('perm_audit_log').insert(audit)
    } catch (error: any) {
      logError('Audit logging failed', { error: error.message })
    }
  }

  /**
   * Get audit logs for entity
   */
  static async getAuditLogs(entityType: string, entityId: string, limit = 50) {
    const { data, error } = await supabase
      .from('perm_audit_log')
      .select('*')
      .eq('entity_type', entityType)
      .eq('entity_id', entityId)
      .order('created_at', { ascending: false })
      .limit(limit)

    if (error) {
      logError('Failed to fetch audit logs', { error: error.message })
      return []
    }

    return data || []
  }
}
