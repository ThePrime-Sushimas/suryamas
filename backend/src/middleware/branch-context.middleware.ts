import { Response, NextFunction } from 'express'
import { AuthRequest, BranchContext } from '../types/common.types'
import { supabase } from '../config/supabase'
import { sendError } from '../utils/response.util'
import { logWarn } from '../config/logger'

const branchContextCache = new Map<string, { context: BranchContext; expiresAt: number }>()
const CACHE_TTL = 5 * 60 * 1000 // 5 minutes

export const resolveBranchContext = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    if (!req.user?.id) {
      sendError(res, 'Authentication required', 401)
      return
    }

    const branchId = req.headers['x-branch-id'] as string

    if (!branchId) {
      // Use primary branch
      const { data: primary, error } = await supabase
        .from('employee_branches')
        .select(`
          *,
          branches!inner(id, branch_name, company_id),
          employees!inner(id, user_id)
        `)
        .eq('employees.user_id', req.user.id)
        .eq('is_primary', true)
        .eq('status', 'active')
        .single()

      if (error || !primary) {
        logWarn('No active primary branch', { user_id: req.user.id })
        sendError(res, 'No active branch assignment', 403)
        return
      }

      req.context = {
        company_id: (primary as any).branches.company_id,
        branch_id: primary.branch_id,
        branch_name: (primary as any).branches.branch_name,
        employee_id: primary.employee_id,
        role_id: primary.role_id,
        approval_limit: primary.approval_limit,
      }
    } else {
      // Validate user has access to specified branch
      const cacheKey = `${req.user.id}:${branchId}`
      const cached = branchContextCache.get(cacheKey)

      if (cached && cached.expiresAt > Date.now()) {
        req.context = cached.context
      } else {
        const { data: assignment, error } = await supabase
          .from('employee_branches')
          .select(`
            *,
            branches!inner(id, branch_name, company_id),
            employees!inner(id, user_id)
          `)
          .eq('employees.user_id', req.user.id)
          .eq('branch_id', branchId)
          .eq('status', 'active')
          .single()

        if (error || !assignment) {
          logWarn('Branch access denied', {
            user_id: req.user.id,
            branch_id: branchId,
          })
          sendError(res, 'No access to this branch', 403)
          return
        }

        req.context = {
          company_id: (assignment as any).branches.company_id,
          branch_id: assignment.branch_id,
          branch_name: (assignment as any).branches.branch_name,
          employee_id: assignment.employee_id,
          role_id: assignment.role_id,
          approval_limit: assignment.approval_limit,
        }

        branchContextCache.set(cacheKey, {
          context: req.context,
          expiresAt: Date.now() + CACHE_TTL,
        })
      }
    }

    next()
  } catch (error: any) {
    logWarn('Branch context resolution failed', {
      user_id: req.user?.id,
      error: error.message,
    })
    sendError(res, 'Failed to resolve branch context', 500)
  }
}

export const invalidateBranchContextCache = (userId: string, branchId?: string): void => {
  if (branchId) {
    branchContextCache.delete(`${userId}:${branchId}`)
  } else {
    for (const key of branchContextCache.keys()) {
      if (key.startsWith(`${userId}:`)) {
        branchContextCache.delete(key)
      }
    }
  }
}
