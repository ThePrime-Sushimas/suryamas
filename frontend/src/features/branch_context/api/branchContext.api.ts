import api from '@/lib/axios'
import type { BranchContext, BranchesResponse, PermissionsResponse } from '@/features/branch_context/types'

export const branchApi = {
  getUserBranches: async (): Promise<BranchContext[]> => {
    try {
      const res = await api.get<BranchesResponse>('/employee-branches/me')
      return res.data.data
    } catch (error: any) {
      throw new Error(error.response?.data?.message || 'Failed to load branches')
    }
  },

  getPermissions: async (roleId?: string): Promise<PermissionsResponse['data']> => {
    try {
      const url = roleId ? `/permissions/me/permissions?roleId=${roleId}` : '/permissions/me/permissions'
      const res = await api.get<PermissionsResponse>(url)
      return res.data.data
    } catch (error: any) {
      throw new Error(error.response?.data?.message || 'Failed to load permissions')
    }
  },
}
