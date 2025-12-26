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
  created_at: string
  updated_at: string
}

export interface Permission {
  id: string
  role_id: string
  module_id: string
  can_view: boolean
  can_insert: boolean
  can_update: boolean
  can_delete: boolean
  can_approve: boolean
  can_release: boolean
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
  modules?: Module
}

export interface RoleWithPermissions extends Role {
  role_permissions: RolePermission[]
  perm_role_permissions?: RolePermission[]
}
