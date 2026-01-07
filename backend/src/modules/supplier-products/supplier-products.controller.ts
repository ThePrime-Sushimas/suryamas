import { Response } from 'express'
import { AuthRequest } from '../../types/common.types'
import { supplierProductsService } from './supplier-products.service'
import { sendSuccess, sendError } from '../../utils/response.util'
import { handleError } from '../../utils/error-handler.util'
import { logInfo } from '../../config/logger'

export class SupplierProductsController {
  /**
   * List supplier products with pagination and filtering
   * GET /supplier-products
   */
  list = async (req: AuthRequest & { sort?: any; filterParams?: any; pagination?: any }, res: Response): Promise<void> => {
    try {
      const page = req.pagination?.page || parseInt(req.query.page as string) || 1
      const limit = req.pagination?.limit || parseInt(req.query.limit as string) || 10
      const includeRelations = req.query.include_relations === 'true'
      
      const result = await supplierProductsService.list(
        { page, limit },
        req.filterParams,
        includeRelations
      )
      
      sendSuccess(res, result.data, 'Supplier products retrieved successfully', 200, result.pagination)
    } catch (error: any) {
      handleError(res, error)
    }
  }

  /**
   * Get supplier product by ID
   * GET /supplier-products/:id
   */
  findById = async (req: AuthRequest, res: Response): Promise<void> => {
    try {
      const { id } = req.params
      const includeRelations = req.query.include_relations === 'true'
      const supplierProduct = await supplierProductsService.findById(id, includeRelations)

      sendSuccess(res, supplierProduct, 'Supplier product retrieved successfully')
    } catch (error: any) {
      handleError(res, error)
    }
  }

  /**
   * Get supplier products by supplier ID
   * GET /supplier-products/supplier/:supplier_id
   */
  findBySupplier = async (req: AuthRequest, res: Response): Promise<void> => {
    try {
      const supplierId = parseInt(req.params.supplier_id)
      const includeRelations = req.query.include_relations === 'true'
      
      // Input validation and sanitization
      if (isNaN(supplierId) || supplierId <= 0) {
        return sendError(res, 'Invalid supplier ID format', 400)
      }

      const supplierProducts = await supplierProductsService.findBySupplier(supplierId, includeRelations)
      sendSuccess(res, supplierProducts, 'Supplier products retrieved successfully')
    } catch (error: any) {
      handleError(res, error)
    }
  }

  /**
   * Get supplier products by product ID
   * GET /supplier-products/product/:product_id
   */
  findByProduct = async (req: AuthRequest, res: Response): Promise<void> => {
    try {
      const { product_id } = req.params
      const includeRelations = req.query.include_relations === 'true'
      
      const supplierProducts = await supplierProductsService.findByProduct(product_id, includeRelations)
      sendSuccess(res, supplierProducts, 'Supplier products retrieved successfully')
    } catch (error: any) {
      handleError(res, error)
    }
  }

  /**
   * Create new supplier product
   * POST /supplier-products
   */
  create = async (req: AuthRequest, res: Response): Promise<void> => {
    try {
      const supplierProduct = await supplierProductsService.create(req.body, req.user?.id)
      
      logInfo('Supplier product created via API', { 
        supplierProductId: supplierProduct.id,
        supplierId: supplierProduct.supplier_id,
        productId: supplierProduct.product_id,
        userId: req.user?.id
      })
      
      sendSuccess(res, supplierProduct, 'Supplier product created successfully', 201)
    } catch (error: any) {
      handleError(res, error)
    }
  }

  /**
   * Update supplier product
   * PUT /supplier-products/:id
   */
  update = async (req: AuthRequest, res: Response): Promise<void> => {
    try {
      const { id } = req.params
      const supplierProduct = await supplierProductsService.update(id, req.body, req.user?.id)
      
      logInfo('Supplier product updated via API', { 
        supplierProductId: id,
        userId: req.user?.id
      })
      
      sendSuccess(res, supplierProduct, 'Supplier product updated successfully')
    } catch (error: any) {
      handleError(res, error)
    }
  }

  /**
   * Delete supplier product
   * DELETE /supplier-products/:id
   */
  delete = async (req: AuthRequest, res: Response): Promise<void> => {
    try {
      const { id } = req.params
      await supplierProductsService.delete(id, req.user?.id)
      
      sendSuccess(res, null, 'Supplier product deleted successfully')
    } catch (error: any) {
      handleError(res, error)
    }
  }

  /**
   * Bulk delete supplier products
   * POST /supplier-products/bulk/delete
   */
  bulkDelete = async (req: AuthRequest, res: Response): Promise<void> => {
    try {
      const { ids } = req.body
      await supplierProductsService.bulkDelete(ids, req.user?.id)
      
      sendSuccess(res, null, 'Supplier products deleted successfully')
    } catch (error: any) {
      handleError(res, error)
    }
  }

  /**
   * Get active supplier products for dropdown/options
   * GET /supplier-products/options/active
   */
  getActiveOptions = async (req: AuthRequest, res: Response): Promise<void> => {
    try {
      const options = await supplierProductsService.getActiveOptions()
      sendSuccess(res, options, 'Active supplier products retrieved successfully')
    } catch (error: any) {
      handleError(res, error)
    }
  }
}

export const supplierProductsController = new SupplierProductsController()