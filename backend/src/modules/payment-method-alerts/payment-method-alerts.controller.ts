import type { Request, Response } from 'express'
import type { ParsedQs } from 'qs'
import { paymentMethodAlertsService } from './payment-method-alerts.service'
import { sendSuccess } from '../../utils/response.util'
import { handleError } from '../../utils/error-handler.util'

class PaymentMethodAlertsController {
  async list(req: Request, res: Response) {
    try {
      const companyId = req.context?.company_id
      if (!companyId) { res.status(400).json({ success: false, message: 'Company context required' }); return }
      const data = await paymentMethodAlertsService.list(companyId)
      sendSuccess(res, data, 'Alerts retrieved')
    } catch (error) {
      await handleError(res, error, req, { action: 'list_alerts' })
    }
  }

  async create(req: Request, res: Response) {
    try {
      const companyId = req.context?.company_id
      const userId = req.context?.employee_id || req.user?.id
      if (!companyId || !userId) { res.status(400).json({ success: false, message: 'Context required' }); return }
      
      const alert = await paymentMethodAlertsService.create(companyId, (req as any).validated.body, userId)
      sendSuccess(res, alert, 'Alert created', 201)
    } catch (error) {
      await handleError(res, error, req, { action: 'create_alert' })
    }
  }

  async update(req: Request, res: Response) {
    try {
      const companyId = req.context?.company_id
      const userId = req.context?.employee_id || req.user?.id
      if (!companyId || !userId) { res.status(400).json({ success: false, message: 'Context required' }); return }
      const { id } = (req as any).validated.params
      const alert = await paymentMethodAlertsService.update(id, companyId, (req as any).validated.body, userId)
      sendSuccess(res, alert, 'Alert updated')
    } catch (error) {
      await handleError(res, error, req, { action: 'update_alert' })
    }
  }

  async delete(req: Request, res: Response) {
    try {
      const companyId = req.context?.company_id
      const userId = req.context?.employee_id || req.user?.id
      if (!companyId || !userId) { res.status(400).json({ success: false, message: 'Context required' }); return }
      const { id } = (req as any).validated.params
      await paymentMethodAlertsService.delete(id, companyId, userId)
      sendSuccess(res, null, 'Alert deleted')
    } catch (error) {
      await handleError(res, error, req, { action: 'delete_alert' })
    }
  }

  async test(req: Request, res: Response) {
    try {
      const companyId = req.context?.company_id
      if (!companyId) { res.status(400).json({ success: false, message: 'Context required' }); return }
      const { id } = (req as any).validated.params
      await paymentMethodAlertsService.testAlert(id, companyId)
      sendSuccess(res, null, 'Test alert sent')
    } catch (error) {
      await handleError(res, error, req, { action: 'test_alert' })
    }
  }

  async getHistory(req: Request, res: Response) {
    try {
      const companyId = req.context?.company_id
      if (!companyId) { res.status(400).json({ success: false, message: 'Company context required' }); return }
      
      // Helper to handle Express query parameter types
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
      
      // Ensure page and limit are positive integers
      if (filters.page < 1) filters.page = 1
      if (filters.limit < 1 || filters.limit > 100) filters.limit = 25
      
      const data = await paymentMethodAlertsService.getHistory(companyId, filters)
      sendSuccess(res, data, 'Alert history retrieved')
    } catch (error) {
      await handleError(res, error, req, { action: 'get_alert_history' })
    }
  }

  async getHistoryById(req: Request, res: Response) {
    try {
      const companyId = req.context?.company_id
      if (!companyId) { res.status(400).json({ success: false, message: 'Company context required' }); return }
      
      // Handle req.params.id which can be string | string[]
      const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id
      if (!id) { res.status(400).json({ success: false, message: 'Invalid ID parameter' }); return }
      
      const data = await paymentMethodAlertsService.getHistoryById(id, companyId)
      sendSuccess(res, data, 'Alert history detail retrieved')
    } catch (error) {
      await handleError(res, error, req, { action: 'get_alert_history_detail' })
    }
  }
}

export const paymentMethodAlertsController = new PaymentMethodAlertsController()
