import type { Request, Response } from 'express'
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
      
      // Fix: Proper type conversion dari req.query strings dengan validation
      const rawPaymentMethodId = req.query.payment_method_id as string | undefined
      const rawPage = req.query.page as string | undefined
      const rawLimit = req.query.limit as string | undefined
      
      const filters = {
        start_date: req.query.start_date as string | undefined,
        end_date: req.query.end_date as string | undefined,
        payment_method_id: rawPaymentMethodId && !isNaN(Number(rawPaymentMethodId))
          ? Number(rawPaymentMethodId) 
          : undefined,
        page: rawPage && !isNaN(Number(rawPage)) ? Number(rawPage) : 1,
        limit: rawLimit && !isNaN(Number(rawLimit)) ? Number(rawLimit) : 25,
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
      const { id } = req.params
      const data = await paymentMethodAlertsService.getHistoryById(id, companyId)
      sendSuccess(res, data, 'Alert history detail retrieved')
    } catch (error) {
      await handleError(res, error, req, { action: 'get_alert_history_detail' })
    }
  }
}

export const paymentMethodAlertsController = new PaymentMethodAlertsController()
