import { Response } from 'express'
import { AuthRequest } from '../../types/common.types'
import { productsService } from './products.service'
import { sendSuccess, sendError } from '../../utils/response.util'
import { logError } from '../../config/logger'

export class ProductsController {
  list = async (req: AuthRequest & { sort?: any; filter?: any }, res: Response): Promise<void> => {
    try {
      const page = parseInt(req.query.page as string) || 1
      const limit = parseInt(req.query.limit as string) || 10
      const includeDeleted = req.query.includeDeleted === 'true'
      const result = await productsService.list(
        { page, limit },
        req.sort,
        req.filter,
        includeDeleted
      )
      res.json({
        success: true,
        data: result.data,
        pagination: result.pagination,
        message: 'Products retrieved successfully'
      })
    } catch (error: any) {
      logError('List products failed', { error: error.message })
      sendError(res, 'Failed to retrieve products', 500)
    }
  }

  search = async (req: AuthRequest & { sort?: any; filter?: any }, res: Response): Promise<void> => {
    try {
      const q = (req.query.q as string) || ''
      const page = parseInt(req.query.page as string) || 1
      const limit = parseInt(req.query.limit as string) || 10
      const includeDeleted = req.query.includeDeleted === 'true'
      const result = await productsService.search(
        q,
        { page, limit },
        req.sort,
        req.filter,
        includeDeleted
      )
      res.json({
        success: true,
        data: result.data,
        pagination: result.pagination,
        message: 'Search completed'
      })
    } catch (error: any) {
      logError('Search products failed', { error: error.message })
      sendError(res, 'Search failed', 500)
    }
  }

  getById = async (req: AuthRequest, res: Response): Promise<void> => {
    try {
      const { id } = req.params
      const includeDeleted = req.query.includeDeleted === 'true'
      const product = await productsService.getById(id, includeDeleted)

      if (!product) {
        sendError(res, 'Product not found', 404)
        return
      }

      if (product.is_deleted && !includeDeleted) {
        sendError(res, 'Product has been deleted', 410)
        return
      }

      sendSuccess(res, product, 'Product retrieved successfully')
    } catch (error: any) {
      logError('Get product failed', { error: error.message })
      sendError(res, 'Failed to retrieve product', 500)
    }
  }

  create = async (req: AuthRequest, res: Response): Promise<void> => {
    try {
      const product = await productsService.create(req.body, req.user?.id)
      sendSuccess(res, product, 'Product created successfully', 201)
    } catch (error: any) {
      logError('Create product failed', { error: error.message })
      sendError(res, error.message || 'Failed to create product', 400)
    }
  }

  update = async (req: AuthRequest, res: Response): Promise<void> => {
    try {
      const { id } = req.params
      const product = await productsService.update(id, req.body, req.user?.id)
      sendSuccess(res, product, 'Product updated successfully')
    } catch (error: any) {
      logError('Update product failed', { error: error.message })
      sendError(res, error.message || 'Failed to update product', 400)
    }
  }

  delete = async (req: AuthRequest, res: Response): Promise<void> => {
    try {
      const { id } = req.params
      await productsService.delete(id, req.user?.id)
      sendSuccess(res, null, 'Product deleted successfully')
    } catch (error: any) {
      logError('Delete product failed', { error: error.message })
      sendError(res, error.message || 'Failed to delete product', 400)
    }
  }

  bulkUpdateStatus = async (req: AuthRequest, res: Response): Promise<void> => {
    try {
      const { ids, status } = req.body
      await productsService.bulkUpdateStatus(ids, status, req.user?.id)
      sendSuccess(res, null, 'Status updated successfully')
    } catch (error: any) {
      logError('Bulk update status failed', { error: error.message })
      sendError(res, error.message || 'Failed to update status', 400)
    }
  }

  getFilterOptions = async (req: AuthRequest, res: Response): Promise<void> => {
    try {
      const options = await productsService.getFilterOptions()
      sendSuccess(res, options, 'Filter options retrieved successfully')
    } catch (error: any) {
      logError('Get filter options failed', { error: error.message })
      sendError(res, 'Failed to retrieve filter options', 500)
    }
  }

  minimalActive = async (req: AuthRequest, res: Response): Promise<void> => {
    try {
      const products = await productsService.minimalActive()
      sendSuccess(res, products, 'Products retrieved successfully')
    } catch (error: any) {
      logError('Get minimal products failed', { error: error.message })
      sendError(res, 'Failed to retrieve products', 500)
    }
  }

  restore = async (req: AuthRequest, res: Response): Promise<void> => {
    try {
      const { id } = req.params
      await productsService.restore(id, req.user?.id)
      const product = await productsService.getById(id, true)
      sendSuccess(res, product, 'Product restored successfully')
    } catch (error: any) {
      logError('Restore product failed', { error: error.message })
      sendError(res, error.message || 'Failed to restore product', 400)
    }
  }
}

export const productsController = new ProductsController()
