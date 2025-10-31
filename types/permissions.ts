export interface Permission {
  id: number;
  permission_code: string;
  permission_name: string;
  module: string;
  table_name?: string;
  description?: string;
  created_at: string;
  updated_at: string;
  is_assigned?: boolean; // For role assignment view
}

export interface RolePermission {
  id: number;
  role_id: number;
  permission_id: number;
  created_at: string;
}

export interface UserPermissionOverride {
  id: number;
  user_id: number;
  permission_id: number;
  is_granted: boolean;
  created_at: string;
  updated_at: string;
}

export interface PermissionFormData {
  permission_code: string;
  permission_name: string;
  module: string;
  table_name?: string;
  description?: string;
}

export interface PermissionsResponse {
  permissions: Permission[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
  modules: string[];
}

export interface RolePermissionsResponse {
  role: {
    id: number;
    role_name: string;
  };
  permissions: Permission[];
  modules: string[];
}
