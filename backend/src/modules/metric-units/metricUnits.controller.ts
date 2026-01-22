import { Response } from 'express'
import { metricUnitsService } from './metricUnits.service'
import { sendSuccess } from '../../utils/response.util'
import { logInfo } from '../../config/logger'
import { AuthenticatedQueryRequest, AuthenticatedRequest } from '../../types/request.types'
import { getPaginationParams } from '../../utils/pagination.util'
import { CreateMetricUnitSchema, UpdateMetricUnitSchema, BulkUpdateStatusSchema, UuidParamSchema } from './metricUnits.schema'
import { handleError } from '../../utils/error-handler.util'

import { getParamString } from '../../utils/validation.util'
import { ValidatedAuthRequest } from '../../middleware/validation.middleware'

export class MetricUnitsController {
  async list(req: AuthenticatedQueryRequest, res: Response) {
    try {
      const { offset } = getPaginationParams(req.query)
      const filter = { ...(req.filterParams || req.queryFilter) }
      
      // Add search query if present
      if (req.query.q) {
        filter.q = req.query.q as string
      }
      
      const result = await metricUnitsService.list({ ...req.pagination, offset }, req.sort, filter)
      sendSuccess(res, result.data, 'Success', 200, result.pagination)
    } catch (error) {
      handleError(res, error)
    }
  }

  async listActive(req: AuthenticatedQueryRequest, res: Response) {
    try {
      const { offset } = getPaginationParams(req.query)
      const result = await metricUnitsService.listActive({ ...req.pagination, offset }, req.sort)
      sendSuccess(res, result.data, 'Success', 200, result.pagination)
    } catch (error) {
      handleError(res, error)
    }
  }

  async getById(req: AuthenticatedRequest, res: Response) {
    try {
      UuidParamSchema.parse(req.params)
      const metricUnit = await metricUnitsService.getById(getParamString(req.params.id))
      logInfo('Metric unit retrieved', { id: getParamString(req.params.id), userId: req.user?.id })
      sendSuccess(res, metricUnit)
    } catch (error) {
      handleError(res, error)
    }
  }

  async create(req: ValidatedAuthRequest<typeof CreateMetricUnitSchema>, res: Response) {
    try {
      const dto = req.validated.body
      const metricUnit = await metricUnitsService.create(dto, req.user?.id)
      logInfo('Metric unit created', { id: metricUnit.id, userId: req.user?.id })
      sendSuccess(res, metricUnit, 'Created', 201)
    } catch (error) {
      handleError(res, error)
    }
  }

  async update(req: ValidatedAuthRequest<typeof UpdateMetricUnitSchema>, res: Response) {
    try {
      const { params, body } = req.validated
      const metricUnit = await metricUnitsService.update(params.id, body, req.user?.id)
      logInfo('Metric unit updated', { id: params.id, userId: req.user?.id })
      sendSuccess(res, metricUnit, 'Updated')
    } catch (error) {
      handleError(res, error)
    }
  }

  async delete(req: AuthenticatedRequest, res: Response) {
    try {
      UuidParamSchema.parse(req.params)
      await metricUnitsService.delete(getParamString(req.params.id), req.user?.id)
      logInfo('Metric unit deleted', { id: getParamString(req.params.id), userId: req.user?.id })
      sendSuccess(res, null, 'Deleted')
    } catch (error) {
      handleError(res, error)
    }
  }

  async restore(req: AuthenticatedRequest, res: Response) {
    try {
      UuidParamSchema.parse(req.params)
      const metricUnit = await metricUnitsService.restore(getParamString(req.params.id), req.user?.id)
      logInfo('Metric unit restored', { id: getParamString(req.params.id), userId: req.user?.id })
      sendSuccess(res, metricUnit, 'Restored')
    } catch (error) {
      handleError(res, error)
    }
  }

  async bulkUpdateStatus(req: ValidatedAuthRequest<typeof BulkUpdateStatusSchema>, res: Response) {
    try {
      const { ids, is_active } = req.validated.body
      await metricUnitsService.bulkUpdateStatus(ids, is_active, req.user?.id)
      logInfo('Bulk status updated', { count: ids.length, is_active, userId: req.user?.id })
      sendSuccess(res, null, 'Updated')
    } catch (error) {
      handleError(res, error)
    }
  }

  async getFilterOptions(req: AuthenticatedRequest, res: Response) {
    try {
      const options = metricUnitsService.filterOptions()
      sendSuccess(res, options)
    } catch (error) {
      handleError(res, error)
    }
  }
}

export const metricUnitsController = new MetricUnitsController()
