import { Request, Response } from 'express'
import { productUomsService } from './product-uoms.service'
import { sendSuccess } from '../../utils/response.util'
import { handleError } from '../../utils/error-handler.util'
import type { ValidatedAuthRequest } from '../../middleware/validation.middleware'
import {
  productUomIdSchema,
  productUomListSchema,
  createProductUomSchema,
  updateProductUomSchema,
  purchaseUnitsBatchSchema,
} from './product-uoms.schema'

type ListReq = ValidatedAuthRequest<typeof productUomListSchema>
type IdReq = ValidatedAuthRequest<typeof productUomIdSchema>
type CreateReq = ValidatedAuthRequest<typeof createProductUomSchema>
type UpdateReq = ValidatedAuthRequest<typeof updateProductUomSchema>
type BatchReq = ValidatedAuthRequest<typeof purchaseUnitsBatchSchema>

export class ProductUomsController {
  list = async (req: Request, res: Response) => {
    try {
      const { productId } = (req as ListReq).validated.params
      const includeDeleted = req.query.includeDeleted === 'true'
      const uoms = await productUomsService.getByProductId(productId, includeDeleted)
      sendSuccess(res, uoms, 'UOMs retrieved successfully')
    } catch (error: unknown) {
      await handleError(res, error, req, { action: 'list_product_uoms', productId: req.params.productId })
    }
  }

  create = async (req: Request, res: Response) => {
    try {
      const { params, body } = (req as CreateReq).validated
      const uom = await productUomsService.create(params.productId, body, req.user?.id)
      sendSuccess(res, uom, 'UOM created successfully', 201)
    } catch (error: unknown) {
      await handleError(res, error, req, { action: 'create_product_uom', productId: req.params.productId })
    }
  }

  update = async (req: Request, res: Response) => {
    try {
      const { params, body } = (req as UpdateReq).validated
      const uom = await productUomsService.update(params.uomId, body, req.user?.id)
      sendSuccess(res, uom, 'UOM updated successfully')
    } catch (error: unknown) {
      await handleError(res, error, req, { action: 'update_product_uom', uomId: req.params.uomId })
    }
  }

  delete = async (req: Request, res: Response) => {
    try {
      const { uomId } = (req as IdReq).validated.params
      await productUomsService.delete(uomId, req.user?.id)
      sendSuccess(res, null, 'UOM deleted successfully')
    } catch (error: unknown) {
      await handleError(res, error, req, { action: 'delete_product_uom', uomId: req.params.uomId })
    }
  }

  restore = async (req: Request, res: Response) => {
    try {
      const { uomId } = (req as IdReq).validated.params
      const uom = await productUomsService.restore(uomId, req.user?.id)
      sendSuccess(res, uom, 'UOM restored successfully')
    } catch (error: unknown) {
      await handleError(res, error, req, { action: 'restore_product_uom', uomId: req.params.uomId })
    }
  }

  getPurchaseUnit = async (req: Request, res: Response) => {
    try {
      const { productId } = (req as ListReq).validated.params
      const uom = await productUomsService.getPurchaseUnit(productId)
      sendSuccess(res, uom, 'Purchase unit retrieved successfully')
    } catch (error: unknown) {
      await handleError(res, error, req, { action: 'get_purchase_unit', productId: req.params.productId })
    }
  }

  getPurchaseUnitsBatch = async (req: Request, res: Response) => {
    try {
      const { product_ids } = (req as BatchReq).validated.body
      const result = await productUomsService.getPurchaseUnitsBatch(product_ids)
      sendSuccess(res, result, 'Purchase units retrieved')
    } catch (error: unknown) {
      await handleError(res, error, req, { action: 'get_purchase_units_batch' })
    }
  }

  getConversionsBatch = async (req: Request, res: Response) => {
    try {
      const { product_ids } = (req as BatchReq).validated.body
      const result = await productUomsService.getConversionsBatch(product_ids)
      sendSuccess(res, result, 'Conversions retrieved')
    } catch (error: unknown) {
      await handleError(res, error, req, { action: 'get_conversions_batch' })
    }
  }
}

export const productUomsController = new ProductUomsController()
