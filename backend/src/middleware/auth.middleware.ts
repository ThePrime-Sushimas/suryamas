import { Response, NextFunction } from 'express'
import { supabase } from '../config/supabase'
import { AuthRequest } from '../types/common.types'
import { sendError } from '../utils/response.util'
import { logWarn } from '../config/logger'
import { PermissionService } from '../services/permission.service'

const resignedCache = new Map<string, { isResigned: boolean; expiresAt: number }>()
const RESIGNED_CACHE_TTL = 30 * 60 * 1000 // 30 minutes

export const authenticate = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  const token = req.headers.authorization?.replace('Bearer ', '')
  
  if (!token) {
    logWarn('Authentication failed: No token', {
      path: req.path,
      ip: req.ip
    })
    sendError(res, 'No token provided', 401)
    return
  }

  const { data: { user }, error } = await supabase.auth.getUser(token)
  
  if (error || !user) {
    logWarn('Authentication failed: Invalid token', {
      path: req.path,
      error: error?.message,
      ip: req.ip
    })
    sendError(res, 'Invalid or expired token', 401)
    return
  }

  // Check resigned status from cache first
  let isResigned = false
  const cached = resignedCache.get(user.id)
  if (cached && cached.expiresAt > Date.now()) {
    isResigned = cached.isResigned
  } else {
    // Only query if not cached
    const { data: employee } = await supabase
      .from('employees')
      .select('resign_date')
      .eq('user_id', user.id)
      .maybeSingle()

    isResigned = employee?.resign_date && new Date(employee.resign_date) < new Date()
    resignedCache.set(user.id, {
      isResigned,
      expiresAt: Date.now() + RESIGNED_CACHE_TTL,
    })
  }

  if (isResigned) {
    logWarn('Authentication failed: Employee has resigned', {
      path: req.path,
      user_id: user.id,
      ip: req.ip
    })
    sendError(res, 'Account has been deactivated', 403)
    return
  }

  req.user = user as any
  
  // Preload permissions for this request
  req.permissions = await PermissionService.getUserPermissions(user.id)
  
  next()
}
