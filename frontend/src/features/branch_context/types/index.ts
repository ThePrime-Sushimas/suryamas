export interface BranchContext {
  branch_id: string
  branch_name: string
  branch_code?: string
  company_id: string
  company_name?: string
  employee_id: string
  role_id: string
  role_name: string
  position_id?: string | null
  position_name?: string | null
  department_name?: string | null
  approval_limit: number
  status?: string
  is_primary?: boolean
  is_read_only: boolean
  branch_status: string
}

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

export type PermissionAction = 'view' | 'insert' | 'update' | 'delete' | 'approve' | 'release'

export interface BranchesResponse {
  success: boolean
  data: BranchContext[]
}

export interface PermissionsResponse {
  success: boolean
  data: PermissionMatrix
}
