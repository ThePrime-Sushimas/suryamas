import { Response, NextFunction } from 'express'
import { AuthRequest } from '../types/common.types'
import { sendError } from '../utils/response.util'
import { employeeBranchesService } from '../modules/employee_branches/employee_branches.service'

export const requireBranchAccess = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  const branchId = req.params.branchId || req.body.branch_id || req.query.branch_id
  
  if (!branchId) {
    next()
    return
  }

  const hasAccess = await employeeBranchesService.hasActiveBranchAccess(req.user.id, branchId)
  
  if (!hasAccess) {
    sendError(res, 'Access denied: Branch access suspended or not assigned', 403)
    return
  }

  next()
}