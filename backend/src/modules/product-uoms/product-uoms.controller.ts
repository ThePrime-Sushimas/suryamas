import { Response } from 'express'
import { AuthRequest } from '../../types/common.types'
import { productUomsService } from './product-uoms.service'
import { sendSuccess } from '../../utils/response.util'
import { handleError } from '../../utils/error-handler.util'

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

  create = async (req: AuthRequest, res: Response): Promise<void> => {
    try {
      const { productId } = req.params
      const uom = await productUomsService.create(productId, req.body, req.user?.id)
      sendSuccess(res, uom, 'UOM created successfully', 201)
    } catch (error: any) {
      handleError(res, error)
    }
  }

  update = async (req: AuthRequest, res: Response): Promise<void> => {
    try {
      const { uomId } = req.params
      const uom = await productUomsService.update(uomId, req.body, req.user?.id)
      sendSuccess(res, uom, 'UOM updated successfully')
    } catch (error: any) {
      handleError(res, error)
    }
  }

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
