import type { Request, Response } from 'express'
import { branchesService } from './branches.service'
import type { CreateBranchSchema, UpdateBranchSchema, BulkUpdateStatusSchema } from './branches.schema'
import { sendSuccess } from '../../utils/response.util'
import { handleError } from '../../utils/error-handler.util'
import { getPaginationParams } from '../../utils/pagination.util'
import { getParamString } from '../../utils/validation.util'
import type { ValidatedAuthRequest } from '../../middleware/validation.middleware'
import type { AuthenticatedQueryRequest, AuthenticatedRequest } from '../../types/request.types'

export class BranchesController {
  list = async (req: AuthenticatedQueryRequest, res: Response): Promise<void> => {
    try {
      const { page, limit, offset } = getPaginationParams(req.query)
      const result = await branchesService.list({ page, limit, offset }, req.sort, req.queryFilter)
      sendSuccess(res, result.data, 'Branches retrieved', 200, result.pagination)
    } catch (error: unknown) {
      await handleError(res, error, req, { method: 'list' })
    }
  }

  create = async (req: ValidatedAuthRequest<typeof CreateBranchSchema>, res: Response): Promise<void> => {
    try {
      const branch = await branchesService.create(req.validated.body, req.user!.id)
      sendSuccess(res, branch, 'Branch created', 201)
    } catch (error: unknown) {
      await handleError(res, error, req, { method: 'create' })
    }
  }

  update = async (req: ValidatedAuthRequest<typeof UpdateBranchSchema>, res: Response): Promise<void> => {
    try {
      const { body, params } = req.validated
      const branch = await branchesService.update(params.id, body, req.user!.id)
      sendSuccess(res, branch, 'Branch updated')
    } catch (error: unknown) {
      await handleError(res, error, req, { method: 'update', id: req.validated.params.id })
    }
  }

  getById = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    try {
      const id = getParamString(req.params.id)
      const branch = await branchesService.getById(id)
      sendSuccess(res, branch, 'Branch retrieved')
    } catch (error: unknown) {
      await handleError(res, error, req, { method: 'getById', id: req.params.id })
    }
  }

  delete = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    try {
      const id = getParamString(req.params.id)
      await branchesService.delete(id, req.user.id)
      sendSuccess(res, null, 'Branch deleted')
    } catch (error: unknown) {
      await handleError(res, error, req, { method: 'delete', id: req.params.id })
    }
  }

  search = async (req: AuthenticatedQueryRequest, res: Response): Promise<void> => {
    try {
      const { page, limit, offset } = getPaginationParams(req.query)
      const q = String(req.query.q || '')
      const result = await branchesService.search(q, { page, limit, offset }, req.sort, req.queryFilter)
      sendSuccess(res, result.data, 'Search completed', 200, result.pagination)
    } catch (error: unknown) {
      await handleError(res, error, req, { method: 'search', q: req.query.q })
    }
  }

  getFilterOptions = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    try {
      const options = await branchesService.getFilterOptions()
      sendSuccess(res, options, 'Filter options retrieved')
    } catch (error: unknown) {
      await handleError(res, error, req, { method: 'getFilterOptions' })
    }
  }

  minimalActive = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    try {
      const branches = await branchesService.minimalActive()
      sendSuccess(res, branches, 'Branches retrieved')
    } catch (error: unknown) {
      await handleError(res, error, req, { method: 'minimalActive' })
    }
  }

  bulkUpdateStatus = async (req: ValidatedAuthRequest<typeof BulkUpdateStatusSchema>, res: Response): Promise<void> => {
    try {
      const { ids, status } = req.validated.body
      await branchesService.bulkUpdateStatus(ids, status, req.user!.id)
      sendSuccess(res, null, 'Status updated')
    } catch (error: unknown) {
      await handleError(res, error, req, { method: 'bulkUpdateStatus' })
    }
  }
}

export const branchesController = new BranchesController()
