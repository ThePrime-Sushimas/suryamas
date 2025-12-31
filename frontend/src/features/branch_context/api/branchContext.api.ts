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
    } catch (error: unknown) {
      if (error instanceof Error && error.name === 'AbortError') throw error
      if (error && typeof error === 'object' && 'response' in error && error.response && typeof error.response === 'object' && 'data' in error.response && error.response.data && typeof error.response.data === 'object' && 'message' in error.response.data) {
        const customError = new Error(String(error.response.data.message)) as Error & { cause?: unknown; statusCode?: number }
        customError.cause = error
        if ('status' in error.response) customError.statusCode = Number(error.response.status)
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
    } catch (error: unknown) {
      if (error instanceof Error && error.name === 'AbortError') throw error
      if (error && typeof error === 'object' && 'response' in error && error.response && typeof error.response === 'object' && 'data' in error.response && error.response.data && typeof error.response.data === 'object' && 'message' in error.response.data) {
        const customError = new Error(String(error.response.data.message)) as Error & { cause?: unknown; statusCode?: number }
        customError.cause = error
        if ('status' in error.response) customError.statusCode = Number(error.response.status)
        throw customError
      }
      throw error
    }
  },
}
