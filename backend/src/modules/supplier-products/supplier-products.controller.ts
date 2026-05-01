import { Request, Response } from 'express'
import type { ValidatedAuthRequest } from '../../middleware/validation.middleware'
import { supplierProductsService } from './supplier-products.service'
import { sendSuccess } from '../../utils/response.util'
import { handleError } from '../../utils/error-handler.util'
import { logInfo } from '../../config/logger'
import type { SupplierProductWithRelations } from './supplier-products.types'
import type {
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
      await handleError(res, error, req, { action: 'list_supplier_products' })
    }
  }

  findById = async (req: Request, res: Response): Promise<void> => {
    try {
      const { params } = (req as ValidatedAuthRequest<typeof supplierProductIdSchema>).validated
      const includeRelations = req.query.include_relations === 'true'
      const includeDeleted = req.query.include_deleted === 'true'
      const supplierProduct = await supplierProductsService.findById(params.id, includeRelations, includeDeleted)

      sendSuccess(res, supplierProduct, 'Supplier product retrieved successfully')
    } catch (error: unknown) {
      await handleError(res, error, req, { action: 'get_supplier_product' })
    }
  }

  findBySupplier = async (req: Request, res: Response): Promise<void> => {
    try {
      const { params } = (req as ValidatedAuthRequest<typeof getBySupplierSchema>).validated
      const includeRelations = req.query.include_relations === 'true'

      const supplierProducts = await supplierProductsService.findBySupplier(params.supplier_id, includeRelations)
      sendSuccess(res, supplierProducts, 'Supplier products retrieved successfully')
    } catch (error: unknown) {
      await handleError(res, error, req, { action: 'get_by_supplier' })
    }
  }

  findByProduct = async (req: Request, res: Response): Promise<void> => {
    try {
      const { params } = (req as ValidatedAuthRequest<typeof getByProductSchema>).validated
      const includeRelations = req.query.include_relations === 'true'

      const supplierProducts = await supplierProductsService.findByProduct(params.product_id, includeRelations)
      sendSuccess(res, supplierProducts, 'Supplier products retrieved successfully')
    } catch (error: unknown) {
      await handleError(res, error, req, { action: 'get_by_product' })
    }
  }

  create = async (req: Request, res: Response): Promise<void> => {
    try {
      const { body } = (req as ValidatedAuthRequest<typeof createSupplierProductSchema>).validated
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
      await handleError(res, error, req, { action: 'create_supplier_product' })
    }
  }

  update = async (req: Request, res: Response): Promise<void> => {
    try {
      const { params, body } = (req as ValidatedAuthRequest<typeof updateSupplierProductSchema>).validated
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
      await handleError(res, error, req, { action: 'update_supplier_product' })
    }
  }

  delete = async (req: Request, res: Response): Promise<void> => {
    try {
      const { params } = (req as ValidatedAuthRequest<typeof supplierProductIdSchema>).validated
      await supplierProductsService.delete(params.id, req.user?.id)
      sendSuccess(res, null, 'Supplier product deleted successfully')
    } catch (error: unknown) {
      await handleError(res, error, req, { action: 'delete_supplier_product' })
    }
  }

  restore = async (req: Request, res: Response): Promise<void> => {
    try {
      const { params } = (req as ValidatedAuthRequest<typeof supplierProductIdSchema>).validated
      const supplierProduct = await supplierProductsService.restore(params.id, req.user?.id)
      sendSuccess(res, supplierProduct, 'Supplier product restored successfully')
    } catch (error: unknown) {
      await handleError(res, error, req, { action: 'restore_supplier_product' })
    }
  }

  bulkRestore = async (req: Request, res: Response): Promise<void> => {
    try {
      const { body } = (req as ValidatedAuthRequest<typeof bulkDeleteSchema>).validated
      await supplierProductsService.bulkRestore(body.ids, req.user?.id)
      sendSuccess(res, null, 'Supplier products restored successfully')
    } catch (error: unknown) {
      await handleError(res, error, req, { action: 'bulk_restore_supplier_products' })
    }
  }

  bulkDelete = async (req: Request, res: Response): Promise<void> => {
    try {
      const { body } = (req as ValidatedAuthRequest<typeof bulkDeleteSchema>).validated
      await supplierProductsService.bulkDelete(body.ids, req.user?.id)
      sendSuccess(res, null, 'Supplier products deleted successfully')
    } catch (error: unknown) {
      await handleError(res, error, req, { action: 'bulk_delete_supplier_products' })
    }
  }

  getActiveOptions = async (req: Request, res: Response): Promise<void> => {
    try {
      const options = await supplierProductsService.getActiveOptions()
      sendSuccess(res, options, 'Active supplier products retrieved successfully')
    } catch (error: unknown) {
      await handleError(res, error, req, { action: 'get_active_options' })
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
      await handleError(res, error, req, { action: 'export_csv_supplier_products' })
    }
  }
}

export const supplierProductsController = new SupplierProductsController()
