import { Response } from 'express'
import { AuthRequest } from '../../types/common.types'
import { branchesService } from './branches.service'
import { CreateBranchSchema, UpdateBranchSchema } from './branches.schema'
import { sendSuccess, sendError } from '../../utils/response.util'
import { logError } from '../../config/logger'
import { getPaginationParams } from '../../utils/pagination.util'
import { BranchError } from './branches.errors'

export class BranchesController {
  list = async (req: AuthRequest, res: Response): Promise<void> => {
    try {
      const { page, limit, offset } = getPaginationParams(req.query)
      const result = await branchesService.list({ page, limit, offset })
      sendSuccess(res, result.data, 'Branches retrieved', 200, result.pagination)
    } catch (error: any) {
      this.handleError(res, error)
    }
  }

  create = async (req: AuthRequest, res: Response): Promise<void> => {
    try {
      const dto = CreateBranchSchema.parse(req.body)
      const branch = await branchesService.create(dto, req.user?.id)
      sendSuccess(res, branch, 'Branch created', 201)
    } catch (error: any) {
      this.handleError(res, error)
    }
  }

  update = async (req: AuthRequest, res: Response): Promise<void> => {
    try {
      const dto = UpdateBranchSchema.parse(req.body)
      const branch = await branchesService.update(req.params.id, dto, req.user?.id)
      sendSuccess(res, branch, 'Branch updated')
    } catch (error: any) {
      this.handleError(res, error)
    }
  }

  getById = async (req: AuthRequest, res: Response): Promise<void> => {
    try {
      const branch = await branchesService.getById(req.params.id)
      sendSuccess(res, branch, 'Branch retrieved')
    } catch (error: any) {
      this.handleError(res, error)
    }
  }

  delete = async (req: AuthRequest, res: Response): Promise<void> => {
    try {
      await branchesService.delete(req.params.id, req.user?.id)
      sendSuccess(res, null, 'Branch deleted')
    } catch (error: any) {
      this.handleError(res, error)
    }
  }
  
  search = async (req: AuthRequest, res: Response): Promise<void> => {
    try {
      const { page, limit, offset } = getPaginationParams(req.query)
      const q = String(req.query.q || '')
      const result = await branchesService.search(q, { page, limit, offset })
      sendSuccess(res, result.data, 'Search completed', 200, result.pagination)
    } catch (error) {
      this.handleError(res, error)
    }
  }

  getFilterOptions = async (_req: AuthRequest, res: Response): Promise<void> => {
    try {
      const options = await branchesService.getFilterOptions()
      sendSuccess(res, options, 'Filter options retrieved')
    } catch (error) {
      this.handleError(res, error)
    }
  }

  minimalActive = async (_req: AuthRequest, res: Response): Promise<void> => {
    try {
      const branches = await branchesService.minimalActive()
      sendSuccess(res, branches, 'Branches retrieved')
    } catch (error) {
      this.handleError(res, error)
    }
  }

  bulkUpdateStatus = async (req: AuthRequest, res: Response): Promise<void> => {
    try {
      const { ids, status } = req.body
      await branchesService.bulkUpdateStatus(ids, status, req.user?.id)
      sendSuccess(res, null, 'Status updated')
    } catch (error: any) {
      this.handleError(res, error)
    }
  }

  private handleError(res: Response, error: any): void {
    if (error instanceof BranchError) {
      logError(error.code, { message: error.message })
      sendError(res, error.message, error.statusCode)
    } else if (error.name === 'ZodError') {
      sendError(res, error.errors[0].message, 400)
    } else {
      logError('Unexpected error', { error: error.message })
      sendError(res, 'Internal server error', 500)
    }
  }
}

export const branchesController = new BranchesController()
