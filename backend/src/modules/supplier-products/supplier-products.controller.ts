import { Request, Response } from 'express'
import { supplierProductsService } from './supplier-products.service'
import { sendSuccess } from '../../utils/response.util'
import { handleError } from '../../utils/error-handler.util'
import { logInfo } from '../../config/logger'
import type { ValidatedAuthRequest } from '../../middleware/validation.middleware'
import type { SupplierProductWithRelations } from './supplier-products.types'
import {
  createSupplierProductSchema,
  updateSupplierProductSchema,
  supplierProductIdSchema,
  bulkDeleteSchema,
  getBySupplierSchema,
  getByProductSchema,
} from './supplier-products.schema'

export class SupplierProductsController {
  list = async (req: Request, res: Response): Promise<void> => {
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
    } catch (error: unknown) {
      await handleError(res, error, req, { action: 'list' })
    }
  }

  findById = async (req: ValidatedAuthRequest<typeof supplierProductIdSchema>, res: Response): Promise<void> => {
    try {
      const { id } = req.validated.params
      const includeRelations = req.query.include_relations === 'true'
      const includeDeleted = req.query.include_deleted === 'true'
      const supplierProduct = await supplierProductsService.findById(id, includeRelations, includeDeleted)

      sendSuccess(res, supplierProduct, 'Supplier product retrieved successfully')
    } catch (error: unknown) {
      await handleError(res, error, req, { action: 'findById', id: req.validated?.params?.id })
    }
  }

  findBySupplier = async (req: ValidatedAuthRequest<typeof getBySupplierSchema>, res: Response): Promise<void> => {
    try {
      const { supplier_id } = req.validated.params
      const includeRelations = req.query.include_relations === 'true'

      const supplierProducts = await supplierProductsService.findBySupplier(supplier_id, includeRelations)
      sendSuccess(res, supplierProducts, 'Supplier products retrieved successfully')
    } catch (error: unknown) {
      await handleError(res, error, req, { action: 'findBySupplier', supplierId: req.validated?.params?.supplier_id })
    }
  }

  findByProduct = async (req: ValidatedAuthRequest<typeof getByProductSchema>, res: Response): Promise<void> => {
    try {
      const { product_id } = req.validated.params
      const includeRelations = req.query.include_relations === 'true'

      const supplierProducts = await supplierProductsService.findByProduct(product_id, includeRelations)
      sendSuccess(res, supplierProducts, 'Supplier products retrieved successfully')
    } catch (error: unknown) {
      await handleError(res, error, req, { action: 'findByProduct', productId: req.validated?.params?.product_id })
    }
  }

  create = async (req: ValidatedAuthRequest<typeof createSupplierProductSchema>, res: Response): Promise<void> => {
    try {
      const body = req.validated.body
      const supplierProduct = await supplierProductsService.create({
        ...body,
        lead_time_days: body.lead_time_days ?? undefined,
        min_order_qty: body.min_order_qty ?? undefined,
      }, req.user?.id)

      logInfo('Supplier product created via API', {
        supplierProductId: supplierProduct.id,
        supplierId: supplierProduct.supplier_id,
        productId: supplierProduct.product_id,
        userId: req.user?.id
      })

      sendSuccess(res, supplierProduct, 'Supplier product created successfully', 201)
    } catch (error: unknown) {
      await handleError(res, error, req, { action: 'create' })
    }
  }

  update = async (req: ValidatedAuthRequest<typeof updateSupplierProductSchema>, res: Response): Promise<void> => {
    try {
      const { params, body } = req.validated
      const supplierProduct = await supplierProductsService.update(params.id, {
        ...body,
        lead_time_days: body.lead_time_days ?? undefined,
        min_order_qty: body.min_order_qty ?? undefined,
      }, req.user?.id)

      logInfo('Supplier product updated via API', {
        supplierProductId: params.id,
        userId: req.user?.id
      })

      sendSuccess(res, supplierProduct, 'Supplier product updated successfully')
    } catch (error: unknown) {
      await handleError(res, error, req, { action: 'update', id: req.validated?.params?.id })
    }
  }

  delete = async (req: ValidatedAuthRequest<typeof supplierProductIdSchema>, res: Response): Promise<void> => {
    try {
      const { id } = req.validated.params
      await supplierProductsService.delete(id, req.user?.id)

      sendSuccess(res, null, 'Supplier product deleted successfully')
    } catch (error: unknown) {
      await handleError(res, error, req, { action: 'delete', id: req.validated?.params?.id })
    }
  }

  restore = async (req: ValidatedAuthRequest<typeof supplierProductIdSchema>, res: Response): Promise<void> => {
    try {
      const { id } = req.validated.params
      const supplierProduct = await supplierProductsService.restore(id, req.user?.id)

      sendSuccess(res, supplierProduct, 'Supplier product restored successfully')
    } catch (error: unknown) {
      await handleError(res, error, req, { action: 'restore', id: req.validated?.params?.id })
    }
  }

  bulkRestore = async (req: ValidatedAuthRequest<typeof bulkDeleteSchema>, res: Response): Promise<void> => {
    try {
      const { ids } = req.validated.body
      await supplierProductsService.bulkRestore(ids, req.user?.id)

      sendSuccess(res, null, 'Supplier products restored successfully')
    } catch (error: unknown) {
      await handleError(res, error, req, { action: 'bulkRestore' })
    }
  }

  bulkDelete = async (req: ValidatedAuthRequest<typeof bulkDeleteSchema>, res: Response): Promise<void> => {
    try {
      const { ids } = req.validated.body
      await supplierProductsService.bulkDelete(ids, req.user?.id)

      sendSuccess(res, null, 'Supplier products deleted successfully')
    } catch (error: unknown) {
      await handleError(res, error, req, { action: 'bulkDelete' })
    }
  }

  getActiveOptions = async (req: Request, res: Response): Promise<void> => {
    try {
      const options = await supplierProductsService.getActiveOptions()
      sendSuccess(res, options, 'Active supplier products retrieved successfully')
    } catch (error: unknown) {
      await handleError(res, error, req, { action: 'getActiveOptions' })
    }
  }

  exportCSV = async (req: Request, res: Response): Promise<void> => {
    try {
      const { data } = await supplierProductsService.list(
        { page: 1, limit: 10000 },
        req.filterParams,
        true
      )

      const csv = [
        ['Supplier Code', 'Supplier Name', 'Product Code', 'Product Name', 'Price', 'Currency', 'Lead Time (Days)', 'Min Order Qty', 'Preferred', 'Active'].join(','),
        ...(data as SupplierProductWithRelations[]).map((item) => [
          item.supplier?.supplier_code || '',
          item.supplier?.supplier_name || '',
          item.product?.product_code || '',
          item.product?.product_name || '',
          item.price,
          item.currency,
          item.lead_time_days ?? '',
          item.min_order_qty ?? '',
          item.is_preferred ? 'Yes' : 'No',
          item.is_active ? 'Active' : 'Inactive'
        ].join(','))
      ].join('\n')

      res.setHeader('Content-Type', 'text/csv')
      res.setHeader('Content-Disposition', `attachment; filename=supplier-products-${Date.now()}.csv`)
      res.send(csv)
    } catch (error: unknown) {
      await handleError(res, error, req, { action: 'exportCSV' })
    }
  }
}

export const supplierProductsController = new SupplierProductsController()
