import { Response, Request } from 'express'
import { AuthRequest } from '../../types/common.types'
import { productUomsService } from './product-uoms.service'
import { sendSuccess } from '../../utils/response.util'
import { handleError } from '../../utils/error-handler.util'
import { withValidated } from '../../utils/handler'
import type { ValidatedRequest } from '../../middleware/validation.middleware'
import {
  productUomIdSchema,
  createProductUomSchema,
  updateProductUomSchema,
} from './product-uoms.schema'

type ProductUomIdReq = ValidatedRequest<typeof productUomIdSchema>
type CreateProductUomReq = ValidatedRequest<typeof createProductUomSchema>
type UpdateProductUomReq = ValidatedRequest<typeof updateProductUomSchema>


export class ProductUomsController {
  list = async (req: AuthRequest, res: Response): Promise<void> => {
    try {
      const { productId } = req.params
      const { includeDeleted } = req.query
      const uoms = await productUomsService.getByProductId(productId, includeDeleted === 'true')
      sendSuccess(res, uoms, 'UOMs retrieved successfully')
    } catch (error: any) {
      handleError(res, error)
    }
  }

  create = withValidated(async (req: CreateProductUomReq, res: Response) => {
    try {
      const { productId } = req.validated.params
      const uom = await productUomsService.create(productId, req.validated.body, (req as any).user?.id)
      sendSuccess(res, uom, 'UOM created successfully', 201)
    } catch (error: any) {
      handleError(res, error)
    }
  })

  update = withValidated(async (req: UpdateProductUomReq, res: Response) => {
    try {
      const { uomId } = req.validated.params
      const uom = await productUomsService.update(uomId, req.validated.body, (req as any).user?.id)
      sendSuccess(res, uom, 'UOM updated successfully')
    } catch (error: any) {
      handleError(res, error)
    }
  })

  delete = async (req: AuthRequest, res: Response): Promise<void> => {
    try {
      const { uomId } = req.params
      await productUomsService.delete(uomId, req.user?.id)
      sendSuccess(res, null, 'UOM deleted successfully')
    } catch (error: any) {
      handleError(res, error)
    }
  }

  restore = async (req: AuthRequest, res: Response): Promise<void> => {
    try {
      const { uomId } = req.params
      const uom = await productUomsService.restore(uomId, req.user?.id)
      sendSuccess(res, uom, 'UOM restored successfully')
    } catch (error: any) {
      handleError(res, error)
    }
  }
}

export const productUomsController = new ProductUomsController()
