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
      const alert = await paymentMethodAlertsService.create(companyId, req.validated as any, userId)
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
}

export const paymentMethodAlertsController = new PaymentMethodAlertsController()
