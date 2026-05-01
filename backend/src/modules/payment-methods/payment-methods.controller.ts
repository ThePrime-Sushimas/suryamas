import { Request, Response } from 'express'
import { paymentMethodsService } from './payment-methods.service'
import { sendSuccess } from '../../utils/response.util'
import { handleError } from '../../utils/error-handler.util'
import { handleExportToken, handleExport } from '../../utils/export.util'
import type { ValidatedAuthRequest } from '../../middleware/validation.middleware'
import {
  createPaymentMethodSchema,
  updatePaymentMethodSchema,
  paymentMethodIdSchema,
  bulkUpdateStatusSchema,
  bulkDeleteSchema,
} from './payment-methods.schema'
import type { CreatePaymentMethodDto, UpdatePaymentMethodDto } from './payment-methods.types'

type CreateReq = ValidatedAuthRequest<typeof createPaymentMethodSchema>
type UpdateReq = ValidatedAuthRequest<typeof updatePaymentMethodSchema>
type IdReq = ValidatedAuthRequest<typeof paymentMethodIdSchema>
type BulkStatusReq = ValidatedAuthRequest<typeof bulkUpdateStatusSchema>
type BulkDeleteReq = ValidatedAuthRequest<typeof bulkDeleteSchema>

function getCompanyId(req: Request): string {
  const companyId = req.context?.company_id
  if (!companyId) throw new Error('Branch context required - no company access')
  return companyId
}

export class PaymentMethodsController {
  list = async (req: Request, res: Response) => {
    try {
      const companyId = getCompanyId(req)
      const pagination = req.pagination!
      if (pagination.limit > 1000) pagination.limit = 1000

      const result = await paymentMethodsService.list(companyId, pagination, req.sort, req.filterParams)
      sendSuccess(res, result.data, 'Payment methods retrieved', 200, result.pagination)
    } catch (error: unknown) {
      await handleError(res, error, req, { action: 'list_payment_methods' })
    }
  }

  create = async (req: Request, res: Response) => {
    try {
      const companyId = getCompanyId(req)
      const { body } = (req as CreateReq).validated
      const paymentMethod = await paymentMethodsService.create(
        { ...body, company_id: companyId } as CreatePaymentMethodDto,
        req.user?.id ?? ''
      )
      sendSuccess(res, paymentMethod, 'Payment method created', 201)
    } catch (error: unknown) {
      await handleError(res, error, req, { action: 'create_payment_method' })
    }
  }

  getById = async (req: Request, res: Response) => {
    try {
      const companyId = getCompanyId(req)
      const id = parseInt((req as IdReq).validated.params.id)
      const paymentMethod = await paymentMethodsService.getById(id, companyId)
      sendSuccess(res, paymentMethod)
    } catch (error: unknown) {
      await handleError(res, error, req, { action: 'get_payment_method', id: req.params.id })
    }
  }

  update = async (req: Request, res: Response) => {
    try {
      const companyId = getCompanyId(req)
      const validated = (req as UpdateReq).validated
      const id = parseInt(validated.params.id)
      const paymentMethod = await paymentMethodsService.update(id, validated.body as UpdatePaymentMethodDto, req.user?.id ?? '', companyId)
      sendSuccess(res, paymentMethod, 'Payment method updated')
    } catch (error: unknown) {
      await handleError(res, error, req, { action: 'update_payment_method', id: req.params.id })
    }
  }

  delete = async (req: Request, res: Response) => {
    try {
      const companyId = getCompanyId(req)
      const id = parseInt((req as IdReq).validated.params.id)
      await paymentMethodsService.delete(id, req.user?.id ?? '', companyId)
      sendSuccess(res, null, 'Payment method deleted')
    } catch (error: unknown) {
      await handleError(res, error, req, { action: 'delete_payment_method', id: req.params.id })
    }
  }

  bulkUpdateStatus = async (req: Request, res: Response) => {
    try {
      const companyId = getCompanyId(req)
      const { ids, is_active } = (req as BulkStatusReq).validated.body
      await paymentMethodsService.bulkUpdateStatus(ids, is_active, req.user?.id ?? '', companyId)
      sendSuccess(res, null, 'Bulk status update completed')
    } catch (error: unknown) {
      await handleError(res, error, req, { action: 'bulk_update_status' })
    }
  }

  bulkDelete = async (req: Request, res: Response) => {
    try {
      const companyId = getCompanyId(req)
      const { ids } = (req as BulkDeleteReq).validated.body
      await paymentMethodsService.bulkDelete(ids, req.user?.id ?? '', companyId)
      sendSuccess(res, null, 'Bulk delete completed')
    } catch (error: unknown) {
      await handleError(res, error, req, { action: 'bulk_delete_payment_methods' })
    }
  }

  generateExportToken = async (req: Request, res: Response) => {
    return handleExportToken(req, res)
  }

  exportData = async (req: Request, res: Response) => {
    try {
      const companyId = getCompanyId(req)
      return handleExport(req, res, (filter) => paymentMethodsService.exportToExcel(companyId, filter), 'payment-methods')
    } catch (error: unknown) {
      await handleError(res, error, req, { action: 'export_payment_methods' })
    }
  }

  getOptions = async (req: Request, res: Response) => {
    try {
      const companyId = getCompanyId(req)
      const options = await paymentMethodsService.getOptions(companyId)
      sendSuccess(res, options, 'Payment method options retrieved')
    } catch (error: unknown) {
      await handleError(res, error, req, { action: 'get_payment_method_options' })
    }
  }
}

export const paymentMethodsController = new PaymentMethodsController()
