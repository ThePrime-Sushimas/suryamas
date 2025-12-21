import { Response } from 'express'
import { AuthRequest } from '../../types/common.types'
import { productUomsService } from './product-uoms.service'
import { sendSuccess, sendError } from '../../utils/response.util'
import { logError } from '../../config/logger'

export class ProductUomsController {
  list = async (req: AuthRequest, res: Response): Promise<void> => {
    try {
      const { productId } = req.params
      const { includeDeleted } = req.query
      const uoms = await productUomsService.getByProductId(productId, includeDeleted === 'true')
      sendSuccess(res, uoms, 'UOMs retrieved successfully')
    } catch (error: any) {
      logError('List UOMs failed', { error: error.message })
      sendError(res, 'Failed to retrieve UOMs', 500)
    }
  }

  create = async (req: AuthRequest, res: Response): Promise<void> => {
    try {
      const { productId } = req.params
      const uom = await productUomsService.create(productId, req.body, req.user?.id)
      sendSuccess(res, uom, 'UOM created successfully', 201)
    } catch (error: any) {
      logError('Create UOM failed', { error: error.message })
      sendError(res, error.message || 'Failed to create UOM', 400)
    }
  }

  update = async (req: AuthRequest, res: Response): Promise<void> => {
    try {
      const { uomId } = req.params
      const uom = await productUomsService.update(uomId, req.body, req.user?.id)
      sendSuccess(res, uom, 'UOM updated successfully')
    } catch (error: any) {
      logError('Update UOM failed', { error: error.message })
      sendError(res, error.message || 'Failed to update UOM', 400)
    }
  }

  delete = async (req: AuthRequest, res: Response): Promise<void> => {
    try {
      const { uomId } = req.params
      await productUomsService.delete(uomId, req.user?.id)
      sendSuccess(res, null, 'UOM deleted successfully')
    } catch (error: any) {
      logError('Delete UOM failed', { error: error.message })
      sendError(res, error.message || 'Failed to delete UOM', 400)
    }
  }

  restore = async (req: AuthRequest, res: Response): Promise<void> => {
    try {
      const { uomId } = req.params
      const uom = await productUomsService.restore(uomId, req.user?.id)
      sendSuccess(res, uom, 'UOM restored successfully')
    } catch (error: any) {
      logError('Restore UOM failed', { error: error.message })
      sendError(res, error.message || 'Failed to restore UOM', 400)
    }
  }
}

export const productUomsController = new ProductUomsController()
