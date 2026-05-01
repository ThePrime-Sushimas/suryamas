import { Request, Response } from 'express'
import { paymentTermsService } from './payment-terms.service'
import { sendSuccess } from '../../utils/response.util'
import { handleError } from '../../utils/error-handler.util'
import type { ValidatedAuthRequest } from '../../middleware/validation.middleware'
import {
  createPaymentTermSchema,
  updatePaymentTermSchema,
  paymentTermIdSchema,
} from './payment-terms.schema'
import type { CreatePaymentTermDto, UpdatePaymentTermDto } from './payment-terms.types'

type CreateReq = ValidatedAuthRequest<typeof createPaymentTermSchema>
type UpdateReq = ValidatedAuthRequest<typeof updatePaymentTermSchema>
type IdReq = ValidatedAuthRequest<typeof paymentTermIdSchema>

export class PaymentTermsController {
  list = async (req: Request, res: Response) => {
    try {
      const page = req.pagination?.page ?? 1
      const limit = req.pagination?.limit ?? 10
      const includeDeleted = req.query.includeDeleted === 'true'
      const q = req.query.q as string | undefined

      const filter = { ...req.filterParams }
      if (q) filter.search = q

      const result = await paymentTermsService.list({ page, limit }, req.sort, filter, includeDeleted)
      sendSuccess(res, result.data, 'Payment terms retrieved successfully', 200, result.pagination)
    } catch (error: unknown) {
      await handleError(res, error, req, { action: 'list_payment_terms' })
    }
  }

  findById = async (req: Request, res: Response) => {
    try {
      const id = parseInt((req as IdReq).validated.params.id)
      const includeDeleted = req.query.includeDeleted === 'true'
      const term = await paymentTermsService.findById(id, includeDeleted)
      sendSuccess(res, term, 'Payment term retrieved successfully')
    } catch (error: unknown) {
      await handleError(res, error, req, { action: 'get_payment_term', id: req.params.id })
    }
  }

  create = async (req: Request, res: Response) => {
    try {
      const { body } = (req as CreateReq).validated
      const term = await paymentTermsService.create(body as CreatePaymentTermDto, req.user?.id)
      sendSuccess(res, term, 'Payment term created successfully', 201)
    } catch (error: unknown) {
      await handleError(res, error, req, { action: 'create_payment_term' })
    }
  }

  update = async (req: Request, res: Response) => {
    try {
      const validated = (req as UpdateReq).validated
      const id = parseInt(validated.params.id)
      const term = await paymentTermsService.update(id, validated.body as UpdatePaymentTermDto, req.user?.id)
      sendSuccess(res, term, 'Payment term updated successfully')
    } catch (error: unknown) {
      await handleError(res, error, req, { action: 'update_payment_term', id: req.params.id })
    }
  }

  delete = async (req: Request, res: Response) => {
    try {
      const id = parseInt((req as IdReq).validated.params.id)
      await paymentTermsService.delete(id, req.user?.id)
      sendSuccess(res, null, 'Payment term deleted successfully')
    } catch (error: unknown) {
      await handleError(res, error, req, { action: 'delete_payment_term', id: req.params.id })
    }
  }

  restore = async (req: Request, res: Response) => {
    try {
      const id = parseInt((req as IdReq).validated.params.id)
      const term = await paymentTermsService.restore(id, req.user?.id)
      sendSuccess(res, term, 'Payment term restored successfully')
    } catch (error: unknown) {
      await handleError(res, error, req, { action: 'restore_payment_term', id: req.params.id })
    }
  }

  minimalActive = async (req: Request, res: Response) => {
    try {
      const terms = await paymentTermsService.minimalActive()
      sendSuccess(res, terms, 'Payment terms retrieved successfully')
    } catch (error: unknown) {
      await handleError(res, error, req, { action: 'get_minimal_active_payment_terms' })
    }
  }
}

export const paymentTermsController = new PaymentTermsController()
