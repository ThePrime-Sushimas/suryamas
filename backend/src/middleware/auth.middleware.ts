import { Response, NextFunction } from 'express'
import { AuthRequest } from '../types/common.types'
import { sendError } from '../utils/response.util'
import { logWarn } from '../config/logger'
import { authService } from '../modules/auth/auth.service'
import { employeesRepository } from '../modules/employees/employees.repository'
import { AuthenticatedRequest } from '../types/request.types'

export const authenticate = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  const token = req.headers.authorization?.replace('Bearer ', '')

  if (!token) {
    logWarn('Authentication failed: No token', { path: req.path, ip: req.ip })
    sendError(res, 'No token provided', 401)
    return
  }

  const user = await authService.verifyToken(token)

  if (!user) {
    logWarn('Authentication failed: Invalid token', { path: req.path, ip: req.ip })
    sendError(res, 'Invalid or expired token', 401)
    return
  }

  // Fetch employee data once — used for both resignation check and request attachment
  let employee = null
  try {
    employee = await employeesRepository.findByUserId(user.id)
  } catch (error) {
    logWarn('Failed to load employee data', {
      user_id: user.id,
      error: error instanceof Error ? error.message : 'Unknown error'
    })
  }

  // Check resigned status from fresh data — no cache, immediate effect on resign
  const isResigned = !!(employee?.resign_date && new Date(employee.resign_date) < new Date())

  if (isResigned) {
    logWarn('Authentication failed: Employee has resigned', { path: req.path, user_id: user.id, ip: req.ip })
    sendError(res, 'Account has been deactivated', 403)
    return
  }

  req.user = user as any
  if (employee) {
    (req as AuthenticatedRequest).employee = employee
  }

  next()
}
