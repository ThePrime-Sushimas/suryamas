import type { Request, Response } from 'express'
import { positionsService } from './positions.service'
import { sendSuccess } from '../../utils/response.util'
import { handleError } from '../../utils/error-handler.util'
import type { ValidatedAuthRequest } from '../../middleware/validation.middleware'
import type { createPositionSchema, updatePositionSchema, positionIdSchema, listPositionsSchema } from './positions.schema'
import { getReadScope, getWriteScope } from '../../utils/branch-access.util'

type CreateReq = ValidatedAuthRequest<typeof createPositionSchema>
type UpdateReq = ValidatedAuthRequest<typeof updatePositionSchema>
type IdReq = ValidatedAuthRequest<typeof positionIdSchema>
type ListReq = ValidatedAuthRequest<typeof listPositionsSchema>

class PositionsController {

  list = async (req: Request, res: Response) => {
    try {
      const { companyIds } = await getReadScope(req)
      const { department_id } = (req as ListReq).validated.query
      const data = await positionsService.list(companyIds, department_id)
      sendSuccess(res, data, 'Positions retrieved')
    } catch (error: unknown) {
      await handleError(res, error, req, { action: 'list_positions' })
    }
  }

  getById = async (req: Request, res: Response) => {
    try {
      const { companyIds } = await getReadScope(req)
      const { id } = (req as IdReq).validated.params
      const data = await positionsService.getById(id, companyIds)
      sendSuccess(res, data, 'Position retrieved')
    } catch (error: unknown) {
      await handleError(res, error, req, { action: 'get_position', id: req.params.id })
    }
  }

  create = async (req: Request, res: Response) => {
    try {
      const { companyId, userId } = await getWriteScope(req)
      const { body } = (req as CreateReq).validated
      const data = await positionsService.create(companyId, { ...body, created_by: userId })
      sendSuccess(res, data, 'Position created', 201)
    } catch (error: unknown) {
      await handleError(res, error, req, { action: 'create_position' })
    }
  }

  update = async (req: Request, res: Response) => {
    try {
      const { companyIds, userId } = await getReadScope(req)
      const { params, body } = (req as UpdateReq).validated
      const existing = await positionsService.getById(params.id, companyIds)
      const data = await positionsService.update(params.id, existing.company_id, { ...body, updated_by: userId })
      sendSuccess(res, data, 'Position updated')
    } catch (error: unknown) {
      await handleError(res, error, req, { action: 'update_position', id: req.params.id })
    }
  }

  delete = async (req: Request, res: Response) => {
    try {
      const { companyIds, userId } = await getReadScope(req)
      const { id } = (req as IdReq).validated.params
      const existing = await positionsService.getById(id, companyIds)
      await positionsService.delete(id, existing.company_id, userId)
      sendSuccess(res, null, 'Position deleted')
    } catch (error: unknown) {
      await handleError(res, error, req, { action: 'delete_position', id: req.params.id })
    }
  }
}

export const positionsController = new PositionsController()
