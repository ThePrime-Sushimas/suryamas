import type { Request, Response } from 'express'
import { goodsReceiptsService } from './goods-receipts.service'
import { sendSuccess } from '../../utils/response.util'
import { handleError } from '../../utils/error-handler.util'
import type { ValidatedAuthRequest } from '../../middleware/validation.middleware'
import type { createGoodsReceiptSchema, confirmGoodsReceiptSchema, goodsReceiptIdSchema } from './goods-receipts.schema'

type CreateReq = ValidatedAuthRequest<typeof createGoodsReceiptSchema>
type ConfirmReq = ValidatedAuthRequest<typeof confirmGoodsReceiptSchema>
type IdReq = ValidatedAuthRequest<typeof goodsReceiptIdSchema>

export class GoodsReceiptsController {
  list = async (req: Request, res: Response) => {
    try {
      const companyId = req.context?.company_id ?? ''
      const page = parseInt(req.query.page as string) || 1
      const limit = parseInt(req.query.limit as string) || 25

      const filter: Record<string, string | undefined> = {}
      if (req.query.status) filter.status = req.query.status as string
      if (req.query.po_id) filter.po_id = req.query.po_id as string
      if (req.query.branch_id) filter.branch_id = req.query.branch_id as string
      if (req.query.date_from) filter.date_from = req.query.date_from as string
      if (req.query.date_to) filter.date_to = req.query.date_to as string

      const result = await goodsReceiptsService.list(companyId, { page, limit }, filter)
      sendSuccess(res, result.data, 'Goods receipts retrieved', 200, result.pagination)
    } catch (error: unknown) {
      await handleError(res, error, req, { action: 'list_goods_receipts' })
    }
  }

  getById = async (req: Request, res: Response) => {
    try {
      const { id } = (req as IdReq).validated.params
      const companyId = req.context?.company_id ?? ''
      const gr = await goodsReceiptsService.getById(id, companyId)
      sendSuccess(res, gr, 'Goods receipt retrieved')
    } catch (error: unknown) {
      await handleError(res, error, req, { action: 'get_goods_receipt', id: req.params.id })
    }
  }

  create = async (req: Request, res: Response) => {
    try {
      const { body } = (req as CreateReq).validated
      const companyId = req.context?.company_id ?? ''
      const userId = req.user?.id ?? ''
      const gr = await goodsReceiptsService.create(companyId, body, userId)
      sendSuccess(res, gr, 'Goods receipt created', 201)
    } catch (error: unknown) {
      await handleError(res, error, req, { action: 'create_goods_receipt' })
    }
  }

  confirm = async (req: Request, res: Response) => {
    try {
      const { params, body } = (req as ConfirmReq).validated
      const companyId = req.context?.company_id ?? ''
      const userId = req.user?.id ?? ''
      const gr = await goodsReceiptsService.confirm(params.id, companyId, userId, body?.invoice_photo_url)
      sendSuccess(res, gr, 'Goods receipt confirmed — stock & journal created')
    } catch (error: unknown) {
      await handleError(res, error, req, { action: 'confirm_goods_receipt', id: req.params.id })
    }
  }

  delete = async (req: Request, res: Response) => {
    try {
      const { id } = (req as IdReq).validated.params
      const companyId = req.context?.company_id ?? ''
      const userId = req.user?.id ?? ''
      await goodsReceiptsService.delete(id, companyId, userId)
      sendSuccess(res, null, 'Goods receipt deleted')
    } catch (error: unknown) {
      await handleError(res, error, req, { action: 'delete_goods_receipt', id: req.params.id })
    }
  }
}

export const goodsReceiptsController = new GoodsReceiptsController()
