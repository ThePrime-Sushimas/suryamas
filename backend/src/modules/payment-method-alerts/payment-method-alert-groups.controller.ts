import type { Request, Response } from 'express'
import { paymentMethodAlertGroupsService } from './payment-method-alert-groups.service'
import { sendSuccess } from '../../utils/response.util'
import { handleError } from '../../utils/error-handler.util'
import { getReadScope, getWriteScope } from '../../utils/branch-access.util'
import type { CreateAlertGroupDto, UpdateAlertGroupDto } from './payment-method-alert-groups.types'

class PaymentMethodAlertGroupsController {
  async list(req: Request, res: Response) {
    try {
      const { companyIds } = await getReadScope(req)
      const data = await paymentMethodAlertGroupsService.list(companyIds)
      sendSuccess(res, data, 'Alert groups retrieved')
    } catch (error) {
      await handleError(res, error, req, { action: 'list_alert_groups' })
    }
  }

  async create(req: Request, res: Response) {
    try {
      const { companyId, userId } = await getWriteScope(req)
      const body = (req as { validated: { body: CreateAlertGroupDto } }).validated.body
      const group = await paymentMethodAlertGroupsService.create(companyId, body, userId)
      sendSuccess(res, group, 'Alert group created', 201)
    } catch (error) {
      await handleError(res, error, req, { action: 'create_alert_group' })
    }
  }

  async update(req: Request, res: Response) {
    try {
      const { companyIds, userId } = await getReadScope(req)
      const validated = (req as { validated: { params: { id: string }; body: UpdateAlertGroupDto } }).validated
      const existing = await paymentMethodAlertGroupsService.getById(validated.params.id, companyIds)
      const group = await paymentMethodAlertGroupsService.update(validated.params.id, existing.company_id, validated.body, userId, existing)
      sendSuccess(res, group, 'Alert group updated')
    } catch (error) {
      await handleError(res, error, req, { action: 'update_alert_group' })
    }
  }

  async delete(req: Request, res: Response) {
    try {
      const { companyIds, userId } = await getReadScope(req)
      const { params } = (req as { validated: { params: { id: string } } }).validated
      const existing = await paymentMethodAlertGroupsService.getById(params.id, companyIds)
      await paymentMethodAlertGroupsService.delete(params.id, existing.company_id, userId, existing)
      sendSuccess(res, null, 'Alert group deleted')
    } catch (error) {
      await handleError(res, error, req, { action: 'delete_alert_group' })
    }
  }

  async test(req: Request, res: Response) {
    try {
      const { companyIds } = await getReadScope(req)
      const { params } = (req as { validated: { params: { id: string } } }).validated
      const existing = await paymentMethodAlertGroupsService.getById(params.id, companyIds)
      await paymentMethodAlertGroupsService.testAlert(params.id, existing.company_id, existing)
      sendSuccess(res, null, 'Test alert group sent')
    } catch (error) {
      await handleError(res, error, req, { action: 'test_alert_group' })
    }
  }
}

export const paymentMethodAlertGroupsController = new PaymentMethodAlertGroupsController()
