import { Response, Request } from 'express'
import { metricUnitsService } from './metricUnits.service'
import { sendSuccess } from '../../utils/response.util'
import { logInfo } from '../../config/logger'
import type { AuthenticatedQueryRequest, AuthenticatedRequest } from '../../types/request.types'
import { getPaginationParams } from '../../utils/pagination.util'
import { CreateMetricUnitSchema, UpdateMetricUnitSchema, BulkUpdateStatusSchema, UuidParamSchema } from './metricUnits.schema'
import { handleError } from '../../utils/error-handler.util'
import { getParamString } from '../../utils/validation.util'
import type { ValidatedAuthRequest } from '../../middleware/validation.middleware'

export class MetricUnitsController {
  async list(req: AuthenticatedQueryRequest, res: Response) {
    try {
      const { offset } = getPaginationParams(req.query)
      const filter = { ...(req.filterParams || req.queryFilter) }
      if (req.query.q) filter.q = req.query.q as string

      const result = await metricUnitsService.list({ ...req.pagination, offset }, req.sort, filter)
      sendSuccess(res, result.data, 'Success', 200, result.pagination)
    } catch (error: unknown) {
      await handleError(res, error, req as unknown as Request, { action: 'list_metric_units' })
    }
  }

  async listActive(req: AuthenticatedQueryRequest, res: Response) {
    try {
      const { offset } = getPaginationParams(req.query)
      const result = await metricUnitsService.listActive({ ...req.pagination, offset }, req.sort)
      sendSuccess(res, result.data, 'Success', 200, result.pagination)
    } catch (error: unknown) {
      await handleError(res, error, req as unknown as Request, { action: 'list_active_metric_units' })
    }
  }

  async getById(req: AuthenticatedRequest, res: Response) {
    try {
      UuidParamSchema.parse(req.params)
      const id = getParamString(req.params.id)
      const metricUnit = await metricUnitsService.getById(id)
      logInfo('Metric unit retrieved', { id, userId: req.user?.id })
      sendSuccess(res, metricUnit)
    } catch (error: unknown) {
      await handleError(res, error, req as unknown as Request, { action: 'get_metric_unit', id: req.params?.id })
    }
  }

  async create(req: ValidatedAuthRequest<typeof CreateMetricUnitSchema>, res: Response) {
    try {
      const dto = req.validated.body
      const metricUnit = await metricUnitsService.create(dto, req.user?.id)
      logInfo('Metric unit created', { id: metricUnit.id, userId: req.user?.id })
      sendSuccess(res, metricUnit, 'Created', 201)
    } catch (error: unknown) {
      await handleError(res, error, req as unknown as Request, { action: 'create_metric_unit' })
    }
  }

  async update(req: ValidatedAuthRequest<typeof UpdateMetricUnitSchema>, res: Response) {
    try {
      const { params, body } = req.validated
      const metricUnit = await metricUnitsService.update(params.id, body, req.user?.id)
      logInfo('Metric unit updated', { id: params.id, userId: req.user?.id })
      sendSuccess(res, metricUnit, 'Updated')
    } catch (error: unknown) {
      await handleError(res, error, req as unknown as Request, { action: 'update_metric_unit', id: req.validated?.params?.id })
    }
  }

  async delete(req: AuthenticatedRequest, res: Response) {
    try {
      UuidParamSchema.parse(req.params)
      const id = getParamString(req.params.id)
      await metricUnitsService.delete(id, req.user?.id)
      logInfo('Metric unit deleted', { id, userId: req.user?.id })
      sendSuccess(res, null, 'Deleted')
    } catch (error: unknown) {
      await handleError(res, error, req as unknown as Request, { action: 'delete_metric_unit', id: req.params?.id })
    }
  }

  async restore(req: AuthenticatedRequest, res: Response) {
    try {
      UuidParamSchema.parse(req.params)
      const id = getParamString(req.params.id)
      const metricUnit = await metricUnitsService.restore(id, req.user?.id)
      logInfo('Metric unit restored', { id, userId: req.user?.id })
      sendSuccess(res, metricUnit, 'Restored')
    } catch (error: unknown) {
      await handleError(res, error, req as unknown as Request, { action: 'restore_metric_unit', id: req.params?.id })
    }
  }

  async bulkUpdateStatus(req: ValidatedAuthRequest<typeof BulkUpdateStatusSchema>, res: Response) {
    try {
      const { ids, is_active } = req.validated.body
      await metricUnitsService.bulkUpdateStatus(ids, is_active, req.user?.id)
      logInfo('Bulk status updated', { count: ids.length, is_active, userId: req.user?.id })
      sendSuccess(res, null, 'Updated')
    } catch (error: unknown) {
      await handleError(res, error, req as unknown as Request, { action: 'bulk_update_metric_unit_status' })
    }
  }

  async getFilterOptions(req: AuthenticatedRequest, res: Response) {
    try {
      const options = metricUnitsService.filterOptions()
      sendSuccess(res, options)
    } catch (error: unknown) {
      await handleError(res, error, req as unknown as Request, { action: 'get_metric_unit_filter_options' })
    }
  }
}

export const metricUnitsController = new MetricUnitsController()
