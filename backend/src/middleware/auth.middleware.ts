import { Response, NextFunction } from 'express'
import { supabase } from '../config/supabase'
import { AuthRequest } from '../types/common.types'
import { sendError } from '../utils/response.util'
import { logWarn } from '../config/logger'

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

  const { data: employee } = await supabase
    .from('employees')
    .select('resign_date')
    .eq('user_id', user.id)
    .maybeSingle()

  const isResigned = employee?.resign_date && new Date(employee.resign_date) < new Date()
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
  next()
}