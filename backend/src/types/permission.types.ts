// =====================================================
// PERMISSION TYPES
// =====================================================

export type PermissionAction = 'view' | 'insert' | 'update' | 'delete' | 'approve' | 'release'

export interface Module {
  id: string
  name: string
  description: string | null
  is_active: boolean
  created_at: string
  updated_at: string
}

export interface Role {
  id: string
  name: string
  description: string | null
  is_system_role: boolean
  parent_role_id: string | null
  created_at: string
  updated_at: string
}

export interface RolePermission {
  id: string
  role_id: string
  module_id: string
  can_view: boolean
  can_insert: boolean
  can_update: boolean
  can_delete: boolean
  can_approve: boolean
  can_release: boolean
  created_at: string
  updated_at: string
}

export interface PermissionAuditLog {
  id: string
  action: 'CREATE' | 'UPDATE' | 'DELETE'
  entity_type: 'role' | 'module' | 'permission'
  entity_id: string
  changed_by: string | null
  old_value: any
  new_value: any
  ip_address: string | null
  user_agent: string | null
  created_at: string
}

export interface PermissionCache {
  user_id: string
  permissions: PermissionMatrix
  expires_at: string
  created_at: string
}

// Flattened permission structure for caching
export interface PermissionMatrix {
  [moduleName: string]: {
    view: boolean
    insert: boolean
    update: boolean
    delete: boolean
    approve: boolean
    release: boolean
  }
}

// DTOs for API requests/responses
export interface CreateModuleDto {
  name: string
  description?: string
  is_active?: boolean
}

export interface CreateRoleDto {
  name: string
  description?: string
  parent_role_id?: string
}

export interface UpdateRolePermissionsDto {
  module_id: string
  can_view?: boolean
  can_insert?: boolean
  can_update?: boolean
  can_delete?: boolean
  can_approve?: boolean
  can_release?: boolean
}

export interface RoleWithPermissions extends Role {
  permissions: Array<RolePermission & { module: Module }>
}

export interface ModuleWithPermissions extends Module {
  permissions: Array<RolePermission & { role: Role }>
}

// Permission check result
export interface PermissionCheckResult {
  allowed: boolean
  reason?: string
  cached?: boolean
}
