import { Response } from 'express'
import { branchesService } from './branches.service'
import { CreateBranchSchema, UpdateBranchSchema, BulkUpdateStatusSchema } from './branches.schema'
import { sendSuccess } from '../../utils/response.util'
import { handleError } from '../../utils/error-handler.util'
import { getPaginationParams } from '../../utils/pagination.util'
import { ValidatedAuthRequest } from '../../middleware/validation.middleware'
import type { AuthenticatedQueryRequest, AuthenticatedRequest } from '../../types/request.types'

export class BranchesController {
  list = async (req: AuthenticatedQueryRequest, res: Response): Promise<void> => {
    try {
      const { page, limit, offset } = getPaginationParams(req.query)
      const result = await branchesService.list({ page, limit, offset }, req.sort, req.queryFilter)
      sendSuccess(res, result.data, 'Branches retrieved', 200, result.pagination)
    } catch (error: unknown) {
      handleError(res, error)
    }
  }

  create = async (req: ValidatedAuthRequest<typeof CreateBranchSchema>, res: Response): Promise<void> => {
    try {
      const branch = await branchesService.create(req.validated.body, req.user!.id)
      sendSuccess(res, branch, 'Branch created', 201)
    } catch (error: any) {
      handleError(res, error)
    }
  }

  update = async (req: ValidatedAuthRequest<typeof UpdateBranchSchema>, res: Response): Promise<void> => {
    try {
      const { body, params } = req.validated
      const branch = await branchesService.update(params.id, body, req.user!.id)
      sendSuccess(res, branch, 'Branch updated')
    } catch (error: any) {
      handleError(res, error)
    }
  }

  getById = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    try {
      const branch = await branchesService.getById(req.params.id)
      sendSuccess(res, branch, 'Branch retrieved')
    } catch (error: any) {
      handleError(res, error)
    }
  }

  delete = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    try {
      await branchesService.delete(req.params.id, req.user.id)
      sendSuccess(res, null, 'Branch deleted')
    } catch (error: any) {
      handleError(res, error)
    }
  }
  
  search = async (req: AuthenticatedQueryRequest, res: Response): Promise<void> => {
    try {
      const { page, limit, offset } = getPaginationParams(req.query)
      const q = String(req.query.q || '')
      const result = await branchesService.search(q, { page, limit, offset }, req.sort, req.queryFilter)
      sendSuccess(res, result.data, 'Search completed', 200, result.pagination)
    } catch (error) {
      handleError(res, error)
    }
  }

  getFilterOptions = async (_req: AuthenticatedRequest, res: Response): Promise<void> => {
    try {
      const options = await branchesService.getFilterOptions()
      sendSuccess(res, options, 'Filter options retrieved')
    } catch (error) {
      handleError(res, error)
    }
  }

  minimalActive = async (_req: AuthenticatedRequest, res: Response): Promise<void> => {
    try {
      const branches = await branchesService.minimalActive()
      sendSuccess(res, branches, 'Branches retrieved')
    } catch (error) {
      handleError(res, error)
    }
  }

  bulkUpdateStatus = async (req: ValidatedAuthRequest<typeof BulkUpdateStatusSchema>, res: Response): Promise<void> => {
    try {
      const { ids, status } = req.validated.body
      await branchesService.bulkUpdateStatus(ids, status, req.user!.id)
      sendSuccess(res, null, 'Status updated')
    } catch (error: any) {
      handleError(res, error)
    }
  }
}

export const branchesController = new BranchesController()
