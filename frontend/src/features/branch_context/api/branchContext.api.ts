import api from '@/lib/axios'
import type { BranchContext } from '@/features/branch_context/store/branchContext.store'

interface BranchesResponse {
  success: boolean
  data: BranchContext[]
}

interface PermissionsResponse {
  success: boolean
  data: Record<string, {
    view: boolean
    insert: boolean
    update: boolean
    delete: boolean
    approve: boolean
    release: boolean
  }>
}

export const branchApi = {
  getUserBranches: async (): Promise<BranchContext[]> => {
    const res = await api.get<BranchesResponse>('/employee-branches/me')
    return res.data.data
  },

  getPermissions: async (): Promise<PermissionsResponse['data']> => {
    const res = await api.get<PermissionsResponse>('/permissions/me/permissions')
    return res.data.data
  },
}
