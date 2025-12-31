import api from '@/lib/axios'
import type { BranchContext, BranchesResponse, PermissionsResponse } from '@/features/branch_context/types'

const ENDPOINTS = {
  USER_BRANCHES: '/employee-branches/me',
  PERMISSIONS: '/permissions/me/permissions',
} as const

export const branchApi = {
  getUserBranches: async (signal?: AbortSignal): Promise<BranchContext[]> => {
    try {
      const res = await api.get<BranchesResponse>(ENDPOINTS.USER_BRANCHES, { signal })
      return res.data.data
    } catch (error: any) {
      if (error.name === 'AbortError') throw error
      if (error.response?.data?.message) {
        const customError = new Error(error.response.data.message) as any
        customError.cause = error
        customError.statusCode = error.response.status
        throw customError
      }
      throw error
    }
  },

  getPermissions: async (roleId?: string, signal?: AbortSignal): Promise<PermissionsResponse['data']> => {
    try {
      const res = await api.get<PermissionsResponse>(ENDPOINTS.PERMISSIONS, {
        params: roleId ? { roleId } : undefined,
        signal,
      })
      return res.data.data
    } catch (error: any) {
      if (error.name === 'AbortError') throw error
      if (error.response?.data?.message) {
        const customError = new Error(error.response.data.message) as any
        customError.cause = error
        customError.statusCode = error.response.status
        throw customError
      }
      throw error
    }
  },
}
