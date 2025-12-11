// =====================================================
// PERMISSION CONSTANTS & HELPERS
// =====================================================

import type { PermissionAction } from '../types/permission.types'

// Permission action constants
export const PERMISSIONS = {
  VIEW: 'view' as PermissionAction,
  INSERT: 'insert' as PermissionAction,
  UPDATE: 'update' as PermissionAction,
  DELETE: 'delete' as PermissionAction,
  APPROVE: 'approve' as PermissionAction,
  RELEASE: 'release' as PermissionAction,
} as const

// Public modules that don't require permission checking
export const PUBLIC_MODULES = ['auth'] as const

// Permission cache TTL (5 minutes)
export const PERMISSION_CACHE_TTL = 5 * 60 * 1000

// Helper: Check if module is public
export function isPublicModule(moduleName: string): boolean {
  return PUBLIC_MODULES.includes(moduleName as any)
}

// Helper: Check if role is system role (from database)
export async function isSystemRole(roleId: string): Promise<boolean> {
  const { supabase } = await import('../config/supabase')
  const { data } = await supabase.from('perm_roles').select('is_system_role').eq('id', roleId).single()
  return data?.is_system_role || false
}

// Helper: Get permission column name from action
export function getPermissionColumn(action: PermissionAction): string {
  return `can_${action}`
}

// Helper: Validate permission action
export function isValidPermissionAction(action: string): action is PermissionAction {
  return Object.values(PERMISSIONS).includes(action as PermissionAction)
}

// Helper: Get all permission actions
export function getAllPermissionActions(): PermissionAction[] {
  return Object.values(PERMISSIONS)
}

// Helper: Create default permission object (all false for new roles)
export function createDefaultPermissions() {
  return {
    can_view: false,
    can_insert: false,
    can_update: false,
    can_delete: false,
    can_approve: false,
    can_release: false,
  }
}
