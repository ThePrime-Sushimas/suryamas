import { Request, Response } from 'express'
import { metricUnitsService } from './metricUnits.service'
import { sendSuccess } from '../../utils/response.util'
import { getPaginationParams } from '../../utils/pagination.util'
import { handleError } from '../../utils/error-handler.util'
import type { ValidatedAuthRequest } from '../../middleware/validation.middleware'
import { CreateMetricUnitSchema, UpdateMetricUnitSchema, BulkUpdateStatusSchema, metricUnitIdSchema } from './metricUnits.schema'

type CreateReq = ValidatedAuthRequest<typeof CreateMetricUnitSchema>
type UpdateReq = ValidatedAuthRequest<typeof UpdateMetricUnitSchema>
type BulkStatusReq = ValidatedAuthRequest<typeof BulkUpdateStatusSchema>
type IdReq = ValidatedAuthRequest<typeof metricUnitIdSchema>

export class MetricUnitsController {
  list = async (req: Request, res: Response) => {
    try {
      const { offset } = getPaginationParams(req.query)
      const filter = { ...(req.filterParams || req.queryFilter) }
      if (req.query.q) filter.q = req.query.q as string
      const result = await metricUnitsService.list({ ...req.pagination!, offset }, req.sort, filter)
      sendSuccess(res, result.data, 'Success', 200, result.pagination)
    } catch (error: unknown) {
      await handleError(res, error, req, { action: 'list_metric_units' })
    }
  }

  listActive = async (req: Request, res: Response) => {
    try {
      const { offset } = getPaginationParams(req.query)
      const result = await metricUnitsService.listActive({ ...req.pagination!, offset }, req.sort)
      sendSuccess(res, result.data, 'Success', 200, result.pagination)
    } catch (error: unknown) {
      await handleError(res, error, req, { action: 'list_active_metric_units' })
    }
  }

  getById = async (req: Request, res: Response) => {
    try {
      const { id } = (req as IdReq).validated.params
      const metricUnit = await metricUnitsService.getById(id)
      sendSuccess(res, metricUnit)
    } catch (error: unknown) {
      await handleError(res, error, req, { action: 'get_metric_unit', id: req.params.id })
    }
  }

  create = async (req: Request, res: Response) => {
    try {
      const { body } = (req as CreateReq).validated
      const metricUnit = await metricUnitsService.create(body, req.user?.id)
      sendSuccess(res, metricUnit, 'Created', 201)
    } catch (error: unknown) {
      await handleError(res, error, req, { action: 'create_metric_unit' })
    }
  }

  update = async (req: Request, res: Response) => {
    try {
      const { params, body } = (req as UpdateReq).validated
      const metricUnit = await metricUnitsService.update(params.id, body, req.user?.id)
      sendSuccess(res, metricUnit, 'Updated')
    } catch (error: unknown) {
      await handleError(res, error, req, { action: 'update_metric_unit', id: req.params.id })
    }
  }

  delete = async (req: Request, res: Response) => {
    try {
      const { id } = (req as IdReq).validated.params
      await metricUnitsService.delete(id, req.user?.id)
      sendSuccess(res, null, 'Deleted')
    } catch (error: unknown) {
      await handleError(res, error, req, { action: 'delete_metric_unit', id: req.params.id })
    }
  }

  restore = async (req: Request, res: Response) => {
    try {
      const { id } = (req as IdReq).validated.params
      const metricUnit = await metricUnitsService.restore(id, req.user?.id)
      sendSuccess(res, metricUnit, 'Restored')
    } catch (error: unknown) {
      await handleError(res, error, req, { action: 'restore_metric_unit', id: req.params.id })
    }
  }

  bulkUpdateStatus = async (req: Request, res: Response) => {
    try {
      const { ids, is_active } = (req as BulkStatusReq).validated.body
      await metricUnitsService.bulkUpdateStatus(ids, is_active, req.user?.id)
      sendSuccess(res, null, 'Updated')
    } catch (error: unknown) {
      await handleError(res, error, req, { action: 'bulk_update_metric_unit_status' })
    }
  }

  getFilterOptions = async (req: Request, res: Response) => {
    try {
      const options = metricUnitsService.filterOptions()
      sendSuccess(res, options)
    } catch (error: unknown) {
      await handleError(res, error, req, { action: 'get_metric_unit_filter_options' })
    }
  }
}

export const metricUnitsController = new MetricUnitsController()
