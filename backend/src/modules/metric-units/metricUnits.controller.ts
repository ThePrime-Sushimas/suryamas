import { Response } from 'express'
import { AuthRequest } from '../../types/common.types'
import { metricUnitsService } from './metricUnits.service'
import { sendSuccess, sendError } from '../../utils/response.util'
import { logInfo, logError } from '../../config/logger'
import { PaginatedRequest } from '../../middleware/pagination.middleware'
import { SortRequest } from '../../middleware/sort.middleware'
import { FilterRequest } from '../../middleware/filter.middleware'

export class MetricUnitsController {
  async list(req: PaginatedRequest & SortRequest & FilterRequest, res: Response) {
    try {
      const result = await metricUnitsService.list(req.pagination, req.sort, req.filterParams)
      res.json({ success: true, data: result.data, pagination: result.pagination })
    } catch (error) {
      logError('Failed to list metric units', { error: (error as Error).message })
      sendError(res, (error as Error).message, 400)
    }
  }

  async listActive(req: PaginatedRequest & SortRequest, res: Response) {
    try {
      const result = await metricUnitsService.listActive(req.pagination, req.sort)
      res.json({ success: true, data: result.data, pagination: result.pagination })
    } catch (error) {
      logError('Failed to list active metric units', { error: (error as Error).message })
      sendError(res, (error as Error).message, 400)
    }
  }

  async getById(req: AuthRequest, res: Response) {
    try {
      const id = req.params.id
      if (!id) return sendError(res, 'Invalid ID', 400)

      const metricUnit = await metricUnitsService.getById(id)
      sendSuccess(res, metricUnit)
    } catch (error) {
      const msg = (error as Error).message
      sendError(res, msg, msg.includes('not found') ? 404 : 400)
    }
  }

  async create(req: AuthRequest, res: Response) {
    try {
      const metricUnit = await metricUnitsService.create(req.body, req.user?.id)
      logInfo('Metric unit created', { id: metricUnit.id })
      sendSuccess(res, metricUnit, 'Created', 201)
    } catch (error) {
      const msg = (error as Error).message
      if (msg.startsWith('409:')) {
        return sendError(res, msg.replace('409: ', ''), 409)
      }
      sendError(res, msg, msg.includes('Invalid') ? 400 : 500)
    }
  }

  async update(req: AuthRequest, res: Response) {
    try {
      const id = req.params.id
      if (!id) return sendError(res, 'Invalid ID', 400)

      const metricUnit = await metricUnitsService.update(id, req.body, req.user?.id)
      logInfo('Metric unit updated', { id })
      sendSuccess(res, metricUnit, 'Updated')
    } catch (error) {
      const msg = (error as Error).message
      if (msg.startsWith('409:')) {
        return sendError(res, msg.replace('409: ', ''), 409)
      }
      sendError(res, msg, msg.includes('not found') ? 404 : msg.includes('Invalid') ? 400 : 500)
    }
  }

  async delete(req: AuthRequest, res: Response) {
    try {
      const id = req.params.id
      if (!id) return sendError(res, 'Invalid ID', 400)

      await metricUnitsService.delete(id, req.user?.id)
      logInfo('Metric unit deleted', { id })
      sendSuccess(res, null, 'Deleted')
    } catch (error) {
      const msg = (error as Error).message
      sendError(res, msg, msg.includes('not found') ? 404 : 500)
    }
  }

  async bulkUpdateStatus(req: AuthRequest, res: Response) {
    try {
      const { ids, is_active } = req.body
      if (!Array.isArray(ids) || ids.length === 0) {
        return sendError(res, 'ids must be non-empty array', 400)
      }
      if (typeof is_active !== 'boolean') {
        return sendError(res, 'is_active must be boolean', 400)
      }

      await metricUnitsService.bulkUpdateStatus(ids, is_active, req.user?.id)
      logInfo('Bulk status updated', { count: ids.length })
      sendSuccess(res, null, 'Updated')
    } catch (error) {
      sendError(res, (error as Error).message, 400)
    }
  }

  async getFilterOptions(req: AuthRequest, res: Response) {
    try {
      const options = await metricUnitsService.filterOptions()
      sendSuccess(res, options)
    } catch (error) {
      sendError(res, (error as Error).message, 400)
    }
  }
}

export const metricUnitsController = new MetricUnitsController()
