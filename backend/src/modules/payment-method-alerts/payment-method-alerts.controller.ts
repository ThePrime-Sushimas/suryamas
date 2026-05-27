import type { Request, Response } from 'express'
import type { ParsedQs } from 'qs'
import { paymentMethodAlertsService } from './payment-method-alerts.service'
import { sendSuccess } from '../../utils/response.util'
import { handleError } from '../../utils/error-handler.util'
import { getReadScope, getWriteScope } from '../../utils/branch-access.util'

class PaymentMethodAlertsController {
  async list(req: Request, res: Response) {
    try {
      const { companyIds } = await getReadScope(req)
      const data = await paymentMethodAlertsService.list(companyIds)
      sendSuccess(res, data, 'Alerts retrieved')
    } catch (error) {
      await handleError(res, error, req, { action: 'list_alerts' })
    }
  }

  async create(req: Request, res: Response) {
    try {
      const { companyId, userId } = await getWriteScope(req)
      const alert = await paymentMethodAlertsService.create(companyId, (req as { validated: { body: Parameters<typeof paymentMethodAlertsService.create>[1] } }).validated.body, userId)
      sendSuccess(res, alert, 'Alert created', 201)
    } catch (error) {
      await handleError(res, error, req, { action: 'create_alert' })
    }
  }

  async update(req: Request, res: Response) {
    try {
      const { companyIds, userId } = await getReadScope(req)
      const validated = (req as { validated: { params: { id: string }; body: Parameters<typeof paymentMethodAlertsService.update>[2] } }).validated
      const existing = await paymentMethodAlertsService.getById(validated.params.id, companyIds)
      const alert = await paymentMethodAlertsService.update(validated.params.id, existing.company_id, validated.body, userId, existing)
      sendSuccess(res, alert, 'Alert updated')
    } catch (error) {
      await handleError(res, error, req, { action: 'update_alert' })
    }
  }

  async delete(req: Request, res: Response) {
    try {
      const { companyIds, userId } = await getReadScope(req)
      const { params } = (req as { validated: { params: { id: string } } }).validated
      const existing = await paymentMethodAlertsService.getById(params.id, companyIds)
      await paymentMethodAlertsService.delete(params.id, existing.company_id, userId, existing)
      sendSuccess(res, null, 'Alert deleted')
    } catch (error) {
      await handleError(res, error, req, { action: 'delete_alert' })
    }
  }

  async test(req: Request, res: Response) {
    try {
      const { companyIds } = await getReadScope(req)
      const { params } = (req as { validated: { params: { id: string } } }).validated
      const existing = await paymentMethodAlertsService.getById(params.id, companyIds)
      await paymentMethodAlertsService.testAlert(params.id, existing.company_id, existing)
      sendSuccess(res, null, 'Test alert sent')
    } catch (error) {
      await handleError(res, error, req, { action: 'test_alert' })
    }
  }

  async debugCheckAlerts(req: Request, res: Response) {
    try {
      const { companyId } = await getWriteScope(req)
      const salesDate = req.query.date as string || new Date().toISOString().split('T')[0]
      await paymentMethodAlertsService.checkAlerts(companyId, salesDate)
      sendSuccess(res, { companyId, salesDate }, 'Alert check completed')
    } catch (error) {
      await handleError(res, error, req, { action: 'debug_check_alerts' })
    }
  }

  async getHistory(req: Request, res: Response) {
    try {
      const { companyIds } = await getReadScope(req)
      const getQueryParam = (param: string | ParsedQs | (string | ParsedQs)[] | undefined): string | undefined => {
        if (typeof param === 'string') return param
        if (Array.isArray(param) && param.length > 0 && typeof param[0] === 'string') return param[0]
        return undefined
      }

      const filters = {
        start_date: getQueryParam(req.query.start_date),
        end_date: getQueryParam(req.query.end_date),
        payment_method_id: (() => {
          const raw = getQueryParam(req.query.payment_method_id)
          return raw && !isNaN(Number(raw)) ? Number(raw) : undefined
        })(),
        page: (() => {
          const raw = getQueryParam(req.query.page)
          return raw && !isNaN(Number(raw)) ? Number(raw) : 1
        })(),
        limit: (() => {
          const raw = getQueryParam(req.query.limit)
          return raw && !isNaN(Number(raw)) ? Number(raw) : 25
        })(),
      }

      if (filters.page < 1) filters.page = 1
      if (filters.limit < 1 || filters.limit > 100) filters.limit = 25

      const data = await paymentMethodAlertsService.getHistory(companyIds, filters)
      sendSuccess(res, data, 'Alert history retrieved')
    } catch (error) {
      await handleError(res, error, req, { action: 'get_alert_history' })
    }
  }

  async getHistoryById(req: Request, res: Response) {
    try {
      const { companyIds } = await getReadScope(req)
      const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id
      if (!id) { res.status(400).json({ success: false, message: 'Invalid ID parameter' }); return }
      const data = await paymentMethodAlertsService.getHistoryById(id, companyIds)
      sendSuccess(res, data, 'Alert history detail retrieved')
    } catch (error) {
      await handleError(res, error, req, { action: 'get_alert_history_detail' })
    }
  }
}

export const paymentMethodAlertsController = new PaymentMethodAlertsController()
