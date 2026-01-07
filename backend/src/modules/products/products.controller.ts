import { Response, Request } from 'express'
import { productsService } from './products.service'
import { productsExportService } from '../../services/products.export.service'
import { productsImportService } from '../../services/products.import.service'
import { sendSuccess } from '../../utils/response.util'
import { handleError } from '../../utils/error-handler.util'
import { logInfo } from '../../config/logger'
import { withValidated } from '../../utils/handler'
import type { AuthenticatedQueryRequest, AuthenticatedRequest } from '../../types/request.types'
import type { ValidatedRequest } from '../../middleware/validation.middleware'
import {
  createProductSchema,
  updateProductSchema,
  bulkDeleteSchema,
  bulkUpdateStatusSchema,
  bulkRestoreSchema,
  productIdSchema,
} from './products.schema'

type CreateProductReq = ValidatedRequest<typeof createProductSchema>
type UpdateProductReq = ValidatedRequest<typeof updateProductSchema>
type BulkDeleteReq = ValidatedRequest<typeof bulkDeleteSchema>
type BulkUpdateStatusReq = ValidatedRequest<typeof bulkUpdateStatusSchema>
type BulkRestoreReq = ValidatedRequest<typeof bulkRestoreSchema>
type ProductIdReq = ValidatedRequest<typeof productIdSchema>

export class ProductsController {
  list = async (req: AuthenticatedQueryRequest, res: Response): Promise<void> => {
    try {
      const page = req.pagination?.page || parseInt(req.query.page as string) || 1
      const limit = req.pagination?.limit || parseInt(req.query.limit as string) || 10
      const includeDeleted = req.query.includeDeleted === 'true'
      
      const result = await productsService.list(
        { page, limit },
        req.sort,
        req.filterParams,
        includeDeleted
      )
      
      sendSuccess(res, result.data, 'Products retrieved successfully', 200, result.pagination)
    } catch (error: any) {
      handleError(res, error)
    }
  }

  search = async (req: AuthenticatedQueryRequest, res: Response): Promise<void> => {
    try {
      const q = (req.query.q as string) || ''
      const page = req.pagination?.page || parseInt(req.query.page as string) || 1
      const limit = req.pagination?.limit || parseInt(req.query.limit as string) || 10
      const includeDeleted = req.query.includeDeleted === 'true'
      
      const result = await productsService.search(
        q,
        { page, limit },
        req.sort,
        req.filterParams,
        includeDeleted
      )
      
      sendSuccess(res, result.data, 'Search completed', 200, result.pagination)
    } catch (error: any) {
      handleError(res, error)
    }
  }

  findById = withValidated(async (req: ProductIdReq, res: Response) => {
    try {
      const { params } = req.validated
      const includeDeleted = req.query.includeDeleted === 'true'
      const product = await productsService.findById(params.id, includeDeleted)
      sendSuccess(res, product, 'Product retrieved successfully')
    } catch (error: any) {
      handleError(res, error)
    }
  })

  create = withValidated(async (req: CreateProductReq, res: Response) => {
    try {
      const product = await productsService.create(req.validated.body, (req as any).user?.id)
      logInfo('Product created via API', { 
        productId: product.id, 
        userId: (req as any).user?.id
      })
      sendSuccess(res, product, 'Product created successfully', 201)
    } catch (error: any) {
      handleError(res, error)
    }
  })

  update = withValidated(async (req: UpdateProductReq, res: Response) => {
    try {
      const { params, body } = req.validated
      const product = await productsService.update(params.id, body, (req as any).user?.id)
      logInfo('Product updated via API', { 
        productId: params.id, 
        userId: (req as any).user?.id
      })
      sendSuccess(res, product, 'Product updated successfully')
    } catch (error: any) {
      handleError(res, error)
    }
  })

  delete = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    try {
      const { id } = req.params
      await productsService.delete(id, req.user?.id)
      sendSuccess(res, null, 'Product deleted successfully')
    } catch (error: any) {
      handleError(res, error)
    }
  }

  bulkDelete = withValidated(async (req: BulkDeleteReq, res: Response) => {
    try {
      const { ids } = req.validated.body
      await productsService.bulkDelete(ids, (req as any).user?.id)
      sendSuccess(res, null, 'Products deleted successfully')
    } catch (error: any) {
      handleError(res, error)
    }
  })

  bulkUpdateStatus = withValidated(async (req: BulkUpdateStatusReq, res: Response) => {
    try {
      const { ids, status } = req.validated.body
      await productsService.bulkUpdateStatus(ids, status, (req as any).user?.id)
      sendSuccess(res, null, 'Status updated successfully')
    } catch (error: any) {
      handleError(res, error)
    }
  })

  getFilterOptions = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    try {
      const options = await productsService.getFilterOptions()
      sendSuccess(res, options, 'Filter options retrieved successfully')
    } catch (error: any) {
      handleError(res, error)
    }
  }

  minimalActive = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    try {
      const products = await productsService.minimalActive()
      sendSuccess(res, products, 'Products retrieved successfully')
    } catch (error: any) {
      handleError(res, error)
    }
  }

  checkProductName = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    try {
      const { product_name, excludeId } = req.query
      const exists = await productsService.checkProductNameExists(
        product_name as string, 
        excludeId as string
      )
      sendSuccess(res, { exists }, 'Check completed')
    } catch (error: any) {
      handleError(res, error)
    }
  }

  restore = withValidated(async (req: ProductIdReq, res: Response) => {
    try {
      const { params } = req.validated
      const product = await productsService.restore(params.id, (req as any).user?.id)
      sendSuccess(res, product, 'Product restored successfully')
    } catch (error: any) {
      handleError(res, error)
    }
  })

  bulkRestore = withValidated(async (req: BulkRestoreReq, res: Response) => {
    try {
      const { ids } = req.validated.body
      await productsService.bulkRestore(ids, (req as any).user?.id)
      sendSuccess(res, null, 'Products restored successfully')
    } catch (error: any) {
      handleError(res, error)
    }
  })

  export = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    try {
      const buffer = await productsExportService.export()
      res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet')
      res.setHeader('Content-Disposition', 'attachment; filename=products.xlsx')
      res.send(buffer)
    } catch (error: any) {
      handleError(res, error)
    }
  }

  importPreview = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    try {
      if (!req.file) {
        res.status(400).json({ success: false, error: 'No file uploaded' })
        return
      }
      const preview = await productsImportService.preview(req.file.buffer)
      sendSuccess(res, preview, 'Import preview generated')
    } catch (error: any) {
      handleError(res, error)
    }
  }

  import = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    try {
      if (!req.file) {
        res.status(400).json({ success: false, error: 'No file uploaded' })
        return
      }
      const result = await productsImportService.import(req.file.buffer, req.user?.id)
      sendSuccess(res, result, 'Import completed')
    } catch (error: any) {
      handleError(res, error)
    }
  }
}

export const productsController = new ProductsController()
