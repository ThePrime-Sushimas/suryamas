import { Response, Request } from 'express'
import { AuthRequest } from '../../types/common.types'
import { supplierProductsService } from './supplier-products.service'
import { sendSuccess, sendError } from '../../utils/response.util'
import { handleError } from '../../utils/error-handler.util'
import { logInfo } from '../../config/logger'
import { withValidated } from '../../utils/handler'
import type { ValidatedRequest } from '../../middleware/validation.middleware'
import {
  createSupplierProductSchema,
  updateSupplierProductSchema,
  supplierProductIdSchema,
  bulkDeleteSchema,
} from './supplier-products.schema'

type CreateSupplierProductReq = ValidatedRequest<typeof createSupplierProductSchema>
type UpdateSupplierProductReq = ValidatedRequest<typeof updateSupplierProductSchema>
type SupplierProductIdReq = ValidatedRequest<typeof supplierProductIdSchema>
type BulkDeleteReq = ValidatedRequest<typeof bulkDeleteSchema>


export class SupplierProductsController {
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

  findBySupplier = async (req: AuthRequest, res: Response): Promise<void> => {
    try {
      const supplierId = req.params.supplier_id
      const includeRelations = req.query.include_relations === 'true'

      const supplierProducts = await supplierProductsService.findBySupplier(supplierId, includeRelations)
      sendSuccess(res, supplierProducts, 'Supplier products retrieved successfully')
    } catch (error: any) {
      handleError(res, error)
    }
  }

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

  create = withValidated(async (req: CreateSupplierProductReq, res: Response) => {
    try {
      const body = req.validated.body as any
      const supplierProduct = await supplierProductsService.create({
        ...body,
        lead_time_days: body.lead_time_days ?? undefined,
        min_order_qty: body.min_order_qty ?? undefined,
      }, (req as any).user?.id)
      
      logInfo('Supplier product created via API', { 
        supplierProductId: supplierProduct.id,
        supplierId: supplierProduct.supplier_id,
        productId: supplierProduct.product_id,
        userId: (req as any).user?.id
      })
      
      sendSuccess(res, supplierProduct, 'Supplier product created successfully', 201)
    } catch (error: any) {
      handleError(res, error)
    }
  })

  update = withValidated(async (req: UpdateSupplierProductReq, res: Response) => {
    try {
      const { id } = req.validated.params
      const body = req.validated.body as any
      const supplierProduct = await supplierProductsService.update(id, {
        ...body,
        lead_time_days: body.lead_time_days ?? undefined,
        min_order_qty: body.min_order_qty ?? undefined,
      }, (req as any).user?.id)
      
      logInfo('Supplier product updated via API', { 
        supplierProductId: id,
        userId: (req as any).user?.id
      })
      
      sendSuccess(res, supplierProduct, 'Supplier product updated successfully')
    } catch (error: any) {
      handleError(res, error)
    }
  })

  delete = async (req: AuthRequest, res: Response): Promise<void> => {
    try {
      const { id } = req.params
      await supplierProductsService.delete(id, req.user?.id)
      
      sendSuccess(res, null, 'Supplier product deleted successfully')
    } catch (error: any) {
      handleError(res, error)
    }
  }

  bulkDelete = withValidated(async (req: BulkDeleteReq, res: Response) => {
    try {
      const { ids } = req.validated.body
      await supplierProductsService.bulkDelete(ids, (req as any).user?.id)
      
      sendSuccess(res, null, 'Supplier products deleted successfully')
    } catch (error: any) {
      handleError(res, error)
    }
  })

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
