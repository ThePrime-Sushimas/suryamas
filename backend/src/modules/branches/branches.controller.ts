import type { Request, Response } from 'express'
import { branchesService } from './branches.service'
import type { CreateBranchSchema, UpdateBranchSchema, BulkUpdateStatusSchema } from './branches.schema'
import { sendSuccess, sendError } from '../../utils/response.util'
import { handleError } from '../../utils/error-handler.util'
import { getPaginationParams } from '../../utils/pagination.util'
import type { ValidatedAuthRequest } from '../../middleware/validation.middleware'
import { branchIdSchema } from './branches.schema'

export class BranchesController {
  list = async (req: Request, res: Response) => {
    try {
      const { page, limit, offset } = getPaginationParams(req.query)
      const result = await branchesService.list({ page, limit, offset }, req.sort, req.queryFilter)
      sendSuccess(res, result.data, 'Branches retrieved', 200, result.pagination)
    } catch (error: unknown) {
      await handleError(res, error, req, { action: 'list_branches' })
    }
  }

  create = async (req: Request, res: Response) => {
    try {
      const { body } = (req as ValidatedAuthRequest<typeof CreateBranchSchema>).validated
      const branch = await branchesService.create(body, req.user?.id ?? '')
      sendSuccess(res, branch, 'Branch created', 201)
    } catch (error: unknown) {
      await handleError(res, error, req, { action: 'create_branch' })
    }
  }

  update = async (req: Request, res: Response) => {
    try {
      const { body, params } = (req as ValidatedAuthRequest<typeof UpdateBranchSchema>).validated
      const branch = await branchesService.update(params.id, body, req.user?.id ?? '')
      sendSuccess(res, branch, 'Branch updated')
    } catch (error: unknown) {
      await handleError(res, error, req, { action: 'update_branch', id: req.params.id })
    }
  }

  getById = async (req: Request, res: Response) => {
    try {
      const { id } = (req as ValidatedAuthRequest<typeof branchIdSchema>).validated.params
      const branch = await branchesService.getById(id)
      sendSuccess(res, branch, 'Branch retrieved')
    } catch (error: unknown) {
      await handleError(res, error, req, { action: 'get_branch', id: req.params.id })
    }
  }

  delete = async (req: Request, res: Response) => {
    try {
      const { id } = (req as ValidatedAuthRequest<typeof branchIdSchema>).validated.params
      await branchesService.delete(id, req.user?.id ?? '')
      sendSuccess(res, null, 'Branch deleted')
    } catch (error: unknown) {
      await handleError(res, error, req, { action: 'delete_branch', id: req.params.id })
    }
  }

  search = async (req: Request, res: Response) => {
    try {
      const { page, limit, offset } = getPaginationParams(req.query)
      const q = String(req.query.q || '')
      const result = await branchesService.search(q, { page, limit, offset }, req.sort, req.queryFilter)
      sendSuccess(res, result.data, 'Search completed', 200, result.pagination)
    } catch (error: unknown) {
      await handleError(res, error, req, { action: 'search_branches' })
    }
  }

  getFilterOptions = async (req: Request, res: Response) => {
    try {
      const options = await branchesService.getFilterOptions()
      sendSuccess(res, options, 'Filter options retrieved')
    } catch (error: unknown) {
      await handleError(res, error, req, { action: 'get_filter_options' })
    }
  }

  minimalActive = async (req: Request, res: Response) => {
    try {
      const branches = await branchesService.minimalActive()
      sendSuccess(res, branches, 'Branches retrieved')
    } catch (error: unknown) {
      await handleError(res, error, req, { action: 'get_minimal_active' })
    }
  }

  bulkUpdateStatus = async (req: Request, res: Response) => {
    try {
      const { ids, status } = (req as ValidatedAuthRequest<typeof BulkUpdateStatusSchema>).validated.body
      await branchesService.bulkUpdateStatus(ids, status, req.user?.id ?? '')
      sendSuccess(res, null, 'Status updated')
    } catch (error: unknown) {
      await handleError(res, error, req, { action: 'bulk_update_status' })
    }
  }

  closeBranch = async (req: Request, res: Response) => {
    try {
      const { params } = (req as ValidatedAuthRequest<typeof branchIdSchema>).validated
      const reason = req.body?.reason as string
      if (!reason || reason.trim().length < 5) {
        sendError(res, 'Alasan penutupan wajib diisi (minimal 5 karakter)', 400)
        return
      }
      const userId = req.user?.id
      if (!userId) {
        sendError(res, 'Authentication required', 401)
        return
      }
      const branch = await branchesService.closeBranch(params.id, userId, reason.trim())
      sendSuccess(res, branch, 'Cabang berhasil ditutup secara permanen')
    } catch (error: unknown) {
      await handleError(res, error, req, { action: 'close_branch' })
    }
  }
}

export const branchesController = new BranchesController()
