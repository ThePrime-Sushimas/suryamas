export interface BranchContext {
  branch_id: string
  branch_name: string
  company_id: string
  role_id: string
  role_name: string
  approval_limit: number
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
