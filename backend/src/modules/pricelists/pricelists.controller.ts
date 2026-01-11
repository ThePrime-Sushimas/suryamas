import { Response } from 'express'
import { pricelistsService } from './pricelists.service'
import { sendSuccess } from '../../utils/response.util'
import { handleError } from '../../utils/error-handler.util'
import { withValidated } from '../../utils/handler'
import type { ValidatedAuthRequest } from '../../middleware/validation.middleware'
import {
  createPricelistSchema,
  updatePricelistSchema,
  pricelistIdSchema,
  pricelistListQuerySchema,
  approvalSchema,
  lookupPriceSchema,
} from './pricelists.schema'

type CreatePricelistReq = ValidatedAuthRequest<typeof createPricelistSchema>
type UpdatePricelistReq = ValidatedAuthRequest<typeof updatePricelistSchema>
type PricelistIdReq = ValidatedAuthRequest<typeof pricelistIdSchema>
type PricelistListReq = ValidatedAuthRequest<typeof pricelistListQuerySchema>
type ApprovalReq = ValidatedAuthRequest<typeof approvalSchema>
type LookupPriceReq = ValidatedAuthRequest<typeof lookupPriceSchema>

export class PricelistsController {
  create = withValidated(async (req: CreatePricelistReq, res: Response) => {
    try {
      const { body } = req.validated
      const userId = req.context?.employee_id
      const pricelist = await pricelistsService.createPricelist(body, userId)
      sendSuccess(res, pricelist, 'Pricelist created successfully', 201)
    } catch (error: any) {
      handleError(res, error)
    }
  })

  list = withValidated(async (req: PricelistListReq, res: Response) => {
    try {
      const { query } = req.validated
      const result = await pricelistsService.getPricelists(query)
      sendSuccess(res, result.data, 'Pricelists retrieved successfully', 200, result.pagination)
    } catch (error: any) {
      handleError(res, error)
    }
  })

  findById = withValidated(async (req: PricelistIdReq, res: Response) => {
    try {
      const { params } = req.validated
      const pricelist = await pricelistsService.getPricelistById(params.id)
      sendSuccess(res, pricelist, 'Pricelist retrieved successfully')
    } catch (error: any) {
      handleError(res, error)
    }
  })

  update = withValidated(async (req: UpdatePricelistReq, res: Response) => {
    try {
      const { params, body } = req.validated
      const userId = req.context?.employee_id
      const pricelist = await pricelistsService.updatePricelist(params.id, body, userId)
      sendSuccess(res, pricelist, 'Pricelist updated successfully')
    } catch (error: any) {
      handleError(res, error)
    }
  })

  delete = withValidated(async (req: PricelistIdReq, res: Response) => {
    try {
      const { params } = req.validated
      const userId = req.context?.employee_id
      await pricelistsService.deletePricelist(params.id, userId)
      sendSuccess(res, null, 'Pricelist deleted successfully')
    } catch (error: any) {
      handleError(res, error)
    }
  })

  approve = withValidated(async (req: ApprovalReq, res: Response) => {
    try {
      const { params, body } = req.validated
      const userId = req.context?.employee_id
      const pricelist = await pricelistsService.approvePricelist(params.id, body, userId)
      sendSuccess(res, pricelist, `Pricelist ${body.status.toLowerCase()} successfully`)
    } catch (error: any) {
      handleError(res, error)
    }
  })

  restore = withValidated(async (req: PricelistIdReq, res: Response) => {
    try {
      const { params } = req.validated
      const userId = req.context?.employee_id
      const pricelist = await pricelistsService.restorePricelist(params.id, userId)
      sendSuccess(res, pricelist, 'Pricelist restored successfully')
    } catch (error: any) {
      handleError(res, error)
    }
  })

  lookupPrice = withValidated(async (req: LookupPriceReq, res: Response) => {
    try {
      const { query } = req.validated
      const pricelist = await pricelistsService.lookupPrice(query)
      if (!pricelist) {
        sendSuccess(res, null, 'No active pricelist found', 404)
        return
      }
      sendSuccess(res, pricelist, 'Price found successfully')
    } catch (error: any) {
      handleError(res, error)
    }
  })
}

export const pricelistsController = new PricelistsController()
