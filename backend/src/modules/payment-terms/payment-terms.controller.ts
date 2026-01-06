// backend/src/modules/payment-terms/payment-terms.controller.ts

import { Response } from 'express'
import { AuthRequest } from '../../types/common.types'
import { paymentTermsService } from './payment-terms.service'
import { sendSuccess } from '../../utils/response.util'
import { handleError } from '../../utils/error-handler.util'
import { logInfo } from '../../config/logger'

export class PaymentTermsController {
  list = async (req: AuthRequest & { sort?: any; filterParams?: any; pagination?: any }, res: Response): Promise<void> => {
    try {
      const page = req.pagination?.page || parseInt(req.query.page as string) || 1
      const limit = req.pagination?.limit || parseInt(req.query.limit as string) || 10
      const includeDeleted = req.query.includeDeleted === 'true'

      const result = await paymentTermsService.list(
        { page, limit },
        req.sort,
        req.filterParams,
        includeDeleted
      )

      sendSuccess(res, result.data, 'Payment terms retrieved successfully', 200, result.pagination)
    } catch (error: any) {
      handleError(res, error)
    }
  }

  findById = async (req: AuthRequest, res: Response): Promise<void> => {
    try {
      const id = parseInt(req.params.id)
      const includeDeleted = req.query.includeDeleted === 'true'
      const term = await paymentTermsService.findById(id, includeDeleted)

      sendSuccess(res, term, 'Payment term retrieved successfully')
    } catch (error: any) {
      handleError(res, error)
    }
  }

  create = async (req: AuthRequest, res: Response): Promise<void> => {
    try {
      const userId = req.user?.id
      const term = await paymentTermsService.create(req.body, userId)
      logInfo('Payment term created via API', { termId: term.id, userId })
      sendSuccess(res, term, 'Payment term created successfully', 201)
    } catch (error: any) {
      handleError(res, error)
    }
  }

  update = async (req: AuthRequest, res: Response): Promise<void> => {
    try {
      const id = parseInt(req.params.id)
      const userId = req.user?.id
      const term = await paymentTermsService.update(id, req.body, userId)
      logInfo('Payment term updated via API', { termId: id, userId })
      sendSuccess(res, term, 'Payment term updated successfully')
    } catch (error: any) {
      handleError(res, error)
    }
  }

  delete = async (req: AuthRequest, res: Response): Promise<void> => {
    try {
      const id = parseInt(req.params.id)
      const userId = req.user?.id
      await paymentTermsService.delete(id, userId)
      sendSuccess(res, null, 'Payment term deleted successfully')
    } catch (error: any) {
      handleError(res, error)
    }
  }

  restore = async (req: AuthRequest, res: Response): Promise<void> => {
    try {
      const id = parseInt(req.params.id)
      const userId = req.user?.id
      const term = await paymentTermsService.restore(id, userId)
      sendSuccess(res, term, 'Payment term restored successfully')
    } catch (error: any) {
      handleError(res, error)
    }
  }

  minimalActive = async (req: AuthRequest, res: Response): Promise<void> => {
    try {
      const terms = await paymentTermsService.minimalActive()
      sendSuccess(res, terms, 'Payment terms retrieved successfully')
    } catch (error: any) {
      handleError(res, error)
    }
  }
}

export const paymentTermsController = new PaymentTermsController()
