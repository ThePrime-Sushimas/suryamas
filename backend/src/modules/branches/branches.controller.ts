import { Response } from 'express'
import { AuthRequest } from '../../types/common.types'
import { branchesService } from './branches.service'
import { sendSuccess, sendError } from '../../utils/response.util'
import { logError } from '../../config/logger'

export class BranchesController {
  list = async (req: AuthRequest & { sort?: any; filter?: any }, res: Response): Promise<void> => {
    try {
      const page = parseInt(req.query.page as string) || 1
      const limit = parseInt(req.query.limit as string) || 10
      const result = await branchesService.list(
        { page, limit },
        req.sort,
        req.filter
      )
      res.json({
        success: true,
        data: result.data,
        pagination: result.pagination,
        message: 'Branches retrieved successfully'
      })
    } catch (error: any) {
      logError('List branches failed', { error: error.message })
      sendError(res, 'Failed to retrieve branches', 500)
    }
  }

  search = async (req: AuthRequest & { sort?: any; filter?: any }, res: Response): Promise<void> => {
    try {
      const q = (req.query.q as string) || ''
      const page = parseInt(req.query.page as string) || 1
      const limit = parseInt(req.query.limit as string) || 10
      const result = await branchesService.search(
        q,
        { page, limit },
        req.sort,
        req.filter
      )
      res.json({
        success: true,
        data: result.data,
        pagination: result.pagination,
        message: 'Search completed'
      })
    } catch (error: any) {
      logError('Search branches failed', { error: error.message })
      sendError(res, 'Search failed', 500)
    }
  }

  getById = async (req: AuthRequest, res: Response): Promise<void> => {
    try {
      const { id } = req.params
      const branch = await branchesService.getById(id)

      if (!branch) {
        sendError(res, 'Branch not found', 404)
        return
      }

      sendSuccess(res, branch, 'Branch retrieved successfully')
    } catch (error: any) {
      logError('Get branch failed', { error: error.message })
      sendError(res, 'Failed to retrieve branch', 500)
    }
  }

  create = async (req: AuthRequest, res: Response): Promise<void> => {
    try {
      const branch = await branchesService.create(req.body, req.user?.id)
      sendSuccess(res, branch, 'Branch created successfully', 201)
    } catch (error: any) {
      logError('Create branch failed', { error: error.message })
      sendError(res, error.message || 'Failed to create branch', 400)
    }
  }

  update = async (req: AuthRequest, res: Response): Promise<void> => {
    try {
      const { id } = req.params
      const branch = await branchesService.update(id, req.body, req.user?.id)
      sendSuccess(res, branch, 'Branch updated successfully')
    } catch (error: any) {
      logError('Update branch failed', { error: error.message })
      sendError(res, error.message || 'Failed to update branch', 400)
    }
  }

  delete = async (req: AuthRequest, res: Response): Promise<void> => {
    try {
      const { id } = req.params
      await branchesService.delete(id, req.user?.id)
      sendSuccess(res, null, 'Branch deleted successfully')
    } catch (error: any) {
      logError('Delete branch failed', { error: error.message })
      sendError(res, error.message || 'Failed to delete branch', 400)
    }
  }

  bulkUpdateStatus = async (req: AuthRequest, res: Response): Promise<void> => {
    try {
      const { ids, status } = req.body
      await branchesService.bulkUpdateStatus(ids, status, req.user?.id)
      sendSuccess(res, null, 'Status updated successfully')
    } catch (error: any) {
      logError('Bulk update status failed', { error: error.message })
      sendError(res, error.message || 'Failed to update status', 400)
    }
  }

  getFilterOptions = async (req: AuthRequest, res: Response): Promise<void> => {
    try {
      const options = await branchesService.getFilterOptions()
      sendSuccess(res, options, 'Filter options retrieved successfully')
    } catch (error: any) {
      logError('Get filter options failed', { error: error.message })
      sendError(res, 'Failed to retrieve filter options', 500)
    }
  }

  minimalActive = async (req: AuthRequest, res: Response): Promise<void> => {
    try {
      const branches = await branchesService.minimalActive()
      sendSuccess(res, branches, 'Branches retrieved successfully')
    } catch (error: any) {
      logError('Get minimal branches failed', { error: error.message })
      sendError(res, 'Failed to retrieve branches', 500)
    }
  }
}

export const branchesController = new BranchesController()
