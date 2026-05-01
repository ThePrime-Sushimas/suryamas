import { Request, Response } from 'express'
import { pricelistsService } from './pricelists.service'
import { sendSuccess } from '../../utils/response.util'
import { handleError } from '../../utils/error-handler.util'
import type { ValidatedAuthRequest } from '../../middleware/validation.middleware'
import {
  createPricelistSchema, updatePricelistSchema, pricelistIdSchema,
  pricelistListQuerySchema, approvalSchema, lookupPriceSchema,
} from './pricelists.schema'

type CreateReq = ValidatedAuthRequest<typeof createPricelistSchema>
type UpdateReq = ValidatedAuthRequest<typeof updatePricelistSchema>
type IdReq = ValidatedAuthRequest<typeof pricelistIdSchema>
type ListReq = ValidatedAuthRequest<typeof pricelistListQuerySchema>
type ApprovalReq = ValidatedAuthRequest<typeof approvalSchema>
type LookupReq = ValidatedAuthRequest<typeof lookupPriceSchema>

export class PricelistsController {
  create = async (req: Request, res: Response) => {
    try {
      const { body } = (req as CreateReq).validated
      const pricelist = await pricelistsService.createPricelist(body, req.context?.employee_id)
      sendSuccess(res, pricelist, 'Pricelist created successfully', 201)
    } catch (error: unknown) {
      await handleError(res, error, req, { action: 'create_pricelist' })
    }
  }

  list = async (req: Request, res: Response) => {
    try {
      const { query } = (req as ListReq).validated
      const result = await pricelistsService.getPricelists(query)
      sendSuccess(res, result.data, 'Pricelists retrieved successfully', 200, result.pagination)
    } catch (error: unknown) {
      await handleError(res, error, req, { action: 'list_pricelists' })
    }
  }

  findById = async (req: Request, res: Response) => {
    try {
      const { id } = (req as IdReq).validated.params
      const pricelist = await pricelistsService.getPricelistById(id)
      sendSuccess(res, pricelist, 'Pricelist retrieved successfully')
    } catch (error: unknown) {
      await handleError(res, error, req, { action: 'get_pricelist', id: req.params.id })
    }
  }

  update = async (req: Request, res: Response) => {
    try {
      const { params, body } = (req as UpdateReq).validated
      const pricelist = await pricelistsService.updatePricelist(params.id, body, req.context?.employee_id)
      sendSuccess(res, pricelist, 'Pricelist updated successfully')
    } catch (error: unknown) {
      await handleError(res, error, req, { action: 'update_pricelist', id: req.params.id })
    }
  }

  delete = async (req: Request, res: Response) => {
    try {
      const { id } = (req as IdReq).validated.params
      await pricelistsService.deletePricelist(id, req.context?.employee_id)
      sendSuccess(res, null, 'Pricelist deleted successfully')
    } catch (error: unknown) {
      await handleError(res, error, req, { action: 'delete_pricelist', id: req.params.id })
    }
  }

  approve = async (req: Request, res: Response) => {
    try {
      const { params, body } = (req as ApprovalReq).validated
      const pricelist = await pricelistsService.approvePricelist(params.id, body, req.context?.employee_id)
      sendSuccess(res, pricelist, `Pricelist ${body.status.toLowerCase()} successfully`)
    } catch (error: unknown) {
      await handleError(res, error, req, { action: 'approve_pricelist', id: req.params.id })
    }
  }

  restore = async (req: Request, res: Response) => {
    try {
      const { id } = (req as IdReq).validated.params
      const pricelist = await pricelistsService.restorePricelist(id, req.context?.employee_id)
      sendSuccess(res, pricelist, 'Pricelist restored successfully')
    } catch (error: unknown) {
      await handleError(res, error, req, { action: 'restore_pricelist', id: req.params.id })
    }
  }

  lookupPrice = async (req: Request, res: Response) => {
    try {
      const { query } = (req as LookupReq).validated
      const pricelist = await pricelistsService.lookupPrice(query)
      if (!pricelist) {
        sendSuccess(res, null, 'No active pricelist found')
        return
      }
      sendSuccess(res, pricelist, 'Price found successfully')
    } catch (error: unknown) {
      await handleError(res, error, req, { action: 'lookup_price' })
    }
  }
}

export const pricelistsController = new PricelistsController()
