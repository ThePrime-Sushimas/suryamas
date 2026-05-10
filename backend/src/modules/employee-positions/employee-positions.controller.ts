import type { Request, Response } from 'express'
import { employeePositionsService } from './employee-positions.service'
import { sendSuccess } from '../../utils/response.util'
import { handleError } from '../../utils/error-handler.util'
import type { ValidatedAuthRequest } from '../../middleware/validation.middleware'
import type { assignPositionSchema, removePositionSchema, setPrimarySchema, listEmployeePositionsSchema } from './employee-positions.schema'

type AssignReq = ValidatedAuthRequest<typeof assignPositionSchema>
type RemoveReq = ValidatedAuthRequest<typeof removePositionSchema>
type SetPrimaryReq = ValidatedAuthRequest<typeof setPrimarySchema>
type ListReq = ValidatedAuthRequest<typeof listEmployeePositionsSchema>

class EmployeePositionsController {

  list = async (req: Request, res: Response) => {
    try {
      const { employeeId } = (req as ListReq).validated.params
      const data = await employeePositionsService.listByEmployee(employeeId)
      sendSuccess(res, data, 'Employee positions retrieved')
    } catch (error: unknown) {
      await handleError(res, error, req, { action: 'list_employee_positions', id: req.params.employeeId })
    }
  }

  assign = async (req: Request, res: Response) => {
    try {
      const { params, body } = (req as AssignReq).validated
      const userId = req.user?.id ?? ''
      await employeePositionsService.assign(params.employeeId, body.position_id, body.is_primary, userId)
      sendSuccess(res, null, 'Position assigned', 201)
    } catch (error: unknown) {
      await handleError(res, error, req, { action: 'assign_employee_position', id: req.params.employeeId })
    }
  }

  remove = async (req: Request, res: Response) => {
    try {
      const { employeeId, positionId } = (req as RemoveReq).validated.params
      const userId = req.user?.id ?? ''
      await employeePositionsService.remove(employeeId, positionId, userId)
      sendSuccess(res, null, 'Position removed')
    } catch (error: unknown) {
      await handleError(res, error, req, { action: 'remove_employee_position', id: req.params.employeeId })
    }
  }

  setPrimary = async (req: Request, res: Response) => {
    try {
      const { employeeId, positionId } = (req as SetPrimaryReq).validated.params
      const userId = req.user?.id ?? ''
      await employeePositionsService.setPrimary(employeeId, positionId, userId)
      sendSuccess(res, null, 'Primary position updated')
    } catch (error: unknown) {
      await handleError(res, error, req, { action: 'set_primary_position', id: req.params.employeeId })
    }
  }
}

export const employeePositionsController = new EmployeePositionsController()
